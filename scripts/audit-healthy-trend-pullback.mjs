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
const controlledSelections=JSON.parse(fs.readFileSync(path.join(OUT_DIR,'controlled-selections.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(MANIFEST_FILE,'utf8'));
const reports=Array.from({length:4},(_,i)=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
for(const r of reports)assertHistoricalFinalSealedReport(r,'independent audit input batch '+r.batchIndex);
if(summary.evidence?.finalTestOpened!==false)throw new Error('Challenger summary does not declare Historical Final sealed');

const calendar=manifest.validationCalendar;
const meta=new Map(UNIVERSE.map(([symbol,name,sector])=>[symbol,{name,sector}]));
const cdr=new Set(UNIVERSE.filter(x=>x[2]==='CDR').map(x=>x[0]));
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
function avgDollar20(rows,i){return i>=19?mean(rows.slice(i-19,i+1).map(x=>x.rawClose*x.volume)):null}
function recentSplit(pack,rows,i){
  const splitDays=pack?.splitDays instanceof Set?pack.splitDays:new Set(pack?.splitDays||[]);
  for(let j=Math.max(0,i-30);j<=i;j++)if(splitDays.has(day(rows[j].t)))return true;
  return false;
}
function independentPoolForDate(date){
  const pool=[];
  for(const [symbol,,sector] of UNIVERSE){
    if(cdr.has(symbol))continue;
    const pack=data[symbol];if(!pack)continue;
    const i=exactIndex(pack.rows,date);
    if(i<100)continue;
    const a=atr14(pack.rows,i),adv=avgDollar20(pack.rows,i);
    if(!Number.isFinite(pack.rows[i]?.rawClose)||pack.rows[i].rawClose<2)continue;
    if(!Number.isFinite(adv)||adv<3000000)continue;
    if(recentSplit(pack,pack.rows,i))continue;
    if(!Number.isFinite(a)||a<=0)continue;
    pool.push({symbol,sector,atr14Pct:pct(pack.rows[i].close+a,pack.rows[i].close)});
  }
  pool.sort((a,b)=>a.atr14Pct-b.atr14Pct||a.symbol.localeCompare(b.symbol));
  pool.forEach((x,i)=>x.volQuintile=Math.min(4,Math.floor(i*5/Math.max(1,pool.length))));
  return pool;
}
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
let weeklyLeak=0,pivotLeak=0,pivotMissing=0,volQuintileMissing=0;
for(const r of selections.filter(x=>['core','core_volume','core_market'].includes(x.model))){
  for(const p of r.picks||[]){
    if(!p.weeklyLastCompleted||p.weeklyLastCompleted>=monday(r.date))weeklyLeak++;
    if(!p.pivotConfirmedAt)pivotMissing++;
    else if(p.pivotConfirmedAt>r.date)pivotLeak++;
    if(!Number.isInteger(p.volQuintile)||p.volQuintile<0||p.volQuintile>4)volQuintileMissing++;
  }
}
check('completed weekly inputs precede decision week',weeklyLeak===0,{weeklyLeak});
check('all challenger pivots were confirmed by decision close',pivotLeak===0&&pivotMissing===0,{pivotLeak,pivotMissing});
check('all challenger picks carry a frozen ATR-volatility quintile',volQuintileMissing===0,{volQuintileMissing});

// Controlled deterministic baselines must preserve challenger opportunity dates and daily counts without forced fill.
const naturalSelectionByKey=new Map(
  selections.filter(x=>x.coverage==='confirmed'&&x.model!=='coverage_only').map(x=>[[x.model,x.date].join('|'),x])
);
const controlledByKey=new Map();
let controlledDuplicateKeys=0,controlledIdentityMismatch=0;
const controlledAgg={};
for(const r of controlledSelections){
  const key=[r.target,r.date].join('|');
  if(controlledByKey.has(key))controlledDuplicateKeys++;
  controlledByKey.set(key,r);
  const target=naturalSelectionByKey.get([r.target,r.date].join('|'));
  const ew=naturalSelectionByKey.get(['early_watch',r.date].join('|'));
  const trsel=naturalSelectionByKey.get(['trend_rs',r.date].join('|'));
  const targetSymbols=(target?.picks||[]).map(x=>x.symbol);
  const expectedEw=(ew?.picks||[]).slice(0,targetSymbols.length).map(x=>x.symbol);
  const expectedTr=(trsel?.picks||[]).slice(0,targetSymbols.length).map(x=>x.symbol);
  if(
    !target||targetSymbols.length===0||
    r.targetCount!==targetSymbols.length||JSON.stringify(r.targetSymbols)!==JSON.stringify(targetSymbols)||
    r.earlyWatchCount!==expectedEw.length||JSON.stringify(r.earlyWatchSymbols)!==JSON.stringify(expectedEw)||
    r.trendRsCount!==expectedTr.length||JSON.stringify(r.trendRsSymbols)!==JSON.stringify(expectedTr)||
    r.earlyWatchShortfall!==targetSymbols.length-expectedEw.length||
    r.trendRsShortfall!==targetSymbols.length-expectedTr.length
  )controlledIdentityMismatch++;
  if(!controlledAgg[r.target])controlledAgg[r.target]={records:0,ewShortfallDays:0,ewShortfallPicks:0,trShortfallDays:0,trShortfallPicks:0};
  const a=controlledAgg[r.target];a.records++;
  if(r.earlyWatchShortfall>0)a.ewShortfallDays++;
  a.ewShortfallPicks+=r.earlyWatchShortfall;
  if(r.trendRsShortfall>0)a.trShortfallDays++;
  a.trShortfallPicks+=r.trendRsShortfall;
}
let missingControlledOpportunityRecords=0,controlledSummaryMismatch=0;
for(const target of ['core','core_volume','core_market']){
  for(const d of selections.filter(x=>x.model===target&&x.coverage==='confirmed'&&x.count>0)){
    if(!controlledByKey.has([target,d.date].join('|')))missingControlledOpportunityRecords++;
  }
  const a=controlledAgg[target]||{};
  const rep=summary.controlled?.[target];
  if(
    a.ewShortfallDays!==rep?.currentEarlyWatch?.shortfallDays||
    a.ewShortfallPicks!==rep?.currentEarlyWatch?.shortfallPicks||
    a.trShortfallDays!==rep?.trendRs?.shortfallDays||
    a.trShortfallPicks!==rep?.trendRs?.shortfallPicks
  )controlledSummaryMismatch++;
}
check('controlled deterministic baselines exactly preserve challenger opportunity dates/counts and explicit shortfalls',
  controlledDuplicateKeys===0&&controlledIdentityMismatch===0&&missingControlledOpportunityRecords===0&&controlledSummaryMismatch===0,
  {records:controlledSelections.length,controlledDuplicateKeys,controlledIdentityMismatch,missingControlledOpportunityRecords,controlledSummaryMismatch,controlledAgg}
);
let pairedCalendarMethodMismatch=0;
for(const target of ['core','core_volume','core_market']){
  for(const x of [summary.controlled?.[target]?.currentEarlyWatch?.pairedEffectTargetMinusBaseline,summary.controlled?.[target]?.trendRs?.pairedEffectTargetMinusBaseline]){
    if((x?.sharedDates||0)>0&&(x?.bootstrapReplicationsUsed!==5000||!String(x?.bootstrapCalendar||'').includes('full confirmed calendar')))pairedCalendarMethodMismatch++;
  }
}
check('paired uncertainty uses 20-session blocks on the full confirmed calendar rather than compressed shared-date order',
  pairedCalendarMethodMismatch===0,{pairedCalendarMethodMismatch}
);

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

// Random-control seed summaries are audited chunk-by-chunk to avoid reusing the analysis path or loading all rows at once.
const expectedSeeds=Array.from({length:100},(_,i)=>2026092800+i);
check('random control seed set is the predeclared fixed 100-seed sequence',
  JSON.stringify(summary.randomSeeds)===JSON.stringify(expectedSeeds),
  {reportedCount:summary.randomSeeds?.length,first:summary.randomSeeds?.[0],last:summary.randomSeeds?.at?.(-1)}
);

// Independently verify daily random matching against frozen generic-eligibility pools.
const opportunityDates=[...new Set(controlledSelections.map(x=>x.date))].sort();
const independentPools=new Map(opportunityDates.map(d=>[d,independentPoolForDate(d)]));
const poolLookup=new Map([...independentPools].map(([d,p])=>[d,new Map(p.map(x=>[x.symbol,x]))]));
const randomMatchingFiles=fs.readdirSync(OUT_DIR).filter(x=>/^random-matching-part-\d+\.jsonl\.gz$/.test(x)).sort();
const expectedDailyKeys=new Set();
for(const r of controlledSelections)for(const seed of expectedSeeds)for(const control of ['random','matched'])expectedDailyKeys.add([control,r.target,seed,r.date].join('|'));
const seenDailyKeys=new Set(),dailyMatchAgg=new Map();
let randomDailyRows=0,randomDailyDuplicateKeys=0,randomDailyCountMismatch=0,randomPoolViolations=0,matchedDailyIdentityViolations=0;
for(const file of randomMatchingFiles){
  const payload=zlib.gunzipSync(fs.readFileSync(path.join(OUT_DIR,file))).toString('utf8');
  for(const line of payload.split('\n')){
    if(!line)continue;
    const r=JSON.parse(line),key=[r.control,r.target,r.seed,r.date].join('|');
    if(seenDailyKeys.has(key))randomDailyDuplicateKeys++;
    seenDailyKeys.add(key);randomDailyRows++;
    const ctl=controlledByKey.get([r.target,r.date].join('|'));
    const pool=poolLookup.get(r.date)||new Map();
    if(!ctl||r.targetCount!==ctl.targetCount||r.selectedCount!==(r.selected||[]).length||r.selectedCount+r.unmatchedCount!==r.targetCount)randomDailyCountMismatch++;
    const selectedSymbols=(r.selected||[]).map(x=>x.symbol);
    if(new Set(selectedSymbols).size!==selectedSymbols.length)randomPoolViolations++;
    for(const x of r.selected||[]){
      const p=pool.get(x.symbol);
      if(!p){randomPoolViolations++;continue}
      if(r.control==='matched'){
        const targetPool=pool.get(x.matchedTargetSymbol);
        if(!targetPool||x.symbol===x.matchedTargetSymbol||
          p.sector!==targetPool.sector||p.volQuintile!==targetPool.volQuintile||
          x.sector!==p.sector||x.volQuintile!==p.volQuintile||
          x.matchedTargetSector!==targetPool.sector||x.matchedTargetVolQuintile!==targetPool.volQuintile
        )matchedDailyIdentityViolations++;
      }
    }
    const aggKey=[r.control,r.target,r.seed].join('|');
    if(!dailyMatchAgg.has(aggKey))dailyMatchAgg.set(aggKey,{unmatchedPicks:0,insufficientDates:0});
    const a=dailyMatchAgg.get(aggKey);a.unmatchedPicks+=r.unmatchedCount;if(r.unmatchedCount>0)a.insufficientDates++;
  }
}
let missingRandomDailyKeys=0,unexpectedRandomDailyKeys=0,randomSeedMatchSummaryMismatch=0;
for(const k of expectedDailyKeys)if(!seenDailyKeys.has(k))missingRandomDailyKeys++;
for(const k of seenDailyKeys)if(!expectedDailyKeys.has(k))unexpectedRandomDailyKeys++;
for(const target of ['core','core_volume','core_market']){
  for(const [control,key] of [['random','repeatedRandom'],['matched','sectorVolMatchedRandom']]){
    for(const seedSummary of summary.controlled?.[target]?.[key]?.seedSummaries||[]){
      const a=dailyMatchAgg.get([control,target,seedSummary.seed].join('|'))||{unmatchedPicks:0,insufficientDates:0};
      if(a.unmatchedPicks!==seedSummary.unmatchedPicks||a.insufficientDates!==seedSummary.insufficientDates)randomSeedMatchSummaryMismatch++;
    }
  }
}
check('random controls match challenger opportunity dates/counts using independently reconstructed eligible pools',
  randomDailyDuplicateKeys===0&&randomDailyCountMismatch===0&&randomPoolViolations===0&&missingRandomDailyKeys===0&&unexpectedRandomDailyKeys===0&&randomSeedMatchSummaryMismatch===0,
  {files:randomMatchingFiles.length,rows:randomDailyRows,expected:expectedDailyKeys.size,randomDailyDuplicateKeys,randomDailyCountMismatch,randomPoolViolations,missingRandomDailyKeys,unexpectedRandomDailyKeys,randomSeedMatchSummaryMismatch}
);
check('sector/volatility-matched random controls independently satisfy same-date sector and ATR-quintile constraints',
  matchedDailyIdentityViolations===0,{matchedDailyIdentityViolations}
);

const randomFiles=fs.readdirSync(OUT_DIR).filter(x=>/^random-controls-part-\d+\.jsonl\.gz$/.test(x)).sort();
const randomAgg=new Map(),randomSample=[];
let randomRowCount=0,matchedIdentityViolations=0,matchedRows=0;
for(const file of randomFiles){
  const payload=zlib.gunzipSync(fs.readFileSync(path.join(OUT_DIR,file))).toString('utf8');
  for(const line of payload.split('\n')){
    if(!line)continue;
    const r=JSON.parse(line),k=[r.control,r.target,r.seed].join('|');
    if(r.control==='matched'){
      matchedRows++;
      if(!r.matchedTargetSymbol||r.symbol===r.matchedTargetSymbol||r.sector!==r.matchedTargetSector||
         !Number.isInteger(r.volQuintile)||r.volQuintile!==r.matchedTargetVolQuintile)matchedIdentityViolations++;
    }
    if(!randomAgg.has(k))randomAgg.set(k,{successDenom:0,successCount:0,excessCount:0,excessSum:0});
    const a=randomAgg.get(k);
    if(r.status==='evaluated'&&r.included){
      if(r.primaryLabel!=='suspension_or_irregular_gap'){
        a.successDenom++;
        if(r.primaryLabel==='success')a.successCount++;
      }
      const ex=r.excessReturns?.[20];
      if(Number.isFinite(ex)){a.excessCount++;a.excessSum+=ex}
    }
    if(randomRowCount%2000===0)randomSample.push(r);
    randomRowCount++;
  }
}
let seedSummaryMismatch=0;
for(const target of ['core','core_volume','core_market']){
  for(const [control,key] of [['random','repeatedRandom'],['matched','sectorVolMatchedRandom']]){
    const reported=summary.controlled?.[target]?.[key]?.seedSummaries||[];
    for(const seedSummary of reported){
      const a=randomAgg.get([control,target,seedSummary.seed].join('|'))||{successDenom:0,successCount:0,excessCount:0,excessSum:0};
      const successRate=a.successDenom?round(a.successCount/a.successDenom*100,2):null;
      const meanExcess20=a.excessCount?round(a.excessSum/a.excessCount):null;
      if(!nearly(successRate,seedSummary.successRate,1e-7)||!nearly(meanExcess20,seedSummary.meanExcess20,1e-7))seedSummaryMismatch++;
    }
  }
}
check('all random-control seed outcome summaries recompute from chunked exported rows',seedSummaryMismatch===0,{
  files:randomFiles.length,rows:randomRowCount,groups:randomAgg.size,seedSummaryMismatch
});
check('matched random controls preserve same-date sector and ATR-quintile identities',
  matchedRows>0&&matchedIdentityViolations===0,
  {matchedRows,matchedIdentityViolations});

let sampledRandomMismatch=0;
for(const e of randomSample){
  const r=recompute(e);
  if(!nearly(e.entryDate,r.entryDate)||!nearly(e.entryPrice,r.entryPrice)||!nearly(e.atr14,r.atr14)||!nearly(e.primaryLabel,r.primaryLabel)||!nearly(e.excessReturns?.[20],r.excessReturns?.[20]))sampledRandomMismatch++;
}
check('fixed-stride sample of random-control outcomes independently recomputes from frozen OHLC',sampledRandomMismatch===0,{
  sampled:randomSample.length,sampledRandomMismatch
});

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
  auditedRandomRows:randomRowCount,
  auditedRandomDailyMatchingRows:randomDailyRows,
  auditedControlledSelectionRecords:controlledSelections.length,
  note:'Unit regressions separately exercise synthetic weekly-bar availability, pivot confirmation, next-session entry alignment, ambiguous same-bar barriers, irregular gaps, split-boundary purges, zero-pick continuity and cross-model timing identity. Controlled deterministic and random daily count/opportunity matching are independently checked from exported identities and frozen eligibility pools.'
};
fs.writeFileSync(path.join(OUT_DIR,'audit.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({
  totalChecks:audit.totalChecks,passed:audit.passedChecks,failed:audit.failedChecks,
  deterministicEpisodes:episodes.length,randomRows:randomRowCount,
  differences:audit.differences
},null,2));
if(audit.failedChecks)process.exitCode=1;
