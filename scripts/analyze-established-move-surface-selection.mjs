import fs from 'node:fs';

const reports=[0,1,2,3].map(i=>({batch:i,...JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8'))}));
const MAX_VISIBLE=6;
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const median=a=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
function summary(a){
  if(!a.length)return null;
  const r=a.map(x=>x.forwardReturn).filter(Number.isFinite),ex=a.map(x=>x.excessReturn).filter(Number.isFinite);
  return {n:r.length,mean:round(avg(r)),median:round(median(r)),positiveRate:round(r.filter(x=>x>0).length/r.length*100,1),benchmarkBeatRate:ex.length?round(ex.filter(x=>x>0).length/ex.length*100,1):null,meanExcess:round(avg(ex)),avgMAE:round(avg(a.map(x=>x.mae))),avgMFE:round(avg(a.map(x=>x.mfe)))};
}
function replay(report,h,filterFn){
  const dates=[...(report.establishedMoveSurfaceReplay?.dates||[])].sort();
  const pool=(report.establishedMoveSurfaceReplay?.candidates||[]).filter(x=>x.horizon===h&&filterFn(x));
  const byDate=new Map();
  for(const x of pool){if(!byDate.has(x.date))byDate.set(x.date,[]);byDate.get(x.date).push(x);}
  const obs=[],counts=[],crowdedSel=[],crowdedEx=[];
  for(const date of dates){
    const eligible=[...(byDate.get(date)||[])].sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
    const sel=eligible.slice(0,MAX_VISIBLE);
    counts.push(sel.length);obs.push(...sel);
    if(eligible.length>MAX_VISIBLE){crowdedSel.push(...sel);crowdedEx.push(...eligible.slice(MAX_VISIBLE));}
  }
  const active=counts.filter(n=>n>0).length,cut=dates[Math.floor(dates.length*.7)]||null;
  return {selection:{scanDays:dates.length,daysWithPicks:active,pctDaysWithPicks:round(active/dates.length*100,1),averageVisibleAllDays:round(obs.length/dates.length,2),averageVisibleActiveDays:active?round(obs.length/active,2):null},overall:summary(obs),recentHoldout:summary(obs.filter(x=>cut&&x.date>=cut)),crowdedDays:{selectedTop6:summary(crowdedSel),excludedBelow6:summary(crowdedEx)}};
}
const policies={
  baseline:x=>true,
  cleanReview:x=>x.cleanReview===true,
  score55:x=>x.score>=55,
  score58:x=>x.score>=58,
  score60:x=>x.score>=60
};
const result={generatedAt:new Date().toISOString(),note:'Established Move daily surface selection stability. Diagnostic only; production unchanged.',horizons:{}};
for(const h of [5,10,20]){
  result.horizons[h]={};
  for(const [name,filterFn] of Object.entries(policies)){
    const perBatch=reports.map(r=>({batch:r.batch,...replay(r,h,filterFn)}));
    result.horizons[h][name]={perBatch};
  }
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/established-move-surface-selection-stability.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
