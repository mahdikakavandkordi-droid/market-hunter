import fs from 'node:fs';
import {metrics,isEarlyWatch} from '../api/scan.js';
const symbols=(process.env.BACKTEST_SYMBOLS||'RY.TO,TD.TO,BMO.TO,BNS.TO,CM.TO,NA.TO,SHOP.TO,CSU.TO,OTEX.TO,LUN.TO,ABX.TO,AEM.TO,CNQ.TO,SU.TO,CVE.TO,IMO.TO,CNR.TO,CP.TO,WCN.TO,FTS.TO,EMA.TO,T.TO,BCE.TO,TRP.TO,ENB.TO,ATD.TO,DOL.TO,L.TO,MRU.TO,QSR.TO,CCO.TO,NTR.TO,POW.TO,MFC.TO,SLF.TO,GWO.TO,BN.TO,BAM.TO,WSP.TO,STN.TO,TFII.TO,MG.TO,GIB-A.TO,AAPL.TO,MSFT.TO,NVDA.TO,AMZN.TO,GOOG.TO,META.TO,TSLA.TO').split(',').map(x=>x.trim()).filter(Boolean);
const range=process.env.BACKTEST_RANGE||'2y',holdoutEnd=process.env.BACKTEST_HOLDOUT_END||'',horizons=(process.env.BACKTEST_HORIZONS||process.env.BACKTEST_HORIZON||'5,10,20').split(',').map(Number).filter(x=>x>0),maxH=Math.max(...horizons),minDollar=Number(process.env.BACKTEST_MIN_DOLLAR||5000000),warmup=90;
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
const STAGE_AWARE_V1_SPEC=Object.freeze({
  version:'stage-aware-shortlist-v1-frozen-2026-09-23',
  status:'validation-only',
  frozenAt:'2026-09-23',
  discoveryThreshold:5,
  note:'Frozen before independent historical validation. Do not tune rules or threshold from validation outcomes; any change requires V2.'
});
// Frozen discovery selector: compare evidence within each stage instead of
// forcing four different market states through one global priority scale.
// Backtest-only; live Shortlist remains unchanged.
function stageAwareEvidence(e){
  let p=0;
  const rs=e.rs20,m=e.momentumShift,v=e.upDownVolumeRatio,room=e.roomToResistance,st=e.swingTrend,set=e.setups||[];
  if(e.stage==='Early Watch'){
    if(Number.isFinite(m)){if(m>=2)p+=3;else if(m>0)p+=2;else if(m<=-3)p-=2}
    if(Number.isFinite(rs)){if(rs>=0)p+=2;else if(rs>-5)p+=1;else p-=1}
    if(set.includes('Selling Exhaustion'))p+=2;
    if(set.includes('Failed Breakdown / Reclaim'))p+=2;
    if(st==='Structure improving')p+=2;
    if(st==='Lower highs + lower lows')p-=1; // weakness is expected here, not a global veto
  }else if(e.stage==='Recovery'){
    if(Number.isFinite(m)){if(m>=2)p+=3;else if(m>0)p+=1;else p-=2}
    if(Number.isFinite(rs)){if(rs>=0)p+=2;else if(rs>-5)p+=1;else p-=1}
    if(set.includes('Recovery'))p+=2;
    if(set.includes('Higher-Low Turn')||set.includes('Failed Breakdown / Reclaim'))p+=2;
    if(st==='Structure improving'||st==='Higher highs + higher lows')p+=2;
    if(Number.isFinite(v)&&v>=.85)p+=1;
  }else if(e.stage==='Attractive Growth'){
    if(Number.isFinite(rs)){if(rs>=4)p+=3;else if(rs>=0)p+=2;else p-=2}
    if(Number.isFinite(m)){if(m>=1)p+=2;else if(m<=-3)p-=2}
    if(st==='Higher highs + higher lows')p+=3;else if(st==='Structure improving')p+=2;else if(st==='Lower highs + lower lows')p-=3;
    if(Number.isFinite(v)){if(v>=1.2)p+=2;else if(v<.85)p-=1}
    if(Number.isFinite(room)){if(room>=7)p+=2;else if(room<3)p-=2}
  }else if(e.stage==='Established Move'){
    if(Number.isFinite(rs)){if(rs>=4)p+=2;else if(rs>=0)p+=1;else p-=2}
    if(st==='Higher highs + higher lows')p+=2;else if(st==='Lower highs + lower lows')p-=3;
    if(Number.isFinite(m)){if(m>=1)p+=1;else if(m<=-3)p-=2}
    if(Number.isFinite(v)){if(v>=1.2)p+=1;else if(v<.85)p-=1}
    if(Number.isFinite(room)){if(room>=7)p+=2;else if(room<3)p-=3}
    if(set.includes('Pullback in Uptrend')||set.includes('Local Breakout'))p+=1;
  }
  return p;
}
function stageAwareShortlistReport(a){
  const thresholds=[2,3,4,5,6,7],out={};
  for(const t of thresholds){
    const rows=a.filter(e=>stageAwareEvidence(e)>=t);
    out[String(t)]={coveragePct:a.length?round(rows.length/a.length*100,1):0,summary:summary(rows),tradeability:stageTradeabilityReport(rows),byStage:Object.fromEntries(['Early Watch','Recovery','Attractive Growth','Established Move'].map(stage=>[stage,summary(rows.filter(e=>e.stage===stage))]))};
  }
  return out;
}
// Backend-only workload diagnostics. Threshold variants are diagnostic only; none changes Live.
function featureLiftReport(a){
  const defs={
    rsPositive:e=>Number.isFinite(e.rs20)&&e.rs20>=0,
    rsStrong:e=>Number.isFinite(e.rs20)&&e.rs20>=4,
    momentumPositive:e=>Number.isFinite(e.momentumShift)&&e.momentumShift>0,
    momentumStrong:e=>Number.isFinite(e.momentumShift)&&e.momentumShift>=3,
    constructiveStructure:e=>e.swingTrend==='Structure improving'||e.swingTrend==='Higher highs + higher lows',
    healthyVolume:e=>Number.isFinite(e.upDownVolumeRatio)&&e.upDownVolumeRatio>=.85,
    strongUpVolume:e=>Number.isFinite(e.upDownVolumeRatio)&&e.upDownVolumeRatio>=1.2,
    room7:e=>Number.isFinite(e.roomToResistance)&&e.roomToResistance>=7,
    failedBreakdown:e=>(e.setups||[]).includes('Failed Breakdown / Reclaim'),
    higherLow:e=>(e.setups||[]).includes('Higher-Low Turn'),
    localBreakout:e=>(e.setups||[]).includes('Local Breakout'),
    sellingExhaustion:e=>(e.setups||[]).includes('Selling Exhaustion')
  };
  const stages=['Early Watch','Recovery','Attractive Growth','Established Move'],out={};
  const delta=(x,y,k)=>Number.isFinite(x?.[k])&&Number.isFinite(y?.[k])?round(x[k]-y[k],2):null;
  for(const stage of stages){
    const base=a.filter(e=>e.stage===stage);out[stage]={};
    for(const [name,test] of Object.entries(defs)){
      const yes=base.filter(test),no=base.filter(e=>!test(e)),ys=summary(yes),ns=summary(no);
      out[stage][name]={present:ys,absent:ns,lift:{positiveRate:delta(ys,ns,'positiveRate'),meanReturn:delta(ys,ns,'mean'),benchmarkBeatRate:delta(ys,ns,'benchmarkBeatRate'),meanExcessReturn:delta(ys,ns,'meanExcessReturn')}};
    }
  }
  return out;
}
function stageSelectionLiftReport(a){
  const stages=['Early Watch','Recovery','Attractive Growth','Established Move'],out={};
  const delta=(x,y,k)=>Number.isFinite(x?.[k])&&Number.isFinite(y?.[k])?round(x[k]-y[k],2):null;
  for(const stage of stages){
    const base=a.filter(e=>e.stage===stage);out[stage]={};
    for(const threshold of [2,3,4,5,6,7]){
      const selected=base.filter(e=>stageAwareEvidence(e)>=threshold),rejected=base.filter(e=>stageAwareEvidence(e)<threshold);
      const ss=summary(selected),rr=summary(rejected);
      out[stage][String(threshold)]={
        selected:ss,rejected:rr,
        lift:{
          positiveRate:delta(ss,rr,'positiveRate'),
          meanReturn:delta(ss,rr,'mean'),
          benchmarkBeatRate:delta(ss,rr,'benchmarkBeatRate'),
          meanExcessReturn:delta(ss,rr,'meanExcessReturn')
        },
        selectedTradeability:stageTradeabilityReport(selected)
      };
    }
  }
  return out;
}
function dailyReviewLoad(a,threshold=5){
  const rows=a.filter(e=>stageAwareEvidence(e)>=threshold),days=[...new Set(a.map(e=>e.date))].sort();
  const counts=days.map(date=>rows.filter(e=>e.date===date).length).sort((x,y)=>x-y);
  const q=p=>counts.length?counts[Math.min(counts.length-1,Math.floor((counts.length-1)*p))]:0;
  const byStage=Object.fromEntries(['Early Watch','Recovery','Attractive Growth','Established Move'].map(stage=>{
    const cs=days.map(date=>rows.filter(e=>e.date===date&&e.stage===stage).length).sort((x,y)=>x-y);
    const qq=p=>cs.length?cs[Math.min(cs.length-1,Math.floor((cs.length-1)*p))]:0;
    return [stage,{avg:cs.length?round(cs.reduce((p,c)=>p+c,0)/cs.length,2):0,median:qq(.5),p90:qq(.9),max:cs.length?Math.max(...cs):0}];
  }));
  return {threshold,days:days.length,avgPerDay:counts.length?round(counts.reduce((p,c)=>p+c,0)/counts.length,2):0,medianPerDay:q(.5),p90PerDay:q(.9),maxPerDay:counts.length?Math.max(...counts):0,zeroCandidateDays:counts.filter(x=>x===0).length,zeroCandidatePct:counts.length?round(counts.filter(x=>x===0).length/counts.length*100,1):0,byStage};
}
function frozenStageAwareValidation(a){
  const t=STAGE_AWARE_V1_SPEC.discoveryThreshold,rows=a.filter(e=>stageAwareEvidence(e)>=t);
  return {spec:STAGE_AWARE_V1_SPEC,coveragePct:a.length?round(rows.length/a.length*100,1):0,summary:summary(rows),tradeability:stageTradeabilityReport(rows),byStage:Object.fromEntries(['Early Watch','Recovery','Attractive Growth','Established Move'].map(stage=>[stage,summary(rows.filter(e=>e.stage===stage))]))};
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
const events=[];for(const symbol of symbols){const rows=data[symbol],bench=data[benchSymbol(symbol)];if(!rows?.length||!bench?.length)continue;for(let i=warmup;i<rows.length-maxH;i++){if(holdoutEnd&&dayKey(rows[i].t)>holdoutEnd)continue;const hist=rows.slice(0,i+1),date=dayKey(rows[i].t),bh=align(bench,date);if(!bh||bh.length<65)continue;const m=metrics({rows:hist},{rows:bh},null);if(!m||!Number.isFinite(m.avgDollarVol)||m.avgDollarVol<minDollar||rows[i].rawClose<2)continue;const stage=m.stage||(isEarlyWatch(m)?'Early Watch':null);if(!stage)continue;for(const horizon of horizons){const entryClose=rows[i].close,window=rows.slice(i+1,i+horizon+1),pathReturns=window.map(x=>pct(x.close,entryClose)).filter(Number.isFinite),mae=pathReturns.length?Math.min(...pathReturns):null,mfe=pathReturns.length?Math.max(...pathReturns):null,daysToMfe=Number.isFinite(mfe)?pathReturns.indexOf(mfe)+1:null,daysToMae=Number.isFinite(mae)?pathReturns.indexOf(mae)+1:null,hitPlus7=pathReturns.findIndex(v=>v>=7),hitMinus7=pathReturns.findIndex(v=>v<=-7),forwardReturn=pct(rows[i+horizon].close,entryClose),benchEntry=bh.at(-1)?.close,benchFuture=bench.find(x=>dayKey(x.t)===dayKey(rows[i+horizon].t))?.close,benchmarkReturn=pct(benchFuture,benchEntry);const ss=setups(m,stage),strategyPass=setupStrategy(m,stage,ss),priority=opportunityScore(m,stage,ss);const confirmation={};if(strategyPass.includes('Higher-Low Turn')){for(const d of [1,2,3]){if(i+d+horizon>=rows.length)continue;const h2=rows.slice(0,i+d+1),b2=align(bench,dayKey(rows[i+d].t)),m2=b2&&b2.length>=65?metrics({rows:h2},{rows:b2},null):null;if(!m2)continue;const heldLow=m2.lowState!=='local_low_broken',momentumOk=Number.isFinite(m2.momentumShift)&&m2.momentumShift>=1,rsOk=Number.isFinite(m2.rs20)&&m2.rs20>=0,structureOk=m2.higherLow===true||m2.swingTrend==='HH+HL'||m2.swingTrend==='Improving';if(!(heldLow&&momentumOk&&rsOk&&structureOk))continue;const ep=rows[i+d].close,w=rows.slice(i+d+1,i+d+horizon+1),pr=w.map(x=>pct(x.close,ep)).filter(Number.isFinite),ma=pr.length?Math.min(...pr):null,mf=pr.length?Math.max(...pr):null,p7=pr.findIndex(v=>v>=7),m7=pr.findIndex(v=>v<=-7);confirmation[d]={ret:round(pct(rows[i+d+horizon].close,ep)),mae:round(ma),mfe:round(mf),plus7:p7>=0,minus7:m7>=0,plus7Day:p7>=0?p7+1:null,minus7Day:m7>=0?m7+1:null};break;}}const delay={};for(const d of [0,1,2,3]){if(i+d+horizon>=rows.length)continue;const ep=rows[i+d].close,w=rows.slice(i+d+1,i+d+horizon+1),pr=w.map(x=>pct(x.close,ep)).filter(Number.isFinite),ma=pr.length?Math.min(...pr):null,mf=pr.length?Math.max(...pr):null,p7=pr.findIndex(v=>v>=7),m7=pr.findIndex(v=>v<=-7);delay[d]={ret:round(pct(rows[i+d+horizon].close,ep)),mae:round(ma),mfe:round(mf),plus7:p7>=0,minus7:m7>=0,plus7Day:p7>=0?p7+1:null,minus7Day:m7>=0?m7+1:null};}events.push({symbol,date,sessionIndex:i,horizon,delay,confirmation,stage,setups:ss,primarySetup:ss[0]||'Stage only',strategyPass,strategyQualified:strategyPass.length>0,priority,atr14Pct:m.atr14Pct,upDownVolumeRatio:m.upDownVolumeRatio,roomToResistance:m.roomToResistance,swingTrend:m.swingTrend,benchRet20:pct(bh.at(-1)?.close,bh.at(-21)?.close),benchRet60:pct(bh.at(-1)?.close,bh.at(-61)?.close),regime:null,entry:round(rows[i].close),exit:round(rows[i+horizon].close),forwardReturn:round(forwardReturn),mae:round(mae),mfe:round(mfe),daysToMae,daysToMfe,hitPlus7Day:hitPlus7>=0?hitPlus7+1:null,hitMinus7Day:hitMinus7>=0?hitMinus7+1:null,benchmarkReturn:round(benchmarkReturn),excessReturn:round(Number.isFinite(benchmarkReturn)?forwardReturn-benchmarkReturn:null),momentumShift:m.momentumShift,rs20:m.rs20,roomToResistance:m.roomToResistance,swingTrend:m.swingTrend,upDownVolumeRatio:m.upDownVolumeRatio})}}}
for(const e of events)e.regime=marketRegime(e);
function splitChronologically(a){const dates=[...new Set(a.map(e=>e.date))].sort(),cut=dates[Math.floor(dates.length*.7)]||null;return{cut,train:a.filter(e=>!cut||e.date<cut),test:a.filter(e=>cut&&e.date>=cut)}}
function thresholdReport(a){const thresholds=[10,20,30,40,50],out={};for(const t of thresholds)out[String(t)]=summary(a.filter(e=>e.priority>=t));return out}
function shortlistQualityReport(a){
  const thresholds=[40,50,58,65,70,75,80],out={};
  for(const t of thresholds){
    const rows=a.filter(e=>e.priority>=t);
    out[String(t)]={coveragePct:a.length?round(rows.length/a.length*100,1):0,summary:summary(rows),tradeability:stageTradeabilityReport(rows),byStage:Object.fromEntries(['Early Watch','Recovery','Attractive Growth','Established Move'].map(stage=>[stage,summary(rows.filter(e=>e.stage===stage))]))};
  }
  return out;
}
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


const HUNTER_V2_SPEC=Object.freeze({
  version:'hunter-v2-frozen-2026-09-23',
  status:'forward-evaluation',
  frozenAt:'2026-09-23',
  note:'Do not tune from forward outcomes. Any rule change requires a new version and evaluation cohort.',
  higherLow:{momentumShiftMin:3,upDownVolumeRatioMin:.85,atr14PctMin:3,atr14PctMaxExclusive:6,rs20Min:0,preferredRegimes:['Strong','Positive']},
  failedBreakdown:{atr14PctMaxExclusive:3,rs20Min:0,rs20MaxExclusive:4,upDownVolumeRatioMin:.85,upDownVolumeRatioMaxExclusive:1.2}
});
function v2Candidate(e){
  const h=HUNTER_V2_SPEC.higherLow,f=HUNTER_V2_SPEC.failedBreakdown;
  if(e.strategyPass?.includes('Higher-Low Turn'))return Number.isFinite(e.momentumShift)&&e.momentumShift>=h.momentumShiftMin&&Number.isFinite(e.upDownVolumeRatio)&&e.upDownVolumeRatio>=h.upDownVolumeRatioMin&&Number.isFinite(e.atr14Pct)&&e.atr14Pct>=h.atr14PctMin&&e.atr14Pct<h.atr14PctMaxExclusive&&Number.isFinite(e.rs20)&&e.rs20>=h.rs20Min;
  if(e.strategyPass?.includes('Failed Breakdown / Reclaim'))return Number.isFinite(e.atr14Pct)&&e.atr14Pct<f.atr14PctMaxExclusive&&Number.isFinite(e.rs20)&&e.rs20>=f.rs20Min&&e.rs20<f.rs20MaxExclusive&&Number.isFinite(e.upDownVolumeRatio)&&e.upDownVolumeRatio>=f.upDownVolumeRatioMin&&e.upDownVolumeRatio<f.upDownVolumeRatioMaxExclusive;
  return false;
}
function v2Report(a){
  const picked=a.filter(v2Candidate),bySetup={};
  for(const name of ['Higher-Low Turn','Failed Breakdown / Reclaim'])
    bySetup[name]=summary(picked.filter(e=>e.strategyPass?.includes(name)));
  return {picked:summary(picked),coverage:a.length?round(picked.length/a.length*100,1):0,bySetup};
}
function marketRegime(e){if(!Number.isFinite(e.benchRet20)||!Number.isFinite(e.benchRet60))return 'Unknown';if(e.benchRet20>2&&e.benchRet60>5)return 'Strong';if(e.benchRet20>=0&&e.benchRet60>=0)return 'Positive';if(e.benchRet20<0&&e.benchRet60<0)return 'Weak';return 'Mixed'}
function confirmationSelectionReport(a){
 const q=a.filter(e=>v2Candidate(e)&&e.strategyPass?.includes('Higher-Low Turn'));
 const confirmed=q.filter(e=>[1,2,3].some(k=>e.confirmation?.[k]));
 const rejected=q.filter(e=>![1,2,3].some(k=>e.confirmation?.[k]));
 const sum=x=>{const n=x.length;if(!n)return {n:0};const rate=fn=>round(100*x.filter(fn).length/n),avg=k=>round(x.reduce((z,e)=>z+(Number.isFinite(e[k])?e[k]:0),0)/n);return {n,avgSignalReturn:avg('forwardReturn'),avgSignalMae:avg('mae'),avgSignalMfe:avg('mfe'),positive:rate(e=>e.forwardReturn>0),hitPlus7:rate(e=>Number.isFinite(e.hitPlus7Day)),hitMinus7:rate(e=>Number.isFinite(e.hitMinus7Day)),plus7BeforeMinus7:rate(e=>Number.isFinite(e.hitPlus7Day)&&(!Number.isFinite(e.hitMinus7Day)||e.hitPlus7Day<e.hitMinus7Day)),bigWinner10:rate(e=>e.mfe>=10),deepDrawdown10:rate(e=>e.mae<=-10)};};
 return {confirmedFromSignal:sum(confirmed),rejectedFromSignal:sum(rejected)};
}
function confirmationReport(a){
 const q=a.filter(e=>v2Candidate(e)&&e.strategyPass?.includes('Higher-Low Turn')),vals=q.map(e=>{const d=[1,2,3].find(k=>e.confirmation?.[k]);return d?{...e.confirmation[d],day:d}:null}).filter(Boolean),n=vals.length,total=q.length;if(!n)return {signals:total,confirmed:0};const rate=fn=>round(100*vals.filter(fn).length/n),avg=k=>round(vals.reduce((z,v)=>z+v[k],0)/n);return {signals:total,confirmed:n,confirmationRate:round(100*n/Math.max(1,total)),avgConfirmationDay:round(vals.reduce((z,v)=>z+v.day,0)/n),avgReturn:avg('ret'),avgMae:avg('mae'),avgMfe:avg('mfe'),hitPlus7:rate(v=>v.plus7),hitMinus7:rate(v=>v.minus7),plus7BeforeMinus7:rate(v=>v.plus7&&(!v.minus7||v.plus7Day<v.minus7Day))};
}
function entryDelayReport(a){
  const q=a.filter(e=>v2Candidate(e)&&e.strategyPass?.includes('Higher-Low Turn'));
  const delays=[0,1,2,3];
  const summarize=(x,d)=>{const vals=x.map(e=>e.delay?.[d]).filter(Boolean);const n=vals.length;if(!n)return {n:0};const rate=fn=>round(100*vals.filter(fn).length/n),avg=k=>round(vals.reduce((z,v)=>z+v[k],0)/n);return {n,avgReturn:avg('ret'),avgMae:avg('mae'),avgMfe:avg('mfe'),hitPlus7:rate(v=>v.plus7),hitMinus7:rate(v=>v.minus7),plus7BeforeMinus7:rate(v=>v.plus7&&(!v.minus7||v.plus7Day<v.minus7Day))};};
  return Object.fromEntries(delays.map(d=>[d,summarize(q,d)]));
}
function tradeabilityReport(a){
  const q=a.filter(e=>v2Candidate(e));
  const summarize=x=>{const n=x.length;if(!n)return {n:0};const rate=fn=>round(100*x.filter(fn).length/n);const avg=k=>round(x.reduce((z,e)=>z+(Number.isFinite(e[k])?e[k]:0),0)/n);return {n,avgReturn:avg('forwardReturn'),avgMae:avg('mae'),avgMfe:avg('mfe'),maeBelow3:rate(e=>e.mae<=-3),maeBelow5:rate(e=>e.mae<=-5),maeBelow7:rate(e=>e.mae<=-7),hitPlus7:rate(e=>Number.isFinite(e.hitPlus7Day)),hitMinus7:rate(e=>Number.isFinite(e.hitMinus7Day)),plus7BeforeMinus7:rate(e=>Number.isFinite(e.hitPlus7Day)&&(!Number.isFinite(e.hitMinus7Day)||e.hitPlus7Day<e.hitMinus7Day)),minus7BeforePlus7:rate(e=>Number.isFinite(e.hitMinus7Day)&&(!Number.isFinite(e.hitPlus7Day)||e.hitMinus7Day<e.hitPlus7Day))};};
  const paths=['Higher-Low Turn','Failed Breakdown / Reclaim'];
  const has=(e,p)=>e.strategyPass?.includes(p);
  const exclusive={
    higherLowOnly:q.filter(e=>has(e,'Higher-Low Turn')&&!has(e,'Failed Breakdown / Reclaim')),
    failedBreakdownOnly:q.filter(e=>has(e,'Failed Breakdown / Reclaim')&&!has(e,'Higher-Low Turn')),
    both:q.filter(e=>has(e,'Higher-Low Turn')&&has(e,'Failed Breakdown / Reclaim'))
  };
  const distribution=x=>({
    mae:[-3,-5,-7,-10].map(t=>({threshold:t,pct:summarize(x)['maeBelow'+Math.abs(t)]??round(100*x.filter(e=>e.mae<=t).length/Math.max(1,x.length))})),
    mfe:[3,5,7,10,15].map(t=>({threshold:t,pct:round(100*x.filter(e=>e.mfe>=t).length/Math.max(1,x.length))}))
  });
  return {overall:summarize(q),byPath:Object.fromEntries(paths.map(p=>[p,summarize(q.filter(e=>has(e,p)))])),exclusive:Object.fromEntries(Object.entries(exclusive).map(([k,x])=>[k,{...summarize(x),distribution:distribution(x)}]))};
}
function stageTradeabilityReport(a){
  const summarize=x=>{const n=x.length;if(!n)return {n:0};const rate=fn=>round(100*x.filter(fn).length/n);const avg=k=>{const v=x.map(e=>e[k]).filter(Number.isFinite);return v.length?round(v.reduce((p,c)=>p+c,0)/v.length):null};return {n,avgReturn:avg('forwardReturn'),avgMae:avg('mae'),avgMfe:avg('mfe'),maeBelow3:rate(e=>Number.isFinite(e.mae)&&e.mae<=-3),maeBelow5:rate(e=>Number.isFinite(e.mae)&&e.mae<=-5),maeBelow7:rate(e=>Number.isFinite(e.mae)&&e.mae<=-7),hitPlus7:rate(e=>Number.isFinite(e.hitPlus7Day)),hitMinus7:rate(e=>Number.isFinite(e.hitMinus7Day)),plus7BeforeMinus7:rate(e=>Number.isFinite(e.hitPlus7Day)&&(!Number.isFinite(e.hitMinus7Day)||e.hitPlus7Day<e.hitMinus7Day)),minus7BeforePlus7:rate(e=>Number.isFinite(e.hitMinus7Day)&&(!Number.isFinite(e.hitPlus7Day)||e.hitMinus7Day<e.hitPlus7Day))};};
  return summarize(a);
}
function benchmarkComparisonReport(a,horizon){
  const sim=sequentialCapital100Report(a,horizon),ledger=sim.ledger||[];
  if(!ledger.length)return {hunter:sim,benchmarks:null};
  const first=ledger[0].signalDate,last=ledger.at(-1).signalDate;
  const bh=(symbol)=>{const rows=data[symbol]||[],i=rows.findIndex(x=>dayKey(x.t)>=first),j=[...rows].map(x=>dayKey(x.t)).findLastIndex(d=>d<=last);if(i<0||j<=i)return null;const ret=pct(rows[j].close,rows[i].close);return {symbol,startDate:dayKey(rows[i].t),endDate:dayKey(rows[j].t),startCapital:100,endCapital:round(100*(1+ret/100)),totalReturn:round(ret)}};
  const tsx=bh('^GSPTSE'),nasdaq=bh('^IXIC');
  return {hunter:{startCapital:sim.startCapital,endCapital:sim.endCapital,totalReturn:sim.totalReturn,trades:sim.trades,holdingSessions:horizon,firstSignal:first,lastSignal:last},buyAndHold:{tsx,nasdaq},note:'Benchmark window spans first to last Hunter signal in the sequential ledger. Hunter may spend time in cash; benchmark is continuously invested. This is a context comparison, not risk-adjusted attribution.'};
}
function portfolioStressReport(a,horizon){
  const q=a.filter(e=>v2Candidate(e));
  const eligible=q.map(e=>{const hl=e.strategyPass?.includes('Higher-Low Turn'),fb=e.strategyPass?.includes('Failed Breakdown / Reclaim');let d=0,path='Failed Breakdown / Reclaim';if(hl){const cd=[1,2,3].find(k=>e.confirmation?.[k]);if(!cd&&!fb)return null;if(cd){d=cd;path='Confirmed Higher-Low'}}const perf=d?e.confirmation[d]:e.delay?.[0];return perf&&Number.isFinite(perf.ret)?{...e,entrySession:e.sessionIndex+d,exitSession:e.sessionIndex+d+horizon,tradeReturn:perf.ret,mae:perf.mae,mfe:perf.mfe,path}:null}).filter(Boolean);
  const run=mode=>{let cash=100,free=-1,peak=100,maxDD=0,trades=0;const rows=[...eligible].sort((x,y)=>x.entrySession-y.entrySession||(mode==='best'?y.tradeReturn-x.tradeReturn:mode==='worst'?x.tradeReturn-y.tradeReturn:x.symbol.localeCompare(y.symbol)));for(const e of rows){if(e.entrySession<=free)continue;const before=cash,entryDD=Number.isFinite(e.mae)?(before*(1+e.mae/100)/peak-1)*100:0;maxDD=Math.min(maxDD,entryDD);cash*=1+e.tradeReturn/100;peak=Math.max(peak,cash);maxDD=Math.min(maxDD,(cash/peak-1)*100);free=e.exitSession;trades++}return{trades,endCapital:round(cash),totalReturn:round(cash-100),maxEquityDrawdown:round(maxDD)}};
  const base=run('symbol'),best=run('best'),worst=run('worst');
  // Cost sensitivity is applied per completed round trip to the base ledger.
  const costs={};for(const bps of [10,25,50]){const perTrade=2*bps/10000;costs[bps+'bpsPerSide']={endCapital:round(base.endCapital*Math.pow(1-perTrade,base.trades)),note:'Approximate round-trip friction sensitivity.'}}
  return {base,bestSameDayTieBreak:best,worstSameDayTieBreak:worst,costSensitivity:costs,note:'Stress diagnostics only. Best/worst vary only simultaneous eligible-event tie breaking; MAE-based drawdown uses daily-close excursion.'};
}
function sequentialCapital100Report(a,horizon){
  // Real cash ledger: one position at a time, C$100 initial capital, no leverage and no overlapping trades.
  // Failed Breakdown enters on signal day. Higher-Low enters only on its first frozen Confirmation V1 day (1..3).
  const all=a.filter(e=>v2Candidate(e)).sort((x,y)=>x.date.localeCompare(y.date)||x.symbol.localeCompare(y.symbol));
  const dates=[...new Set(all.map(e=>e.date))].sort(),trades=[];let cash=100,freeSession=-1;
  const candidates=[];
  for(const e of all){
    const hl=e.strategyPass?.includes('Higher-Low Turn'),fb=e.strategyPass?.includes('Failed Breakdown / Reclaim');
    let delay=0,path='Failed Breakdown / Reclaim';
    if(hl&&!fb){const d=[1,2,3].find(k=>e.confirmation?.[k]);if(!d)continue;delay=d;path='Confirmed Higher-Low';}
    const start=e.sessionIndex+delay,end=start+horizon,perf=delay?e.confirmation[delay]:e.delay?.[0];
    if(!perf||!Number.isFinite(perf.ret))continue;
    candidates.push({...e,entrySession:start,exitSession:end,entryDelay:delay,tradeReturn:perf.ret,tradePath:path});
  }
  candidates.sort((x,y)=>x.date.localeCompare(y.date)||x.entrySession-y.entrySession||x.symbol.localeCompare(y.symbol));
  for(const e of candidates){
    if(e.entrySession<=freeSession)continue;
    const before=cash;cash*=1+e.tradeReturn/100;trades.push({symbol:e.symbol,signalDate:e.date,path:e.tradePath,regime:e.regime,entryDelay:e.entryDelay,return:round(e.tradeReturn),capitalBefore:round(before),capitalAfter:round(cash)});freeSession=e.exitSession;
  }
  let peak=100,maxDrawdown=0;for(const t of trades){peak=Math.max(peak,t.capitalAfter);maxDrawdown=Math.min(maxDrawdown,(t.capitalAfter/peak-1)*100)}
  return {mode:'sequential-cash-ledger',startCapital:100,endCapital:round(cash),totalReturn:round((cash/100-1)*100),trades:trades.length,maxClosedTradeDrawdown:round(maxDrawdown),holdingSessions:horizon,entryRules:'Failed Breakdown on signal; Higher-Low only after frozen Confirmation V1; one position at a time; first eligible event; no leverage.',ledger:trades};
}
function capital100Report(a){
  // Opportunity-engine test only: no sell signal. Each qualified event gets an equal sleeve;
  // capital is marked at a fixed horizon so entry selection is isolated from exit design.
  const q=a.filter(e=>v2Candidate(e)).sort((x,y)=>x.date.localeCompare(y.date)||x.symbol.localeCompare(y.symbol));
  const byRegime={};
  for(const regime of ['Strong','Positive','Mixed','Weak','Unknown']){
    const rows=q.filter(e=>e.regime===regime),n=rows.length;
    if(!n){byRegime[regime]={n:0,startCapital:100,endCapital:100,totalReturn:0};continue}
    // Equal-weight independent opportunity sleeves. This intentionally avoids inventing portfolio sizing/exits.
    const gross=rows.map(e=>1+e.forwardReturn/100).filter(Number.isFinite);
    const avgGross=gross.reduce((z,v)=>z+v,0)/gross.length;
    byRegime[regime]={n,startCapital:100,endCapital:round(100*avgGross),totalReturn:round((avgGross-1)*100),note:'Equal-weight opportunity cohort; fixed-horizon mark, not sequential trading.'};
  }
  const gross=q.map(e=>1+e.forwardReturn/100).filter(Number.isFinite),avgGross=gross.length?gross.reduce((z,v)=>z+v,0)/gross.length:1;
  return {mode:'opportunity-engine-only',startCapital:100,endCapital:round(100*avgGross),totalReturn:round((avgGross-1)*100),positions:q.length,holdingRule:'Fixed horizon only; no Hunter sell rule',byRegime};
}
function replayReport(a){
  const dates=[...new Set(a.map(e=>e.date))].sort();
  if(!dates.length)return {dates:[]};
  const targets=[];
  const count=Math.min(12,dates.length);
  for(let k=0;k<count;k++){const idx=Math.round(k*(dates.length-1)/Math.max(1,count-1));targets.push(dates[idx])}
  return {dates:[...new Set(targets)].map(date=>{
    const rows=a.filter(e=>e.date===date&&v2Candidate(e)).sort((x,y)=>(y.priority??0)-(x.priority??0));
    return {date,picks:rows.map(e=>({symbol:e.symbol,stage:e.stage,setups:e.strategyPass,regime:e.regime,entry:e.entry,forwardReturn:e.forwardReturn,mae:e.mae,mfe:e.mfe,daysToMae:e.daysToMae,daysToMfe:e.daysToMfe,hitPlus7Day:e.hitPlus7Day,hitMinus7Day:e.hitMinus7Day,benchmarkReturn:e.benchmarkReturn,excessReturn:e.excessReturn,rs20:e.rs20,momentumShift:e.momentumShift,atr14Pct:e.atr14Pct,upDownVolumeRatio:e.upDownVolumeRatio}))};
  })};
}
function failedBreakdownRsValidation(rows){
  const bins=[['0..2',0,2],['2..4',2,4],['4+',4,Infinity]];
  const report=a=>Object.fromEntries(bins.map(([name,lo,hi])=>{
    const x=a.filter(e=>Number.isFinite(e.rs20)&&e.rs20>=lo&&e.rs20<hi);
    return [name,{...summary(x),tradeability:tradeabilityReport(x)}];
  }));
  const byYear={};
  for(const year of [...new Set(rows.map(e=>String(e.date).slice(0,4)))].sort()){
    byYear[year]=report(rows.filter(e=>String(e.date).startsWith(year+'-')));
  }
  return {preSpecifiedBins:'RS20: 0-2, 2-4, 4+',overall:report(rows),byYear};
}
function failedBreakdownQualityDiagnostics(rows){
  const groups={winners:rows.filter(e=>Number.isFinite(e.forwardReturn)&&e.forwardReturn>0),losers:rows.filter(e=>Number.isFinite(e.forwardReturn)&&e.forwardReturn<=0),bigWinners:rows.filter(e=>Number.isFinite(e.forwardReturn)&&e.forwardReturn>=7),bigLosers:rows.filter(e=>Number.isFinite(e.forwardReturn)&&e.forwardReturn<=-7)};
  const fields=['rs20','momentumShift','atr14Pct','upDownVolumeRatio','roomToResistance','ret5','ret20','pullback'];
  const avg=(a,k)=>{const v=a.map(x=>x[k]).filter(Number.isFinite);return v.length?Math.round(v.reduce((p,c)=>p+c,0)/v.length*100)/100:null};
  const profile=a=>{const sm=summary(a)||{};return {n:a.length,meanReturn:sm.mean??null,positiveRate:sm.positiveRate??null,averages:Object.fromEntries(fields.map(k=>[k,avg(a,k)])),regimes:Object.fromEntries(['Strong','Positive','Mixed','Weak','Unknown'].map(r=>[r,a.filter(e=>e.regime===r).length])),structures:Object.fromEntries([...new Set(a.map(e=>e.swingTrend||'Unknown'))].sort().map(k=>[k,a.filter(e=>(e.swingTrend||'Unknown')===k).length]))};};
  return Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,profile(v)]));
}
function failedBreakdownOnlyReport(a,horizon){
  const rows=dedupe(a.filter(e=>e.strategyPass?.includes('Failed Breakdown / Reclaim')&&v2Candidate(e)),horizon);
  const seq=sequentialCapital100Report(rows,horizon);
  const byYear={};
  for(const year of [...new Set(rows.map(e=>String(e.date).slice(0,4)))].sort()){
    const yr=rows.filter(e=>String(e.date).startsWith(year+'-'));
    byYear[year]={summary:summary(yr),tradeability:tradeabilityReport(yr),sequentialCapital100:sequentialCapital100Report(yr,horizon)};
  }
  const exclusive=rows.filter(e=>!e.strategyPass?.includes('Higher-Low Turn'));
  return {setup:'Failed Breakdown / Reclaim',frozenRules:true,summary:summary(rows),tradeability:tradeabilityReport(rows),sequentialCapital100:seq,portfolioStress:portfolioStressReport(rows,horizon),benchmarkComparison:benchmarkComparisonReport(rows,horizon),byRegime:regimeReport(rows),qualityDiagnostics:failedBreakdownQualityDiagnostics(rows),rsValidation:failedBreakdownRsValidation(rows),byYear,exclusiveFailedBreakdown:{summary:summary(exclusive),tradeability:tradeabilityReport(exclusive),sequentialCapital100:sequentialCapital100Report(exclusive,horizon)}};
}
function regimeReport(a){const out={};for(const regime of ['Strong','Positive','Mixed','Weak','Unknown']){const rows=a.filter(e=>e.regime===regime),picked=rows.filter(v2Candidate);out[regime]={all:summary(rows),v2:summary(picked),higherLow:summary(picked.filter(e=>e.strategyPass?.includes('Higher-Low Turn'))),failedBreakdown:summary(picked.filter(e=>e.strategyPass?.includes('Failed Breakdown / Reclaim')))}}return out}
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
const byHorizon={};for(const horizon of horizons){const raw=events.filter(e=>e.horizon===horizon),he=dedupe(raw,horizon),byStage={},bySetup={};for(const e of he){(byStage[e.stage]??=[]).push(e);for(const x of e.setups)(bySetup[x]??=[]).push(e)}const ranked=[...he].sort((a,b)=>b.priority-a.priority),topQuartile=ranked.slice(0,Math.ceil(ranked.length*.25)),split=splitChronologically(he),trainRanked=[...split.train].sort((a,b)=>b.priority-a.priority),testRanked=[...split.test].sort((a,b)=>b.priority-a.priority);const walkForward=walkForwardReport(he);byHorizon[String(horizon)]={rawObservations:raw.length,independentEvents:he.length,overall:summary(he),shortlistQuality:shortlistQualityReport(he),stageAwareShortlist:stageAwareShortlistReport(he),stageSelectionLift:stageSelectionLiftReport(he),featureLift:featureLiftReport(he),frozenStageAwareValidation:frozenStageAwareValidation(he),dailyReviewLoad:{t5:dailyReviewLoad(he,5),t6:dailyReviewLoad(he,6),t7:dailyReviewLoad(he,7)},topQuartile:summary(topQuartile),byPriority:thresholdReport(he),featureDiagnostics:featureBuckets(he),hunterV2:{spec:HUNTER_V2_SPEC,overall:v2Report(he),byRegime:regimeReport(he),entryDelay:entryDelayReport(he),confirmation:confirmationReport(he),confirmationSelection:confirmationSelectionReport(he),tradeability:tradeabilityReport(he),capital100:capital100Report(he),sequentialCapital100:sequentialCapital100Report(he,horizon),portfolioStress:portfolioStressReport(he,horizon),benchmarkComparison:benchmarkComparisonReport(he,horizon),failedBreakdownOnly:failedBreakdownOnlyReport(he,horizon),replay:replayReport(he),walkForward:v2WalkForward(he)},walkForward:{...walkForward,stability:setupStability(walkForward)},outOfSample:{cutDate:split.cut,train:{overall:summary(split.train),byPriority:thresholdReport(split.train),setupStrategy:strategyReport(split.train),topQuartile:summary(trainRanked.slice(0,Math.ceil(trainRanked.length*.25)))},test:{overall:summary(split.test),byPriority:thresholdReport(split.test),setupStrategy:strategyReport(split.test),topQuartile:summary(testRanked.slice(0,Math.ceil(testRanked.length*.25)))}},byStage:Object.fromEntries(Object.entries(byStage).map(([k,v])=>[k,summary(v)])),byStageBehavior:Object.fromEntries(Object.entries(byStage).map(([k,v])=>[k,{summary:summary(v),tradeability:stageTradeabilityReport(v),byRegime:Object.fromEntries(['Strong','Positive','Mixed','Weak','Unknown'].map(r=>[r,summary(v.filter(e=>e.regime===r))]))}])),bySetup:Object.fromEntries(Object.entries(bySetup).map(([k,v])=>[k,summary(v)]))}}
const result={generatedAt:new Date().toISOString(),range,holdoutEnd:holdoutEnd||null,horizons,minDollar,symbols,validSymbols:symbols.filter(x=>data[x]?.length),totalEvents:events.length,byHorizon,events};fs.mkdirSync('data',{recursive:true});const compact={...result,events:undefined};fs.writeFileSync('data/backtest.json',JSON.stringify(compact,null,2)+'\n');console.log('\nBACKTEST',JSON.stringify(compact));
