import fs from 'node:fs';

const reports=[0,1,2,3].map(i=>({batch:i,...JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8'))}));
const stages=['Early Watch','Recovery','Attractive Growth','Established Move'];
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const median=a=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
function summary(a){
 if(!a.length)return null;
 const r=a.map(x=>x.forwardReturn).filter(Number.isFinite),ex=a.map(x=>x.excessReturn).filter(Number.isFinite);
 return {n:r.length,mean:round(avg(r)),median:round(median(r)),positiveRate:round(r.filter(x=>x>0).length/r.length*100,1),benchmarkBeatRate:ex.length?round(ex.filter(x=>x>0).length/ex.length*100,1):null,meanExcess:round(avg(ex)),avgMAE:round(avg(a.map(x=>x.mae))),avgMFE:round(avg(a.map(x=>x.mfe)))};
}
function build(report,h){
 const dates=[...(report.attractiveGrowthSurfaceReplay?.dates||report.establishedMoveSurfaceReplay?.dates||[])].sort();
 const maps=Object.fromEntries(stages.map(s=>[s,new Map()]));
 const put=(s,d,x)=>{const m=maps[s];if(!m.has(d))m.set(d,[]);m.get(d).push(x)};
 for(const x of (report.surfaceReplay?.candidates||[]))if(x.horizon===h)put('Early Watch',x.date,x);
 for(const x of (report.recoverySurfaceReplay?.candidates||[]))if(x.horizon===h&&Number.isFinite(x.stageAge)&&x.stageAge<=2)put('Recovery',x.date,x);
 for(const x of (report.attractiveGrowthSurfaceReplay?.candidates||[]))if(x.horizon===h)put('Attractive Growth',x.date,x);
 for(const x of (report.establishedMoveSurfaceReplay?.candidates||[]))if(x.horizon===h&&x.score>=60)put('Established Move',x.date,x);
 const byDate=new Map();
 for(const d of dates){
  byDate.set(d,{
   'Early Watch':[...(maps['Early Watch'].get(d)||[])].sort((a,b)=>b.score-a.score).slice(0,6),
   'Recovery':[...(maps['Recovery'].get(d)||[])].sort((a,b)=>(b.surfaceScore??b.score)-(a.surfaceScore??a.score)).slice(0,6),
   'Attractive Growth':[...(maps['Attractive Growth'].get(d)||[])].sort((a,b)=>b.score-a.score).slice(0,6),
   'Established Move':[...(maps['Established Move'].get(d)||[])].sort((a,b)=>b.score-a.score).slice(0,6)
  });
 }
 return {dates,byDate};
}
function rr6(rows){
 const out=[];
 for(let rank=0;rank<6&&out.length<6;rank++){
  for(const s of stages){const x=rows[s]?.[rank];if(x&&out.length<6)out.push({...x,stage:s});}
 }
 return out;
}
function evalReport(report,h,mode){
 const {dates,byDate}=build(report,h),obs=[],counts=[];
 for(const d of dates){
  const rows=byDate.get(d);
  const sel=mode==='uncapped'?stages.flatMap(s=>(rows[s]||[]).map(x=>({...x,stage:s}))):rr6(rows);
  obs.push(...sel);counts.push(sel.length);
 }
 const cut=dates[Math.floor(dates.length*.7)]||null;
 return {workload:{average:round(avg(counts),2),max:Math.max(0,...counts)},overall:summary(obs),recentHoldout:summary(obs.filter(x=>cut&&x.date>=cut))};
}
const result={generatedAt:new Date().toISOString(),note:'Per-batch validation of integrated round-robin max6. Diagnostic only.',horizons:{}};
for(const h of [5,10,20]){
 result.horizons[h]=reports.map(r=>{
  const uncapped=evalReport(r,h,'uncapped'),cap6=evalReport(r,h,'cap6');
  return {batch:r.batch,uncapped,cap6,delta:{
    holdoutMean:round((cap6.recentHoldout?.mean??NaN)-(uncapped.recentHoldout?.mean??NaN)),
    holdoutExcess:round((cap6.recentHoldout?.meanExcess??NaN)-(uncapped.recentHoldout?.meanExcess??NaN)),
    overallMean:round((cap6.overall?.mean??NaN)-(uncapped.overall?.mean??NaN))
  }};
 });
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/integrated-cap6-batch-stability.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
