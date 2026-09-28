import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const analyzer=path.join(root,'scripts/analyze-early-watch-surface-replay.mjs');
const calendar={developmentStart:'2025-01-01',validationStart:'2025-07-01',finalStart:'2026-01-01'};
const source={provider:'fixture',interval:'1d',period1:'1',period2:'2',range:null,includePrePost:false,events:['div','splits']};
const artifactId='dpl_fixture_locked';

const hash=(char)=>char.repeat(64);
const row=(symbol,date,outcomeDate,horizon,score=70)=>({
  symbol,date,outcomeDate,horizon,score,
  forwardReturn:2,benchmarkReturn:1,excessReturn:1,mae:-1,mfe:3,
  ret5:1,ret20:-2,momentumShift:1,rs20:0,rsi14:50,swingTrend:'Structure improving',
  downsideDecel:true,volumeShockNearLow:false,sellingFading:true,freshReclaimAge:1,
  upDownVolumeRatio:1,higherLow:false,atr14Pct:3,pullback60:-5
});

function writeFixture({mode='episodes'}={}){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-ew-calendar-'));
  const reportsDir=path.join(tmp,'reports');
  const dataDir=path.join(tmp,'data');
  fs.mkdirSync(reportsDir,{recursive:true});
  fs.mkdirSync(dataDir,{recursive:true});
  const manifest={
    format:'market-hunter-v2-numerical-snapshot-manifest-v1',
    batchCount:4,normalizationVersion:'fixture-norm-v1',source,validationCalendar:calendar,
    artifact:{deploymentId:artifactId,id:artifactId},
    batches:[]
  };
  for(let i=0;i<4;i++){
    const symbol=i===0?'SAME':'B'+i;
    const snapshotId='snap-'+i;
    const dataSha256=hash(String(i+1));
    const structureSha256=hash(String(i+5));
    manifest.batches.push({batchIndex:i,snapshotId,dataSha256,structureSha256,symbols:[symbol,'^GSPTSE']});
    const datesByHorizon=mode==='episodes'
      ? {5:['2025-06-02','2025-06-03','2025-06-04','2025-12-20'],20:['2025-06-02','2025-06-03','2025-06-04']}
      : {5:['2025-06-02','2025-06-29','2025-09-01'],20:['2025-06-02','2025-06-29','2025-09-01']};
    const candidates=[];
    if(i===0&&mode==='episodes'){
      candidates.push(row('SAME','2025-06-02','2025-06-09',5),row('SAME','2025-06-04','2025-06-11',5));
      candidates.push(row('SAME','2025-06-02','2025-06-30',20),row('SAME','2025-06-04','2025-06-30',20));
    }
    if(i===0&&mode==='purge'){
      candidates.push(row('SAME','2025-06-02','2025-06-09',5));
      candidates.push(row('SAME','2025-06-29','2025-07-07',5));
      candidates.push(row('SAME','2025-09-01','2025-09-08',5));
      candidates.push(row('SAME','2025-06-02','2025-06-30',20));
      candidates.push(row('SAME','2025-06-29','2025-07-29',20));
      candidates.push(row('SAME','2025-09-01','2025-09-30',20));
    }
    const report={
      version:'fixture',batchIndex:i,batchCount:4,symbols:[symbol],
      dataset:{mode:'frozen',snapshotId,dataSha256,structureSha256,normalizationVersion:'fixture-norm-v1',source,artifactId,symbols:[symbol,'^GSPTSE']},
      validation:{calendar,finalTestOpened:false},
      horizons:{5:{scope:'development'},20:{scope:'development'}},
      surfaceReplay:{scope:'development',calendarSource:'completed-scans-with-mature-development-outcomes',datesByHorizon,candidates}
    };
    fs.writeFileSync(path.join(reportsDir,'v2-backtest-batch-'+i+'.json'),JSON.stringify(report));
  }
  const manifestFile=path.join(tmp,'manifest.json');
  fs.writeFileSync(manifestFile,JSON.stringify(manifest));
  return {tmp,reportsDir,manifestFile};
}

function runFixture(f){
  const r=spawnSync(process.execPath,[analyzer],{
    cwd:f.tmp,encoding:'utf8',
    env:{...process.env,V2_REPORT_DIR:f.reportsDir,V2_DATASET_LOCK_MANIFEST:f.manifestFile}
  });
  return r;
}

// Confirm a completed zero-pick session splits two appearances into two episodes,
// and 5D/20D use their own mature completed-session calendars.
{
  const f=writeFixture({mode:'episodes'});
  const r=runFixture(f);
  assert.equal(r.status,0,r.stderr||r.stdout);
  const out=JSON.parse(fs.readFileSync(path.join(f.tmp,'data/v2-early-watch-surface-replay.json'),'utf8'));
  assert.equal(out.horizons[5].selection.scanDays,4);
  assert.equal(out.horizons[20].selection.scanDays,3);
  assert.equal(out.horizons[5].selection.zeroPickDays,2);
  assert.equal(out.horizons[5].firstSurfaceEpisodes.n,2);
  assert.equal(out.validationIdentity.calendar.validationStart,calendar.validationStart);
}

// Confirm fixed-calendar outcome purging survives replay/ranking filtering.
// A training-date observation whose outcome crosses validationStart must not enter train.
{
  const f=writeFixture({mode:'purge'});
  const r=runFixture(f);
  assert.equal(r.status,0,r.stderr||r.stdout);
  const out=JSON.parse(fs.readFileSync(path.join(f.tmp,'data/v2-early-watch-surface-replay.json'),'utf8'));
  for(const h of [5,20]){
    const fold=out.horizons[h].pickDayObservations.chronologicalSplit;
    assert.equal(fold.mode,'fixed_calendar');
    assert.equal(fold.cutDate,calendar.validationStart);
    assert.equal(fold.counts.trainCount,1);
    assert.equal(fold.counts.validationBoundaryPurgedCount,1);
    assert.equal(fold.counts.validationCount,1);
    for(const variant of Object.values(out.horizons[h].rankingExperiments)){
      assert.equal(variant.chronologicalSplit.counts.trainCount,1);
      assert.equal(variant.chronologicalSplit.counts.validationBoundaryPurgedCount,1);
      assert.equal(variant.chronologicalSplit.counts.validationCount,1);
    }
  }
}

// Missing horizon coverage is stale input and must fail, never reconstructed from candidate dates.
{
  const f=writeFixture({mode:'episodes'});
  const file=path.join(f.reportsDir,'v2-backtest-batch-2.json');
  const j=JSON.parse(fs.readFileSync(file,'utf8'));
  delete j.surfaceReplay.datesByHorizon[20];
  fs.writeFileSync(file,JSON.stringify(j));
  const r=runFixture(f);
  assert.notEqual(r.status,0);
  assert.match((r.stderr||'')+(r.stdout||''),/calendar missing/);
}

// Duplicate/misassigned batch identity must fail before aggregation.
{
  const f=writeFixture({mode:'episodes'});
  const file=path.join(f.reportsDir,'v2-backtest-batch-1.json');
  const j=JSON.parse(fs.readFileSync(file,'utf8'));
  j.batchIndex=0;
  fs.writeFileSync(file,JSON.stringify(j));
  const r=runFixture(f);
  assert.notEqual(r.status,0);
  assert.match((r.stderr||'')+(r.stdout||''),/file\/batch index mismatch/);
}

console.log('Early Watch fixed-calendar replay regression tests passed');


// Real snapshots include benchmark series; reports contain only tradable symbols.
// Reject mismatched identity, stale coverage, and outcomes from sealed Final.
for(const [label,mutate,pattern] of [
 ['snapshot symbols',r=>r.dataset.symbols=['SAME'],/snapshot symbol membership/],
 ['traded symbols',r=>r.symbols=['WRONG'],/traded symbol membership/],
 ['numerical hash',r=>r.dataset.dataSha256='f'.repeat(64),/numerical hash mismatch/],
 ['opened final',r=>r.validation.finalTestOpened=true,/final test must remain closed/],
 ['missing closed flag',r=>delete r.validation.finalTestOpened,/explicitly false/],
 ['final outcome',r=>r.surfaceReplay.candidates[0].outcomeDate='2026-01-01',/outside mature Development/],
 ['final calendar',r=>r.surfaceReplay.datesByHorizon[5].push('2026-02-01'),/outside Development calendar/],
 ['unknown candidate',r=>r.surfaceReplay.candidates[0].symbol='UNKNOWN',/outside traded membership/],
 ['duplicate candidate',r=>r.surfaceReplay.candidates.push(r.surfaceReplay.candidates[0]),/duplicate candidate/],
 ['missing candidate coverage',r=>r.surfaceReplay.datesByHorizon[5]=[],/lacks completed scan coverage/]
]){
 const f=writeFixture();
 const file=path.join(f.reportsDir,'v2-backtest-batch-0.json');
 const report=JSON.parse(fs.readFileSync(file,'utf8'));mutate(report);
 fs.writeFileSync(file,JSON.stringify(report));
 const result=runFixture(f);
 assert.notEqual(result.status,0,label);
 assert.match(result.stderr+result.stdout,pattern,label);
}
console.log('Early Watch real-schema and sealed-input guards passed');
