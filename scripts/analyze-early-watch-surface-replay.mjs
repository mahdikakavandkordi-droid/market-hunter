import fs from 'node:fs';

const BATCH_COUNT=4;
const MAX_VISIBLE=6;
const reports=Array.from({length:BATCH_COUNT},(_,i)=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
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

function dailyCohortRows(selectedByDate){
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

function episodeStarts(dates,selectedByDate){
  const out=[];
  let prev=new Set();
  for(const date of dates){
    const rows=selectedByDate.get(date)||[];
    const current=new Set(rows.map(x=>x.symbol));
    for(const x of rows)if(!prev.has(x.symbol))out.push(x);
    prev=current;
  }
  return out;
}

const dates=[...new Set(reports.flatMap(r=>r.surfaceReplay?.dates||[]))].sort();
const candidates=reports.flatMap(r=>r.surfaceReplay?.candidates||[]);
const horizons=[...new Set(candidates.map(x=>x.horizon).filter(Number.isFinite))].sort((a,b)=>a-b);

const result={
  version:reports[0]?.version||null,
  generatedAt:new Date().toISOString(),
  method:{
    description:'Historical daily replay of the Early Watch surfaced shortlist. Daily Review First candidates from all four batches are merged, sorted by the frozen Early Watch score, and capped at six. No quota is filled.',
    maxVisible:MAX_VISIBLE,
    candidateSource:'All daily Early Watch Review First candidates from all four universe batches.',
    repeatedNames:'pickDayObservations reflects what the user would actually see each day. firstSurfaceEpisodes removes consecutive-day repeats.',
    holdout:'Recent holdout is the last 30% of chronological scan dates; no threshold is refit on holdout outcomes.',
    capTest:'On days with more than six eligible names, topSixOnCrowdedDays is compared with excludedBelowSix to test whether score ordering adds value rather than merely reducing workload.'
  },
  dateRange:{start:dates[0]||null,end:dates.at(-1)||null,scanDays:dates.length},
  horizons:{}
};

for(const h of horizons){
  const pool=candidates.filter(x=>x.horizon===h);
  const byDate=new Map();
  for(const x of pool){
    if(!byDate.has(x.date))byDate.set(x.date,[]);
    byDate.get(x.date).push(x);
  }

  const selectedByDate=new Map();
  const visibleDistribution=Object.fromEntries(Array.from({length:MAX_VISIBLE+1},(_,i)=>[i,0]));
  const observations=[],allEligible=[],topSixCrowded=[],excludedCrowded=[];
  const eligibleCounts=[];

  for(const date of dates){
    const eligible=[...(byDate.get(date)||[])].sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
    eligibleCounts.push(eligible.length);
    allEligible.push(...eligible);
    const selected=eligible.slice(0,MAX_VISIBLE).map((x,i)=>({...x,rank:i+1}));
    selectedByDate.set(date,selected);
    visibleDistribution[selected.length]=(visibleDistribution[selected.length]||0)+1;
    observations.push(...selected);
    if(eligible.length>MAX_VISIBLE){
      topSixCrowded.push(...selected);
      excludedCrowded.push(...eligible.slice(MAX_VISIBLE));
    }
  }

  const activeDays=eligibleCounts.filter(n=>n>0).length;
  const capBindingDays=eligibleCounts.filter(n=>n>MAX_VISIBLE).length;
  const cut=dates[Math.floor(dates.length*.7)]||null;
  const train=observations.filter(x=>!cut||x.date<cut);
  const test=observations.filter(x=>cut&&x.date>=cut);
  const episodes=episodeStarts(dates,selectedByDate);
  const daily=dailyCohortRows(selectedByDate);
  const years=Object.fromEntries([...new Set(observations.map(x=>x.date.slice(0,4)))].sort().map(y=>[y,summary(observations.filter(x=>x.date.startsWith(y)))]));

  result.horizons[h]={
    selection:{
      scanDays:dates.length,
      daysWithPicks:activeDays,
      zeroPickDays:dates.length-activeDays,
      pctDaysWithPicks:dates.length?round(activeDays/dates.length*100,1):null,
      averageVisibleAllDays:dates.length?round(observations.length/dates.length,2):null,
      averageVisibleActiveDays:activeDays?round(observations.length/activeDays,2):null,
      averageEligibleAllDays:dates.length?round(avg(eligibleCounts),2):null,
      averageEligibleActiveDays:activeDays?round(avg(eligibleCounts.filter(n=>n>0)),2):null,
      maxEligibleBeforeCap:Math.max(0,...eligibleCounts),
      capBindingDays,
      pctActiveDaysCapBinds:activeDays?round(capBindingDays/activeDays*100,1):null,
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
    allReviewFirstBeforeCap:summary(allEligible),
    capOrderingTest:{
      topSixOnCrowdedDays:summary(topSixCrowded),
      excludedBelowSix:summary(excludedCrowded),
      meanReturnLift:round((summary(topSixCrowded)?.mean??NaN)-(summary(excludedCrowded)?.mean??NaN)),
      meanExcessLift:round((summary(topSixCrowded)?.meanExcess??NaN)-(summary(excludedCrowded)?.meanExcess??NaN)),
      positiveRateLift:round((summary(topSixCrowded)?.positiveRate??NaN)-(summary(excludedCrowded)?.positiveRate??NaN),1),
      benchmarkBeatRateLift:round((summary(topSixCrowded)?.benchmarkBeatRate??NaN)-(summary(excludedCrowded)?.benchmarkBeatRate??NaN),1)
    },
    dailyEqualWeightCohort:summary(daily),
    firstSurfaceEpisodes:summary(episodes),
    uniqueSymbols:new Set(observations.map(x=>x.symbol)).size
  };
}

fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/v2-early-watch-surface-replay.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
