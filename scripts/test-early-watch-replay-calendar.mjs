import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const script=path.resolve('scripts/analyze-early-watch-surface-replay.mjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-ew-replay-'));
const dataDir=path.join(tmp,'data');
const manifestDir=path.join(dataDir,'frozen/market-hunter-v2-numerical-snapshot');
fs.mkdirSync(manifestDir,{recursive:true});

const source={provider:'fixture',interval:'1d'};
const normalizationVersion='fixture-norm-v1';
const calendar={developmentStart:'2021-09-27',validationStart:'2024-09-20',finalStart:'2026-01-01'};
const artifactId='dpl_fixture_locked_artifact';
const horizons=[5,20];
const batchSymbols=Array.from({length:4},(_,i)=>['B'+i+'.TO']);
const batchMeta=Array.from({length:4},(_,i)=>({
  batchIndex:i,file:'batch-'+i+'.json',symbols:batchSymbols[i],snapshotId:'snap-'+i,
  dataSha256:String(i+1).repeat(64).slice(0,64),structureSha256:String(i+5).repeat(64).slice(0,64)
}));
const manifest={
  format:'market-hunter-v2-numerical-snapshot-manifest-v1',batchCount:4,normalizationVersion,source,
  validationCalendar:calendar,artifact:{deploymentId:artifactId},batches:batchMeta
};
fs.writeFileSync(path.join(manifestDir,'manifest.json'),JSON.stringify(manifest));

const coverage5=['2024-01-10','2024-09-19','2024-10-01','2024-10-02','2024-10-03','2025-12-20'];
const coverage20=['2024-01-10','2024-09-19','2024-10-01','2024-10-02','2024-10-03'];
const candidate=(symbol,date,outcomeDate,horizon,extra={})=>({
  symbol,date,outcomeDate,horizon,score:70,forwardReturn:4,benchmarkReturn:1,excessReturn:3,mae:-2,mfe:6,
  momentumShift:2,rs20:1,swingTrend:'Structure improving',downsideDecel:true,volumeShockNearLow:false,
  freshReclaimAge:1,upDownVolumeRatio:1.1,...extra
});

function report(i){
  const symbol=batchSymbols[i][0];
  const candidates=[];
  for(const h of horizons){
    candidates.push(candidate(symbol,'2024-01-10',h===5?'2024-01-17':'2024-02-07',h));
    candidates.push(candidate(symbol,'2024-09-19','2024-09-21',h));
    candidates.push(candidate(symbol,'2024-10-01',h===5?'2024-10-08':'2024-10-29',h));
    candidates.push(candidate(symbol,'2024-10-03',h===5?'2024-10-10':'2024-10-31',h));
  }
  return {
    version:'fixture',batchIndex:i,batchCount:4,symbols:batchSymbols[i],
    dataset:{mode:'frozen',snapshotId:batchMeta[i].snapshotId,dataSha256:batchMeta[i].dataSha256,
      structureSha256:batchMeta[i].structureSha256,normalizationVersion,source,artifactId},
    validation:{finalTestOpened:false,calendar},
    horizons:{5:{scope:'development'},20:{scope:'development'}},
    surfaceReplay:{datesByHorizon:{5:coverage5,20:coverage20},candidates}
  };
}
function writeReports(mutator){
  for(let i=0;i<4;i++){
    const r=report(i);if(mutator)mutator(r,i);
    fs.writeFileSync(path.join(dataDir,'v2-backtest-batch-'+i+'.json'),JSON.stringify(r));
  }
}
function run(){
  return spawnSync(process.execPath,[script],{cwd:tmp,encoding:'utf8',env:{...process.env,V2_DATASET_LOCK_MANIFEST:'data/frozen/market-hunter-v2-numerical-snapshot/manifest.json'}});
}

writeReports();
let r=run();
assert.equal(r.status,0,r.stderr||r.stdout);
let out=JSON.parse(fs.readFileSync(path.join(dataDir,'v2-early-watch-surface-replay.json'),'utf8'));
assert.deepEqual(out.validationIdentity.calendar,calendar);
assert.equal(out.validationIdentity.finalTestOpened,false);
assert.equal(out.horizons[5].coverage.confirmedScanDays,coverage5.length);
assert.equal(out.horizons[20].coverage.confirmedScanDays,coverage20.length);
assert.equal(out.horizons[5].pickDayObservations.fixedCalendar.counts.validationBoundaryPurgedCount,4);
assert.equal(out.horizons[5].firstSurfaceEpisodes.n,8);
assert.deepEqual(out.horizons[5].rankingExperiments.baseline.fixedCalendar.calendar,calendar);
assert.deepEqual(out.horizons[20].rankingExperiments.evidencePolish.fixedCalendar.calendar,calendar);

writeReports((x,i)=>{if(i===3)x.batchIndex=2});
r=run();
assert.notEqual(r.status,0,'duplicate batch should fail');
assert.match((r.stderr||'')+(r.stdout||''),/Duplicate report batch index/);

writeReports((x,i)=>{if(i===1)delete x.surfaceReplay.datesByHorizon[5]});
r=run();
assert.notEqual(r.status,0,'missing coverage should fail');
assert.match((r.stderr||'')+(r.stdout||''),/missing surfaceReplay\.datesByHorizon\[5\]/);

writeReports((x,i)=>{if(i===3)x.surfaceReplay.datesByHorizon[5]=x.surfaceReplay.datesByHorizon[5].filter(d=>d!=='2024-10-02')});
r=run();
assert.equal(r.status,0,r.stderr||r.stdout);
out=JSON.parse(fs.readFileSync(path.join(dataDir,'v2-early-watch-surface-replay.json'),'utf8'));
assert.equal(out.horizons[5].coverage.partialCoverageDays,1);
assert.equal(out.horizons[5].selection.zeroPickDays,1,'partial unavailable date must not be counted as confirmed zero-pick');

console.log('Early Watch fixed-calendar replay consumer tests passed');
