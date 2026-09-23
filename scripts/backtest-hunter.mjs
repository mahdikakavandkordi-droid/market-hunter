import fs from 'node:fs';
import {metrics,isEarlyWatch} from '../api/scan.js';
const symbols=(process.env.BACKTEST_SYMBOLS||'RY.TO,TD.TO,BMO.TO,BNS.TO,CM.TO,NA.TO,SHOP.TO,CSU.TO,OTEX.TO,LUN.TO,ABX.TO,AEM.TO,CNQ.TO,SU.TO,CVE.TO,IMO.TO,CNR.TO,CP.TO,WCN.TO,FTS.TO,EMA.TO,T.TO,BCE.TO,TRP.TO,ENB.TO,ATD.TO,DOL.TO,L.TO,MRU.TO,QSR.TO,CCO.TO,NTR.TO,POW.TO,MFC.TO,SLF.TO,GWO.TO,BN.TO,BAM.TO,WSP.TO,STN.TO,TFII.TO,MG.TO,GIB-A.TO,AAPL.TO,MSFT.TO,NVDA.TO,AMZN.TO,GOOG.TO,META.TO,TSLA.TO').split(',').map(x=>x.trim()).filter(Boolean);
const range=process.env.BACKTEST_RANGE||'2y',horizons=(process.env.BACKTEST_HORIZONS||process.env.BACKTEST_HORIZON||'5,10,20').split(',').map(Number).filter(x=>x>0),maxH=Math.max(...horizons),minDollar=Number(process.env.BACKTEST_MIN_DOLLAR||5000000),warmup=90;
const CDR=new Set(['AAPL.TO','MSFT.TO','NVDA.TO','AMZN.TO','GOOG.TO','META.TO','TSLA.TO','AMD.TO']);
const benchSymbol=s=>CDR.has(s)?'^IXIC':'^GSPTSE',dayKey=t=>new Date(t*1000).toISOString().slice(0,10);
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null,pct=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b?((a/b)-1)*100:null;
async function fetchRows(symbol){const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&includePrePost=false&events=div%2Csplits`;const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 MarketHunterBacktest/1.0'}});if(!r.ok)throw new Error(`${symbol}: HTTP ${r.status}`);const j=await r.json(),z=j?.chart?.result?.[0],q=z?.indicators?.quote?.[0]||{},adj=z?.indicators?.adjclose?.[0]?.adjclose||q.close||[];return(z?.timestamp||[]).map((t,i)=>({t,close:adj[i],rawClose:q.close?.[i],high:q.high?.[i],low:q.low?.[i],volume:q.volume?.[i]})).filter(x=>[x.close,x.rawClose,x.high,x.low,x.volume].every(Number.isFinite)&&x.volume>0)}
function align(rows,date){const i=rows.findIndex(x=>dayKey(x.t)===date);return i>=0?rows.slice(0,i+1):null}
function setups(m,stage){const o=[];if(m.nearRecentLow===true&&(m.sellingPressureFading===true||m.downsideSlowing===true)&&m.ret20<0)o.push('Selling Exhaustion');if(stage==='Recovery')o.push('Recovery');if(m.higherLow===true&&Number.isFinite(m.momentumShift)&&m.momentumShift>0)o.push('Higher-Low Turn');if(m.highState==='local_high_broken')o.push('Local Breakout');if(m.weeklyUp===true&&m.dailyUp===true&&m.pullback<=-2&&m.pullback>=-12)o.push('Pullback in Uptrend');if(m.lowState==='failed_low_break')o.push('Failed Breakdown / Reclaim');return o}
function summary(a){if(!a.length)return null;const r=a.map(x=>x.forwardReturn),v=[...r].sort((a,b)=>a-b),m=Math.floor(v.length/2),ex=a.map(x=>x.excessReturn).filter(Number.isFinite);return{n:r.length,positiveRate:round(r.filter(x=>x>0).length/r.length*100,1),gain7Rate:round(r.filter(x=>x>=7).length/r.length*100,1),loss7Rate:round(r.filter(x=>x<=-7).length/r.length*100,1),mean:round(r.reduce((a,b)=>a+b,0)/r.length),median:round(v.length%2?v[m]:(v[m-1]+v[m])/2),benchmarkBeatRate:ex.length?round(ex.filter(x=>x>0).length/ex.length*100,1):null,meanExcessReturn:ex.length?round(ex.reduce((a,b)=>a+b,0)/ex.length):null}}
function opportunityScore(m,stage,ss){
  let p=0;
  if(stage==='Established Move')p+=12; else if(stage==='Attractive Growth')p+=7; else if(stage==='Early Watch')p+=4;
  if(ss.includes('Failed Breakdown / Reclaim'))p+=14;
  if(ss.includes('Higher-Low Turn'))p+=8;
  if(ss.includes('Selling Exhaustion'))p+=6;
  if(ss.includes('Local Breakout'))p+=5;
  if(Number.isFinite(m.rs20)){if(m.rs20>=4)p+=10;else if(m.rs20>=0)p+=5;else if(m.rs20<-5)p-=10}
  if(Number.isFinite(m.momentumShift)){if(m.momentumShift>=3)p+=8;else if(m.momentumShift>=1)p+=4;else if(m.momentumShift<=-3)p-=9}
  if(m.swingTrend==='Higher highs + higher lows')p+=9;else if(m.swingTrend==='Structure improving')p+=5;else if(m.swingTrend==='Lower highs + lower lows')p-=12;
  if(Number.isFinite(m.upDownVolumeRatio)){if(m.upDownVolumeRatio>=1.2)p+=6;else if(m.upDownVolumeRatio<.8)p-=6}
  if(Number.isFinite(m.roomToResistance)){if(m.roomToResistance>=7)p+=8;else if(m.roomToResistance<3)p-=12}
  if(stage==='Recovery')p-=6;
  return p;
}
function dedupe(a,h){const out=[],last=new Map();for(const e of [...a].sort((x,y)=>x.date.localeCompare(y.date)||x.symbol.localeCompare(y.symbol))){const k=e.symbol+'|'+e.stage+'|'+e.primarySetup,prev=last.get(k);if(prev&&e.sessionIndex-prev<h)continue;out.push(e);last.set(k,e.sessionIndex)}return out}
function setupStrategy(m,stage,ss){
  const pass=[];
  // Each setup gets its own confirmation logic. This is deliberately backtest-only until OOS validation.
  if(ss.includes('Selling Exhaustion')){
    const ok=m.nearRecentLow===true&&(m.sellingPressureFading===true||m.downsideSlowing===true)&&
      Number.isFinite(m.momentumShift)&&m.momentumShift>0&&
      (!Number.isFinite(m.rs20)||m.rs20>-8);
    if(ok)pass.push('Selling Exhaustion');
  }
  if(ss.includes('Recovery')){
    const ok=stage==='Recovery'&&Number.isFinite(m.momentumShift)&&m.momentumShift>=2&&
      Number.isFinite(m.rs20)&&m.rs20>-3&&m.lowState!=='local_low_broken'&&
      (m.higherLow===true||m.swingTrend==='Structure improving'||m.swingTrend==='Higher highs + higher lows');
    if(ok)pass.push('Recovery');
  }
  if(ss.includes('Higher-Low Turn')){
    const ok=m.higherLow===true&&Number.isFinite(m.momentumShift)&&m.momentumShift>=1&&
      Number.isFinite(m.rs20)&&m.rs20>-3&&
      (!Number.isFinite(m.roomToResistance)||m.roomToResistance>=4);
    if(ok)pass.push('Higher-Low Turn');
  }
  if(ss.includes('Local Breakout')){
    const ok=m.highState==='local_high_broken'&&Number.isFinite(m.rs20)&&m.rs20>=0&&
      (m.unusual5dDirection==='positive'||(Number.isFinite(m.upDownVolumeRatio)&&m.upDownVolumeRatio>=1.1));
    if(ok)pass.push('Local Breakout');
  }
  if(ss.includes('Pullback in Uptrend')){
    const ok=m.weeklyUp===true&&m.dailyUp===true&&m.pullback<=-2&&m.pullback>=-10&&
      Number.isFinite(m.rs20)&&m.rs20>=0&&
      (m.higherLow===true||m.swingTrend==='Higher highs + higher lows')&&
      (!Number.isFinite(m.roomToResistance)||m.roomToResistance>=5);
    if(ok)pass.push('Pullback in Uptrend');
  }
  if(ss.includes('Failed Breakdown / Reclaim')){
    const ok=m.lowState==='failed_low_break'&&Number.isFinite(m.momentumShift)&&m.momentumShift>0&&
      (!Number.isFinite(m.rs20)||m.rs20>-5)&&
      (!Number.isFinite(m.upDownVolumeRatio)||m.upDownVolumeRatio>=.85);
    if(ok)pass.push('Failed Breakdown / Reclaim');
  }
  return pass;
}
const needed=[...new Set([...symbols,...symbols.map(benchSymbol)])],data={};for(const s of needed){process.stdout.write(`fetch ${s}... `);try{data[s]=await fetchRows(s);console.log(data[s].length)}catch(e){console.log('SKIP',e.message);data[s]=[]}}
const events=[];for(const symbol of symbols){const rows=data[symbol],bench=data[benchSymbol(symbol)];if(!rows?.length||!bench?.length)continue;for(let i=warmup;i<rows.length-maxH;i++){const hist=rows.slice(0,i+1),date=dayKey(rows[i].t),bh=align(bench,date);if(!bh||bh.length<65)continue;const m=metrics({rows:hist},{rows:bh},null);if(!m||!Number.isFinite(m.avgDollarVol)||m.avgDollarVol<minDollar||rows[i].rawClose<2)continue;const stage=m.stage||(isEarlyWatch(m)?'Early Watch':null);if(!stage)continue;for(const horizon of horizons){const forwardReturn=pct(rows[i+horizon].close,rows[i].close),benchEntry=bh.at(-1)?.close,benchFuture=bench.find(x=>dayKey(x.t)===dayKey(rows[i+horizon].t))?.close,benchmarkReturn=pct(benchFuture,benchEntry);const ss=setups(m,stage),strategyPass=setupStrategy(m,stage,ss),priority=opportunityScore(m,stage,ss);events.push({symbol,date,sessionIndex:i,horizon,stage,setups:ss,primarySetup:ss[0]||'Stage only',strategyPass,strategyQualified:strategyPass.length>0,priority,atr14Pct:m.atr14Pct,upDownVolumeRatio:m.upDownVolumeRatio,roomToResistance:m.roomToResistance,swingTrend:m.swingTrend,entry:round(rows[i].close),exit:round(rows[i+horizon].close),forwardReturn:round(forwardReturn),benchmarkReturn:round(benchmarkReturn),excessReturn:round(Number.isFinite(benchmarkReturn)?forwardReturn-benchmarkReturn:null),momentumShift:m.momentumShift,rs20:m.rs20,roomToResistance:m.roomToResistance,swingTrend:m.swingTrend,upDownVolumeRatio:m.upDownVolumeRatio})}}}
function splitChronologically(a){const dates=[...new Set(a.map(e=>e.date))].sort(),cut=dates[Math.floor(dates.length*.7)]||null;return{cut,train:a.filter(e=>!cut||e.date<cut),test:a.filter(e=>cut&&e.date>=cut)}}
function thresholdReport(a){const thresholds=[10,20,30,40,50],out={};for(const t of thresholds)out[String(t)]=summary(a.filter(e=>e.priority>=t));return out}
function strategyReport(a){const qualified=a.filter(e=>e.strategyQualified),bySetup={};for(const e of qualified)for(const x of e.strategyPass)(bySetup[x]??=[]).push(e);return{qualified:summary(qualified),coverage:a.length?round(qualified.length/a.length*100,1):0,bySetup:Object.fromEntries(Object.entries(bySetup).map(([k,v])=>[k,summary(v)]))}}
function walkForwardReport(a){
  const dates=[...new Set(a.map(e=>e.date))].sort();
  if(dates.length<5)return {folds:[]};
  const folds=[];
  // Expanding-window validation: earlier history is train, each later block is unseen test.
  for(let fold=1;fold<=3;fold++){
    const trainEnd=Math.floor(dates.length*(.4+fold*.1));
    const testEnd=fold<3?Math.floor(dates.length*(.5+fold*.1)):dates.length;
    const cut=dates[trainEnd],end=dates[Math.max(trainEnd,testEnd-1)];
    const train=a.filter(e=>e.date<cut),test=a.filter(e=>e.date>=cut&&e.date<=end);
    folds.push({fold,trainThrough:dates[trainEnd-1]||null,testFrom:cut||null,testThrough:end||null,
      train:strategyReport(train),test:strategyReport(test)});
  }
  return {folds};
}


function v2Candidate(e){
  // Candidate rules are intentionally simple and setup-specific; research only until forward validation.
  if(e.strategyPass?.includes('Higher-Low Turn')){
    return Number.isFinite(e.momentumShift)&&e.momentumShift>=3&&
      Number.isFinite(e.upDownVolumeRatio)&&e.upDownVolumeRatio>=.85&&
      Number.isFinite(e.atr14Pct)&&e.atr14Pct>=3&&e.atr14Pct<6&&
      Number.isFinite(e.rs20)&&e.rs20>=0;
  }
  if(e.strategyPass?.includes('Failed Breakdown / Reclaim')){
    return Number.isFinite(e.atr14Pct)&&e.atr14Pct<3&&
      Number.isFinite(e.rs20)&&e.rs20>=0&&e.rs20<4&&
      Number.isFinite(e.upDownVolumeRatio)&&e.upDownVolumeRatio>=.85&&e.upDownVolumeRatio<1.2;
  }
  return false;
}
function v2Report(a){
  const picked=a.filter(v2Candidate),bySetup={};
  for(const name of ['Higher-Low Turn','Failed Breakdown / Reclaim'])
    bySetup[name]=summary(picked.filter(e=>e.strategyPass?.includes(name)));
  return {picked:summary(picked),coverage:a.length?round(picked.length/a.length*100,1):0,bySetup};
}
function v2WalkForward(a){
  const dates=[...new Set(a.map(e=>e.date))].sort(),folds=[];
  if(dates.length<5)return {folds};
  for(let fold=1;fold<=3;fold++){
    const trainEnd=Math.floor(dates.length*(.4+fold*.1));
    const testEnd=fold<3?Math.floor(dates.length*(.5+fold*.1)):dates.length;
    const cut=dates[trainEnd],end=dates[Math.max(trainEnd,testEnd-1)];
    const train=a.filter(e=>e.date<cut),test=a.filter(e=>e.date>=cut&&e.date<=end);
    folds.push({fold,trainThrough:dates[trainEnd-1]||null,testFrom:cut||null,testThrough:end||null,
      train:v2Report(train),test:v2Report(test)});
  }
  return {folds};
}
function featureBuckets(a){
  const defs={
    rs20:[[-Infinity,0],[0,4],[4,Infinity]],
    momentumShift:[[-Infinity,1],[1,3],[3,Infinity]],
    roomToResistance:[[-Infinity,4],[4,7],[7,Infinity]],
    upDownVolumeRatio:[[-Infinity,.85],[.85,1.2],[1.2,Infinity]],
    atr14Pct:[[-Infinity,3],[3,6],[6,Infinity]]
  },out={};
  for(const setup of ['Failed Breakdown / Reclaim','Higher-Low Turn']){
    const rows=a.filter(e=>e.strategyPass?.includes(setup));out[setup]={};
    for(const [field,bins] of Object.entries(defs)){
      out[setup][field]=bins.map(([lo,hi])=>{
        const x=rows.filter(e=>Number.isFinite(e[field])&&e[field]>=lo&&e[field]<hi);
        return {range:(Number.isFinite(lo)?lo:'-inf')+'..'+(Number.isFinite(hi)?hi:'inf'),...summary(x)};
      });
    }
    out[setup].structure={improving:summary(rows.filter(e=>e.swingTrend==='Structure improving'||e.swingTrend==='Higher highs + higher lows')),
      other:summary(rows.filter(e=>e.swingTrend!=='Structure improving'&&e.swingTrend!=='Higher highs + higher lows'))};
  }
  return out;
}
function setupStability(wf){
  const names=['Recovery','Failed Breakdown / Reclaim','Selling Exhaustion','Local Breakout','Higher-Low Turn','Pullback in Uptrend'],out={};
  for(const name of names){
    const rows=wf.folds.map(f=>({fold:f.fold,...(f.test.bySetup[name]||summary([]))}));
    const usable=rows.filter(x=>x.n>=10);
    out[name]={folds:rows,usableFolds:usable.length,
      positiveFolds:usable.filter(x=>x.positiveRate>50).length,
      benchmarkWinningFolds:usable.filter(x=>x.benchmarkBeatRate>50).length,
      positiveExcessFolds:usable.filter(x=>x.meanExcessReturn>0).length};
  }
  return out;
}
const byHorizon={};for(const horizon of horizons){const raw=events.filter(e=>e.horizon===horizon),he=dedupe(raw,horizon),byStage={},bySetup={};for(const e of he){(byStage[e.stage]??=[]).push(e);for(const x of e.setups)(bySetup[x]??=[]).push(e)}const ranked=[...he].sort((a,b)=>b.priority-a.priority),topQuartile=ranked.slice(0,Math.ceil(ranked.length*.25)),split=splitChronologically(he),trainRanked=[...split.train].sort((a,b)=>b.priority-a.priority),testRanked=[...split.test].sort((a,b)=>b.priority-a.priority);const walkForward=walkForwardReport(he);byHorizon[String(horizon)]={rawObservations:raw.length,independentEvents:he.length,overall:summary(he),topQuartile:summary(topQuartile),byPriority:thresholdReport(he),featureDiagnostics:featureBuckets(he),hunterV2:{overall:v2Report(he),walkForward:v2WalkForward(he)},walkForward:{...walkForward,stability:setupStability(walkForward)},outOfSample:{cutDate:split.cut,train:{overall:summary(split.train),byPriority:thresholdReport(split.train),setupStrategy:strategyReport(split.train),topQuartile:summary(trainRanked.slice(0,Math.ceil(trainRanked.length*.25)))},test:{overall:summary(split.test),byPriority:thresholdReport(split.test),setupStrategy:strategyReport(split.test),topQuartile:summary(testRanked.slice(0,Math.ceil(testRanked.length*.25)))}},byStage:Object.fromEntries(Object.entries(byStage).map(([k,v])=>[k,summary(v)])),bySetup:Object.fromEntries(Object.entries(bySetup).map(([k,v])=>[k,summary(v)]))}}
const result={generatedAt:new Date().toISOString(),range,horizons,minDollar,symbols,validSymbols:symbols.filter(x=>data[x]?.length),totalEvents:events.length,byHorizon,events};fs.mkdirSync('data',{recursive:true});fs.writeFileSync('data/backtest.json',JSON.stringify(result,null,2)+'\n');console.log('\nBACKTEST',JSON.stringify({...result,events:undefined},null,2));
