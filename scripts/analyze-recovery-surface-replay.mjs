import fs from 'node:fs';

const reports=Array.from({length:4},(_,i)=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const MAX_VISIBLE=6;
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const median=a=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};

function summary(a){
  if(!a.length)return null;
  const r=a.map(x=>x.forwardReturn).filter(Number.isFinite);
  const ex=a.map(x=>x.excessReturn).filter(Number.isFinite);
  return {
    n:r.length,
    mean:round(avg(r)),
    median:round(median(r)),
    positiveRate:r.length?round(r.filter(x=>x>0).length/r.length*100,1):null,
    benchmarkBeatRate:ex.length?round(ex.filter(x=>x>0).length/ex.length*100,1):null,
    meanExcess:round(avg(ex)),
    avgMAE:round(avg(a.map(x=>x.mae))),
    avgMFE:round(avg(a.map(x=>x.mfe)))
  };
}
function dailyRows(selectedByDate){
  const out=[];
  for(const [date,rows] of selectedByDate){
    if(!rows.length)continue;
    out.push({
      date,
      forwardReturn:avg(rows.map(x=>x.forwardReturn)),
      excessReturn:avg(rows.map(x=>x.excessReturn)),
      mae:avg(rows.map(x=>x.mae)),
      mfe:avg(rows.map(x=>x.mfe))
    });
  }
  return out;
}
function firstEpisodes(dates,selectedByDate){
  const out=[]; let prev=new Set();
  for(const date of dates){
    const rows=selectedByDate.get(date)||[];
    const cur=new Set(rows.map(x=>x.symbol));
    for(const x of rows)if(!prev.has(x.symbol))out.push(x);
    prev=cur;
  }
  return out;
}
function policyStats({dates,pool,filter}){
  const byDate=new Map();
  for(const x of pool){
    if(!filter(x))continue;
    if(!byDate.has(x.date))byDate.set(x.date,[]);
    byDate.get(x.date).push(x);
  }
  const selectedByDate=new Map(),observations=[],eligibleCounts=[];
  const visibleDistribution=Object.fromEntries(Array.from({length:MAX_VISIBLE+1},(_,i)=>[i,0]));
  for(const date of dates){
    const eligible=[...(byDate.get(date)||[])].sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
    eligibleCounts.push(eligible.length);
    const selected=eligible.slice(0,MAX_VISIBLE).map((x,i)=>({...x,rank:i+1}));
    selectedByDate.set(date,selected);
    visibleDistribution[selected.length]=(visibleDistribution[selected.length]||0)+1;
    observations.push(...selected);
  }
  const active=eligibleCounts.filter(n=>n>0).length;
  const cut=dates[Math.floor(dates.length*.7)]||null;
  const train=observations.filter(x=>!cut||x.date<cut);
  const test=observations.filter(x=>cut&&x.date>=cut);
  const years=Object.fromEntries([...new Set(observations.map(x=>x.date.slice(0,4)))].sort().map(y=>[y,summary(observations.filter(x=>x.date.startsWith(y)))]));
  return {
    selection:{
      scanDays:dates.length,daysWithPicks:active,zeroPickDays:dates.length-active,
      pctDaysWithPicks:dates.length?round(active/dates.length*100,1):null,
      averageVisibleAllDays:dates.length?round(observations.length/dates.length,2):null,
      averageVisibleActiveDays:active?round(observations.length/active,2):null,
      averageEligibleActiveDays:active?round(avg(eligibleCounts.filter(n=>n>0)),2):null,
      maxEligibleBeforeCap:Math.max(0,...eligibleCounts),
      capBindingDays:eligibleCounts.filter(n=>n>MAX_VISIBLE).length,
      maxVisibleObserved:Math.max(0,...[...selectedByDate.values()].map(x=>x.length)),
      visibleDistribution
    },
    pickDayObservations:{
      overall:summary(observations),
      chronologicalSplit:{cutDate:cut,train:summary(train),recentHoldout:summary(test)},
      rank1:summary(observations.filter(x=>x.rank===1)),
      ranks1to3:summary(observations.filter(x=>x.rank<=3)),
      ranks4to6:summary(observations.filter(x=>x.rank>=4)),
      byYear:years
    },
    dailyEqualWeightCohort:summary(dailyRows(selectedByDate)),
    firstSurfaceEpisodes:summary(firstEpisodes(dates,selectedByDate)),
    uniqueSymbols:new Set(observations.map(x=>x.symbol)).size
  };
}

const dates=[...new Set(reports.flatMap(r=>r.recoverySurfaceReplay?.dates||[]))].sort();
const candidates=reports.flatMap(r=>r.recoverySurfaceReplay?.candidates||[]);
const horizons=[...new Set(candidates.map(x=>x.horizon).filter(Number.isFinite))].sort((a,b)=>a-b);
const result={
  generatedAt:new Date().toISOString(),
  version:reports[0]?.version||null,
  method:{
    description:'Historical daily replay of Recovery Review First candidates from all four batches. Compare current Review First surface with Review First plus a confirmed break above the latest minor swing high. Both policies are capped at six with no quota filling.',
    maxVisible:MAX_VISIBLE,
    holdout:'Recent holdout is the final 30% of chronological scan dates.',
    note:'Diagnostic only. Production Recovery rules are unchanged.'
  },
  dateRange:{start:dates[0]||null,end:dates.at(-1)||null,scanDays:dates.length},
  horizons:{}
};

for(const h of horizons){
  const pool=candidates.filter(x=>x.horizon===h);
  const reviewFirst=policyStats({dates,pool,filter:()=>true});
  const confirmedBreak=policyStats({dates,pool,filter:x=>x.highBroken===true});
  const a=reviewFirst.pickDayObservations.overall,b=confirmedBreak.pickDayObservations.overall;
  const at=reviewFirst.pickDayObservations.chronologicalSplit.recentHoldout;
  const bt=confirmedBreak.pickDayObservations.chronologicalSplit.recentHoldout;
  result.horizons[h]={
    reviewFirst,
    confirmedBreak,
    deltaConfirmedVsReviewFirst:{
      overall:{
        mean:round((b?.mean??NaN)-(a?.mean??NaN)),
        positiveRate:round((b?.positiveRate??NaN)-(a?.positiveRate??NaN),1),
        benchmarkBeatRate:round((b?.benchmarkBeatRate??NaN)-(a?.benchmarkBeatRate??NaN),1),
        meanExcess:round((b?.meanExcess??NaN)-(a?.meanExcess??NaN))
      },
      recentHoldout:{
        mean:round((bt?.mean??NaN)-(at?.mean??NaN)),
        positiveRate:round((bt?.positiveRate??NaN)-(at?.positiveRate??NaN),1),
        benchmarkBeatRate:round((bt?.benchmarkBeatRate??NaN)-(at?.benchmarkBeatRate??NaN),1),
        meanExcess:round((bt?.meanExcess??NaN)-(at?.meanExcess??NaN))
      }
    }
  };
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/v2-recovery-surface-replay.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
