import fs from 'node:fs';

const reports=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const MAX_VISIBLE=6;
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const median=a=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
function summary(a){
  if(!a.length)return null;
  const r=a.map(x=>x.forwardReturn).filter(Number.isFinite),ex=a.map(x=>x.excessReturn).filter(Number.isFinite);
  return {n:r.length,mean:round(avg(r)),median:round(median(r)),positiveRate:round(r.filter(x=>x>0).length/r.length*100,1),
    benchmarkBeatRate:ex.length?round(ex.filter(x=>x>0).length/ex.length*100,1):null,meanExcess:round(avg(ex)),
    avgMAE:round(avg(a.map(x=>x.mae))),avgMFE:round(avg(a.map(x=>x.mfe)))};
}
const dates=[...new Set(reports.flatMap(r=>r.recoverySurfaceReplay?.dates||[]))].sort();
const candidates=reports.flatMap(r=>r.recoverySurfaceReplay?.candidates||[]);
const horizons=[5,10,20];

function featureProfile(rows){
  if(!rows.length)return null;
  const mean=k=>round(avg(rows.map(x=>x[k]).filter(Number.isFinite)),2);
  const rate=f=>round(rows.filter(f).length/rows.length*100,1);
  return {
    n:rows.length,
    score:mean('score'),rs20:mean('rs20'),momentumShift:mean('momentumShift'),
    upDownVolumeRatio:mean('upDownVolumeRatio'),atr14Pct:mean('atr14Pct'),ret5:mean('ret5'),ret20:mean('ret20'),
    highBrokenRate:rate(x=>x.highBroken===true),
    freshHighBreak3Rate:rate(x=>Number.isFinite(x.freshHighBreakAge)&&x.freshHighBreakAge<=3),
    higherLowRate:rate(x=>x.higherLow===true),
    structureImprovingRate:rate(x=>x.swingTrend==='Structure improving'||x.swingTrend==='Higher highs + higher lows')
  };
}

function policyReplay(h,filterFn,scoreFn=x=>x.score){
  const pool=candidates.filter(x=>x.horizon===h&&filterFn(x));
  const byDate=new Map();
  for(const x of pool){if(!byDate.has(x.date))byDate.set(x.date,[]);byDate.get(x.date).push(x);}
  const observations=[],counts=[],crowdedSelected=[],crowdedExcluded=[];
  for(const date of dates){
    const eligible=[...(byDate.get(date)||[])].map(x=>({...x,policyScore:scoreFn(x)}))
      .sort((a,b)=>b.policyScore-a.policyScore||b.score-a.score||a.symbol.localeCompare(b.symbol));
    const selected=eligible.slice(0,MAX_VISIBLE).map((x,i)=>({...x,rank:i+1}));
    counts.push(selected.length); observations.push(...selected);
    if(eligible.length>MAX_VISIBLE){crowdedSelected.push(...selected);crowdedExcluded.push(...eligible.slice(MAX_VISIBLE));}
  }
  const active=counts.filter(n=>n>0).length;
  const cut=dates[Math.floor(dates.length*.7)]||null;
  const sel=summary(crowdedSelected),exc=summary(crowdedExcluded);
  return {
    selection:{scanDays:dates.length,daysWithPicks:active,zeroPickDays:dates.length-active,pctDaysWithPicks:round(active/dates.length*100,1),
      averageVisibleAllDays:round(observations.length/dates.length,2),averageVisibleActiveDays:active?round(observations.length/active,2):null,maxVisibleObserved:Math.max(0,...counts)},
    overall:summary(observations),
    chronologicalSplit:{cutDate:cut,train:summary(observations.filter(x=>!cut||x.date<cut)),recentHoldout:summary(observations.filter(x=>cut&&x.date>=cut))},
    crowdedDays:{selectedTop6:sel,excludedBelow6:exc,
      selectedProfile:featureProfile(crowdedSelected),excludedProfile:featureProfile(crowdedExcluded),
      selectedMinusExcluded:{
      mean:round((sel?.mean??NaN)-(exc?.mean??NaN)),meanExcess:round((sel?.meanExcess??NaN)-(exc?.meanExcess??NaN)),
      positiveRate:round((sel?.positiveRate??NaN)-(exc?.positiveRate??NaN),1)}}
  };
}

const result={generatedAt:new Date().toISOString(),note:'Diagnostic only. Recovery engine and frontend unchanged.',dateRange:{start:dates[0]||null,end:dates.at(-1)||null,scanDays:dates.length},horizons:{}};
for(const h of horizons){
  const freshBreak3=x=>x.highBroken===true&&Number.isFinite(x.freshHighBreakAge)&&x.freshHighBreakAge<=3;
  result.horizons[h]={
    currentReviewFirst:policyReplay(h,()=>true),
    reviewFirstRsNonNegative:policyReplay(h,x=>Number.isFinite(x.rs20)&&x.rs20>=0),
    reviewFirstAndMinorHighBroken:policyReplay(h,x=>x.highBroken===true),
    reviewFirstAndFreshHighBreak3:policyReplay(h,freshBreak3),
    reviewFirstEpisodeStart:policyReplay(h,x=>x.stageAge===0),
    reviewFirstStageAge2:policyReplay(h,x=>Number.isFinite(x.stageAge)&&x.stageAge<=2),
    reviewFirstStageAge3:policyReplay(h,x=>Number.isFinite(x.stageAge)&&x.stageAge<=3),
    reviewFirstStageAge3OrFreshBreak3:policyReplay(h,x=>(Number.isFinite(x.stageAge)&&x.stageAge<=3)||freshBreak3(x)),
    rankMinorHighBoost:policyReplay(h,()=>true,x=>x.score+(x.highBroken===true?8:0)),
    rankFreshHighBreakBoost:policyReplay(h,()=>true,x=>x.score+(Number.isFinite(x.freshHighBreakAge)&&x.freshHighBreakAge<=3?10:0)),
    rankRsOnly:policyReplay(h,()=>true,x=>Number.isFinite(x.rs20)?x.rs20:-999),
    rankRsMomentum:policyReplay(h,()=>true,x=>(Number.isFinite(x.rs20)?x.rs20*2:0)+(Number.isFinite(x.momentumShift)?x.momentumShift:0))
  };
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/recovery-surface-replay-diagnostic.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
