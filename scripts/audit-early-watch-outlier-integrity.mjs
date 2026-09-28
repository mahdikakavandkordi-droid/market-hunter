import fs from 'node:fs';
import path from 'node:path';
import {loadFrozenDataset} from '../lib/frozen-dataset.js';

const EPISODES_FILE=process.env.EARLY_WATCH_EPISODES||'data/research/early-watch-episode-stability/episodes.json';
const MANIFEST_FILE=process.env.V2_DATASET_LOCK_MANIFEST||'data/frozen/market-hunter-v2-numerical-snapshot/manifest.json';
const SNAPSHOT_DIR=process.env.V2_SNAPSHOT_DIR||'data/frozen/market-hunter-v2-numerical-snapshot/files';
const OUT_DIR=process.env.EARLY_WATCH_OUTLIER_OUT||'data/research/early-watch-outlier-integrity';
const TOP_EPISODES_PER_HORIZON=Math.max(5,Number(process.env.TOP_EPISODES_PER_HORIZON||10));

if(process.env.V2_OPEN_FINAL_TEST==='1')throw new Error('Historical Final must remain sealed');

const episodes=JSON.parse(fs.readFileSync(EPISODES_FILE,'utf8'));
const manifest=JSON.parse(fs.readFileSync(MANIFEST_FILE,'utf8'));
if(manifest.validationCalendar?.finalStart!=='2026-01-01')throw new Error('Unexpected locked calendar');
if(!Array.isArray(manifest.batches)||manifest.batches.length!==4)throw new Error('Expected four locked snapshot batches');

function round(n,d=4){return Number.isFinite(n)?Number(n.toFixed(d)):null}
function pct(a,b){return Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a/b-1)*100:null}
function day(t){return new Date(Number(t)*1000).toISOString().slice(0,10)}
function mean(a){const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null}
function sum(a){return a.filter(Number.isFinite).reduce((s,v)=>s+v,0)}
function must(v,m){if(!v)throw new Error(m)}

const loaded=[];
for(const b of manifest.batches){
  const file=path.join(SNAPSHOT_DIR,b.file);
  const ds=loadFrozenDataset(file,{
    expectedSnapshotId:b.snapshotId,
    expectedDataSha256:b.dataSha256,
    expectedStructureSha256:b.structureSha256,
    expectedSource:manifest.source,
    expectedNormalizationVersion:manifest.normalizationVersion,
    expectedBatchIndex:b.batchIndex,
    expectedBatchCount:manifest.batchCount,
    expectedSymbols:b.symbols
  });
  loaded.push(ds);
}

function locate(symbol){
  for(const ds of loaded){
    if(ds.data[symbol])return {dataset:ds,pack:ds.data[symbol]};
  }
  return null;
}
function lastAtOrBefore(rows,date){
  let last=null;
  for(const r of rows){
    const d=day(r.t);
    if(d>date)break;
    last=r;
  }
  return last;
}
function indexOnDate(rows,date){
  return rows.findIndex(r=>day(r.t)===date);
}
function corporateEvents(pack,start,end){
  const splits=(pack.splitEvents||[]).filter(x=>x.date>=start&&x.date<=end);
  const dividends=(pack.dividends||[]).filter(x=>x.date>=start&&x.date<=end);
  return {splits,dividends};
}
function adjustmentFactor(row){
  return Number.isFinite(row?.close)&&Number.isFinite(row?.rawClose)&&row.rawClose!==0?row.close/row.rawClose:null;
}
function oneDayMoves(rows,startIndex,endIndex){
  const moves=[];
  for(let i=Math.max(1,startIndex+1);i<=endIndex;i++){
    const prev=rows[i-1],cur=rows[i];
    const adjusted=pct(cur.close,prev.close);
    const raw=pct(cur.rawClose,prev.rawClose);
    moves.push({date:day(cur.t),adjustedReturn:round(adjusted),rawReturn:round(raw)});
  }
  return moves;
}
function maxAbsMove(moves,key){
  return [...moves].filter(x=>Number.isFinite(x[key])).sort((a,b)=>Math.abs(b[key])-Math.abs(a[key]))[0]||null;
}

const includedValidation=episodes.filter(x=>x.split==='Validation'&&x.included===true);
const selected=[];
for(const h of [5,10,20]){
  const rows=includedValidation.filter(x=>x.horizon===h)
    .sort((a,b)=>(b.excessReturn??-Infinity)-(a.excessReturn??-Infinity)||a.episodeId.localeCompare(b.episodeId))
    .slice(0,TOP_EPISODES_PER_HORIZON);
  selected.push(...rows);
}
// Always include the specifically flagged LAC episode if present.
for(const row of includedValidation.filter(x=>x.symbol==='LAC.TO'&&x.firstSurfaceDate==='2025-09-10')){
  if(!selected.some(x=>x.episodeId===row.episodeId))selected.push(row);
}

const unique=[...new Map(selected.map(x=>[x.episodeId,x])).values()]
  .sort((a,b)=>a.horizon-b.horizon||(b.excessReturn??0)-(a.excessReturn??0));

const audits=[];
for(const ep of unique){
  const symbolLoc=locate(ep.symbol);
  const benchLoc=locate(ep.benchmarkSymbol);
  must(symbolLoc,'Snapshot missing symbol '+ep.symbol);
  must(benchLoc,'Snapshot missing benchmark '+ep.benchmarkSymbol);
  const rows=symbolLoc.pack.rows;
  const entryIndex=indexOnDate(rows,ep.firstSurfaceDate);
  must(entryIndex>=0,'Entry date missing '+ep.episodeId);
  const outcomeIndex=entryIndex+ep.horizon;
  must(outcomeIndex<rows.length,'Outcome index missing '+ep.episodeId);
  const entry=rows[entryIndex],outcome=rows[outcomeIndex];
  const derivedOutcomeDate=day(outcome.t);
  const window=rows.slice(entryIndex+1,outcomeIndex+1);
  const pathReturns=window.map(r=>pct(r.close,entry.close)).filter(Number.isFinite);

  const benchEntry=lastAtOrBefore(benchLoc.pack.rows,ep.firstSurfaceDate);
  const benchOutcome=lastAtOrBefore(benchLoc.pack.rows,derivedOutcomeDate);
  must(benchEntry&&benchOutcome,'Benchmark rows missing '+ep.episodeId);

  const derivedForward=pct(outcome.close,entry.close);
  const derivedRawForward=pct(outcome.rawClose,entry.rawClose);
  const derivedBenchmark=pct(benchOutcome.close,benchEntry.close);
  const derivedExcess=derivedForward-derivedBenchmark;
  const derivedMAE=pathReturns.length?Math.min(...pathReturns):null;
  const derivedMFE=pathReturns.length?Math.max(...pathReturns):null;

  const entryFactor=adjustmentFactor(entry);
  const outcomeFactor=adjustmentFactor(outcome);
  const factorChange=Number.isFinite(entryFactor)&&Number.isFinite(outcomeFactor)&&entryFactor!==0?pct(outcomeFactor,entryFactor):null;
  const events=corporateEvents(symbolLoc.pack,ep.firstSurfaceDate,derivedOutcomeDate);
  const moves=oneDayMoves(rows,entryIndex,outcomeIndex);
  const largestAdjustedMove=maxAbsMove(moves,'adjustedReturn');
  const largestRawMove=maxAbsMove(moves,'rawReturn');

  const toler=0.02;
  const checks={
    outcomeDateMatches:derivedOutcomeDate===ep.outcomeDate,
    forwardReturnMatches:Math.abs(derivedForward-ep.forwardReturn)<=toler,
    benchmarkReturnMatches:Math.abs(derivedBenchmark-ep.benchmarkReturn)<=toler,
    excessReturnMatches:Math.abs(derivedExcess-ep.excessReturn)<=toler,
    maeMatches:Math.abs(derivedMAE-ep.mae)<=toler,
    mfeMatches:Math.abs(derivedMFE-ep.mfe)<=toler
  };
  const calculationMatch=Object.values(checks).every(Boolean);
  const adjustmentArtifactWarning=
    events.splits.length>0||
    (Number.isFinite(factorChange)&&Math.abs(factorChange)>1)||
    (Number.isFinite(derivedForward)&&Number.isFinite(derivedRawForward)&&Math.abs(derivedForward-derivedRawForward)>2);

  audits.push({
    episodeId:ep.episodeId,
    horizon:ep.horizon,
    symbol:ep.symbol,
    firstSurfaceDate:ep.firstSurfaceDate,
    reportedOutcomeDate:ep.outcomeDate,
    benchmarkSymbol:ep.benchmarkSymbol,
    reported:{forwardReturn:ep.forwardReturn,benchmarkReturn:ep.benchmarkReturn,excessReturn:ep.excessReturn,mae:ep.mae,mfe:ep.mfe},
    independentlyDerived:{
      outcomeDate:derivedOutcomeDate,
      adjustedEntryClose:round(entry.close,6),
      adjustedOutcomeClose:round(outcome.close,6),
      rawEntryClose:round(entry.rawClose,6),
      rawOutcomeClose:round(outcome.rawClose,6),
      forwardReturn:round(derivedForward),
      rawForwardReturn:round(derivedRawForward),
      benchmarkEntryClose:round(benchEntry.close,6),
      benchmarkOutcomeClose:round(benchOutcome.close,6),
      benchmarkReturn:round(derivedBenchmark),
      excessReturn:round(derivedExcess),
      mae:round(derivedMAE),
      mfe:round(derivedMFE),
      adjustmentFactorEntry:round(entryFactor,8),
      adjustmentFactorOutcome:round(outcomeFactor,8),
      adjustmentFactorChangePct:round(factorChange)
    },
    corporateActionsInWindow:events,
    pathDiagnostics:{
      largestAbsoluteAdjustedOneDayMove:largestAdjustedMove,
      largestAbsoluteRawOneDayMove:largestRawMove,
      adjustedVsRawWindowReturnDifferencePctPoints:round(derivedForward-derivedRawForward)
    },
    checks,
    calculationMatch,
    adjustmentArtifactWarning,
    snapshotProvenance:{
      batchIndex:symbolLoc.dataset.batchIndex,
      snapshotId:symbolLoc.dataset.snapshotId,
      dataSha256:symbolLoc.dataset.dataSha256,
      structureSha256:symbolLoc.dataset.structureSha256,
      source:symbolLoc.dataset.source,
      normalizationVersion:symbolLoc.dataset.normalizationVersion
    }
  });
}

const byHorizon={};
for(const h of [5,10,20]){
  const rows=includedValidation.filter(x=>x.horizon===h);
  const total=sum(rows.map(x=>x.excessReturn));
  const bySymbol=new Map();
  for(const x of rows){
    if(!bySymbol.has(x.symbol))bySymbol.set(x.symbol,[]);
    bySymbol.get(x.symbol).push(x);
  }
  byHorizon[h]={
    validationEpisodeCount:rows.length,
    meanExcessReturn:round(mean(rows.map(x=>x.excessReturn))),
    totalExcessReturnPctPoints:round(total),
    topPositiveSymbolContributors:[...bySymbol.entries()].map(([symbol,x])=>({
      symbol,
      episodeCount:x.length,
      sumExcessReturn:round(sum(x.map(r=>r.excessReturn))),
      contributionPct:total!==0?round(sum(x.map(r=>r.excessReturn))/total*100):null
    })).filter(x=>x.sumExcessReturn>0)
      .sort((a,b)=>b.sumExcessReturn-a.sumExcessReturn)
      .slice(0,10)
  };
}

const lac=audits.filter(x=>x.symbol==='LAC.TO'&&x.firstSurfaceDate==='2025-09-10');
const result={
  format:'market-hunter-early-watch-outlier-integrity-v1',
  generatedAt:new Date().toISOString(),
  evidenceTag:'locked-v2-validation-36420714736-archive-v1',
  validationRunId:36420714736,
  historicalFinal:'SEALED',
  finalTestOpened:false,
  scope:{
    split:'Validation only',
    purpose:'Retrospective data-integrity and concentration audit of largest positive Early Watch first-surface episodes. Not a selection rule and not threshold optimization.',
    topEpisodesPerHorizon:TOP_EPISODES_PER_HORIZON
  },
  byHorizon,
  auditedEpisodes:audits,
  summary:{
    auditedEpisodeCount:audits.length,
    calculationMismatchCount:audits.filter(x=>!x.calculationMatch).length,
    adjustmentArtifactWarningCount:audits.filter(x=>x.adjustmentArtifactWarning).length,
    lacAudit: lac.map(x=>({
      horizon:x.horizon,
      calculationMatch:x.calculationMatch,
      adjustmentArtifactWarning:x.adjustmentArtifactWarning,
      corporateActionsInWindow:x.corporateActionsInWindow,
      independentlyDerived:x.independentlyDerived,
      pathDiagnostics:x.pathDiagnostics
    }))
  }
};

fs.mkdirSync(OUT_DIR,{recursive:true});
fs.writeFileSync(path.join(OUT_DIR,'outlier-integrity.json'),JSON.stringify(result,null,2)+'\n');

const rows=audits.map(x=>({
  horizon:x.horizon,symbol:x.symbol,firstSurfaceDate:x.firstSurfaceDate,outcomeDate:x.reportedOutcomeDate,
  benchmark:x.benchmarkSymbol,reportedExcess:x.reported.excessReturn,derivedExcess:x.independentlyDerived.excessReturn,
  rawForward:x.independentlyDerived.rawForwardReturn,adjustedForward:x.independentlyDerived.forwardReturn,
  factorChange:x.independentlyDerived.adjustmentFactorChangePct,
  splitCount:x.corporateActionsInWindow.splits.length,dividendCount:x.corporateActionsInWindow.dividends.length,
  largestAdjustedOneDayMove:x.pathDiagnostics.largestAbsoluteAdjustedOneDayMove?.adjustedReturn??null,
  calculationMatch:x.calculationMatch,adjustmentArtifactWarning:x.adjustmentArtifactWarning
}));
const cols=Object.keys(rows[0]||{});
const esc=v=>{const s=v==null?'':String(v);return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s};
fs.writeFileSync(path.join(OUT_DIR,'outlier-integrity.csv'),[cols.join(','),...rows.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\n')+'\n');

console.log(JSON.stringify(result.summary,null,2));
if(result.summary.calculationMismatchCount)process.exitCode=1;
