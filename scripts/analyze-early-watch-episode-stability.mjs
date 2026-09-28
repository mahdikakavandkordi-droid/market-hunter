import fs from 'node:fs';
import path from 'node:path';
import {validateFixedCalendar,fixedCalendarSplit} from '../lib/validation-split.js';
import {UNIVERSE} from '../lib/universe.js';
import {
  confirmedCoverage,selectedByConfirmedDate,firstSurfaceEpisodes,attachSplitStatus,sameValue
} from '../lib/early-watch-episodes.js';

const BATCH_COUNT=4;
const MAX_VISIBLE=6;
const BOOTSTRAP_SEED=20260928;
const BOOTSTRAP_REPS=5000;
const BOOTSTRAP_BLOCK_SESSIONS=20;
const SMALL_SAMPLE_N=30;
const SYMBOL_SMALL_SAMPLE_N=10;
const OUT_DIR=process.env.EARLY_WATCH_STABILITY_OUT||'data/research/early-watch-episode-stability';
const MANIFEST_FILE=process.env.V2_DATASET_LOCK_MANIFEST||'data/frozen/market-hunter-v2-numerical-snapshot/manifest.json';
const PREVIOUS_REPLAY_FILE=process.env.PREVIOUS_EARLY_WATCH_REPLAY||'data/v2-early-watch-surface-replay.json';

if(process.env.V2_OPEN_FINAL_TEST==='1')throw new Error('Historical Final must remain sealed; V2_OPEN_FINAL_TEST=1 is forbidden');

const reports=Array.from({length:BATCH_COUNT},(_,i)=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const manifest=JSON.parse(fs.readFileSync(MANIFEST_FILE,'utf8'));
const previousReplay=fs.existsSync(PREVIOUS_REPLAY_FILE)?JSON.parse(fs.readFileSync(PREVIOUS_REPLAY_FILE,'utf8')):null;
const calendar=validateFixedCalendar(manifest.validationCalendar);
const CDR=new Set(UNIVERSE.filter(x=>x[2]==='CDR').map(x=>x[0]));
const benchmarkForSymbol=s=>CDR.has(s)?'^IXIC':'^GSPTSE';

function must(v,m){if(!v)throw new Error(m)}
function round(n,d=2){return Number.isFinite(n)?Number(n.toFixed(d)):null}
function finite(a){return a.filter(Number.isFinite)}
function mean(a){const x=finite(a);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null}
function quantile(a,q){
  const x=finite(a).sort((a,b)=>a-b);
  if(!x.length)return null;
  const pos=(x.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);
  if(lo===hi)return x[lo];
  return x[lo]+(x[hi]-x[lo])*(pos-lo);
}
function median(a){return quantile(a,.5)}
function sum(a){return finite(a).reduce((s,v)=>s+v,0)}
function groupBy(rows,keyFn){
  const m=new Map();
  for(const row of rows){
    const k=keyFn(row);
    if(!m.has(k))m.set(k,[]);
    m.get(k).push(row);
  }
  return m;
}
function descriptiveSummary(rows,{smallSampleThreshold=SMALL_SAMPLE_N}={}){
  const returns=rows.map(x=>x.forwardReturn),excess=rows.map(x=>x.excessReturn);
  const symbols=new Set(rows.map(x=>x.symbol));
  const percentiles=values=>({
    p10:round(quantile(values,.10)),
    p25:round(quantile(values,.25)),
    p75:round(quantile(values,.75)),
    p90:round(quantile(values,.90))
  });
  return {
    episodeCount:rows.length,
    distinctSymbolCount:symbols.size,
    smallSample:rows.length<smallSampleThreshold,
    meanReturn:round(mean(returns)),
    medianReturn:round(median(returns)),
    meanExcessReturn:round(mean(excess)),
    medianExcessReturn:round(median(excess)),
    positiveReturnRate:rows.length?round(rows.filter(x=>x.forwardReturn>0).length/rows.length*100,1):null,
    benchmarkBeatRate:rows.length?round(rows.filter(x=>x.excessReturn>0).length/rows.length*100,1):null,
    averageMAE:round(mean(rows.map(x=>x.mae))),
    averageMFE:round(mean(rows.map(x=>x.mfe))),
    returnPercentiles:percentiles(returns),
    excessReturnPercentiles:percentiles(excess)
  };
}
function dailySummary(rows){
  if(!rows.length)return null;
  const r=rows.map(x=>x.forwardReturn),ex=rows.map(x=>x.excessReturn);
  return {
    observationUnit:'selected symbol × confirmed scan day',
    n:rows.length,
    meanReturn:round(mean(r)),
    medianReturn:round(median(r)),
    meanExcessReturn:round(mean(ex)),
    medianExcessReturn:round(median(ex)),
    positiveReturnRate:round(rows.filter(x=>x.forwardReturn>0).length/rows.length*100,1),
    benchmarkBeatRate:round(rows.filter(x=>x.excessReturn>0).length/rows.length*100,1),
    averageMAE:round(mean(rows.map(x=>x.mae))),
    averageMFE:round(mean(rows.map(x=>x.mfe)))
  };
}

function validateLockedInputs(){
  must(manifest?.format==='market-hunter-v2-numerical-snapshot-manifest-v1','locked manifest v1 required');
  must(manifest.batchCount===4,'expected four locked batches');
  must(Array.isArray(manifest.batches)&&manifest.batches.length===4,'manifest must contain four batch identities');
  const artifactId=manifest.artifact?.deploymentId||manifest.artifact?.id;
  must(typeof artifactId==='string'&&artifactId.startsWith('dpl_'),'immutable artifact ID missing');
  const manifestByBatch=new Map(manifest.batches.map(x=>[x.batchIndex,x]));
  const horizons=null;
  for(const report of reports){
    must(report?.validation?.finalTestOpened!==true,'Historical Final was opened in an input report');
    must(!report?.finalEvaluation,'Input report contains Historical Final evaluation output');
    must(report?.dataset?.mode==='frozen','analysis requires frozen reports');
    must(report?.dataset?.artifactId===artifactId,'artifact identity mismatch');
    const b=manifestByBatch.get(report.batchIndex);
    must(b,'manifest missing report batch '+report.batchIndex);
    must(report.dataset.snapshotId===b.snapshotId,'snapshotId mismatch batch '+report.batchIndex);
    must(report.dataset.dataSha256===b.dataSha256,'dataSha256 mismatch batch '+report.batchIndex);
    must(report.dataset.structureSha256===b.structureSha256,'structureSha256 mismatch batch '+report.batchIndex);
    const reportCal=validateFixedCalendar(report.validation.calendar);
    must(sameValue(reportCal,calendar),'calendar mismatch batch '+report.batchIndex);
  }
  return {artifactId};
}

function splitCounts(allRows){
  const out={
    constructedEpisodes:allRows.length,
    Development:{beforePurge:0,included:0,excluded:0,reasons:{}},
    Validation:{beforePurge:0,included:0,excluded:0,reasons:{}},
    Other:{count:0,reasons:{}}
  };
  for(const row of allRows){
    if(row.split==='Development'||row.split==='Validation'){
      const x=out[row.split];
      x.beforePurge++;
      if(row.included)x.included++;
      else{
        x.excluded++;
        x.reasons[row.exclusionReason]=(x.reasons[row.exclusionReason]||0)+1;
      }
    }else{
      out.Other.count++;
      out.Other.reasons[row.exclusionReason]=(out.Other.reasons[row.exclusionReason]||0)+1;
    }
  }
  return out;
}

function combinedIncluded(rows){
  return rows.filter(x=>{
    if(x.split==='Invalid'||x.split==='Outside'||x.split==='Historical Final')return false;
    if(!(x.firstSurfaceDate>=calendar.developmentStart&&x.firstSurfaceDate<calendar.finalStart))return false;
    if(!(x.outcomeDate>=x.firstSurfaceDate&&x.outcomeDate<calendar.finalStart))return false;
    return true;
  });
}

function byYear(rows){
  const g=groupBy(rows,x=>x.firstSurfaceDate.slice(0,4));
  return Object.fromEntries([...g.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([year,x])=>[year,descriptiveSummary(x)]));
}

function symbolConcentration(rows){
  const totalExcess=sum(rows.map(x=>x.excessReturn));
  const meanExcess=mean(rows.map(x=>x.excessReturn));
  const g=groupBy(rows,x=>x.symbol);
  const symbols=[...g.entries()].map(([symbol,x])=>{
    const symbolSum=sum(x.map(r=>r.excessReturn));
    return {
      symbol,
      episodeCount:x.length,
      smallSample:x.length<SYMBOL_SMALL_SAMPLE_N,
      meanExcessReturn:round(mean(x.map(r=>r.excessReturn))),
      sumExcessReturn:round(symbolSum),
      contributionPct:Number.isFinite(totalExcess)&&totalExcess!==0?round(symbolSum/totalExcess*100,2):null
    };
  }).sort((a,b)=>(b.sumExcessReturn??-Infinity)-(a.sumExcessReturn??-Infinity)||a.symbol.localeCompare(b.symbol));
  return {
    contributionDenominator:{
      definition:'sum of episode excess-return percentage points in this sample',
      totalExcessReturn:round(totalExcess),
      meanExcessReturn:round(meanExcess),
      nearZero:Math.abs(meanExcess??0)<0.10,
      nearZeroRule:'absolute episode-weighted mean excess < 0.10 percentage points; contribution percentages are unstable when true'
    },
    symbols
  };
}

function meanExcessOnly(rows){
  return {
    episodeCount:rows.length,
    distinctSymbolCount:new Set(rows.map(x=>x.symbol)).size,
    meanExcessReturn:round(mean(rows.map(x=>x.excessReturn))),
    medianExcessReturn:round(median(rows.map(x=>x.excessReturn)))
  };
}

function concentrationSensitivity(rows,concentration){
  const positive=concentration.symbols.filter(x=>x.sumExcessReturn>0);
  const symbolExclusions={};
  for(const k of [1,3,5]){
    const excludedSymbols=positive.slice(0,k).map(x=>x.symbol);
    const kept=rows.filter(x=>!excludedSymbols.includes(x.symbol));
    symbolExclusions['excludeTop'+k+'PositiveSymbolContributors']={
      retrospectiveDiagnostic:true,
      excludedSymbols,
      ...meanExcessOnly(kept)
    };
  }
  const cut=Math.ceil(rows.length*.01);
  const ranked=[...rows].sort((a,b)=>(b.excessReturn??-Infinity)-(a.excessReturn??-Infinity)||a.episodeId.localeCompare(b.episodeId));
  const excludedIds=new Set(ranked.slice(0,cut).map(x=>x.episodeId));
  const kept=rows.filter(x=>!excludedIds.has(x.episodeId));
  const perSymbol=[...groupBy(rows,x=>x.symbol).values()].map(x=>mean(x.map(r=>r.excessReturn))).filter(Number.isFinite);
  return {
    baseline:meanExcessOnly(rows),
    equalWeightPerSymbolMeanExcessReturn:round(mean(perSymbol)),
    symbolExclusions,
    excludeBestOnePctEpisodes:{
      retrospectiveDiagnostic:true,
      rankingMetric:'episode excess return',
      excludedEpisodeCount:cut,
      ...meanExcessOnly(kept)
    }
  };
}

function hashString(s){
  let h=2166136261>>>0;
  for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0}
  return h>>>0;
}
function rng32(seed){
  let x=seed>>>0||1;
  return ()=>{
    x^=x<<13;x^=x>>>17;x^=x<<5;
    return (x>>>0)/4294967296;
  };
}
function blockBootstrapMeanExcess({rows,calendarDates,label}){
  const dateRows=groupBy(rows,x=>x.firstSurfaceDate);
  const dates=[...calendarDates];
  if(!rows.length||!dates.length)return {method:'calendar-block-bootstrap',status:'insufficient',reps:0,interval95:null};
  const random=rng32((BOOTSTRAP_SEED^hashString(label))>>>0);
  const values=[];
  for(let rep=0;rep<BOOTSTRAP_REPS;rep++){
    let total=0,count=0,produced=0;
    while(produced<dates.length){
      const start=Math.floor(random()*dates.length);
      for(let j=0;j<BOOTSTRAP_BLOCK_SESSIONS&&produced<dates.length;j++,produced++){
        const d=dates[(start+j)%dates.length];
        for(const row of dateRows.get(d)||[]){
          if(Number.isFinite(row.excessReturn)){total+=row.excessReturn;count++}
        }
      }
    }
    if(count)values.push(total/count);
  }
  return {
    method:'circular calendar-block bootstrap over confirmed scan sessions; all episodes sharing a sampled date are resampled together',
    seed:BOOTSTRAP_SEED,
    reps:BOOTSTRAP_REPS,
    blockLengthConfirmedSessions:BOOTSTRAP_BLOCK_SESSIONS,
    pointEstimateMeanExcessReturn:round(mean(rows.map(x=>x.excessReturn))),
    interval95:{
      lower:round(quantile(values,.025)),
      upper:round(quantile(values,.975))
    },
    bootstrapMedian:round(median(values)),
    limitations:[
      'Temporal blocks reduce the independence assumption for overlapping market dates but do not remove repeated-symbol dependence across distant blocks.',
      'The universe and stage rules were selected within this project history.',
      'Validation has already been observed and has informed project research; it is not described as untouched out-of-sample evidence.'
    ]
  };
}

function splitCalendarDates(confirmedDates,split){
  if(split==='Development')return confirmedDates.filter(d=>d>=calendar.developmentStart&&d<calendar.validationStart);
  if(split==='Validation')return confirmedDates.filter(d=>d>=calendar.validationStart&&d<calendar.finalStart);
  return confirmedDates.filter(d=>d>=calendar.developmentStart&&d<calendar.finalStart);
}

function csvEscape(v){
  const s=v==null?'':String(v);
  return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
}
function toCsv(rows){
  const cols=['episodeId','horizon','split','included','exclusionReason','symbol','firstSurfaceDate','outcomeDate','benchmarkSymbol','rank','score','forwardReturn','benchmarkReturn','excessReturn','mae','mfe'];
  return [cols.join(','),...rows.map(r=>cols.map(c=>csvEscape(r[c])).join(','))].join('\n')+'\n';
}

function previousReconciliation(h,newCombined,newDev,newVal){
  const old=previousReplay?.horizons?.[h]??previousReplay?.horizons?.[String(h)];
  if(!old)return {available:false};
  const oldCombined=old.firstSurfaceEpisodes;
  const oldDev=old.pickDayObservations?.fixedCalendar?.train;
  const oldVal=old.pickDayObservations?.fixedCalendar?.validation;
  const keyMap={
    episodeCount:'n',meanReturn:'mean',medianReturn:'median',meanExcessReturn:'meanExcess',
    positiveReturnRate:'positiveRate',benchmarkBeatRate:'benchmarkBeatRate',averageMAE:'avgMAE',averageMFE:'avgMFE'
  };
  const combinedDiffs=[];
  for(const [nk,ok] of Object.entries(keyMap)){
    const a=newCombined?.[nk],b=oldCombined?.[ok];
    if(a!==b)combinedDiffs.push({field:nk,previous:b,current:a});
  }
  return {
    available:true,
    combinedEpisodeSummaryAgreement:combinedDiffs.length===0,
    combinedEpisodeDiscrepancies:combinedDiffs,
    previousDevelopmentObservationUnit:'pickDayObservations',
    currentDevelopmentObservationUnit:'firstSurfaceEpisodes after boundary purge',
    previousValidationObservationUnit:'pickDayObservations',
    currentValidationObservationUnit:'firstSurfaceEpisodes after boundary purge',
    Development:{previousDaily:oldDev,currentEpisodes:newDev},
    Validation:{previousDaily:oldVal,currentEpisodes:newVal},
    explanation:'Differences in split-level statistics are expected from changing the observation unit from repeated daily selections to first-surface episodes and from applying outcome-date purges to episodes. Combined first-surface episode statistics should agree with the previous combined episode report; disagreement would indicate a defect.'
  };
}

const identity=validateLockedInputs();
const allCandidates=reports.flatMap(r=>r.surfaceReplay?.candidates||[]);
const horizons=Object.keys(reports[0]?.horizons||{}).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
must(sameValue(horizons,[5,10,20]),'expected locked horizons 5,10,20');

const exportRows=[];
const summary={
  format:'market-hunter-early-watch-episode-stability-v1',
  generatedAt:new Date().toISOString(),
  source:{
    artifactId:identity.artifactId,
    validationRunId:36420714736,
    evidenceTag:'locked-v2-validation-36420714736-archive-v1',
    calendar,
    finalTestOpened:false
  },
  method:{
    observationUnit:'first-surface episode',
    episodeDefinition:'A symbol starts an episode when it is selected in the visible top-six Early Watch shortlist on a confirmed combined-market scan and was absent from the immediately previous confirmed scan. Confirmed zero-pick sessions end all active episodes. Missing/partial-coverage sessions are skipped and do not create an absence or reset.',
    chronology:'Episodes are constructed over the full confirmed timeline before Development/Validation assignment. The split boundary never resets episode continuity.',
    entryTiming:'Entry reference is the adjusted close on the first-surface scan date, inherited unchanged from the locked replay candidate.',
    outcomeTiming:'Outcome is the adjusted close exactly h symbol trading sessions after the first-surface scan date, for h in 5, 10, 20, inherited from the locked replay candidate.',
    benchmark:'CAD CDR symbols use ^IXIC; all other current universe symbols use ^GSPTSE. Benchmark return is measured from benchmark close aligned to the entry date through benchmark close at the symbol outcome date.',
    returnMeaning:'Returns are descriptive historical close-to-close replay outcomes and are not executable trading profits; they omit implementation frictions and do not assert fillability at the reference close.',
    maeMfe:'MAE/MFE are the minimum/maximum adjusted-close percentage moves relative to entry across symbol sessions 1 through h.',
    splitSafeguard:'Episodes are assigned by first-surface date. Development episodes with outcomes on/after validationStart are purged. Validation episodes with outcomes on/after finalStart are purged. Historical Final is never inspected.',
    bootstrap:{
      seed:BOOTSTRAP_SEED,reps:BOOTSTRAP_REPS,blockLengthConfirmedSessions:BOOTSTRAP_BLOCK_SESSIONS
    }
  },
  horizons:{},
  dailyObservationStatistics:{
    label:'Separate repeated daily-observation section; not used as the primary episode unit.',
    horizons:{}
  }
};

for(const h of horizons){
  const lists=reports.map(r=>r.surfaceReplay?.datesByHorizon?.[h]??r.surfaceReplay?.datesByHorizon?.[String(h)]);
  must(lists.every(Array.isArray),'missing horizon coverage '+h);
  const coverage=confirmedCoverage(lists);
  const pool=allCandidates.filter(x=>x.horizon===h);
  const {selectedByDate,eligibleCounts}=selectedByConfirmedDate({candidates:pool,confirmedDates:coverage.confirmedDates,maxVisible:MAX_VISIBLE});
  const episodes=firstSurfaceEpisodes({confirmedDates:coverage.confirmedDates,selectedByDate,horizon:h,benchmarkForSymbol});
  const classified=attachSplitStatus(episodes,calendar);
  exportRows.push(...classified);

  const dev=classified.filter(x=>x.split==='Development'&&x.included);
  const val=classified.filter(x=>x.split==='Validation'&&x.included);
  const combined=combinedIncluded(classified);
  must(dev.every(x=>x.outcomeDate<calendar.validationStart),'Development outcome crossed into Validation');
  must(val.every(x=>x.outcomeDate<calendar.finalStart),'Validation outcome entered Historical Final');
  must(combined.every(x=>x.outcomeDate<calendar.finalStart),'Combined included outcome entered Historical Final');

  const combinedStats=descriptiveSummary(combined);
  const devStats=descriptiveSummary(dev);
  const valStats=descriptiveSummary(val);

  const samples={Development:dev,Validation:val,Combined:combined};
  const sampleOutputs={};
  for(const [name,rows] of Object.entries(samples)){
    const concentration=symbolConcentration(rows);
    sampleOutputs[name]={
      summary:descriptiveSummary(rows),
      byCalendarYear:byYear(rows),
      concentration,
      sensitivity:concentrationSensitivity(rows,concentration),
      uncertainty:blockBootstrapMeanExcess({
        rows,
        calendarDates:splitCalendarDates(coverage.confirmedDates,name),
        label:h+'|'+name
      })
    };
  }

  const dailyRows=[...selectedByDate.values()].flat();
  const dailyFold=fixedCalendarSplit(dailyRows.map(x=>({...x,date:x.date})),calendar);
  summary.dailyObservationStatistics.horizons[h]={
    combined:dailySummary(dailyRows),
    Development:dailySummary(dailyFold.train),
    Validation:dailySummary(dailyFold.test),
    splitCounts:dailyFold.counts
  };

  summary.horizons[h]={
    coverage:{
      confirmedScanDays:coverage.confirmedDates.length,
      partialCoverageDays:coverage.partialCoverageDates.length,
      partialCoverageDates:coverage.partialCoverageDates,
      reportCoverageCounts:coverage.reportCoverageCounts,
      zeroPickConfirmedDays:eligibleCounts.filter(x=>x.count===0).length,
      daysWithEligibleNames:eligibleCounts.filter(x=>x.count>0).length
    },
    episodeConstruction:{
      constructedBeforeSplit:episodes.length,
      duplicateEpisodeIdentityCount:episodes.length-new Set(episodes.map(x=>x.episodeId)).size,
      splitCounts:splitCounts(classified)
    },
    samples:sampleOutputs,
    previousReportReconciliation:previousReconciliation(h,combinedStats,devStats,valStats)
  };
}

must(summary.source.finalTestOpened===false,'Historical Final state corrupted');
must(exportRows.length===new Set(exportRows.map(x=>x.episodeId)).size,'Duplicate episode identities detected across exported rows');

fs.mkdirSync(OUT_DIR,{recursive:true});
fs.writeFileSync(path.join(OUT_DIR,'episodes.json'),JSON.stringify(exportRows,null,2)+'\n');
fs.writeFileSync(path.join(OUT_DIR,'episodes.csv'),toCsv(exportRows));
fs.writeFileSync(path.join(OUT_DIR,'summary.json'),JSON.stringify(summary,null,2)+'\n');

console.log(JSON.stringify({
  format:summary.format,
  finalTestOpened:summary.source.finalTestOpened,
  rows:exportRows.length,
  horizons:Object.fromEntries(horizons.map(h=>[h,{
    constructed:summary.horizons[h].episodeConstruction.constructedBeforeSplit,
    Development:summary.horizons[h].samples.Development.summary,
    Validation:summary.horizons[h].samples.Validation.summary,
    Combined:summary.horizons[h].samples.Combined.summary,
    partialCoverageDays:summary.horizons[h].coverage.partialCoverageDays
  }]))
},null,2));
