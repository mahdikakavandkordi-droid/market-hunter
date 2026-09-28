import fs from 'node:fs';

const reports=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const MAX_VISIBLE=6;
const dates=[...new Set(reports.flatMap(r=>r.attractiveGrowthSurfaceReplay?.dates||[]))].sort();
const candidates=reports.flatMap(r=>r.attractiveGrowthSurfaceReplay?.candidates||[]);
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
function dailyEqualWeight(byDate){
  const rows=[];
  for(const [date,xs] of byDate){
    if(!xs.length)continue;
    rows.push({date,forwardReturn:avg(xs.map(x=>x.forwardReturn)),excessReturn:avg(xs.map(x=>x.excessReturn)),mae:avg(xs.map(x=>x.mae)),mfe:avg(xs.map(x=>x.mfe))});
  }
  return summary(rows);
}
function replay(h,filterFn,scoreFn=x=>x.score){
  const pool=candidates.filter(x=>x.horizon===h&&filterFn(x));
  const byDateRaw=new Map();
  for(const x of pool){if(!byDateRaw.has(x.date))byDateRaw.set(x.date,[]);byDateRaw.get(x.date).push(x);}
  const byDateSelected=new Map(),obs=[],counts=[],crowdedSelected=[],crowdedExcluded=[];
  for(const date of dates){
    const eligible=[...(byDateRaw.get(date)||[])].map(x=>({...x,policyScore:scoreFn(x)})).sort((a,b)=>b.policyScore-a.policyScore||b.score-a.score||a.symbol.localeCompare(b.symbol));
    const sel=eligible.slice(0,MAX_VISIBLE);
    byDateSelected.set(date,sel);counts.push(sel.length);obs.push(...sel);
    if(eligible.length>MAX_VISIBLE){crowdedSelected.push(...sel);crowdedExcluded.push(...eligible.slice(MAX_VISIBLE));}
  }
  const active=counts.filter(n=>n>0).length;
  const cut=dates[Math.floor(dates.length*.7)]||null;
  return {
    selection:{scanDays:dates.length,daysWithPicks:active,zeroPickDays:dates.length-active,pctDaysWithPicks:round(active/dates.length*100,1),
      averageVisibleAllDays:round(obs.length/dates.length,2),averageVisibleActiveDays:active?round(obs.length/active,2):null,maxVisibleObserved:Math.max(0,...counts)},
    overall:summary(obs),
    recentHoldout:summary(obs.filter(x=>cut&&x.date>=cut)),
    dailyEqualWeight:dailyEqualWeight(byDateSelected),
    crowdedDays:{selectedTop6:summary(crowdedSelected),excludedBelow6:summary(crowdedExcluded)}
  };
}
const result={generatedAt:new Date().toISOString(),note:'Daily Attractive Growth replay. Diagnostic only; production surface unchanged.',dateRange:{start:dates[0]||null,end:dates.at(-1)||null,scanDays:dates.length},horizons:{}};
for(const h of [5,10,20]){
  const pool=candidates.filter(x=>x.horizon===h);
  const ageBuckets={
    age0to2:summary(pool.filter(x=>Number.isFinite(x.stageAge)&&x.stageAge<=2)),
    age3to5:summary(pool.filter(x=>Number.isFinite(x.stageAge)&&x.stageAge>=3&&x.stageAge<=5)),
    age6to10:summary(pool.filter(x=>Number.isFinite(x.stageAge)&&x.stageAge>=6&&x.stageAge<=10)),
    age11to20:summary(pool.filter(x=>Number.isFinite(x.stageAge)&&x.stageAge>=11&&x.stageAge<=20)),
    age21plus:summary(pool.filter(x=>Number.isFinite(x.stageAge)&&x.stageAge>=21))
  };
  result.horizons[h]={
    currentReviewFirst:replay(h,()=>true),
    cleanReview:replay(h,x=>x.cleanReview===true),
    heatedOnly:replay(h,x=>x.cleanReview===false),
    riskPenalty6:replay(h,()=>true,x=>x.score-6*((x.riskFlags||[]).length)),
    cleanFirstOrdering:replay(h,()=>true,x=>x.score+(x.cleanReview===true?20:0)),
    ageBuckets
  };
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/attractive-growth-surface-replay.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
