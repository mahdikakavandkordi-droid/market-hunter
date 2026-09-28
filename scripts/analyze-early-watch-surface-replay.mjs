import fs from 'node:fs';
import {fixedCalendarSplit,validateFixedCalendar} from '../lib/validation-split.js';
import {UNIVERSE} from '../lib/universe.js';

const BATCH_COUNT=4;
const MAX_VISIBLE=6;
const MANIFEST_FILE=process.env.V2_DATASET_LOCK_MANIFEST||'data/frozen/market-hunter-v2-numerical-snapshot/manifest.json';
const reports=Array.from({length:BATCH_COUNT},(_,i)=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const manifest=JSON.parse(fs.readFileSync(MANIFEST_FILE,'utf8'));
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const median=a=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const must=(condition,message)=>{if(!condition)throw new Error(message)};
const universeSymbols=new Set(UNIVERSE.map(x=>x[0]));
const cdrSymbols=new Set(UNIVERSE.filter(x=>x[2]==='CDR').map(x=>x[0]));
const benchmarkForSymbol=s=>cdrSymbols.has(s)?'^IXIC':'^GSPTSE';

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

function validateInputs(){
  must(manifest?.format==='market-hunter-v2-numerical-snapshot-manifest-v1','Early Watch replay requires the locked numerical snapshot manifest v1');
  must(Number.isInteger(manifest.batchCount)&&manifest.batchCount===BATCH_COUNT,'Manifest batchCount must equal '+BATCH_COUNT);
  const calendar=validateFixedCalendar(manifest.validationCalendar);
  must(Array.isArray(manifest.batches)&&manifest.batches.length===BATCH_COUNT,'Manifest must contain all four designated batches');
  const manifestByBatch=new Map(manifest.batches.map(x=>[x.batchIndex,x]));
  must(manifestByBatch.size===BATCH_COUNT,'Manifest contains duplicate or missing batch indices');
  const artifactId=manifest.artifact?.deploymentId||manifest.artifact?.id;
  must(typeof artifactId==='string'&&artifactId.startsWith('dpl_'),'Manifest missing immutable deployment artifact identity');

  const seen=new Set();
  let commonHorizons=null;
  for(const report of reports){
    const b=report?.batchIndex;
    must(Number.isInteger(b)&&b>=0&&b<BATCH_COUNT,'Invalid report batch index: '+String(b));
    must(!seen.has(b),'Duplicate report batch index '+b);
    seen.add(b);
    must(report.batchCount===BATCH_COUNT,'Report '+b+' has unexpected batchCount');
    must(report?.dataset?.mode==='frozen','Report '+b+' must use dataset.mode=frozen');
    must(report?.validation?.finalTestOpened!==true,'Report '+b+' opened Historical Final');
    const reportCalendar=validateFixedCalendar(report?.validation?.calendar);
    must(same(reportCalendar,calendar),'Report '+b+' validation calendar mismatch');
    must(same(report?.dataset?.source,manifest.source),'Report '+b+' source mismatch');
    must(report?.dataset?.normalizationVersion===manifest.normalizationVersion,'Report '+b+' normalization mismatch');
    must(report?.dataset?.artifactId===artifactId,'Report '+b+' artifact mismatch');

    const designated=manifestByBatch.get(b);
    must(designated,'Manifest missing designated batch '+b);
    must(report?.dataset?.snapshotId===designated.snapshotId,'Report '+b+' snapshotId mismatch');
    must(report?.dataset?.dataSha256===designated.dataSha256,'Report '+b+' dataSha256 mismatch');
    must(report?.dataset?.structureSha256===designated.structureSha256,'Report '+b+' structureSha256 mismatch');
    must(Array.isArray(report?.symbols)&&report.symbols.length>0,'Report '+b+' missing tradable symbol membership');
    must(report.symbols.every(s=>universeSymbols.has(s)),'Report '+b+' contains symbol outside current scan universe');
    const expectedDatasetSymbols=[...new Set([...report.symbols,...report.symbols.map(benchmarkForSymbol)])];
    must(same(expectedDatasetSymbols,designated.symbols),'Report '+b+' dataset symbol/benchmark membership mismatch');

    const horizons=Object.keys(report?.horizons||{}).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    must(horizons.length>0,'Report '+b+' has no horizons');
    if(commonHorizons===null)commonHorizons=horizons;
    else must(same(horizons,commonHorizons),'Report '+b+' horizon set mismatch');
    for(const h of horizons){
      const dates=report?.surfaceReplay?.datesByHorizon?.[h]??report?.surfaceReplay?.datesByHorizon?.[String(h)];
      must(Array.isArray(dates),'Report '+b+' missing surfaceReplay.datesByHorizon['+h+']; stale replay report rejected');
    }
  }
  must(seen.size===BATCH_COUNT,'Incomplete report batch set');
  for(let i=0;i<BATCH_COUNT;i++)must(seen.has(i),'Missing report batch '+i);
  return {calendar,horizons:commonHorizons,artifactId};
}

function coverageForHorizon(h){
  const sets=reports.map((r,i)=>{
    const dates=r.surfaceReplay.datesByHorizon?.[h]??r.surfaceReplay.datesByHorizon?.[String(h)];
    must(Array.isArray(dates),'Report '+i+' missing horizon coverage '+h);
    return new Set(dates);
  });
  const union=[...new Set(sets.flatMap(s=>[...s]))].sort();
  const confirmed=union.filter(d=>sets.every(s=>s.has(d)));
  const partial=union.filter(d=>!sets.every(s=>s.has(d)));
  return {
    confirmedDates:confirmed,
    partialCoverageDates:partial,
    reportCoverageCounts:sets.map((s,batchIndex)=>({batchIndex,scanDays:s.size}))
  };
}

const clamp=(x,lo,hi)=>Number.isFinite(x)?Math.max(lo,Math.min(hi,x)):0;
function structureAdj(s){
  if(s==='Structure improving')return 2;
  if(s==='Higher highs + higher lows')return 1;
  if(s==='Lower highs + lower lows')return -2;
  if(s==='Structure weakening')return -2;
  return 0;
}
const rankingVariants={
  baseline:x=>x.score,
  momentumRsBalanced:x=>x.score+1.2*clamp(x.momentumShift,-4,4)+0.35*clamp(x.rs20,-8,8)+structureAdj(x.swingTrend),
  inflectionFirst:x=>x.score+1.8*clamp(x.momentumShift,-4,4)+(Number.isFinite(x.rs20)?(x.rs20>=0?3:x.rs20>=-5?1:-2):0)+structureAdj(x.swingTrend)*1.5,
  evidencePolish:x=>{
    let s=x.score;
    s+=1.0*clamp(x.momentumShift,-4,4);
    if(x.downsideDecel===true)s+=3;
    if(x.volumeShockNearLow===true)s+=1;
    if(Number.isFinite(x.upDownVolumeRatio)){
      if(x.upDownVolumeRatio>=1.05)s+=2;
      else if(x.upDownVolumeRatio<0.75)s-=2;
    }
    if(Number.isFinite(x.freshReclaimAge)&&x.freshReclaimAge<=2)s+=0.5;
    s+=structureAdj(x.swingTrend);
    return s;
  }
};

function packRanked(rows){
  const top=rows.filter(x=>x.rank<=3),bottom=rows.filter(x=>x.rank>=4);
  const ts=summary(top),bs=summary(bottom);
  return {
    all:summary(rows),rank1:summary(rows.filter(x=>x.rank===1)),ranks1to3:ts,ranks4to6:bs,
    top3MinusBottom3:{
      mean:round((ts?.mean??NaN)-(bs?.mean??NaN)),
      meanExcess:round((ts?.meanExcess??NaN)-(bs?.meanExcess??NaN)),
      positiveRate:round((ts?.positiveRate??NaN)-(bs?.positiveRate??NaN),1),
      benchmarkBeatRate:round((ts?.benchmarkBeatRate??NaN)-(bs?.benchmarkBeatRate??NaN),1)
    }
  };
}

function fixedFold(rows,calendar){
  const split=fixedCalendarSplit(rows,calendar);
  return {
    mode:split.mode,status:split.status,insufficientReason:split.insufficientReason,calendar:split.calendar,counts:split.counts,
    train:packRanked(split.train),validation:packRanked(split.test)
  };
}

function rankingExperiment(byDate,dates,scoreFn,calendar){
  const selectedByDate=new Map(),observations=[],crowdedSelected=[],crowdedExcluded=[];
  for(const date of dates){
    const eligible=[...(byDate.get(date)||[])]
      .map(x=>({...x,experimentScore:scoreFn(x)}))
      .sort((a,b)=>b.experimentScore-a.experimentScore||b.score-a.score||a.symbol.localeCompare(b.symbol));
    const selected=eligible.slice(0,MAX_VISIBLE).map((x,i)=>({...x,rank:i+1}));
    selectedByDate.set(date,selected);
    observations.push(...selected);
    if(eligible.length>MAX_VISIBLE){
      crowdedSelected.push(...selected);
      crowdedExcluded.push(...eligible.slice(MAX_VISIBLE));
    }
  }
  const cs=summary(crowdedSelected),ce=summary(crowdedExcluded);
  return {
    fixedCalendar:fixedFold(observations,calendar),
    overall:packRanked(observations),
    crowdedDays:{
      selectedTop6:cs,excludedBelow6:ce,
      selectedMinusExcluded:{
        mean:round((cs?.mean??NaN)-(ce?.mean??NaN)),
        meanExcess:round((cs?.meanExcess??NaN)-(ce?.meanExcess??NaN)),
        positiveRate:round((cs?.positiveRate??NaN)-(ce?.positiveRate??NaN),1)
      }
    }
  };
}

const identity=validateInputs();
const candidates=reports.flatMap(r=>r.surfaceReplay?.candidates||[]);
const result={
  version:reports[0]?.version||null,
  generatedAt:new Date().toISOString(),
  validationIdentity:{
    mode:'locked_fixed_calendar',
    artifactId:identity.artifactId,
    calendar:identity.calendar,
    batchCount:BATCH_COUNT,
    horizons:identity.horizons,
    finalTestOpened:false
  },
  method:{
    description:'Historical daily replay of the Early Watch surfaced shortlist using the locked four-batch numerical snapshot and the shared fixed validation calendar.',
    maxVisible:MAX_VISIBLE,
    candidateSource:'All daily Early Watch Review First candidates from all four designated universe batches.',
    repeatedNames:'pickDayObservations reflects what the user would see each confirmed scan day. firstSurfaceEpisodes removes consecutive-day repeats and preserves completed zero-pick sessions as episode breaks.',
    holdout:'Training and validation use the repository fixed calendar with outcome-date purging. Historical Final remains closed.',
    coverage:'A date is treated as a completed combined-market scan only when all four designated batch reports include it for that horizon. Partial coverage is disclosed and never counted as a zero-pick session.',
    capTest:'On days with more than six eligible names, top six are compared with excluded names to test ordering value.',
    rankingTest:'Outcome-blind ranking variants change ordering only. Eligibility and max-six policy remain unchanged.'
  },
  horizons:{}
};

for(const h of identity.horizons){
  const coverage=coverageForHorizon(h);
  const dates=coverage.confirmedDates;
  const pool=candidates.filter(x=>x.horizon===h&&dates.includes(x.date));
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
  const fold=fixedCalendarSplit(observations,identity.calendar);
  const episodes=episodeStarts(dates,selectedByDate);
  const daily=dailyCohortRows(selectedByDate);
  const years=Object.fromEntries([...new Set(observations.map(x=>x.date.slice(0,4)))].sort().map(y=>[y,summary(observations.filter(x=>x.date.startsWith(y)))]));

  result.horizons[h]={
    coverage:{
      confirmedScanDays:dates.length,
      partialCoverageDays:coverage.partialCoverageDates.length,
      partialCoverageDates:coverage.partialCoverageDates,
      reportCoverageCounts:coverage.reportCoverageCounts
    },
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
      fixedCalendar:{
        mode:fold.mode,status:fold.status,insufficientReason:fold.insufficientReason,calendar:fold.calendar,counts:fold.counts,
        train:summary(fold.train),validation:summary(fold.test)
      },
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
    uniqueSymbols:new Set(observations.map(x=>x.symbol)).size,
    rankingExperiments:Object.fromEntries(Object.entries(rankingVariants).map(([name,scoreFn])=>[name,rankingExperiment(byDate,dates,scoreFn,identity.calendar)]))
  };
}

fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/v2-early-watch-surface-replay.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
