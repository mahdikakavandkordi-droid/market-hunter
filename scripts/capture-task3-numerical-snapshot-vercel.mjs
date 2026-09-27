import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {NORMALIZATION_VERSION} from '../lib/frozen-dataset.js';

const root=process.cwd();
const captureRevision=process.env.VERCEL_GIT_COMMIT_SHA||'47494e8a1416ca8d0ee4715e9381a2607348bb30';
const source={
  provider:'Yahoo Finance chart endpoint',
  interval:'1d',
  period1:'1632700800',
  period2:'1790380800',
  range:null,
  includePrePost:false,
  events:['div','splits']
};
const validationCalendar={
  developmentStart:'2021-09-27',
  validationStart:'2024-09-20',
  finalStart:'2026-01-01'
};
const batchCount=4;
const outDir=path.join(root,'public','task3-numerical-snapshot');
const tmp=path.join(root,'.task3-snapshot-work');
fs.rmSync(outDir,{recursive:true,force:true});
fs.rmSync(tmp,{recursive:true,force:true});
fs.mkdirSync(outDir,{recursive:true});
fs.mkdirSync(tmp,{recursive:true});

function runNode(args,{cwd=root,env={}}={}){
  return new Promise((resolve,reject)=>{
    const p=spawn(process.execPath,args,{
      cwd,
      env:{...process.env,...env},
      stdio:['ignore','pipe','pipe']
    });
    let tail='';
    p.stdout.on('data',d=>{tail=(tail+d.toString()).slice(-12000)});
    p.stderr.on('data',d=>{tail=(tail+d.toString()).slice(-12000)});
    p.on('exit',code=>code===0?resolve(tail):reject(new Error('exit '+code+'\n'+tail)));
  });
}

function sanitizedReport(file){
  const j=JSON.parse(fs.readFileSync(file,'utf8'));
  delete j.generatedAt;
  if(j.dataset){
    delete j.dataset.file;
  }
  return j;
}

await runNode(['scripts/test-frozen-dataset.mjs']);

const captures=await Promise.all(Array.from({length:batchCount},async(_,batchIndex)=>{
  const cwd=path.join(tmp,'capture-'+batchIndex);
  fs.mkdirSync(path.join(cwd,'data'),{recursive:true});
  const snapshot=path.join(outDir,'batch-'+batchIndex+'.json');
  await runNode([path.join(root,'scripts/backtest-market-hunter-v2.mjs')],{
    cwd,
    env:{
      V2_BATCH_INDEX:String(batchIndex),
      V2_BATCH_COUNT:String(batchCount),
      V2_RANGE:'5y',
      V2_HORIZONS:'5,10,20',
      V2_PERIOD1:source.period1,
      V2_PERIOD2:source.period2,
      V2_DATASET_CAPTURE:snapshot,
      V2_CAPTURE_REVISION:captureRevision,
      V2_DEVELOPMENT_START:validationCalendar.developmentStart,
      V2_VALIDATION_START:validationCalendar.validationStart,
      V2_FINAL_TEST_START:validationCalendar.finalStart,
      V2_OPEN_FINAL_TEST:'0'
    }
  });
  return {batchIndex,snapshot};
}));

const batches=[];
for(const {batchIndex,snapshot} of captures){
  const s=JSON.parse(fs.readFileSync(snapshot,'utf8'));
  const commonEnv={
    V2_BATCH_INDEX:String(batchIndex),
    V2_BATCH_COUNT:String(batchCount),
    V2_RANGE:'5y',
    V2_HORIZONS:'5,10,20',
    V2_DATASET_FILE:snapshot,
    V2_EXPECT_SNAPSHOT_ID:s.snapshotId,
    V2_EXPECT_DATA_SHA256:s.dataSha256,
    V2_EXPECT_STRUCTURE_SHA256:s.structureSha256,
    V2_EXPECT_NORMALIZATION_VERSION:s.normalizationVersion,
    V2_EXPECT_SOURCE_JSON:JSON.stringify(s.source),
    V2_FORBID_NETWORK:'1',
    V2_DATASET_ARTIFACT_ID:'task3-capture-verification',
    V2_DEVELOPMENT_START:validationCalendar.developmentStart,
    V2_VALIDATION_START:validationCalendar.validationStart,
    V2_FINAL_TEST_START:validationCalendar.finalStart,
    V2_OPEN_FINAL_TEST:'0'
  };

  const runDirs=[];
  for(let n=1;n<=2;n++){
    const cwd=path.join(tmp,'offline-b'+batchIndex+'-run'+n);
    fs.mkdirSync(path.join(cwd,'data'),{recursive:true});
    await runNode([path.join(root,'scripts/backtest-market-hunter-v2.mjs')],{cwd,env:commonEnv});
    runDirs.push(cwd);
  }

  const a=sanitizedReport(path.join(runDirs[0],'data','v2-backtest-batch-'+batchIndex+'.json'));
  const b=sanitizedReport(path.join(runDirs[1],'data','v2-backtest-batch-'+batchIndex+'.json'));
  assertSame(a,b,'offline substantive report mismatch for batch '+batchIndex);

  batches.push({
    batchIndex,
    file:'batch-'+batchIndex+'.json',
    snapshotId:s.snapshotId,
    capturedAt:s.capturedAt,
    sha256:s.sha256,
    dataSha256:s.dataSha256,
    structureSha256:s.structureSha256,
    normalizationVersion:s.normalizationVersion,
    source:s.source,
    engineVersion:s.engineVersion,
    captureRevision:s.captureRevision,
    symbolCount:(s.symbols||[]).length,
    symbols:s.symbols||[],
    bytes:fs.statSync(snapshot).size,
    offlineReplayTwice:true,
    networkForbidden:true,
    substantiveReportsMatched:true
  });
}

function assertSame(a,b,message){
  const ah=crypto.createHash('sha256').update(JSON.stringify(a)).digest('hex');
  const bh=crypto.createHash('sha256').update(JSON.stringify(b)).digest('hex');
  if(ah!==bh)throw new Error(message+': '+ah+' != '+bh);
}

const setDigest=crypto.createHash('sha256')
  .update(JSON.stringify(batches.map(x=>[x.batchIndex,x.dataSha256,x.snapshotId,x.symbols])))
  .digest('hex');
const setId='mhv2-numerical-2026-09-27-'+setDigest.slice(0,12);

const manifest={
  format:'market-hunter-v2-numerical-snapshot-manifest-v1',
  setId,
  createdAt:new Date().toISOString(),
  purpose:'Immutable full normalized numerical inputs for controlled Market Hunter V2 validation experiments.',
  rangeLabel:'5y',
  normalizationVersion:NORMALIZATION_VERSION,
  source,
  validationCalendar,
  batchCount,
  captureRevision,
  policy:{
    fullNumericalInputsFrozen:true,
    adjustedCalculationInputsIncluded:true,
    structuralHashRetainedAsDiagnostic:true,
    controlledExperiments:'Download/copy this exact artifact once, then run baseline and candidate variants from the same local snapshot files.',
    finalPeriod:'closed during verification',
    network:'forbidden during offline verification runs'
  },
  artifact:{
    kind:'vercel-versioned-deployment',
    deploymentId:'TO_BE_RECORDED_AFTER_READY',
    deploymentUrl:'TO_BE_RECORDED_AFTER_READY',
    path:'/task3-numerical-snapshot/'
  },
  verification:{
    contractTestsPassed:true,
    allFourBatchesCaptured:true,
    offlineReplayCountPerBatch:2,
    offlineNetworkForbidden:true,
    substantiveReportsMatched:true,
    excludedFromEquality:['generatedAt','dataset.file']
  },
  batches
};
fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(root,'public','index.html'),'<pre>Market Hunter Task 3 numerical snapshot artifact</pre>');

console.log('TASK3_NUMERICAL_SNAPSHOT '+JSON.stringify({
  setId,
  captureRevision,
  normalizationVersion:NORMALIZATION_VERSION,
  source,
  validationCalendar,
  batches:batches.map(x=>({
    batchIndex:x.batchIndex,file:x.file,snapshotId:x.snapshotId,
    dataSha256:x.dataSha256,structureSha256:x.structureSha256,
    symbolCount:x.symbolCount,bytes:x.bytes
  })),
  verification:manifest.verification
}));
