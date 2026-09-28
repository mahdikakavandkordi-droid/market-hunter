import fs from 'node:fs';

const reports=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const dates=[...new Set(reports.flatMap(r=>r.recoverySurfaceReplay?.dates||[]))].sort();
const candidates=reports.flatMap(r=>r.recoverySurfaceReplay?.candidates||[]);
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
function replay(h,maxAge=null){
  const xs=candidates.filter(x=>x.horizon===h&&(maxAge===null||x.stageAge<=maxAge));
  const byDate=new Map();
  for(const x of xs){if(!byDate.has(x.date))byDate.set(x.date,[]);byDate.get(x.date).push(x);}
  const obs=[],counts=[];
  for(const date of dates){
    const sel=[...(byDate.get(date)||[])].sort((a,b)=>(b.surfaceScore??b.score)-(a.surfaceScore??a.score)||a.symbol.localeCompare(b.symbol)).slice(0,6);
    counts.push(sel.length);obs.push(...sel);
  }
  const active=counts.filter(n=>n>0).length;
  const cut=dates[Math.floor(dates.length*.7)]||null;
  return {
    selection:{daysWithPicks:active,zeroPickDays:dates.length-active,pctDaysWithPicks:round(active/dates.length*100,1),
      averageVisibleActiveDays:active?round(obs.length/active,2):null},
    overall:summary(obs),
    recentHoldout:summary(obs.filter(x=>cut&&x.date>=cut))
  };
}
const ageBuckets=[
  {name:'age0to2',test:x=>x.stageAge>=0&&x.stageAge<=2},
  {name:'age3to5',test:x=>x.stageAge>=3&&x.stageAge<=5},
  {name:'age6to10',test:x=>x.stageAge>=6&&x.stageAge<=10},
  {name:'age11plus',test:x=>x.stageAge>=11}
];

const result={generatedAt:new Date().toISOString(),note:'Diagnostic only. Tests whether Recovery quality decays with stage age. Production logic unchanged.',horizons:{}};
for(const h of [5,10,20]){
  const pool=candidates.filter(x=>x.horizon===h);
  result.horizons[h]={
    ageBuckets:Object.fromEntries(ageBuckets.map(b=>[b.name,summary(pool.filter(b.test))])),
    surfacePolicies:{
      noAgeLimit:replay(h,null),
      maxAge2:replay(h,2),
      maxAge3:replay(h,3),
      maxAge5:replay(h,5),
      maxAge7:replay(h,7),
      maxAge10:replay(h,10)
    }
  };
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/recovery-stage-age-diagnostic.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
