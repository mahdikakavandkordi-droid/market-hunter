export const VERSION='market-hunter-v2-rebuild-h2p10-2026-09-26';

export const ASSUMPTIONS=Object.freeze({
  purpose:'Discovery scanner: which chart should be opened first, not a buy/sell signal.',
  universe:'Canadian-listed instruments from reviewed universe; CAD only by construction.',
  liquidity:{minPrice:2,minAvgDollar20:3000000},
  stagePrinciple:'Stage describes chart maturity; evidence ranks candidates inside a stage.',
  earlyWatch:'Prior weakness near a recent low plus fresh evidence of downside exhaustion/reclaim; no full reversal confirmation required.',
  dedupe:'Backtest evaluates first stage episodes and suppresses same-symbol same-stage overlap for each forward horizon.',
  ranking:'Stage-specific evidence score is fixed before reading outcomes; Recovery keeps base score for eligibility and uses an anti-chase surface score only for shortlist ordering.',
  validation:'5D/10D/20D, benchmark excess, MAE/MFE, chronological 70/30 holdout, batch stability.',
  surface:'Each stage keeps its validated backend surface. The final cross-stage shortlist is capped at six by stage-rank round-robin; raw scores are never compared across stages and no quota is filled.'
});

export const PRIORITY_FLOORS=Object.freeze({
  // Stage-local Review First floors derived from TRAIN q80 distributions only.
  // They do not force a target count and scores are not comparable across stages.
  'Early Watch':Object.freeze({reviewFirst:58.5}),
  'Recovery':Object.freeze({reviewFirst:49.5}),
  'Attractive Growth':Object.freeze({reviewFirst:52.3}),
  'Established Move':Object.freeze({reviewFirst:50.4})
});

export const SURFACE_POLICY=Object.freeze({
  // These are review-workload limits, never quotas.
  'Early Watch':Object.freeze({requiredBand:'Review First',maxVisible:6}),
  // Recovery stays classified in backend after day 2, but stale setups are no longer surfaced.
  'Recovery':Object.freeze({requiredBand:'Review First',maxVisible:6,maxStageAge:2}),
  // Attractive Growth keeps the validated base ranking; no risk-only gate or freshness cap.
  'Attractive Growth':Object.freeze({requiredBand:'Review First',maxVisible:6}),
  // Established Move needs a stricter final surface floor because Review First is too common.
  'Established Move':Object.freeze({requiredBand:'Review First',minScore:60,maxVisible:6})
});

export const INTEGRATED_SURFACE_POLICY=Object.freeze({
  maxVisible:6,
  stageOrder:Object.freeze(['Early Watch','Recovery','Attractive Growth','Established Move']),
  method:'stage-rank-round-robin'
});

export function surfaceEligible(stage,score,row=null){
  const p=SURFACE_POLICY[stage];
  if(!p)return false;
  if(priorityBand(stage,score)!==p.requiredBand)return false;
  if(Number.isFinite(p.minScore)&&(!Number.isFinite(score)||score<p.minScore))return false;
  if(Number.isFinite(p.maxStageAge)){
    if(!Number.isFinite(row?.stageAge))return false;
    if(row.stageAge>p.maxStageAge)return false;
  }
  return true;
}

export function surfaceSelect(stage,rows){
  const p=SURFACE_POLICY[stage];
  if(!p||!Array.isArray(rows))return [];
  const orderScore=x=>stage==='Recovery'?(x?.surfaceScore??x?.score):(x?.score);
  return [...rows]
    .filter(x=>surfaceEligible(stage,x?.score,x))
    .sort((a,b)=>(orderScore(b)??-Infinity)-(orderScore(a)??-Infinity)||String(a?.symbol||'').localeCompare(String(b?.symbol||'')))
    .slice(0,p.maxVisible);
}

export function integratedSurfaceSelect(surfacePicksByStage){
  if(!surfacePicksByStage||typeof surfacePicksByStage!=='object')return [];
  const out=[];
  const order=INTEGRATED_SURFACE_POLICY.stageOrder;
  const maxRank=Math.max(0,...order.map(stage=>Array.isArray(surfacePicksByStage[stage])?surfacePicksByStage[stage].length:0));
  for(let rankIndex=0;rankIndex<maxRank&&out.length<INTEGRATED_SURFACE_POLICY.maxVisible;rankIndex++){
    for(const stage of order){
      const row=surfacePicksByStage[stage]?.[rankIndex];
      if(row&&out.length<INTEGRATED_SURFACE_POLICY.maxVisible){
        out.push({...row,stage,stageRank:rankIndex+1,integratedRank:out.length+1});
      }
    }
  }
  return out;
}

export function priorityBand(stage,score){
  const f=PRIORITY_FLOORS[stage];
  if(!f||!Number.isFinite(score))return 'Stage Member';
  return score>=f.reviewFirst?'Review First':'Stage Member';
}

export function riskFlags(m){
  const flags=[];
  if(Number.isFinite(m.dist20)&&m.dist20>=10)flags.push('Very extended above MA20');
  else if(Number.isFinite(m.dist20)&&m.dist20>=6)flags.push('Extended above MA20');
  if(Number.isFinite(m.rsi14)&&m.rsi14>=80)flags.push('Very high RSI');
  else if(Number.isFinite(m.rsi14)&&m.rsi14>=75)flags.push('High RSI');
  if(Number.isFinite(m.atr14Pct)&&m.atr14Pct>=6)flags.push('High ATR');
  return flags;
}

export function reviewLane(stage,score,m){
  if(priorityBand(stage,score)!=='Review First')return 'Stage Member';
  const heated=riskFlags(m).length>0;
  if(heated&&(stage==='Attractive Growth'||stage==='Established Move'))return 'High Intensity';
  return 'Review First';
}

export const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
export const pct=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a/b-1)*100:null;
export const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
export const median=a=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const dayKey=t=>new Date(t*1000).toISOString().slice(0,10);

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
  let freshReclaimAge=null,freshHighBreakAge=null,lowBroken=false,localLow=null,localHigh=null,highBroken=false;
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
  if(Number.isInteger(hi)){
    localHigh=r[hi].high;
    let latestBreakIndex=null;
    for(let j=hi+1;j<=last;j++){
      const prevClose=r[j-1]?.close;
      if(r[j].close>localHigh&&Number.isFinite(prevClose)&&prevClose<=localHigh)latestBreakIndex=j;
    }
    highBroken=r[last].close>localHigh;
    if(highBroken&&Number.isInteger(latestBreakIndex))freshHighBreakAge=last-latestBreakIndex;
  }
  return {higherHigh,higherLow,swingTrend,localLow,localHigh,freshReclaimAge,freshHighBreakAge,lowBroken,highBroken};
}

export function benchmarkHist(rows,date){
  const i=rows.findLastIndex(x=>dayKey(x.t)<=date);
  return i>=0?rows.slice(0,i+1):null;
}

export function metrics(r,bench){
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

export function classify(m){
  const trendAligned=m.weeklyUp&&m.last>m.ma20&&m.ma20>m.ma50&&m.ma20Slope5>0;
  const established=trendAligned&&m.ma50Slope10>0&&m.ret60>=12&&m.pullback60>-12;
  if(established)return 'Established Move';
  const attractive=trendAligned&&m.ret20>0&&m.pullback60>-18;
  if(attractive)return 'Attractive Growth';
  const recovery=m.priorWeakness&&!m.advancedNearHigh&&m.last>=m.ma20*.98&&m.ret5>0&&m.momentumShift>0&&m.pullback60<=-4;
  if(recovery)return 'Recovery';
  const freshReclaim=Number.isFinite(m.freshReclaimAge)&&m.freshReclaimAge<=3;
  // Early Watch should not be admitted by a stale/bare reclaim or by fading sell volume alone.
  // Two defensible discovery paths remain:
  // 1) exhaustion: downside is decelerating while abnormal participation appears near the low;
  // 2) supported reclaim: a fresh reclaim backed by deceleration, volume shock, or RS that is not deeply weak.
  const exhaustion=m.downsideDecel===true&&m.volumeShockNearLow===true;
  const supportedReclaim=freshReclaim&&(
    m.downsideDecel===true||
    m.volumeShockNearLow===true||
    (Number.isFinite(m.rs20)&&m.rs20>=-5)
  );
  const earlyEvidence=exhaustion||supportedReclaim;
  const early=m.priorWeakness&&!m.advancedNearHigh&&m.nearLow20&&earlyEvidence;
  return early?'Early Watch':null;
}

function scale(x,lo,hi){return Number.isFinite(x)?clamp((x-lo)/(hi-lo),0,1):0}

export function rank(m,stage){
  let p=0;
  if(stage==='Early Watch'){
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

export function surfaceRank(m,stage,baseScore=rank(m,stage)){
  if(!Number.isFinite(baseScore))return baseScore;
  if(stage!=='Recovery')return baseScore;
  const chasePenalty=Number.isFinite(m?.ret20)?Math.max(0,m.ret20-3)*1.5:0;
  return clamp(baseScore-chasePenalty,0,100);
}
