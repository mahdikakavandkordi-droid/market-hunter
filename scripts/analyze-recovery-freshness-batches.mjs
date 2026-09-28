import fs from 'node:fs';

const reports=[0,1,2,3].map(i=>({batch:i,...JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8'))}));
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const median=a=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
function summary(a){
  if(!a.length)return null;
  const r=a.map(x=>x.forwardReturn).filter(Number.isFinite),ex=a.map(x=>x.excessReturn).filter(Number.isFinite);
  return {n:r.length,mean:round(avg(r)),median:round(median(r)),
    positiveRate:round(r.filter(x=>x>0).length/r.length*100,1),
    benchmarkBeatRate:ex.length?round(ex.filter(x=>x>0).length/ex.length*100,1):null,
    meanExcess:round(avg(ex)),avgMAE:round(avg(a.map(x=>x.mae))),avgMFE:round(avg(a.map(x=>x.mfe)))};
}
function replay(report,h,maxAge=null){
  const dates=[...(report.recoverySurfaceReplay?.dates||[])].sort();
  const xs=(report.recoverySurfaceReplay?.candidates||[]).filter(x=>x.horizon===h&&(maxAge===null||x.stageAge<=maxAge));
  const byDate=new Map();
  for(const x of xs){if(!byDate.has(x.date))byDate.set(x.date,[]);byDate.get(x.date).push(x);}
  const obs=[],counts=[];
  for(const date of dates){
    const sel=[...(byDate.get(date)||[])]
      .sort((a,b)=>(b.surfaceScore??b.score)-(a.surfaceScore??a.score)||a.symbol.localeCompare(b.symbol))
      .slice(0,6);
    counts.push(sel.length);obs.push(...sel);
  }
  const cut=dates[Math.floor(dates.length*.7)]||null;
  const active=counts.filter(n=>n>0).length;
  return {
    selection:{daysWithPicks:active,pctDaysWithPicks:round(active/dates.length*100,1),averageVisibleActiveDays:active?round(obs.length/active,2):null},
    overall:summary(obs),recentHoldout:summary(obs.filter(x=>cut&&x.date>=cut))
  };
}
const result={generatedAt:new Date().toISOString(),note:'Batch stability for Recovery freshness only. Production logic unchanged.',horizons:{}};
for(const h of [5,10,20]){
  result.horizons[h]=reports.map(r=>{
    const base=replay(r,h,null),a2=replay(r,h,2),a3=replay(r,h,3);
    return {batch:r.batch,baseline:base,maxAge2:a2,maxAge3:a3,
      deltaAge2:{overallMean:round((a2.overall?.mean??NaN)-(base.overall?.mean??NaN)),holdoutMean:round((a2.recentHoldout?.mean??NaN)-(base.recentHoldout?.mean??NaN)),holdoutExcess:round((a2.recentHoldout?.meanExcess??NaN)-(base.recentHoldout?.meanExcess??NaN))},
      deltaAge3:{overallMean:round((a3.overall?.mean??NaN)-(base.overall?.mean??NaN)),holdoutMean:round((a3.recentHoldout?.mean??NaN)-(base.recentHoldout?.mean??NaN)),holdoutExcess:round((a3.recentHoldout?.meanExcess??NaN)-(base.recentHoldout?.meanExcess??NaN))}
    };
  });
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/recovery-freshness-batch-stability.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
