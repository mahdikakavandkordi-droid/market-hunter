import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {UNIVERSE} from '../lib/universe.js';
import {loadFrozenDataset} from '../lib/frozen-dataset.js';
import {assertHistoricalFinalSealedReport} from '../lib/research-audit-guards.js';

const OUT_DIR=process.env.HTP_OUT_DIR||'data/research/healthy-trend-pullback';
const MANIFEST_FILE=process.env.V2_DATASET_LOCK_MANIFEST||'data/frozen/market-hunter-v2-numerical-snapshot/manifest.json';
const SNAPSHOT_DIR=process.env.V2_SNAPSHOT_DIR||'data/frozen/market-hunter-v2-numerical-snapshot/files';
const summary=JSON.parse(fs.readFileSync(path.join(OUT_DIR,'summary.json'),'utf8'));
const episodes=JSON.parse(fs.readFileSync(path.join(OUT_DIR,'episodes.json'),'utf8'));
const selections=JSON.parse(fs.readFileSync(path.join(OUT_DIR,'selections.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(MANIFEST_FILE,'utf8'));
const reports=Array.from({length:4},(_,i)=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
for(const r of reports)assertHistoricalFinalSealedReport(r,'independent audit input batch '+r.batchIndex);
if(summary.evidence?.finalTestOpened!==false)throw new Error('Challenger summary does not declare Historical Final sealed');

const calendar=manifest.validationCalendar;
const meta=new Map(UNIVERSE.map(([symbol,name,sector])=>[symbol,{name,sector}]));
const data={};
for(const b of manifest.batches){
  const ds=loadFrozenDataset(path.join(SNAPSHOT_DIR,b.file),{
    expectedSnapshotId:b.snapshotId,expectedDataSha256:b.dataSha256,expectedStructureSha256:b.structureSha256,
    expectedSource:manifest.source,expectedNormalizationVersion:manifest.normalizationVersion,
    expectedBatchIndex:b.batchIndex,expectedBatchCount:manifest.batchCount,expectedSymbols:b.symbols
  });
  for(const [symbol,pack] of Object.entries(ds.data))if(!data[symbol])data[symbol]=pack;
}
const day=t=>new Date(Number(t)*1000).toISOString().slice(0,10);
const pct=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a/b-1)*100:null;
const finite=a=>a.filter(Number.isFinite);
const mean=a=>{const x=finite(a);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const median=a=>{const x=finite(a).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const round=(n,d=4)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
function lastIndex(rows,date){let ans=-1;for(let i=0;i<rows.length;i++){if(day(rows[i].t)>date)break;ans=i}return ans}
function exactIndex(rows,date){return rows.findIndex(x=>day(x.t)===date)}
function tr(row,prev){return Math.max(row.high-row.low,Math.abs(row.high-prev.close),Math.abs(row.low-prev.close))}
function atr14(rows,i){if(i<14)return null;const a=[];for(let j=i-13;j<=i;j++)a.push(tr(rows[j],rows[j-1]));return a.length===14?mean(a):null}
function gapDays(a,b){return Math.round((Number(b.t)-Number(a.t))/86400)}
function classify(decisionDate,finalDate){
  if(decisionDate>=calendar.developmentStart&&decisionDate<calendar.validationStart){
    return {split:'Development',included:finalDate<calendar.validationStart,exclusionReason:finalDate<calendar.validationStart?null:'validation_boundary_outcome_purge'};
  }
  if(decisionDate>=calendar.validationStart&&decisionDate<calendar.finalStart){
    return {split:'Validation',included:finalDate<calendar.finalStart,exclusionReason:finalDate<calendar.finalStart?null:'historical_final_outcome_purge'};
  }
  if(decisionDate>=calendar.finalStart)return {split:'Historical Final',included:false,exclusionReason:'historical_final_sealed'};
  return {split:'Outside',included:false,exclusionReason:'outside_calendar'};
}
function recompute(row){
  const rows=data[row.symbol]?.rows||[],di=exactIndex(rows,row.firstSurfaceDate);
  if(di<0)return {status:'missing_decision_row'};
  const a=atr14(rows,di),ei=di+1,fi=ei+20;
  if(ei>=rows.length)return {status:'missing_entry',decisionDate:row.firstSurfaceDate,atr14:a};
  const entry=rows[ei],entryDate=day(entry.t);
  if(fi>=rows.length)return {status:'incomplete_horizon',decisionDate:row.firstSurfaceDate,entryDate,entryPrice:entry.close,atr14:a};
  const finalDate=day(rows[fi].t),path=rows.slice(ei+1,fi+1);
  const favourable=entry.close+2*a,adverse=entry.close-a;
  let primary='neither',timeToFavourable=null;
  let irregular=false;
  for(let j=ei+1;j<=fi;j++)if(gapDays(rows[j-1],rows[j])>7)irregular=true;
  for(let k=0;k<path.length;k++){
    const hf=path[k].high>=favourable,ha=path[k].low<=adverse;
    if(hf&&ha){primary='ambiguous_both_hit';break}
    if(hf){primary='success';timeToFavourable=k+1;break}
    if(ha){primary='adverse_first';break}
  }
  if(irregular)primary='suspension_or_irregular_gap';
  const returns={},benchmarkReturns={},excessReturns={};
  const bench=data['^GSPTSE']?.rows||[];
  for(const h of [5,10,20]){
    const oi=ei+h;
    if(oi>=rows.length){returns[h]=benchmarkReturns[h]=excessReturns[h]=null;continue}
    const od=day(rows[oi].t),b0=lastIndex(bench,entryDate),b1=lastIndex(bench,od);
    const rr=pct(rows[oi].close,entry.close),br=b0>=0&&b1>=0?pct(bench[b1].close,bench[b0].close):null;
    returns[h]=rr;benchmarkReturns[h]=br;excessReturns[h]=Number.isFinite(rr)&&Number.isFinite(br)?rr-br:null;
  }
  const cls=classify(row.firstSurfaceDate,finalDate);
  return {
    status:'evaluated',decisionDate:row.firstSurfaceDate,entryDate,entryPrice:entry.close,atr14:a,finalDate,...cls,
    primaryLabel:primary,timeToFavourable,returns,benchmarkReturns,excessReturns,
    favourableExcursionPct:Math.max(...path.map(x=>pct(x.high,entry.close))),
    adverseExcursionPct:Math.min(...path.map(x=>pct(x.low,entry.close)))
  };
}
function nearly(a,b,tol=1e-8){
  if(a==null&&b==null)return true;
  if(Number.isFinite(a)&&Number.isFinite(b))return Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));
  return a===b;
}
function basic(rows){
  const x=rows.filter(r=>r.primaryLabel!=='suspension_or_irregular_gap');
  const labels=Object.fromEntries(['success','adverse_first','neither','ambiguous_both_hit'].map(k=>[k,x.filter(r=>r.primaryLabel===k).length]));
  return {
    episodeCount:rows.length,primaryDenominator:x.length,distinctSymbols:new Set(rows.map(r=>r.symbol)).size,
    primaryLabels:labels,successRate:round(x.length?labels.success/x.length*100:null,2),
    meanReturn5:round(mean(rows.map(r=>r.returns?.[5]))),medianReturn5:round(median(rows.map(r=>r.returns?.[5]))),
    meanExcess5:round(mean(rows.map(r=>r.excessReturns?.[5]))),medianExcess5:round(median(rows.map(r=>r.excessReturns?.[5]))),
    meanReturn10:round(mean(rows.map(r=>r.returns?.[10]))),medianReturn10:round(median(rows.map(r=>r.returns?.[10]))),
    meanExcess10:round(mean(rows.map(r=>r.excessReturns?.[10]))),medianExcess10:round(median(rows.map(r=>r.excessReturns?.[10]))),
    meanReturn20:round(mean(rows.map(r=>r.returns?.[20]))),
    medianReturn20:round(median(rows.map(r=>r.returns?.[20]))),
    meanExcess20:round(mean(rows.map(r=>r.excessReturns?.[20]))),
    medianExcess20:round(median(rows.map(r=>r.excessReturns?.[20]))),
    meanFavourableExcursion:round(mean(rows.map(r=>r.favourableExcursionPct))),
    medianFavourableExcursion:round(median(rows.map(r=>r.favourableExcursionPct))),
    meanAdverseExcursion:round(mean(rows.map(r=>r.adverseExcursionPct))),
    medianAdverseExcursion:round(median(rows.map(r=>r.adverseExcursionPct))),
    medianTimeToFavourable:round(median(rows.filter(r=>r.primaryLabel==='success').map(r=>r.timeToFavourable)),2),
    irregularGapCount:rows.filter(r=>r.primaryLabel==='suspension_or_irregular_gap').length
  };
}
function subsetComparable(reported){
  const keys=['episodeCount','primaryDenominator','distinctSymbols','primaryLabels','successRate','meanReturn5','medianReturn5','meanExcess5','medianExcess5','meanReturn10','medianReturn10','meanExcess10','medianExcess10','meanReturn20','medianReturn20','meanExcess20','medianExcess20','meanFavourableExcursion','medianFavourableExcursion','meanAdverseExcursion','medianAdverseExcursion','medianTimeToFavourable','irregularGapCount'];
  return Object.fromEntries(keys.map(k=>[k,reported?.[k]]));
}
const checks=[],differences=[];
function check(name,pass,detail={}){checks.push({name,pass,detail});if(!pass)differences.push({name,detail})}

// Independent row-level outcome recomputation from frozen OHLC.
let rowMismatches=0;
const mismatchExamples=[];
const fields=['status','entryDate','entryPrice','atr14','finalDate','split','included','exclusionReason','primaryLabel','timeToFavourable','favourableExcursionPct','adverseExcursionPct'];
for(const e of episodes){
  const r=recompute(e);
  let ok=true;
  for(const k of fields)if(!nearly(e[k],r[k])){ok=false;break}
  for(const h of [5,10,20])if(!nearly(e.returns?.[h],r.returns?.[h])||!nearly(e.excessReturns?.[h],r.excessReturns?.[h]))ok=false;
  if(!ok){rowMismatches++;if(mismatchExamples.length<10)mismatchExamples.push({episodeId:e.episodeId,exported:e,recomputed:r})}
}
check('deterministic episode outcomes independently recompute from frozen OHLC',rowMismatches===0,{episodes:episodes.length,rowMismatches,mismatchExamples});

// Full-window boundary purge and Historical Final isolation.
const included=episodes.filter(x=>x.status==='evaluated'&&x.included);
check('Development full-window purge',included.filter(x=>x.split==='Development').every(x=>x.finalDate<calendar.validationStart),{n:included.filter(x=>x.split==='Development').length});
check('Validation full-window purge',included.filter(x=>x.split==='Validation').every(x=>x.finalDate<calendar.finalStart),{n:included.filter(x=>x.split==='Validation').length});
check('no deterministic episode starts in Historical Final',episodes.every(x=>x.firstSurfaceDate<calendar.finalStart),{});

// Selection-calendar coverage and zero-pick distinction.
const models=['core','core_volume','core_market','trend_rs','early_watch'];
const confirmedDays=summary.confirmedCalendar.days;
for(const model of models){
  const sr=selections.filter(x=>x.model===model&&x.coverage==='confirmed').sort((a,b)=>a.date.localeCompare(b.date));
  check(model+' has exactly one selection record per confirmed date',sr.length===confirmedDays,{expected:confirmedDays,actual:sr.length});
  const zero=sr.filter(x=>x.count===0).length,total=sr.reduce((s,x)=>s+x.count,0);
  const rep=summary.natural?.[model]?.volume;
  check(model+' zero-pick count independently matches summary',zero===rep?.zeroPickDays,{recomputed:zero,reported:rep?.zeroPickDays});
  check(model+' total pick count independently matches summary',total===rep?.totalPicks,{recomputed:total,reported:rep?.totalPicks});

  // Independent episode continuity from daily exported picks.
  let prev=new Set();
  const ids=[];
  for(const d of sr){
    const now=new Set((d.picks||[]).map(x=>x.symbol));
    for(const p of d.picks||[])if(!prev.has(p.symbol))ids.push(model+'|'+p.symbol+'|'+d.date);
    prev=now;
  }
  const exportedIds=episodes.filter(x=>x.model===model).map(x=>x.episodeId).sort();
  check(model+' episode identities independently reconstruct from selections',JSON.stringify(ids.sort())===JSON.stringify(exportedIds),{reconstructed:ids.length,exported:exportedIds.length});
}
const partialRows=selections.filter(x=>x.coverage==='partial_or_missing');
check('partial/missing coverage is separate from confirmed zero-pick records',
  partialRows.length===summary.confirmedCalendar.partialCoverageDays&&partialRows.every(x=>x.model==='coverage_only'),
  {recomputed:partialRows.length,reported:summary.confirmedCalendar.partialCoverageDays});

// Weekly/pivot availability on exported challenger picks.
function monday(date){const d=new Date(date+'T00:00:00Z'),shift=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-shift);return d.toISOString().slice(0,10)}
let weeklyLeak=0,pivotLeak=0,pivotMissing=0;
for(const r of selections.filter(x=>['core','core_volume','core_market'].includes(x.model))){
  for(const p of r.picks||[]){
    if(!p.weeklyLastCompleted||p.weeklyLastCompleted>=monday(r.date))weeklyLeak++;
    if(!p.pivotConfirmedAt)pivotMissing++;
    else if(p.pivotConfirmedAt>r.date)pivotLeak++;
  }
}
check('completed weekly inputs precede decision week',weeklyLeak===0,{weeklyLeak});
check('all challenger pivots were confirmed by decision close',pivotLeak===0&&pivotMissing===0,{pivotLeak,pivotMissing});

// Summary recomputation from exported deterministic rows.
for(const model of models){
  const rows=episodes.filter(x=>x.model===model&&x.status==='evaluated'&&x.included);
  const re=basic(rows),reported=subsetComparable(summary.natural?.[model]?.outcomes?.CombinedIncludedPurged);
  check(model+' combined summary independently recomputes from episode rows',JSON.stringify(re)===JSON.stringify(reported),{recomputed:re,reported});
}

// Identical conventions for same symbol/date across models.
const groups=new Map();
for(const e of episodes){
  const k=e.symbol+'|'+e.firstSurfaceDate;
  if(!groups.has(k))groups.set(k,[]);
  groups.get(k).push(e);
}
let conventionMismatch=0;
for(const g of groups.values()){
  if(g.length<2)continue;
  const a=g[0];
  for(const b of g.slice(1)){
    for(const k of ['status','entryDate','entryPrice','atr14','finalDate','split','included','exclusionReason','primaryLabel','timeToFavourable']){
      if(!nearly(a[k],b[k])){conventionMismatch++;break}
    }
  }
}
check('identical evaluation conventions across deterministic models',conventionMismatch===0,{conventionMismatch});

// Random-control exported seed summaries recompute from exported rows; fixed sample also recomputes from OHLC.
const gz=path.join(OUT_DIR,'random-controls.jsonl.gz');
const randomRows=fs.existsSync(gz)?zlib.gunzipSync(fs.readFileSync(gz)).toString('utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const randomGroups=new Map();
for(const r of randomRows){
  const k=[r.control,r.target,r.seed].join('|');
  if(!randomGroups.has(k))randomGroups.set(k,[]);
  randomGroups.get(k).push(r);
}
let seedSummaryMismatch=0;
for(const target of ['core','core_volume','core_market']){
  for(const [control,key] of [['random','repeatedRandom'],['matched','sectorVolMatchedRandom']]){
    const reported=summary.controlled?.[target]?.[key]?.seedSummaries||[];
    for(const s of reported){
      const rows=(randomGroups.get([control,target,s.seed].join('|'))||[]).filter(x=>x.status==='evaluated'&&x.included);
      const re=basic(rows);
      if(!nearly(re.successRate,s.successRate,1e-7)||!nearly(re.meanExcess20,s.meanExcess20,1e-7))seedSummaryMismatch++;
    }
  }
}
check('all random-control seed outcome summaries recompute from exported rows',seedSummaryMismatch===0,{groups:randomGroups.size,seedSummaryMismatch});

let sampledRandomMismatch=0;
const stride=Math.max(1,Math.floor(randomRows.length/250));
for(let i=0;i<randomRows.length;i+=stride){
  const e=randomRows[i],r=recompute(e);
  if(!nearly(e.entryDate,r.entryDate)||!nearly(e.entryPrice,r.entryPrice)||!nearly(e.atr14,r.atr14)||!nearly(e.primaryLabel,r.primaryLabel)||!nearly(e.excessReturns?.[20],r.excessReturns?.[20]))sampledRandomMismatch++;
}
check('fixed-spaced sample of random-control outcomes independently recomputes from frozen OHLC',sampledRandomMismatch===0,{sampled:Math.ceil(randomRows.length/stride),sampledRandomMismatch});

// Separate CDR absolute-path diagnostic: benchmark excess is intentionally not audited/interpreted.
const cdrFile=path.join(OUT_DIR,'cdr-early-watch-episodes.json');
const cdrEpisodes=fs.existsSync(cdrFile)?JSON.parse(fs.readFileSync(cdrFile,'utf8')):[];
let cdrMismatch=0;
for(const e of cdrEpisodes){
  const r=recompute(e);
  for(const k of ['status','entryDate','entryPrice','atr14','finalDate','split','included','exclusionReason','primaryLabel','timeToFavourable']){
    if(!nearly(e[k],r[k])){cdrMismatch++;break}
  }
}
check('separate CDR Early Watch absolute paths independently recompute',cdrMismatch===0,{episodes:cdrEpisodes.length,cdrMismatch});

// Metadata integrity.
check('frozen evidence identity retained',summary.evidence?.tag==='locked-v2-validation-36420714736-archive-v1'&&summary.evidence?.validationRunId===36420714736,{evidence:summary.evidence});
check('Historical Final metadata is exact boolean false',summary.evidence?.finalTestOpened===false&&reports.every(r=>r.validation?.finalTestOpened===false),{});
check('CDR headline exclusion is explicit',summary.cdrAssessment?.headlineComparison?.includes('excluded')===true,{cdrAssessment:summary.cdrAssessment});

const audit={
  format:'market-hunter-healthy-trend-pullback-independent-audit-v1',
  generatedAt:new Date().toISOString(),
  independentCalculation:true,
  outcomeRecomputation:'Independent code path reads frozen OHLC directly and does not import challenger analysis/evaluation functions.',
  evidenceTag:'locked-v2-validation-36420714736-archive-v1',
  validationRunId:36420714736,
  finalTestOpened:false,
  checks,totalChecks:checks.length,passedChecks:checks.filter(x=>x.pass).length,failedChecks:checks.filter(x=>!x.pass).length,differences,
  auditedDeterministicEpisodes:episodes.length,
  auditedRandomRows:randomRows.length,
  note:'Unit regressions separately exercise synthetic weekly-bar availability, pivot confirmation, next-session entry alignment, ambiguous same-bar barriers, irregular gaps, split-boundary purges, zero-pick continuity and cross-model timing identity.'
};
fs.writeFileSync(path.join(OUT_DIR,'audit.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({totalChecks:audit.totalChecks,passed:audit.passedChecks,failed:audit.failedChecks,deterministicEpisodes:episodes.length,randomRows:randomRows.length},null,2));
if(audit.failedChecks)process.exitCode=1;
