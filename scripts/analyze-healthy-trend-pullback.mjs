import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {UNIVERSE} from '../lib/universe.js';
import {loadFrozenDataset} from '../lib/frozen-dataset.js';
import {assertHistoricalFinalSealedReport} from '../lib/research-audit-guards.js';
import {
  HTP_VERSION,HTP_PARAMS,setupAt,trendRsAt,genericEligibility,evaluateEpisode,buildEpisodes,
  dayKey,lastAtOrBeforeIndex,sma,mean
} from '../lib/healthy-trend-pullback.js';

const OUT_DIR=process.env.HTP_OUT_DIR||'data/research/healthy-trend-pullback';
const MANIFEST_FILE=process.env.V2_DATASET_LOCK_MANIFEST||'data/frozen/market-hunter-v2-numerical-snapshot/manifest.json';
const SNAPSHOT_DIR=process.env.V2_SNAPSHOT_DIR||'data/frozen/market-hunter-v2-numerical-snapshot/files';
const BOOTSTRAP_SEED=20260928,BOOTSTRAP_REPS=5000,BLOCK_DATES=20;
const RANDOM_SEEDS=Array.from({length:100},(_,i)=>2026092800+i);
const EVIDENCE_TAG='locked-v2-validation-36420714736-archive-v1';
const LEGACY_FILE='data/research/early-watch-episode-stability/summary.json';

if(process.env.V2_OPEN_FINAL_TEST==='1')throw new Error('Historical Final must remain sealed');

const reports=Array.from({length:4},(_,i)=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
for(const r of reports)assertHistoricalFinalSealedReport(r,'locked backtest report batch '+r.batchIndex);
const manifest=JSON.parse(fs.readFileSync(MANIFEST_FILE,'utf8'));
if(manifest.validationCalendar?.finalStart!=='2026-01-01')throw new Error('Unexpected fixed calendar');
const calendar=manifest.validationCalendar;

const meta=new Map(UNIVERSE.map(([symbol,name,sector])=>[symbol,{symbol,name,sector}]));
const cdr=new Set(UNIVERSE.filter(x=>x[2]==='CDR').map(x=>x[0]));
const headlineSymbols=UNIVERSE.filter(x=>x[2]!=='CDR').map(x=>x[0]);
const data={};
for(const b of manifest.batches){
  const ds=loadFrozenDataset(path.join(SNAPSHOT_DIR,b.file),{
    expectedSnapshotId:b.snapshotId,expectedDataSha256:b.dataSha256,expectedStructureSha256:b.structureSha256,
    expectedSource:manifest.source,expectedNormalizationVersion:manifest.normalizationVersion,
    expectedBatchIndex:b.batchIndex,expectedBatchCount:manifest.batchCount,expectedSymbols:b.symbols
  });
  for(const [symbol,pack] of Object.entries(ds.data))if(!data[symbol])data[symbol]=pack;
}
if(!data['^GSPTSE'])throw new Error('TSX benchmark missing from frozen snapshot');

function round(n,d=4){return Number.isFinite(n)?Number(n.toFixed(d)):null}
function median(a){const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2}
function quantile(a,q){const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const p=(x.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return l===h?x[l]:x[l]+(x[h]-x[l])*(p-l)}
function hashString(s){let h=2166136261>>>0;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0}return h>>>0}
function rng32(seed){let x=seed>>>0||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296}}
function shuffleTake(rows,n,random){const a=[...rows];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n)}
function intersectDates(lists){
  const sets=lists.map(x=>new Set(x));
  const union=[...new Set(lists.flat())].sort();
  return union.filter(d=>sets.every(s=>s.has(d)));
}
const confirmedDates=intersectDates(reports.map(r=>r.surfaceReplay?.datesByHorizon?.['20']||r.surfaceReplay?.datesByHorizon?.[20]||[]))
  .filter(d=>d>=calendar.developmentStart&&d<calendar.finalStart);
if(!confirmedDates.length)throw new Error('No confirmed pre-Final calendar');

const dateIndex=new Map();
for(const [symbol,pack] of Object.entries(data)){
  const m=new Map();
  pack.rows.forEach((r,i)=>m.set(dayKey(r.t),i));
  dateIndex.set(symbol,m);
}
function marketAbove50(date){
  const rows=data['^GSPTSE'].rows,idx=lastAtOrBeforeIndex(rows,date);
  if(idx<49)return null;
  const m50=sma(rows.slice(0,idx+1).map(x=>x.close),50);
  return Number.isFinite(m50)?rows[idx].close>m50:null;
}

const pools=new Map(confirmedDates.map(d=>[d,[]]));
const candidateMaps={
  core:new Map(confirmedDates.map(d=>[d,[]])),
  core_volume:new Map(confirmedDates.map(d=>[d,[]])),
  core_market:new Map(confirmedDates.map(d=>[d,[]])),
  trend_rs:new Map(confirmedDates.map(d=>[d,[]]))
};

for(const symbol of headlineSymbols){
  const pack=data[symbol];if(!pack)continue;
  const bench=data['^GSPTSE']?.rows||[];
  const idxMap=dateIndex.get(symbol);
  for(const date of confirmedDates){
    const i=idxMap.get(date);if(!Number.isInteger(i))continue;
    const g=genericEligibility({pack,rows:pack.rows,i});
    if(g.eligible){
      pools.get(date).push({
        symbol,date,decisionIndex:i,sector:meta.get(symbol)?.sector||'Unknown',
        atr14Pct:g.atr14Pct,score:0
      });
    }
    for(const [variant,key] of [['core','core'],['core_volume','core_volume'],['core_market','core_market']]){
      const x=setupAt({pack,rows:pack.rows,i,benchmarkRows:bench,marketRows:data['^GSPTSE'].rows,variant});
      if(x.eligible)candidateMaps[key].get(date).push({
        symbol,date,decisionIndex:i,sector:meta.get(symbol)?.sector||'Unknown',atr14Pct:x.atr14Pct,
        score:x.score,rs20:x.rs20,drawdownPct:x.drawdownPct,volumeRatio:x.volumeRatio,
        marketAbove50:x.marketAbove50,pivotDate:x.pivot?.date,pivotConfirmedAt:x.pivot?.confirmedAt,
        weeklyLastCompleted:x.weekly?.lastCompletedWeek
      });
    }
    const tr=trendRsAt({pack,rows:pack.rows,i,benchmarkRows:bench});
    if(tr.eligible)candidateMaps.trend_rs.get(date).push({
      symbol,date,decisionIndex:i,sector:meta.get(symbol)?.sector||'Unknown',atr14Pct:tr.atr14Pct,score:tr.score,
      rs20:tr.rs20,weeklyLastCompleted:tr.weekly?.lastCompletedWeek
    });
  }
}

// ATR quintiles are frozen cross-sectionally before any random control outcome is read.
for(const date of confirmedDates){
  const p=pools.get(date).filter(x=>Number.isFinite(x.atr14Pct)).sort((a,b)=>a.atr14Pct-b.atr14Pct||a.symbol.localeCompare(b.symbol));
  p.forEach((x,i)=>x.volQuintile=Math.min(4,Math.floor(i*5/Math.max(1,p.length))));
}
function finalizeMap(m){
  const out=new Map();
  for(const date of confirmedDates){
    out.set(date,[...(m.get(date)||[])].sort((a,b)=>(b.score??-Infinity)-(a.score??-Infinity)||a.symbol.localeCompare(b.symbol))
      .slice(0,HTP_PARAMS.maxVisible).map((x,i)=>({...x,rank:i+1})));
  }
  return out;
}
for(const k of Object.keys(candidateMaps))candidateMaps[k]=finalizeMap(candidateMaps[k]);

// Current Early Watch is reconstructed unchanged from the locked surface replay.
const earlyAll=new Map(confirmedDates.map(d=>[d,[]]));
const ewCandidates=reports.flatMap(r=>r.surfaceReplay?.candidates||[]).filter(x=>x.horizon===20);
for(const x of ewCandidates)if(earlyAll.has(x.date))earlyAll.get(x.date).push(x);
for(const date of confirmedDates){
  earlyAll.set(date,[...(earlyAll.get(date)||[])].sort((a,b)=>(b.score??-Infinity)-(a.score??-Infinity)||String(a.symbol).localeCompare(String(b.symbol)))
    .slice(0,6).map((x,i)=>({
      symbol:x.symbol,date,score:x.score,rank:i+1,decisionIndex:dateIndex.get(x.symbol)?.get(date),
      sector:meta.get(x.symbol)?.sector||'Unknown'
    })));
}
const earlyHeadline=new Map(confirmedDates.map(d=>[d,(earlyAll.get(d)||[]).filter(x=>!cdr.has(x.symbol))]));

function evaluationFor(row){
  const pack=data[row.symbol];
  if(!pack||!Number.isInteger(row.decisionIndex))return {status:'missing_decision_row'};
  const ev=evaluateEpisode({pack,decisionIndex:row.decisionIndex,benchmarkRows:data['^GSPTSE'].rows,calendar});
  return {...ev,marketContext:marketAbove50(row.date)===true?'TSX_above_MA50':'TSX_not_above_MA50'};
}
function episodesFor(model,map){
  return buildEpisodes({model,confirmedDates,selectedByDate:map,evaluate:(row)=>evaluationFor(row)});
}
const naturalMaps={
  core:candidateMaps.core,core_volume:candidateMaps.core_volume,core_market:candidateMaps.core_market,
  trend_rs:candidateMaps.trend_rs,early_watch:earlyHeadline
};
const naturalEpisodes={};
for(const [model,map] of Object.entries(naturalMaps))naturalEpisodes[model]=episodesFor(model,map);

function outputVolume(map,eligibleMap=null){
  const counts=confirmedDates.map(d=>(map.get(d)||[]).length);
  const eligibleCounts=eligibleMap?confirmedDates.map(d=>(eligibleMap.get(d)||[]).length):null;
  return {
    confirmedDays:confirmedDates.length,daysWithPicks:counts.filter(x=>x>0).length,zeroPickDays:counts.filter(x=>x===0).length,
    totalPicks:counts.reduce((a,b)=>a+b,0),meanPicksPerConfirmedDay:round(mean(counts),3),
    naturalEligibleTotal:eligibleCounts?eligibleCounts.reduce((a,b)=>a+b,0):null
  };
}
function eligibleRows(rows,split=null){
  return rows.filter(x=>x.status==='evaluated'&&x.included===true&&(!split||x.split===split));
}
function basicStats(rows){
  const x=rows.filter(r=>r.primaryLabel!=='suspension_or_irregular_gap');
  const labels=Object.fromEntries(['success','adverse_first','neither','ambiguous_both_hit'].map(k=>[k,x.filter(r=>r.primaryLabel===k).length]));
  const successRate=x.length?labels.success/x.length*100:null;
  return {
    episodeCount:rows.length,primaryDenominator:x.length,distinctSymbols:new Set(rows.map(r=>r.symbol)).size,
    primaryLabels:labels,successRate:round(successRate,2),
    meanReturn5:round(mean(rows.map(r=>r.returns?.[5]))),medianReturn5:round(median(rows.map(r=>r.returns?.[5]))),
    meanReturn10:round(mean(rows.map(r=>r.returns?.[10]))),medianReturn10:round(median(rows.map(r=>r.returns?.[10]))),
    meanReturn20:round(mean(rows.map(r=>r.returns?.[20]))),medianReturn20:round(median(rows.map(r=>r.returns?.[20]))),
    meanExcess20:round(mean(rows.map(r=>r.excessReturns?.[20]))),medianExcess20:round(median(rows.map(r=>r.excessReturns?.[20]))),
    meanFavourableExcursion:round(mean(rows.map(r=>r.favourableExcursionPct))),
    meanAdverseExcursion:round(mean(rows.map(r=>r.adverseExcursionPct))),
    medianTimeToFavourable:round(median(rows.filter(r=>r.primaryLabel==='success').map(r=>r.timeToFavourable)),2),
    irregularGapCount:rows.filter(r=>r.primaryLabel==='suspension_or_irregular_gap').length
  };
}
function byGroup(rows,keyFn){
  const m=new Map();for(const r of rows){const k=keyFn(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r)}
  return Object.fromEntries([...m.entries()].sort(([a],[b])=>String(a).localeCompare(String(b))).map(([k,v])=>[k,basicStats(v)]));
}
function concentration(rows){
  const m=new Map();for(const r of rows){if(!m.has(r.symbol))m.set(r.symbol,[]);m.get(r.symbol).push(r)}
  const list=[...m.entries()].map(([symbol,v])=>({symbol,episodes:v.length,sumExcess20:round(v.reduce((s,r)=>s+(Number.isFinite(r.excessReturns?.[20])?r.excessReturns[20]:0),0))}))
    .sort((a,b)=>b.sumExcess20-a.sumExcess20||a.symbol.localeCompare(b.symbol));
  return {topPositiveContributors:list.slice(0,10)};
}
function blockBootstrap(rows,label){
  const x=rows.filter(r=>r.primaryLabel!=='suspension_or_irregular_gap');
  const byDate=new Map();for(const r of x){if(!byDate.has(r.firstSurfaceDate))byDate.set(r.firstSurfaceDate,[]);byDate.get(r.firstSurfaceDate).push(r)}
  const dates=[...new Set(confirmedDates.filter(d=>d<calendar.finalStart))];
  if(!x.length)return {reps:0,successRate95:null,meanExcess20_95:null};
  const rnd=rng32((BOOTSTRAP_SEED^hashString(label))>>>0),sr=[],ex=[];
  for(let rep=0;rep<BOOTSTRAP_REPS;rep++){
    let produced=0,succ=0,n=0,sumEx=0,nEx=0;
    while(produced<dates.length){
      const start=Math.floor(rnd()*dates.length);
      for(let j=0;j<BLOCK_DATES&&produced<dates.length;j++,produced++){
        const d=dates[(start+j)%dates.length];
        for(const r of byDate.get(d)||[]){n++;if(r.primaryLabel==='success')succ++;if(Number.isFinite(r.excessReturns?.[20])){sumEx+=r.excessReturns[20];nEx++}}
      }
    }
    if(n)sr.push(succ/n*100);if(nEx)ex.push(sumEx/nEx);
  }
  return {
    method:'circular 20-confirmed-date block bootstrap',seed:BOOTSTRAP_SEED,reps:BOOTSTRAP_REPS,
    successRate95:{lower:round(quantile(sr,.025),2),upper:round(quantile(sr,.975),2)},
    meanExcess20_95:{lower:round(quantile(ex,.025)),upper:round(quantile(ex,.975))}
  };
}
function summarizeEpisodes(rows,label){
  const included=eligibleRows(rows);
  const top=included.filter(r=>r.rank===1);
  const costs=[0,10,25].map(bps=>({bpsPerSide:bps,meanNetReturn20:round(mean(included.map(r=>Number.isFinite(r.returns?.[20])?r.returns[20]-2*bps/100:null)))}));
  return {
    Development:basicStats(eligibleRows(rows,'Development')),
    ValidationPreviouslyObserved:basicStats(eligibleRows(rows,'Validation')),
    CombinedIncludedPurged:basicStats(included),
    uncertainty:blockBootstrap(included,label),
    topRanked:basicStats(top),
    byYear:byGroup(included,r=>r.firstSurfaceDate.slice(0,4)),
    byMarketContext:byGroup(included,r=>r.marketContext||'unknown'),
    concentration:concentration(included),
    costSensitivity:costs,
    excludedByBoundary:rows.filter(r=>r.status==='evaluated'&&!r.included).reduce((o,r)=>(o[r.exclusionReason]=(o[r.exclusionReason]||0)+1,o),{})
  };
}
const naturalSummary={};
for(const [model,rows] of Object.entries(naturalEpisodes)){
  naturalSummary[model]={
    volume:outputVolume(naturalMaps[model],model.startsWith('core')?candidateMaps[model]:null),
    outcomes:summarizeEpisodes(rows,'natural|'+model)
  };
}
const earlyAllVolume=outputVolume(earlyAll);
const earlyCdrPicks=[...earlyAll.values()].flat().filter(x=>cdr.has(x.symbol));

// Controlled deterministic maps against each challenger.
function controlledBaselineMap(targetMap,baselineMap){
  const out=new Map();
  let shortfallDays=0,shortfallPicks=0;
  for(const date of confirmedDates){
    const n=(targetMap.get(date)||[]).length;
    const picked=n?[...(baselineMap.get(date)||[])].slice(0,n):[];
    if(picked.length<n){shortfallDays++;shortfallPicks+=n-picked.length}
    out.set(date,picked.map((x,i)=>({...x,rank:i+1})));
  }
  return {map:out,shortfallDays,shortfallPicks};
}
function randomMap(targetMap,seed,matched=false){
  const rnd=rng32(seed),out=new Map(),stats={unmatchedPicks:0,insufficientDates:0};
  for(const date of confirmedDates){
    const target=targetMap.get(date)||[];
    if(!target.length){out.set(date,[]);continue}
    if(!matched){
      const chosen=shuffleTake(pools.get(date)||[],target.length,rnd).map((x,i)=>({...x,score:0,rank:i+1}));
      if(chosen.length<target.length){stats.unmatchedPicks+=target.length-chosen.length;stats.insufficientDates++}
      out.set(date,chosen);continue;
    }
    const chosen=[],used=new Set();
    for(const t of target){
      const pool=(pools.get(date)||[]).filter(x=>x.symbol!==t.symbol&&!used.has(x.symbol)&&x.sector===t.sector&&x.volQuintile===t.volQuintile);
      if(!pool.length){stats.unmatchedPicks++;continue}
      const x=pool[Math.floor(rnd()*pool.length)];used.add(x.symbol);chosen.push({...x,score:0,rank:chosen.length+1});
    }
    if(chosen.length<target.length)stats.insufficientDates++;
    out.set(date,chosen);
  }
  return {map:out,...stats};
}
function pairedDateEffect(targetRows,baseRows){
  const t=eligibleRows(targetRows),b=eligibleRows(baseRows);
  const tm=new Map(),bm=new Map();
  for(const r of t){if(!tm.has(r.firstSurfaceDate))tm.set(r.firstSurfaceDate,[]);tm.get(r.firstSurfaceDate).push(r)}
  for(const r of b){if(!bm.has(r.firstSurfaceDate))bm.set(r.firstSurfaceDate,[]);bm.get(r.firstSurfaceDate).push(r)}
  const dates=confirmedDates.filter(d=>tm.has(d)&&bm.has(d));
  const diffs=dates.map(d=>{
    const ta=tm.get(d).filter(x=>x.primaryLabel!=='suspension_or_irregular_gap');
    const ba=bm.get(d).filter(x=>x.primaryLabel!=='suspension_or_irregular_gap');
    return {
      d,
      success:(ta.length?ta.filter(x=>x.primaryLabel==='success').length/ta.length:null)-(ba.length?ba.filter(x=>x.primaryLabel==='success').length/ba.length:null),
      excess:mean(ta.map(x=>x.excessReturns?.[20]))-mean(ba.map(x=>x.excessReturns?.[20]))
    };
  }).filter(x=>Number.isFinite(x.success)&&Number.isFinite(x.excess));
  if(!diffs.length)return {sharedDates:0};
  const pointSuccess=mean(diffs.map(x=>x.success))*100,pointExcess=mean(diffs.map(x=>x.excess));
  const rnd=rng32((BOOTSTRAP_SEED^hashString('paired'+targetRows[0]?.model+baseRows[0]?.model))>>>0),bs=[],be=[];
  for(let rep=0;rep<BOOTSTRAP_REPS;rep++){
    let produced=0,sv=[],ev=[];
    while(produced<diffs.length){
      const start=Math.floor(rnd()*diffs.length);
      for(let j=0;j<BLOCK_DATES&&produced<diffs.length;j++,produced++){
        const x=diffs[(start+j)%diffs.length];sv.push(x.success);ev.push(x.excess);
      }
    }
    bs.push(mean(sv)*100);be.push(mean(ev));
  }
  return {
    sharedDates:diffs.length,successRateDifferencePctPoints:round(pointSuccess,2),meanExcess20DifferencePctPoints:round(pointExcess),
    successDiff95:{lower:round(quantile(bs,.025),2),upper:round(quantile(bs,.975),2)},
    excessDiff95:{lower:round(quantile(be,.025)),upper:round(quantile(be,.975))}
  };
}

const controlled={},randomEvidenceLines=[];
for(const targetName of ['core','core_volume','core_market']){
  const targetMap=naturalMaps[targetName],targetEpisodes=naturalEpisodes[targetName];
  const ew=controlledBaselineMap(targetMap,naturalMaps.early_watch);
  const tr=controlledBaselineMap(targetMap,naturalMaps.trend_rs);
  const ewEpisodes=episodesFor('controlled_'+targetName+'_early_watch',ew.map);
  const trEpisodes=episodesFor('controlled_'+targetName+'_trend_rs',tr.map);
  const seedSummaries=[],matchedSummaries=[];
  for(const seed of RANDOM_SEEDS){
    const rr=randomMap(targetMap,seed,false),mr=randomMap(targetMap,seed,true);
    const re=episodesFor('random_'+targetName+'_'+seed,rr.map),me=episodesFor('matched_'+targetName+'_'+seed,mr.map);
    const rs=basicStats(eligibleRows(re)),ms=basicStats(eligibleRows(me));
    seedSummaries.push({seed,...rs,unmatchedPicks:rr.unmatchedPicks,insufficientDates:rr.insufficientDates});
    matchedSummaries.push({seed,...ms,unmatchedPicks:mr.unmatchedPicks,insufficientDates:mr.insufficientDates});
    for(const e of re)randomEvidenceLines.push(JSON.stringify({control:'random',target:targetName,seed,...e}));
    for(const e of me)randomEvidenceLines.push(JSON.stringify({control:'matched',target:targetName,seed,...e}));
  }
  const dist=arr=>({
    seeds:arr.length,
    meanSuccessRate:round(mean(arr.map(x=>x.successRate)),2),
    successRateP05:round(quantile(arr.map(x=>x.successRate),.05),2),
    successRateP95:round(quantile(arr.map(x=>x.successRate),.95),2),
    meanExcess20:round(mean(arr.map(x=>x.meanExcess20))),
    excess20P05:round(quantile(arr.map(x=>x.meanExcess20),.05)),
    excess20P95:round(quantile(arr.map(x=>x.meanExcess20),.95)),
    totalUnmatchedPicks:arr.reduce((s,x)=>s+(x.unmatchedPicks||0),0),
    seedSummaries:arr
  });
  controlled[targetName]={
    target:summarizeEpisodes(targetEpisodes,'controlled-target|'+targetName),
    currentEarlyWatch:{
      shortfallDays:ew.shortfallDays,shortfallPicks:ew.shortfallPicks,
      summary:summarizeEpisodes(ewEpisodes,'controlled-ew|'+targetName),
      pairedEffectTargetMinusBaseline:pairedDateEffect(targetEpisodes,ewEpisodes)
    },
    trendRs:{
      shortfallDays:tr.shortfallDays,shortfallPicks:tr.shortfallPicks,
      summary:summarizeEpisodes(trEpisodes,'controlled-tr|'+targetName),
      pairedEffectTargetMinusBaseline:pairedDateEffect(targetEpisodes,trEpisodes)
    },
    repeatedRandom:dist(seedSummaries),
    sectorVolMatchedRandom:dist(matchedSummaries)
  };
}

const deterministicRows=Object.values(naturalEpisodes).flat();
const legacy=fs.existsSync(LEGACY_FILE)?JSON.parse(fs.readFileSync(LEGACY_FILE,'utf8')):null;
const summary={
  format:'market-hunter-healthy-trend-pullback-challenger-v1',
  generatedAt:new Date().toISOString(),
  version:HTP_VERSION,
  evidence:{tag:EVIDENCE_TAG,validationRunId:36420714736,finalTestOpened:false,calendar},
  protocol:'docs/healthy-trend-pullback-challenger-protocol-v1.md',
  entryConvention:{
    reference:'next symbol session adjusted close',
    openAvailableInPinnedSnapshot:false,
    pathStarts:'session after entry close',
    primaryResearchBarrier:'+2 ATR before -1 ATR within 20 post-entry symbol sessions',
    ambiguousBothHit:'separate and never success'
  },
  dataLimitations:{
    survivorship:'Reviewed 2026 universe is not point-in-time historical membership.',
    cdrBenchmark:'CAD CDR returns include FX effects while ^IXIC is USD; no FX/hedge series exists in the locked archive, so CDRs are excluded from headline comparison.',
    independentPriceVerification:'Pinned-source consistency is not independent market-price verification.'
  },
  confirmedCalendar:{days:confirmedDates.length,first:confirmedDates[0],last:confirmedDates.at(-1)},
  natural:naturalSummary,
  currentEarlyWatchNaturalAllInstrumentVolume:earlyAllVolume,
  cdrAssessment:{
    cdrUniverseCount:cdr.size,
    currentEarlyWatchCdrPickDays:new Set(earlyCdrPicks.map(x=>x.date)).size,
    currentEarlyWatchCdrPickCount:earlyCdrPicks.length,
    headlineComparison:'excluded due benchmark currency/hedging incompatibility',
    separateRawChallengerComparison:'not used because it would not supply a defensible relative-strength benchmark'
  },
  controlled,
  legacyCloseToClose:{
    label:'Legacy scan-close-to-close Early Watch episode statistics; timing differs from challenger and is not mixed with next-session-entry outcomes.',
    available:!!legacy,
    sourceFormat:legacy?.format||null,
    horizons:legacy?.horizons?Object.fromEntries(Object.entries(legacy.horizons).map(([h,x])=>[h,{
      Development:x.samples?.Development?.summary,
      Validation:x.samples?.Validation?.summary,
      Combined:x.samples?.Combined?.summary
    }])):null
  },
  randomSeeds:RANDOM_SEEDS,
  uncertainty:{bootstrapSeed:BOOTSTRAP_SEED,reps:BOOTSTRAP_REPS,blockLengthConfirmedDates:BLOCK_DATES}
};

fs.mkdirSync(OUT_DIR,{recursive:true});
fs.writeFileSync(path.join(OUT_DIR,'summary.json'),JSON.stringify(summary,null,2)+'\n');
fs.writeFileSync(path.join(OUT_DIR,'episodes.json'),JSON.stringify(deterministicRows,null,2)+'\n');

const cols=['episodeId','model','symbol','sector','firstSurfaceDate','priorConfirmedDate','rank','score','entryDate','entryPrice','atr14','finalDate','split','included','exclusionReason','primaryLabel','timeToFavourable','return5','return10','return20','excess20','favourableExcursionPct','adverseExcursionPct','marketContext'];
const esc=v=>{const s=v==null?'':String(v);return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s};
const csv=[cols.join(','),...deterministicRows.map(r=>cols.map(c=>esc(
  c==='return5'?r.returns?.[5]:c==='return10'?r.returns?.[10]:c==='return20'?r.returns?.[20]:c==='excess20'?r.excessReturns?.[20]:r[c]
)).join(','))].join('\n')+'\n';
fs.writeFileSync(path.join(OUT_DIR,'episodes.csv'),csv);

const randomPayload=randomEvidenceLines.join('\n')+'\n';
fs.writeFileSync(path.join(OUT_DIR,'random-controls.jsonl.gz'),zlib.gzipSync(randomPayload,{level:9}));

const compRows=[];
for(const [model,x] of Object.entries(naturalSummary)){
  const y=x.outcomes.CombinedIncludedPurged;
  compRows.push({scope:'natural',target:'',model,episodes:y.episodeCount,successRate:y.successRate,meanReturn20:y.meanReturn20,meanExcess20:y.meanExcess20,zeroPickDays:x.volume.zeroPickDays});
}
for(const [target,x] of Object.entries(controlled)){
  for(const [model,obj] of [
    [target,x.target.CombinedIncludedPurged],
    ['early_watch',x.currentEarlyWatch.summary.CombinedIncludedPurged],
    ['trend_rs',x.trendRs.summary.CombinedIncludedPurged]
  ])compRows.push({scope:'controlled',target,model,episodes:obj.episodeCount,successRate:obj.successRate,meanReturn20:obj.meanReturn20,meanExcess20:obj.meanExcess20,zeroPickDays:null});
  compRows.push({scope:'controlled_random_distribution',target,model:'random',episodes:null,successRate:x.repeatedRandom.meanSuccessRate,meanReturn20:null,meanExcess20:x.repeatedRandom.meanExcess20,zeroPickDays:null});
  compRows.push({scope:'controlled_random_distribution',target,model:'sector_vol_matched_random',episodes:null,successRate:x.sectorVolMatchedRandom.meanSuccessRate,meanReturn20:null,meanExcess20:x.sectorVolMatchedRandom.meanExcess20,zeroPickDays:null});
}
const cc=Object.keys(compRows[0]);
fs.writeFileSync(path.join(OUT_DIR,'comparison.csv'),[cc.join(','),...compRows.map(r=>cc.map(c=>esc(r[c])).join(','))].join('\n')+'\n');

const files=['summary.json','episodes.json','episodes.csv','comparison.csv','random-controls.jsonl.gz'];
const checksums={};
for(const f of files)checksums[f]=crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT_DIR,f))).digest('hex');
fs.writeFileSync(path.join(OUT_DIR,'checksums.json'),JSON.stringify({algorithm:'sha256',files:checksums},null,2)+'\n');

console.log(JSON.stringify({
  version:HTP_VERSION,confirmedDays:confirmedDates.length,
  natural:Object.fromEntries(Object.entries(naturalSummary).map(([k,v])=>[k,{volume:v.volume,outcomes:v.outcomes.CombinedIncludedPurged}])),
  controlled:Object.fromEntries(Object.entries(controlled).map(([k,v])=>[k,{
    target:v.target.CombinedIncludedPurged,
    earlyWatch:v.currentEarlyWatch.summary.CombinedIncludedPurged,
    trendRs:v.trendRs.summary.CombinedIncludedPurged,
    random:{successRate:v.repeatedRandom.meanSuccessRate,meanExcess20:v.repeatedRandom.meanExcess20},
    matched:{successRate:v.sectorVolMatchedRandom.meanSuccessRate,meanExcess20:v.sectorVolMatchedRandom.meanExcess20}
  }]))
},null,2));
