import fs from 'node:fs';

const reports=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const dates=[...new Set(reports.flatMap(r=>r.surfaceReplay?.dates||r.surfaceReplayDates||r.attractiveGrowthSurfaceReplay?.dates||r.establishedMoveSurfaceReplay?.dates||[]))].sort();

function pushMap(map,date,row){if(!map.has(date))map.set(date,[]);map.get(date).push(row);}
const ew=new Map(),rec=new Map(),ag=new Map(),em=new Map();

for(const r of reports){
  for(const x of (r.surfaceReplay?.candidates||[])) if(x.horizon===5) pushMap(ew,x.date,x);
  for(const x of (r.recoverySurfaceReplay?.candidates||[])) if(x.horizon===5&&Number.isFinite(x.stageAge)&&x.stageAge<=2) pushMap(rec,x.date,x);
  for(const x of (r.attractiveGrowthSurfaceReplay?.candidates||[])) if(x.horizon===5) pushMap(ag,x.date,x);
  for(const x of (r.establishedMoveSurfaceReplay?.candidates||[])) if(x.horizon===5&&Number.isFinite(x.score)&&x.score>=60) pushMap(em,x.date,x);
}
const select=(rows,stage)=>{
  const score=x=>stage==='Recovery'?(x.surfaceScore??x.score):x.score;
  return [...rows].sort((a,b)=>(score(b)??-Infinity)-(score(a)??-Infinity)||String(a.symbol).localeCompare(String(b.symbol))).slice(0,6);
};
const daily=[];
for(const date of dates){
  const stages={
    'Early Watch':select(ew.get(date)||[],'Early Watch'),
    'Recovery':select(rec.get(date)||[],'Recovery'),
    'Attractive Growth':select(ag.get(date)||[],'Attractive Growth'),
    'Established Move':select(em.get(date)||[],'Established Move')
  };
  const all=Object.entries(stages).flatMap(([stage,rows])=>rows.map(x=>({stage,...x})));
  const symbols=all.map(x=>x.symbol);
  const duplicates=[...new Set(symbols.filter((s,i)=>symbols.indexOf(s)!==i))];
  daily.push({date,total:all.length,duplicates,counts:Object.fromEntries(Object.entries(stages).map(([k,v])=>[k,v.length]))});
}
const dist={};
for(const d of daily)dist[d.total]=(dist[d.total]||0)+1;
const totalDays=daily.length;
const avg=arr=>arr.length?arr.reduce((s,v)=>s+v,0)/arr.length:null;
const quantile=(arr,q)=>{const x=[...arr].sort((a,b)=>a-b);if(!x.length)return null;const p=(x.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return lo===hi?x[lo]:x[lo]+(x[hi]-x[lo])*(p-lo)};
const stageAverages={};
for(const stage of ['Early Watch','Recovery','Attractive Growth','Established Move']){
 stageAverages[stage]=round(avg(daily.map(d=>d.counts[stage])),2);
}
const result={
  generatedAt:new Date().toISOString(),
  note:'Integrated historical workload audit using each stage current validated surface policy. No cross-stage cap applied.',
  dateRange:{start:dates[0]||null,end:dates.at(-1)||null,scanDays:totalDays},
  workload:{
    averageChartsPerDay:round(avg(daily.map(d=>d.total)),2),
    medianChartsPerDay:round(quantile(daily.map(d=>d.total),.5),1),
    p75:round(quantile(daily.map(d=>d.total),.75),1),
    p90:round(quantile(daily.map(d=>d.total),.9),1),
    max:Math.max(0,...daily.map(d=>d.total)),
    daysOver6:daily.filter(d=>d.total>6).length,
    pctDaysOver6:round(daily.filter(d=>d.total>6).length/totalDays*100,1),
    daysOver8:daily.filter(d=>d.total>8).length,
    pctDaysOver8:round(daily.filter(d=>d.total>8).length/totalDays*100,1),
    daysOver10:daily.filter(d=>d.total>10).length,
    pctDaysOver10:round(daily.filter(d=>d.total>10).length/totalDays*100,1),
    distribution:dist,
    stageAverages
  },
  overlap:{
    daysWithCrossStageDuplicate:daily.filter(d=>d.duplicates.length).length,
    examples:daily.filter(d=>d.duplicates.length).slice(0,20)
  },
  recent20Days:daily.slice(-20)
};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/integrated-surface-workload-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
