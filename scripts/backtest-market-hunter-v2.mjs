import fs from 'node:fs';
import {UNIVERSE} from '../lib/universe.js';

const VERSION='market-hunter-v2-rebuild-h2-2026-09-26';
const ASSUMPTIONS=Object.freeze({
  purpose:'Discovery scanner: which chart should be opened first, not a buy/sell signal.',
  universe:'Canadian-listed instruments from reviewed universe; CAD only by construction.',
  liquidity:{minPrice:2,minAvgDollar20:3000000},
  stagePrinciple:'Stage describes chart maturity; evidence ranks candidates inside a stage.',
  earlyWatch:'Prior weakness near a recent low plus fresh evidence of downside exhaustion/reclaim; no full reversal confirmation required.',
  dedupe:'Backtest evaluates first stage episodes and suppresses same-symbol same-stage overlap for each forward horizon.',
  ranking:'Stage-specific evidence score is fixed before reading outcomes; train score terciles are applied unchanged to test.',
  validation:'5D/10D/20D, benchmark excess, MAE/MFE, chronological 70/30 holdout, batch stability.'
});

const batchIndex=Number(process.env.V2_BATCH_INDEX||0);
const batchCount=Math.max(1,Number(process.env.V2_BATCH_COUNT||4));
const range=process.env.V2_RANGE||'5y';
const horizons=(process.env.V2_HORIZONS||'5,10,20').split(',').map(Number).filter(x=>x>0);
const maxH=Math.max(...horizons);
const allSymbols=UNIVERSE.map(x=>x[0]);
const symbolMeta=new Map(UNIVERSE.map(x=>[x[0],{name:x[1],sector:x[2]}]));
const symbols=allSymbols.filter((_,i)=>i%batchCount===batchIndex);
const CDR=new Set(UNIVERSE.filter(x=>x[2]==='CDR').map(x=>x[0]));
const benchSymbol=s=>CDR.has(s)?'^IXIC':'^GSPTSE';
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const pct=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a/b-1)*100:null;
const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const median=a=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dayKey=t=>new Date(t*1000).toISOString().slice(0,10);

function sma(a,n,offset=0){const end=a.length-offset;if(end<n)return null;return avg(a.slice(end-n,end))}
function rsi(a,n=14){if(a.length<n+1)return null;let g=0,l=0;for(let i=a.length-n;i<a.length;i++){const d=a[i]-a[i-1];if(d>0)g+=d;else l-=d}if(l===0)return 100;const rs=(g/n)/(l/n);return 100-100/(1+rs)}
function atrPct(r,n=14){if(r.length<n+1)return null;const tr=[];for(let i=r.length-n;i<r.length;i++){const p=r[i-1]?.close;if(!Number.isFinite(p))continue;tr.push(Math.max(r[i].high-r[i].low,Math.abs(r[i].high-p),Math.abs(r[i].low-p)))}const a=avg(tr);return Number.isFinite(a)&&r.at(-1).close?pct(r.at(-1).close+a,r.at(-1).close):null}
function weekKey(t){const d=new Date(t*1000);const shift=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-shift);return d.toISOString().slice(0,10)}
function weeklyCloses(r){const m=new Map();for(const x of r)m.set(weekKey(x.t),x.close);return [...m.values()]}
function directionalVolume(r,n=20){const x=r.slice(-n);let up=0,dn=0;for(let i=1;i<x.length;i++){if(x[i].close>x[i-1].close)up+=x[i].volume;else if(x[i].close<x[i-1].close)dn+=x[i].volume}return dn>0?up/dn:null}

function swingState(r){
  const highs=[],lows=[];
  for(let i=Math.max(2,r.length-90);i<=r.length-3;i++){
    const x=r[i];
    if(x.high>r[i-1].high&&x.high>=r[i-2].high&&x.high>r[i+1].high&&x.high>=r[i+2].high)highs.push(i);
    if(x.low<r[i-1].low&&x.low<=r[i-2].low&&x.low<r[i+1].low&&x.low<=r[i+2].low)lows.push(i);
  }
  const hi=highs.at(-1),lo=lows.at(-1),last=r.length-1;
  const higherHigh=highs.length>=2?r[highs.at(-1)].high>r[highs.at(-2)].high:null;
  const higherLow=lows.length>=2?r[lows.at(-1)].low>r[lows.at(-2)].low:null;
  const swingTrend=higherHigh===true&&higherLow===true?'Higher highs + higher lows':
    higherHigh===false&&higherLow===false?'Lower highs + lower lows':
    higherHigh===true||higherLow===true?'Structure improving':
    higherHigh===false||higherLow===false?'Structure weakening':'Insufficient pivots';
  let freshReclaimAge=null,lowBroken=false,localLow=null,localHigh=null,highBroken=false;
  if(Number.isInteger(lo)){
    localLow=r[lo].low;
    let breached=false,reclaimIndex=null;
    for(let j=lo+1;j<=last;j++){
      if(r[j].low<localLow||r[j].close<localLow)breached=true;
      if(breached&&r[j].close>=localLow){reclaimIndex=j;breached=false}
    }
    lowBroken=r[last].close<localLow;
    if(!lowBroken&&Number.isInteger(reclaimIndex))freshReclaimAge=last-reclaimIndex;
  }
  if(Number.isInteger(hi)){localHigh=r[hi].high;highBroken=r[last].close>localHigh}
  return {higherHigh,higherLow,swingTrend,localLow,localHigh,freshReclaimAge,lowBroken,highBroken};
}

function benchmarkHist(rows,date){
  const i=rows.findLastIndex(x=>dayKey(x.t)<=date);
  return i>=0?rows.slice(0,i+1):null;
}

function metrics(r,bench){
  if(r.length<100||bench.length<65)return null;
  const c=r.map(x=>x.close),v=r.map(x=>x.volume),last=c.at(-1);
  const ma20=sma(c,20),ma50=sma(c,50),ma20p=sma(c,20,5),ma50p=sma(c,50,10);
  const ret5=pct(last,c.at(-6)),ret20=pct(last,c.at(-21)),ret60=pct(last,c.at(-61));
  const high60=Math.max(...c.slice(-60)),low20=Math.min(...r.slice(-20).map(x=>x.low));
  const pullback60=pct(last,high60),nearLow20=pct(last,low20)<=6;
  const dist20=pct(last,ma20),dist50=pct(last,ma50);
  const ma20Slope5=pct(ma20,ma20p),ma50Slope10=pct(ma50,ma50p);
  const prev5=c.at(-6),priorMa20=sma(c.slice(0,-5),20);
  const priorRet20=pct(prev5,c.at(-26));
  const priorHigh60=Math.max(...c.slice(-65,-5));
  const priorPullback60=pct(prev5,priorHigh60);
  const priorWeakness=priorRet20<=-5||(priorPullback60<=-10&&prev5<priorMa20);
  const advancedNearHigh=ret60>=18&&pullback60>-8;
  const prev5Ret=pct(c.at(-6),c.at(-11));
  const momentumShift=Number.isFinite(ret5)&&Number.isFinite(prev5Ret)?ret5-prev5Ret:null;
  const recentDaily=r.slice(-6).map((x,j,a)=>j?pct(x.close,a[j-1].close):null).filter(Number.isFinite);
  const worstPrior=recentDaily.length>=2?Math.min(...recentDaily.slice(0,-1)):null;
  const latest=recentDaily.at(-1);
  const downsideDecel=Number.isFinite(worstPrior)&&worstPrior<=-1.5&&Number.isFinite(latest)&&latest>worstPrior+1;
  const downAvg=(slice)=>avg(slice.filter((x,i,a)=>i>0&&x.close<a[i-1].close).map(x=>x.volume));
  const recent=r.slice(-6),prior=r.slice(-16,-5);
  const recentDown=downAvg(recent),priorDown=downAvg(prior);
  const recentDownCount=recent.slice(1).filter((x,i)=>x.close<recent[i].close).length;
  const priorDownCount=prior.slice(1).filter((x,i)=>x.close<prior[i].close).length;
  const sellingFading=recentDownCount>=2&&priorDownCount>=3&&Number.isFinite(recentDown)&&Number.isFinite(priorDown)&&recentDown<priorDown*.85;
  let maxRvol5=null;
  for(let i=r.length-5;i<r.length;i++){const base=avg(v.slice(i-20,i));if(base>0){const x=v[i]/base;if(maxRvol5===null||x>maxRvol5)maxRvol5=x}}
  const volumeShockNearLow=nearLow20&&Number.isFinite(maxRvol5)&&maxRvol5>=1.4;
  const upDownVolumeRatio=directionalVolume(r,20);
  const w=weeklyCloses(r),w10=sma(w,10),w10p=sma(w,10,4);
  const weeklyUp=Number.isFinite(w10)&&Number.isFinite(w10p)&&last>w10&&w10>w10p;
  const s=swingState(r);
  const bclose=bench.map(x=>x.close),benchRet20=pct(bclose.at(-1),bclose.at(-21)),benchRet60=pct(bclose.at(-1),bclose.at(-61));
  const rs20=Number.isFinite(benchRet20)?ret20-benchRet20:null;
  const rs60=Number.isFinite(benchRet60)?ret60-benchRet60:null;
  const avgDollar20=avg(r.slice(-20).map(x=>x.rawClose*x.volume));
  return {
    last,ret5,ret20,ret60,ma20,ma50,dist20,dist50,ma20Slope5,ma50Slope10,pullback60,nearLow20,
    priorWeakness,advancedNearHigh,momentumShift,downsideDecel,sellingFading,volumeShockNearLow,maxRvol5,
    upDownVolumeRatio,weeklyUp,rs20,rs60,rsi14:rsi(c),atr14Pct:atrPct(r),avgDollar20,
    benchRet20,benchRet60,...s
  };
}

function classify(m){
  const trendAligned=m.weeklyUp&&m.last>m.ma20&&m.ma20>m.ma50&&m.ma20Slope5>0;
  const established=trendAligned&&m.ma50Slope10>0&&m.ret60>=12&&m.pullback60>-12;
  if(established)return 'Established Move';
  const attractive=trendAligned&&m.ret20>0&&m.pullback60>-18;
  if(attractive)return 'Attractive Growth';
  const recovery=m.priorWeakness&&!m.advancedNearHigh&&m.last>=m.ma20*.98&&m.ret5>0&&m.momentumShift>0&&m.pullback60<=-4;
  if(recovery)return 'Recovery';
  const freshReclaim=Number.isFinite(m.freshReclaimAge)&&m.freshReclaimAge<=3;
  const earlyEvidence=freshReclaim||m.sellingFading||(m.downsideDecel&&m.volumeShockNearLow);
  const early=m.priorWeakness&&!m.advancedNearHigh&&m.nearLow20&&earlyEvidence;
  return early?'Early Watch':null;
}

function scale(x,lo,hi){return Number.isFinite(x)?clamp((x-lo)/(hi-lo),0,1):0}
function rank(m,stage){
  let p=0;
  if(stage==='Early Watch'){
    // H1: preserve the pre-reversal nature of Early Watch.
    // Retrospective H0 diagnostics showed that rewarding positive momentum and a fresh reclaim too heavily
    // often promoted later/less attractive entries. Downside deceleration is the primary quality evidence;
    // volume shock and RS help prioritize, while reclaim/selling-fade remain supporting evidence.
    if(m.downsideDecel)p+=26;
    if(m.volumeShockNearLow)p+=16;
    if(Number.isFinite(m.freshReclaimAge)&&m.freshReclaimAge<=3)p+=8;
    if(m.sellingFading)p+=5;
    p+=scale(m.rs20,-15,5)*18;
    p+=scale(m.upDownVolumeRatio,.5,1.2)*8;
    if(Number.isFinite(m.momentumShift)&&m.momentumShift<=-5)p-=5;
    if(m.swingTrend==='Structure improving')p+=6;
    if(m.swingTrend==='Higher highs + higher lows')p+=8;
    return clamp(p,0,100);
  }
  if(stage==='Recovery'){
    // H2: recovery quality is more about regained relative strength and controlled risk
    // than simply having the strongest short-term bounce.
    p+=scale(m.momentumShift,0,6)*15;
    p+=scale(m.rs20,-8,8)*28;
    p+=scale(m.upDownVolumeRatio,.6,1.4)*10;
    if(Number.isFinite(m.freshReclaimAge)&&m.freshReclaimAge<=5)p+=6;
    if(m.higherLow===true)p+=4;
    if(m.swingTrend==='Structure improving'||m.swingTrend==='Higher highs + higher lows')p+=4;
    if(Number.isFinite(m.atr14Pct)){if(m.atr14Pct<6)p+=10;else p-=8;}
    return clamp(p,0,100);
  }
  if(stage==='Attractive Growth'){
    // H2: reward durable trend + medium-term strength, but stop over-rewarding heat.
    p+=scale(m.rs20,-3,12)*25;
    p+=scale(m.rs60,-5,20)*4;
    p+=scale(m.ma20Slope5,0,5)*20;
    p+=scale(m.upDownVolumeRatio,.7,1.5)*4;
    p+=scale(m.ret20,0,15)*18;
    if(m.higherLow===true)p+=3;
    if(m.swingTrend==='Higher highs + higher lows')p+=3;
    if(Number.isFinite(m.atr14Pct)){if(m.atr14Pct<6)p+=5;else p-=12;}
    if(Number.isFinite(m.dist20)&&m.dist20>=6)p-=10;
    if(Number.isFinite(m.dist20)&&m.dist20>=10)p-=10;
    return clamp(p,0,100);
  }
  if(stage==='Established Move'){
    // H2: mature moves are ranked by trend durability, not raw RS/hotness.
    p+=scale(m.ma50Slope10,0,5)*25;
    p+=scale(m.ret60,12,30)*18;
    p+=scale(m.rs20,-2,10)*10;
    p+=scale(m.rs60,0,25)*5;
    p+=scale(m.upDownVolumeRatio,.7,1.5)*6;
    if(m.swingTrend==='Higher highs + higher lows')p+=5;
    if(m.higherLow===true)p+=4;
    if(Number.isFinite(m.atr14Pct)){if(m.atr14Pct<6)p+=6;else p-=12;}
    if(Number.isFinite(m.dist20)&&m.dist20>=6)p-=10;
    if(Number.isFinite(m.dist20)&&m.dist20>=10)p-=10;
    return clamp(p,0,100);
  }
  return 0;
}

async function fetchRows(symbol){
  const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?range='+range+'&interval=1d&includePrePost=false&events=div%2Csplits';
  const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 MarketHunterV2Research/1.0'}});
  if(!res.ok)throw new Error(symbol+': HTTP '+res.status);
  const j=await res.json(),z=j?.chart?.result?.[0],q=z?.indicators?.quote?.[0]||{},adj=z?.indicators?.adjclose?.[0]?.adjclose||q.close||[];
  const splitDays=new Set(Object.values(z?.events?.splits||{}).map(x=>dayKey(Number(x.date))));
  const rows=(z?.timestamp||[]).map((t,i)=>{
    const rawClose=q.close?.[i],factor=Number.isFinite(adj[i])&&Number.isFinite(rawClose)&&rawClose?adj[i]/rawClose:1;
    return {t,close:adj[i],rawClose,high:Number.isFinite(q.high?.[i])?q.high[i]*factor:null,low:Number.isFinite(q.low?.[i])?q.low[i]*factor:null,volume:q.volume?.[i]};
  }).filter(x=>[x.close,x.rawClose,x.high,x.low,x.volume].every(Number.isFinite)&&x.volume>0);
  return {rows,splitDays};
}

function hadRecentSplit(rows,splitDays,i,lookback=30){
  const start=Math.max(0,i-lookback);
  for(let j=start;j<=i;j++)if(splitDays.has(dayKey(rows[j].t)))return true;
  return false;
}

function summary(a){
  if(!a.length)return null;
  const r=a.map(x=>x.forwardReturn).filter(Number.isFinite),ex=a.map(x=>x.excessReturn).filter(Number.isFinite);
  return {
    n:r.length,mean:round(avg(r)),median:round(median(r)),positiveRate:round(r.filter(x=>x>0).length/r.length*100,1),
    benchmarkBeatRate:ex.length?round(ex.filter(x=>x>0).length/ex.length*100,1):null,meanExcess:round(avg(ex)),
    avgMAE:round(avg(a.map(x=>x.mae))),avgMFE:round(avg(a.map(x=>x.mfe))),
    hitPlus7:round(a.filter(x=>x.hitPlus7).length/a.length*100,1),hitMinus7:round(a.filter(x=>x.hitMinus7).length/a.length*100,1)
  };
}

function dedupe(a,h){
  const out=[],last=new Map();
  for(const e of [...a].sort((x,y)=>x.date.localeCompare(y.date)||x.symbol.localeCompare(y.symbol))){
    const k=e.symbol+'|'+e.stage,prev=last.get(k);
    if(Number.isFinite(prev)&&e.sessionIndex-prev<h)continue;
    out.push(e);last.set(k,e.sessionIndex);
  }
  return out;
}

function quantile(a,q){const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;return x[Math.min(x.length-1,Math.floor((x.length-1)*q))]}
function splitChron(a){
  const dates=[...new Set(a.map(x=>x.date))].sort(),cut=dates[Math.floor(dates.length*.7)]||null;
  return {cut,train:a.filter(x=>!cut||x.date<cut),test:a.filter(x=>cut&&x.date>=cut)};
}
function rankingReport(a){
  const sp=splitChron(a),scores=sp.train.map(x=>x.rankScore),q33=quantile(scores,.33),q67=quantile(scores,.67);
  const bucket=x=>x.rankScore>=q67?'Top':x.rankScore>=q33?'Middle':'Lower';
  const pack=x=>Object.fromEntries(['Top','Middle','Lower'].map(k=>[k,summary(x.filter(e=>bucket(e)===k))]));
  return {cutDate:sp.cut,trainThresholds:{q33:round(q33,1),q67:round(q67,1)},train:pack(sp.train),test:pack(sp.test)};
}
function evidenceSlices(stage,a){
  const one=(name,f)=>({name,yes:summary(a.filter(f)),no:summary(a.filter(x=>!f(x)))});
  const common=[
    one('rs20>=0',x=>Number.isFinite(x.features.rs20)&&x.features.rs20>=0),
    one('upDownVolume>=0.85',x=>Number.isFinite(x.features.upDownVolumeRatio)&&x.features.upDownVolumeRatio>=.85),
    one('higherLow',x=>x.features.higherLow===true),
    one('structureImproving',x=>['Structure improving','Higher highs + higher lows'].includes(x.features.swingTrend)),
    one('atr<6',x=>Number.isFinite(x.features.atr14Pct)&&x.features.atr14Pct<6)
  ];
  if(stage==='Early Watch')return [
    one('freshReclaim<=3',x=>Number.isFinite(x.features.freshReclaimAge)&&x.features.freshReclaimAge<=3),
    one('sellingFading',x=>x.features.sellingFading===true),
    one('downsideDecel',x=>x.features.downsideDecel===true),
    one('volumeShockNearLow',x=>x.features.volumeShockNearLow===true),
    one('momentumPositive',x=>Number.isFinite(x.features.momentumShift)&&x.features.momentumShift>0),
    ...common
  ];
  if(stage==='Recovery')return [
    one('momentumShift>=2',x=>Number.isFinite(x.features.momentumShift)&&x.features.momentumShift>=2),
    one('freshReclaim<=5',x=>Number.isFinite(x.features.freshReclaimAge)&&x.features.freshReclaimAge<=5),
    one('absDist20<=3',x=>Number.isFinite(x.features.dist20)&&Math.abs(x.features.dist20)<=3),
    ...common
  ];
  if(stage==='Attractive Growth')return [
    one('rs20>=4',x=>Number.isFinite(x.features.rs20)&&x.features.rs20>=4),
    one('rs60>=0',x=>Number.isFinite(x.features.rs60)&&x.features.rs60>=0),
    one('dist20>=6',x=>Number.isFinite(x.features.dist20)&&x.features.dist20>=6),
    one('ret20>=8',x=>Number.isFinite(x.features.ret20)&&x.features.ret20>=8),
    one('ma20Slope5>=1',x=>Number.isFinite(x.features.ma20Slope5)&&x.features.ma20Slope5>=1),
    ...common
  ];
  return [
    one('rs20>=4',x=>Number.isFinite(x.features.rs20)&&x.features.rs20>=4),
    one('rs60>=8',x=>Number.isFinite(x.features.rs60)&&x.features.rs60>=8),
    one('dist20>=6',x=>Number.isFinite(x.features.dist20)&&x.features.dist20>=6),
    one('ret60>=20',x=>Number.isFinite(x.features.ret60)&&x.features.ret60>=20),
    one('ma50Slope10>=1',x=>Number.isFinite(x.features.ma50Slope10)&&x.features.ma50Slope10>=1),
    ...common
  ];
}

const needed=[...new Set([...symbols,...symbols.map(benchSymbol)])],data={};
for(const s of needed){
  process.stdout.write('fetch '+s+'... ');
  try{data[s]=await fetchRows(s);console.log(data[s].rows.length)}
  catch(e){console.log('SKIP '+e.message);data[s]={rows:[],splitDays:new Set()}}
}

const rawEvents=[],latest=[];
for(const symbol of symbols){
  const pack=data[symbol],rows=pack.rows,benchPack=data[benchSymbol(symbol)],benchRows=benchPack?.rows||[];
  if(rows.length<120||benchRows.length<80)continue;
  let prevStage=null;
  for(let i=100;i<rows.length-maxH;i++){
    if(hadRecentSplit(rows,pack.splitDays,i))continue;
    const date=dayKey(rows[i].t),hist=rows.slice(0,i+1),bh=benchmarkHist(benchRows,date);
    if(!bh||bh.length<65)continue;
    const m=metrics(hist,bh);if(!m)continue;
    if(rows[i].rawClose<ASSUMPTIONS.liquidity.minPrice||m.avgDollar20<ASSUMPTIONS.liquidity.minAvgDollar20){prevStage=null;continue}
    const stage=classify(m);
    const score=stage?rank(m,stage):null;
    if(!stage){prevStage=null;continue}
    const episodeStart=stage!==prevStage;prevStage=stage;
    if(!episodeStart)continue;
    const features={
      freshReclaimAge:m.freshReclaimAge,sellingFading:m.sellingFading,downsideDecel:m.downsideDecel,volumeShockNearLow:m.volumeShockNearLow,
      momentumShift:round(m.momentumShift),rs20:round(m.rs20),rs60:round(m.rs60),upDownVolumeRatio:round(m.upDownVolumeRatio,2),swingTrend:m.swingTrend,
      higherLow:m.higherLow,dist20:round(m.dist20),dist50:round(m.dist50),pullback60:round(m.pullback60),atr14Pct:round(m.atr14Pct),
      ret5:round(m.ret5),ret20:round(m.ret20),ret60:round(m.ret60),ma20Slope5:round(m.ma20Slope5),ma50Slope10:round(m.ma50Slope10)
    };
    for(const h of horizons){
      const entry=rows[i].close,window=rows.slice(i+1,i+h+1),path=window.map(x=>pct(x.close,entry)).filter(Number.isFinite);
      const outcomeDate=dayKey(rows[i+h].t),benchEntry=bh.at(-1)?.close,bf=benchmarkHist(benchRows,outcomeDate)?.at(-1)?.close;
      const fr=pct(rows[i+h].close,entry),br=pct(bf,benchEntry);
      rawEvents.push({
        symbol,date,sessionIndex:i,horizon:h,stage,rankScore:round(score,1),features,
        forwardReturn:round(fr),benchmarkReturn:round(br),excessReturn:round(Number.isFinite(br)?fr-br:null),
        mae:round(path.length?Math.min(...path):null),mfe:round(path.length?Math.max(...path):null),
        hitPlus7:path.some(x=>x>=7),hitMinus7:path.some(x=>x<=-7)
      });
    }
  }
}

for(const symbol of symbols){
  const pack=data[symbol],rows=pack?.rows||[],benchRows=data[benchSymbol(symbol)]?.rows||[];
  if(rows.length<120||benchRows.length<80)continue;
  const i=rows.length-1;
  if(hadRecentSplit(rows,pack.splitDays,i))continue;
  const date=dayKey(rows[i].t),bh=benchmarkHist(benchRows,date);
  if(!bh||bh.length<65)continue;
  const m=metrics(rows,bh);if(!m)continue;
  if(rows[i].rawClose<ASSUMPTIONS.liquidity.minPrice||m.avgDollar20<ASSUMPTIONS.liquidity.minAvgDollar20)continue;
  const stage=classify(m);if(!stage)continue;
  const score=rank(m,stage);
  latest.push({symbol,name:symbolMeta.get(symbol)?.name,sector:symbolMeta.get(symbol)?.sector,stage,score:round(score,1),date,price:round(m.last),ret5:round(m.ret5),ret20:round(m.ret20),rs20:round(m.rs20),rsi14:round(m.rsi14,1),atr14Pct:round(m.atr14Pct,1),swingTrend:m.swingTrend});
}

const report={
  version:VERSION,generatedAt:new Date().toISOString(),batchIndex,batchCount,range,horizons,assumptions:ASSUMPTIONS,
  symbolCount:symbols.length,symbols,
  horizons:{},
  latestPicks:latest.sort((a,b)=>b.score-a.score)
};
for(const h of horizons){
  const ev=dedupe(rawEvents.filter(x=>x.horizon===h),h);
  report.horizons[h]={overall:summary(ev),byStage:{}};
  for(const stage of ['Early Watch','Recovery','Attractive Growth','Established Move']){
    const x=ev.filter(e=>e.stage===stage);
    const sp=splitChron(x);
    report.horizons[h].byStage[stage]={
      overall:summary(x),train:summary(sp.train),test:summary(sp.test),ranking:rankingReport(x),
      evidence:evidenceSlices(stage,x)
    };
  }
}

fs.mkdirSync('data',{recursive:true});
const out='data/v2-backtest-batch-'+batchIndex+'.json';
fs.writeFileSync(out,JSON.stringify(report,null,2));
console.log('wrote '+out);
console.log(JSON.stringify({
  version:VERSION,batchIndex,
  early:Object.fromEntries(horizons.map(h=>[h,report.horizons[h].byStage['Early Watch']])),
  latestPicks:report.latestPicks.slice(0,20)
},null,2));
