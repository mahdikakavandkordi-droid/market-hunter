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

function policyReplay(h,filterFn){
  const pool=candidates.filter(x=>x.horizon===h&&filterFn(x));
  const byDate=new Map();
  for(const x of pool){if(!byDate.has(x.date))byDate.set(x.date,[]);byDate.get(x.date).push(x);}
  const observations=[],counts=[];
  for(const date of dates){
    const selected=[...(byDate.get(date)||[])].sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol)).slice(0,MAX_VISIBLE);
    counts.push(selected.length); observations.push(...selected);
  }
  const active=counts.filter(n=>n>0).length;
  const cut=dates[Math.floor(dates.length*.7)]||null;
  return {
    selection:{scanDays:dates.length,daysWithPicks:active,zeroPickDays:dates.length-active,pctDaysWithPicks:round(active/dates.length*100,1),
      averageVisibleAllDays:round(observations.length/dates.length,2),averageVisibleActiveDays:active?round(observations.length/active,2):null,maxVisibleObserved:Math.max(0,...counts)},
    overall:summary(observations),
    chronologicalSplit:{cutDate:cut,train:summary(observations.filter(x=>!cut||x.date<cut)),recentHoldout:summary(observations.filter(x=>cut&&x.date>=cut))}
  };
}

const result={generatedAt:new Date().toISOString(),note:'Diagnostic only. Recovery engine and frontend unchanged.',dateRange:{start:dates[0]||null,end:dates.at(-1)||null,scanDays:dates.length},horizons:{}};
for(const h of horizons){
  result.horizons[h]={
    currentReviewFirst:policyReplay(h,()=>true),
    reviewFirstAndMinorHighBroken:policyReplay(h,x=>x.highBroken===true),
    reviewFirstAndFreshHighBreak3:policyReplay(h,x=>x.highBroken===true&&Number.isFinite(x.freshHighBreakAge)&&x.freshHighBreakAge<=3)
  };
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/recovery-surface-replay-diagnostic.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
