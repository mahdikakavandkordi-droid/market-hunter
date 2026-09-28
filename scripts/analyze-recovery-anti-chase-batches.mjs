import fs from 'node:fs';

const MAX_VISIBLE=6;
const reports=[0,1,2,3].map(i=>({batch:i,...JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8'))}));
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const median=a=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
function summary(a){
  if(!a.length)return null;
  const r=a.map(x=>x.forwardReturn).filter(Number.isFinite),ex=a.map(x=>x.excessReturn).filter(Number.isFinite);
  return {
    n:r.length,mean:round(avg(r)),median:round(median(r)),
    positiveRate:r.length?round(r.filter(x=>x>0).length/r.length*100,1):null,
    benchmarkBeatRate:ex.length?round(ex.filter(x=>x>0).length/ex.length*100,1):null,
    meanExcess:round(avg(ex)),avgMAE:round(avg(a.map(x=>x.mae))),avgMFE:round(avg(a.map(x=>x.mfe)))
  };
}
function replay(report,h,scoreFn){
  const dates=[...(report.recoverySurfaceReplay?.dates||[])].sort();
  const pool=(report.recoverySurfaceReplay?.candidates||[]).filter(x=>x.horizon===h);
  const byDate=new Map();
  for(const x of pool){if(!byDate.has(x.date))byDate.set(x.date,[]);byDate.get(x.date).push(x);}
  const observations=[],crowdedSelected=[],crowdedExcluded=[];
  for(const date of dates){
    const eligible=[...(byDate.get(date)||[])]
      .map(x=>({...x,policyScore:scoreFn(x)}))
      .sort((a,b)=>b.policyScore-a.policyScore||b.score-a.score||a.symbol.localeCompare(b.symbol));
    const selected=eligible.slice(0,MAX_VISIBLE);
    observations.push(...selected);
    if(eligible.length>MAX_VISIBLE){crowdedSelected.push(...selected);crowdedExcluded.push(...eligible.slice(MAX_VISIBLE));}
  }
  const cut=dates[Math.floor(dates.length*.7)]||null;
  const sel=summary(crowdedSelected),exc=summary(crowdedExcluded);
  return {
    overall:summary(observations),
    recentHoldout:summary(observations.filter(x=>cut&&x.date>=cut)),
    crowdedDays:{
      selectedTop6:sel,excludedBelow6:exc,
      selectedMinusExcluded:{
        mean:round((sel?.mean??NaN)-(exc?.mean??NaN)),
        meanExcess:round((sel?.meanExcess??NaN)-(exc?.meanExcess??NaN)),
        positiveRate:round((sel?.positiveRate??NaN)-(exc?.positiveRate??NaN),1)
      }
    }
  };
}
const baseline=x=>x.score;
const anti=x=>x.score-(Number.isFinite(x.ret20)?Math.max(0,x.ret20-3)*1.5:0);
const result={
  generatedAt:new Date().toISOString(),
  note:'Batch-stability diagnostic only. Production Recovery logic unchanged.',
  antiChaseRule:'score - 1.5 * max(0, ret20 - 3)',
  horizons:{}
};
for(const h of [5,10,20]){
  result.horizons[h]=reports.map(r=>{
    const b=replay(r,h,baseline),a=replay(r,h,anti);
    return {
      batch:r.batch,
      baseline:b,
      antiChase:a,
      delta:{
        overallMean:round((a.overall?.mean??NaN)-(b.overall?.mean??NaN)),
        holdoutMean:round((a.recentHoldout?.mean??NaN)-(b.recentHoldout?.mean??NaN)),
        holdoutExcess:round((a.recentHoldout?.meanExcess??NaN)-(b.recentHoldout?.meanExcess??NaN)),
        crowdedSpreadMean:round((a.crowdedDays.selectedMinusExcluded?.mean??NaN)-(b.crowdedDays.selectedMinusExcluded?.mean??NaN)),
        crowdedSpreadExcess:round((a.crowdedDays.selectedMinusExcluded?.meanExcess??NaN)-(b.crowdedDays.selectedMinusExcluded?.meanExcess??NaN))
      }
    };
  });
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/recovery-anti-chase-batch-stability.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
