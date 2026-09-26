import fs from 'node:fs';

const reports=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const stages=['Early Watch','Recovery','Attractive Growth','Established Move'];
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const median=a=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
function summary(a){
 if(!a.length)return null;
 const r=a.map(x=>x.forwardReturn).filter(Number.isFinite),ex=a.map(x=>x.excessReturn).filter(Number.isFinite);
 return {n:r.length,mean:round(avg(r)),median:round(median(r)),positiveRate:round(r.filter(x=>x>0).length/r.length*100,1),benchmarkBeatRate:ex.length?round(ex.filter(x=>x>0).length/ex.length*100,1):null,meanExcess:round(avg(ex)),avgMAE:round(avg(a.map(x=>x.mae))),avgMFE:round(avg(a.map(x=>x.mfe)))};
}
function dailyEW(rows){return [...rows].sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol)).slice(0,6);}
function dailyRecovery(rows){return [...rows].filter(x=>Number.isFinite(x.stageAge)&&x.stageAge<=2).sort((a,b)=>(b.surfaceScore??b.score)-(a.surfaceScore??a.score)||a.symbol.localeCompare(b.symbol)).slice(0,6);}
function dailyAG(rows){return [...rows].sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol)).slice(0,6);}
function dailyEM(rows){return [...rows].filter(x=>x.score>=60).sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol)).slice(0,6);}

function selectStageRows(h){
 const dates=[...new Set(reports.flatMap(r=>r.attractiveGrowthSurfaceReplay?.dates||r.establishedMoveSurfaceReplay?.dates||[]))].sort();
 const maps=Object.fromEntries(stages.map(s=>[s,new Map()]));
 const put=(stage,date,row)=>{const m=maps[stage];if(!m.has(date))m.set(date,[]);m.get(date).push(row)};
 for(const r of reports){
   for(const x of (r.surfaceReplay?.candidates||[])) if(x.horizon===h) put('Early Watch',x.date,x);
   for(const x of (r.recoverySurfaceReplay?.candidates||[])) if(x.horizon===h) put('Recovery',x.date,x);
   for(const x of (r.attractiveGrowthSurfaceReplay?.candidates||[])) if(x.horizon===h) put('Attractive Growth',x.date,x);
   for(const x of (r.establishedMoveSurfaceReplay?.candidates||[])) if(x.horizon===h) put('Established Move',x.date,x);
 }
 const out=new Map();
 for(const date of dates){
   out.set(date,{
     'Early Watch':dailyEW(maps['Early Watch'].get(date)||[]).map(x=>({stage:'Early Watch',...x})),
     'Recovery':dailyRecovery(maps['Recovery'].get(date)||[]).map(x=>({stage:'Recovery',...x})),
     'Attractive Growth':dailyAG(maps['Attractive Growth'].get(date)||[]).map(x=>({stage:'Attractive Growth',...x})),
     'Established Move':dailyEM(maps['Established Move'].get(date)||[]).map(x=>({stage:'Established Move',...x}))
   });
 }
 return {dates,byDate:out};
}
function fixed2(stageRows){return stages.flatMap(s=>(stageRows[s]||[]).slice(0,2));}
function roundRobin(stageRows,maxTotal){
 const out=[];
 for(let rank=0;rank<6&&out.length<maxTotal;rank++){
   for(const s of stages){
     const x=stageRows[s]?.[rank];
     if(x&&out.length<maxTotal)out.push(x);
   }
 }
 return out;
}
function evaluate(h,selector){
 const {dates,byDate}=selectStageRows(h);
 const picked=[],dropped=[],counts=[],stageCounts=Object.fromEntries(stages.map(s=>[s,0]));
 const perDay=new Map();
 for(const date of dates){
   const rows=byDate.get(date),all=stages.flatMap(s=>rows[s]);
   const sel=selector(rows,all);
   const keys=new Set(sel.map(x=>x.stage+'|'+x.symbol));
   const drop=all.filter(x=>!keys.has(x.stage+'|'+x.symbol));
   picked.push(...sel);dropped.push(...drop);counts.push(sel.length);perDay.set(date,sel);
   for(const x of sel)stageCounts[x.stage]++;
 }
 const cut=dates[Math.floor(dates.length*.7)]||null;
 const dayRows=[];
 for(const [date,xs] of perDay){if(xs.length)dayRows.push({date,forwardReturn:avg(xs.map(x=>x.forwardReturn)),excessReturn:avg(xs.map(x=>x.excessReturn)),mae:avg(xs.map(x=>x.mae)),mfe:avg(xs.map(x=>x.mfe))});}
 return {
   workload:{average:round(avg(counts),2),median:round(median(counts),1),max:Math.max(0,...counts),daysOver6:counts.filter(x=>x>6).length,pctDaysOver6:round(counts.filter(x=>x>6).length/counts.length*100,1),zeroDays:counts.filter(x=>x===0).length},
   overall:summary(picked),
   recentHoldout:summary(picked.filter(x=>cut&&x.date>=cut)),
   dailyEqualWeight:summary(dayRows),
   dropped:summary(dropped),
   stageShare:Object.fromEntries(stages.map(s=>[s,{n:stageCounts[s],pct:round(stageCounts[s]/Math.max(1,picked.length)*100,1)}]))
 };
}
const result={generatedAt:new Date().toISOString(),note:'Cross-stage shortlist diagnostic. Stage scores are never compared across stages.',horizons:{}};
for(const h of [5,10,20]){
 result.horizons[h]={
   uncapped:evaluate(h,(rows,all)=>all),
   fixed2Each:evaluate(h,rows=>fixed2(rows)),
   roundRobin8:evaluate(h,rows=>roundRobin(rows,8)),
   roundRobin6:evaluate(h,rows=>roundRobin(rows,6))
 };
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/integrated-cross-stage-cap-diagnostic.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
