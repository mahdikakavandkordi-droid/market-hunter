import fs from 'node:fs';
import path from 'node:path';
import {UNIVERSE} from '../lib/universe.js';

const OUT_DIR=process.env.EARLY_WATCH_STABILITY_OUT||'data/research/early-watch-episode-stability';
const MANIFEST_FILE=process.env.V2_DATASET_LOCK_MANIFEST||'data/frozen/market-hunter-v2-numerical-snapshot/manifest.json';
const reports=Array.from({length:4},(_,i)=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const manifest=JSON.parse(fs.readFileSync(MANIFEST_FILE,'utf8'));
const exported=JSON.parse(fs.readFileSync(path.join(OUT_DIR,'episodes.json'),'utf8'));
const summary=JSON.parse(fs.readFileSync(path.join(OUT_DIR,'summary.json'),'utf8'));
const calendar=manifest.validationCalendar;
const CDR=new Set(UNIVERSE.filter(x=>x[2]==='CDR').map(x=>x[0]));
const bench=s=>CDR.has(s)?'^IXIC':'^GSPTSE';

function fail(m){throw new Error(m)}
function assert(v,m){if(!v)fail(m)}
function round(n,d=2){return Number.isFinite(n)?Number(n.toFixed(d)):null}
function nums(a){return a.filter(Number.isFinite)}
function mean(a){const x=nums(a);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null}
function quantile(a,q){
  const x=nums(a).sort((a,b)=>a-b);if(!x.length)return null;
  const p=(x.length-1)*q,l=Math.floor(p),h=Math.ceil(p);
  return l===h?x[l]:x[l]+(x[h]-x[l])*(p-l);
}
function median(a){return quantile(a,.5)}
function independentStats(rows){
  const r=rows.map(x=>x.forwardReturn),e=rows.map(x=>x.excessReturn);
  return {
    episodeCount:rows.length,
    distinctSymbolCount:new Set(rows.map(x=>x.symbol)).size,
    meanReturn:round(mean(r)),
    medianReturn:round(median(r)),
    meanExcessReturn:round(mean(e)),
    medianExcessReturn:round(median(e)),
    positiveReturnRate:rows.length?round(rows.filter(x=>x.forwardReturn>0).length/rows.length*100,1):null,
    benchmarkBeatRate:rows.length?round(rows.filter(x=>x.excessReturn>0).length/rows.length*100,1):null,
    averageMAE:round(mean(rows.map(x=>x.mae))),
    averageMFE:round(mean(rows.map(x=>x.mfe))),
    returnPercentiles:{p10:round(quantile(r,.1)),p25:round(quantile(r,.25)),p75:round(quantile(r,.75)),p90:round(quantile(r,.9))},
    excessReturnPercentiles:{p10:round(quantile(e,.1)),p25:round(quantile(e,.25)),p75:round(quantile(e,.75)),p90:round(quantile(e,.9))}
  };
}
function comparableStats(x){
  if(!x)return x;
  const {smallSample,...rest}=x;
  return rest;
}
function iso(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)}
function classify(row){
  const d=row.firstSurfaceDate,o=row.outcomeDate;
  if(!iso(d))return {split:'Invalid',included:false,exclusionReason:'invalid_first_surface_date'};
  if(!iso(o))return {split:'Invalid',included:false,exclusionReason:'invalid_outcome_date'};
  if(o<d)return {split:'Invalid',included:false,exclusionReason:'outcome_before_first_surface'};
  if(d<calendar.developmentStart)return {split:'Outside',included:false,exclusionReason:'before_development_start'};
  if(d>=calendar.finalStart)return {split:'Historical Final',included:false,exclusionReason:'historical_final_sealed'};
  if(d<calendar.validationStart)return o>=calendar.validationStart
    ?{split:'Development',included:false,exclusionReason:'validation_boundary_outcome_purge'}
    :{split:'Development',included:true,exclusionReason:null};
  return o>=calendar.finalStart
    ?{split:'Validation',included:false,exclusionReason:'historical_final_outcome_purge'}
    :{split:'Validation',included:true,exclusionReason:null};
}
function stable(v){return Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v}
function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b))}

assert(process.env.V2_OPEN_FINAL_TEST!=='1','audit refuses V2_OPEN_FINAL_TEST=1');
assert(reports.every(r=>r.validation?.finalTestOpened!==true),'input report opened Historical Final');
assert(reports.every(r=>!r.finalEvaluation),'input report contains Historical Final output');
assert(summary.source?.finalTestOpened===false,'analysis summary says Historical Final opened');

const allCandidates=reports.flatMap(r=>r.surfaceReplay?.candidates||[]);
const exportedById=new Map();
for(const row of exported){
  assert(!exportedById.has(row.episodeId),'duplicate exported episode identity '+row.episodeId);
  exportedById.set(row.episodeId,row);
}

const checks=[];
const differences=[];
const horizonAudit={};
function check(name,pass,detail){
  checks.push({name,pass,detail});
  if(!pass)differences.push({name,detail});
}

for(const h of [5,10,20]){
  // Independent coverage intersection.
  const sets=reports.map(r=>new Set(r.surfaceReplay?.datesByHorizon?.[h]||[]));
  const union=[...new Set(sets.flatMap(s=>[...s]))].sort();
  const confirmed=union.filter(d=>sets.every(s=>s.has(d)));
  const partial=union.filter(d=>!sets.every(s=>s.has(d)));

  // Independent top-six construction from raw candidates.
  const candidateByDate=new Map();
  for(const row of allCandidates){
    if(row.horizon!==h||!confirmed.includes(row.date))continue;
    if(!candidateByDate.has(row.date))candidateByDate.set(row.date,[]);
    candidateByDate.get(row.date).push(row);
  }
  const selected=new Map();
  for(const date of confirmed){
    selected.set(date,[...(candidateByDate.get(date)||[])]
      .sort((a,b)=>(b.score??-Infinity)-(a.score??-Infinity)||String(a.symbol).localeCompare(String(b.symbol)))
      .slice(0,6)
      .map((x,i)=>({...x,rank:i+1})));
  }

  // Independent episode reconstruction across the full confirmed timeline BEFORE split assignment.
  const expected=[];
  let prev=new Set();
  let priorConfirmed=null;
  for(const date of confirmed){
    const rows=selected.get(date)||[];
    const now=new Set(rows.map(x=>x.symbol));
    for(const row of rows){
      if(prev.has(row.symbol))continue;
      const base={
        episodeId:[h,row.symbol,date].join('|'),
        horizon:h,symbol:row.symbol,firstSurfaceDate:date,priorConfirmedDate:priorConfirmed,
        outcomeDate:row.outcomeDate,benchmarkSymbol:bench(row.symbol),rank:row.rank,score:row.score,
        forwardReturn:row.forwardReturn,benchmarkReturn:row.benchmarkReturn,excessReturn:row.excessReturn,
        mae:row.mae,mfe:row.mfe
      };
      expected.push({...base,...classify(base)});
    }
    prev=now;
    priorConfirmed=date;
  }

  const got=exported.filter(x=>x.horizon===h);
  check(h+'D episode identity set',same(expected.map(x=>x.episodeId).sort(),got.map(x=>x.episodeId).sort()),{
    expected:expected.length,actual:got.length
  });

  // Exact raw-row field agreement and horizon-specific outcomes.
  let fieldMismatch=0;
  for(const e of expected){
    const g=exportedById.get(e.episodeId);
    if(!g){fieldMismatch++;continue}
    for(const k of ['horizon','symbol','firstSurfaceDate','priorConfirmedDate','outcomeDate','benchmarkSymbol','rank','score','forwardReturn','benchmarkReturn','excessReturn','mae','mfe','split','included','exclusionReason']){
      if(!same(g[k],e[k])){fieldMismatch++;break}
    }
  }
  check(h+'D raw candidate/outcome agreement',fieldMismatch===0,{fieldMismatch});

  // No boundary reset: an episode at/after validationStart cannot have the symbol present on prior confirmed date.
  let boundaryResetViolations=0;
  for(const e of expected.filter(x=>x.firstSurfaceDate>=calendar.validationStart)){
    if(!e.priorConfirmedDate)continue;
    if((selected.get(e.priorConfirmedDate)||[]).some(x=>x.symbol===e.symbol))boundaryResetViolations++;
  }
  check(h+'D no accidental split-boundary reset',boundaryResetViolations===0,{boundaryResetViolations});

  const zeroPick=confirmed.filter(d=>(selected.get(d)||[]).length===0);
  const reportedCoverage=summary.horizons?.[h]?.coverage;
  check(h+'D zero-pick confirmed sessions',reportedCoverage?.zeroPickConfirmedDays===zeroPick.length,{expected:zeroPick.length,actual:reportedCoverage?.zeroPickConfirmedDays});
  check(h+'D partial/missing coverage disclosure',reportedCoverage?.partialCoverageDays===partial.length&&same(reportedCoverage?.partialCoverageDates,partial),{partialCoverageDays:partial.length});

  const expectedDev=expected.filter(x=>x.split==='Development'&&x.included);
  const expectedVal=expected.filter(x=>x.split==='Validation'&&x.included);
  const expectedCombined=expected.filter(x=>
    x.firstSurfaceDate>=calendar.developmentStart&&x.firstSurfaceDate<calendar.finalStart&&
    x.outcomeDate>=x.firstSurfaceDate&&x.outcomeDate<calendar.finalStart&&
    !['Invalid','Outside','Historical Final'].includes(x.split)
  );

  check(h+'D Development outcome purge',expectedDev.every(x=>x.outcomeDate<calendar.validationStart),{included:expectedDev.length});
  check(h+'D Validation Historical Final seal',expectedVal.every(x=>x.outcomeDate<calendar.finalStart),{included:expectedVal.length});

  for(const [name,rows] of [['Development',expectedDev],['Validation',expectedVal],['Combined',expectedCombined]]){
    const recomputed=independentStats(rows);
    const reported=summary.horizons?.[h]?.samples?.[name]?.summary;
    const ok=same(recomputed,comparableStats(reported));
    check(h+'D '+name+' independent statistics',ok,{recomputed,reported:comparableStats(reported)});
  }

  horizonAudit[h]={
    confirmedScanDays:confirmed.length,
    partialCoverageDays:partial.length,
    zeroPickConfirmedDays:zeroPick.length,
    reconstructedEpisodes:expected.length,
    DevelopmentIncluded:expectedDev.length,
    ValidationIncluded:expectedVal.length,
    CombinedDescriptive:expectedCombined.length
  };
}

const audit={
  format:'market-hunter-early-watch-episode-stability-audit-v1',
  generatedAt:new Date().toISOString(),
  evidenceTag:'locked-v2-validation-36420714736-archive-v1',
  validationRunId:36420714736,
  finalTestOpened:false,
  independentCalculation:true,
  checks,
  horizonAudit,
  totalChecks:checks.length,
  passedChecks:checks.filter(x=>x.pass).length,
  failedChecks:checks.filter(x=>!x.pass).length,
  differences,
  missingCoverageNote:'If partialCoverageDays is zero in the locked sample, missing-coverage non-reset behavior is additionally covered by the synthetic regression test rather than inferred from an absent event.'
};

fs.writeFileSync(path.join(OUT_DIR,'audit.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({totalChecks:audit.totalChecks,passed:audit.passedChecks,failed:audit.failedChecks,horizonAudit},null,2));
if(audit.failedChecks)process.exitCode=1;
