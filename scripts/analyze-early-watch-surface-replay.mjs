import fs from 'node:fs';
import {fixedCalendarSplit,validateFixedCalendar} from '../lib/validation-split.js';
import {assertLockedValidationReport} from '../lib/validation-identity.js';

const BATCH_COUNT=4;
const MAX_VISIBLE=6;
const REPORT_DIR=process.env.V2_REPORT_DIR||'data';
const MANIFEST_FILE=process.env.V2_DATASET_LOCK_MANIFEST||'data/frozen/market-hunter-v2-numerical-snapshot/manifest.json';
const reports=Array.from({length:BATCH_COUNT},(_,i)=>JSON.parse(fs.readFileSync(REPORT_DIR+'/v2-backtest-batch-'+i+'.json','utf8')));

const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const must=(ok,message)=>{if(!ok)throw new Error(message)};
function validateLockedInputs(){
  must(fs.existsSync(MANIFEST_FILE),'Locked numerical snapshot manifest missing: '+MANIFEST_FILE);
  const manifest=JSON.parse(fs.readFileSync(MANIFEST_FILE,'utf8'));
  must(manifest.format==='market-hunter-v2-numerical-snapshot-manifest-v1','Unsupported locked numerical snapshot manifest');
  must(manifest.batchCount===BATCH_COUNT,'Locked manifest batchCount mismatch');
  must(Array.isArray(manifest.batches)&&manifest.batches.length===BATCH_COUNT,'Locked manifest must contain all four batches');
  const ids=reports.map((r,i)=>assertLockedValidationReport(r,'batch '+i));
  const first=ids[0];
  const calendar=validateFixedCalendar(first.calendar);
  const horizons=first.horizons;
  const artifactId=manifest.artifact?.deploymentId||manifest.artifact?.id;
  for(let i=0;i<BATCH_COUNT;i++){
    const report=reports[i],id=ids[i],designated=manifest.batches.find(x=>x.batchIndex===i);
    must(id.batchIndex===i,'Report file/batch index mismatch for batch '+i);
    must(id.batchCount===BATCH_COUNT,'Batch '+i+' batchCount mismatch');
    must(same(id.horizons,horizons),'Batch '+i+' horizons mismatch');
    must(same(id.calendar,calendar),'Batch '+i+' fixed calendar mismatch');
    must(same(id.dataset.source,first.dataset.source),'Batch '+i+' source mismatch');
    must(id.dataset.normalizationVersion===first.dataset.normalizationVersion,'Batch '+i+' normalization mismatch');
    must(id.dataset.artifactId===first.dataset.artifactId,'Batch '+i+' artifact mismatch');
    must(!!designated,'Manifest missing designated batch '+i);
    must(id.dataset.snapshotId===designated.snapshotId,'Batch '+i+' snapshotId mismatch');
    must(id.dataset.dataSha256===designated.dataSha256,'Batch '+i+' numerical hash mismatch');
    must(id.dataset.structureSha256===designated.structureSha256,'Batch '+i+' structure hash mismatch');
    must(same(id.symbols,designated.symbols),'Batch '+i+' symbol membership mismatch');
    must(id.dataset.artifactId===artifactId,'Batch '+i+' artifact does not match locked manifest');
    const replay=report.surfaceReplay;
    must(replay?.scope==='development','Batch '+i+' Early Watch replay scope must be development');
    must(replay?.calendarSource==='completed-scans-with-mature-development-outcomes','Batch '+i+' Early Watch replay calendar coverage is stale');
    must(replay?.datesByHorizon&&typeof replay.datesByHorizon==='object','Batch '+i+' Early Watch datesByHorizon missing');
    for(const h of horizons)must(Array.isArray(replay.datesByHorizon[h]),'Batch '+i+' Early Watch horizon '+h+' calendar missing');
  }
  must(same(manifest.source,first.dataset.source),'Manifest/report source mismatch');
  must(manifest.normalizationVersion===first.dataset.normalizationVersion,'Manifest/report normalization mismatch');
  must(same(manifest.validationCalendar,calendar),'Manifest/report validation calendar mismatch');
  return {manifest,calendar,horizons,identity:first};
}
const {manifest,calendar,horizons,identity}=validateLockedInputs();
const intersection=arrays=>arrays.length?[...new Set(arrays[0])].filter(x=>arrays.slice(1).every(a=>new Set(a).has(x))).sort():[];
const union=arrays=>[...new Set(arrays.flat())].sort();

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
  momentumRsBalanced:x=>
    x.score
    +1.2*clamp(x.momentumShift,-4,4)
    +0.35*clamp(x.rs20,-8,8)
    +structureAdj(x.swingTrend),
  inflectionFirst:x=>
    x.score
    +1.8*clamp(x.momentumShift,-4,4)
    +(Number.isFinite(x.rs20)?(x.rs20>=0?3:x.rs20>=-5?1:-2):0)
    +structureAdj(x.swingTrend)*1.5,
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
  const fold=fixedCalendarSplit(observations,calendar);
  const pack=rows=>{
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
  };
  const cs=summary(crowdedSelected),ce=summary(crowdedExcluded);
  return {
    chronologicalSplit:{mode:'fixed_calendar',cutDate:calendar.validationStart,counts:fold.counts,train:pack(fold.train),recentHoldout:pack(fold.test)},
    overall:pack(observations),
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

const candidates=reports.flatMap(r=>r.surfaceReplay?.candidates||[]);

const result={
  version:reports[0]?.version||null,
  generatedAt:new Date().toISOString(),
  method:{
    description:'Historical daily replay of the Early Watch surfaced shortlist. Daily Review First candidates from all four batches are merged, sorted by the frozen Early Watch score, and capped at six. No quota is filled.',
    maxVisible:MAX_VISIBLE,
    candidateSource:'All daily Early Watch Review First candidates from all four universe batches.',
    repeatedNames:'pickDayObservations reflects what the user would actually see each day. firstSurfaceEpisodes removes consecutive-day repeats.',
    holdout:'Train and recentHoldout use the locked fixed calendar. Rows whose outcome crosses the validation boundary are purged from training, and rows whose outcome crosses Historical Final are purged from validation.',
    capTest:'On days with more than six eligible names, topSixOnCrowdedDays is compared with excludedBelowSix to test whether score ordering adds value rather than merely reducing workload.',
    rankingTest:'Two small outcome-blind ranking variants are compared with the frozen baseline. Eligibility and max-six policy remain unchanged; success requires better top-3 vs ranks 4-6 separation, especially on the recent chronological holdout.'
  },
  validationIdentity:{
    artifactId:identity.dataset.artifactId,
    source:identity.dataset.source,
    normalizationVersion:identity.dataset.normalizationVersion,
    calendar,
    batchCount:BATCH_COUNT,
    horizons,
    historicalFinalOpened:false
  },
  dateRange:{start:calendar.developmentStart,end:calendar.finalStart},
  coverage:{},
  horizons:{}
};

for(const h of horizons){
  const batchDates=reports.map(r=>r.surfaceReplay.datesByHorizon[h]);
  const dates=intersection(batchDates);
  const unionDates=union(batchDates);
  const partialCoverageDates=unionDates.filter(d=>!dates.includes(d));
  result.coverage[h]={
    confirmedWholeUniverseSessions:dates.length,
    unionSessions:unionDates.length,
    partialCoverageSessionCount:partialCoverageDates.length,
    partialCoverageDates,
    byBatch:Object.fromEntries(reports.map(r=>[r.batchIndex,r.surfaceReplay.datesByHorizon[h].length]))
  };
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
  const fold=fixedCalendarSplit(observations,calendar);
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
      chronologicalSplit:{mode:'fixed_calendar',cutDate:calendar.validationStart,counts:fold.counts,train:summary(fold.train),recentHoldout:summary(fold.test)},
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
    rankingExperiments:Object.fromEntries(
      Object.entries(rankingVariants).map(([name,scoreFn])=>[name,rankingExperiment(byDate,dates,scoreFn,calendar)])
    )
  };
}

fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/v2-early-watch-surface-replay.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
