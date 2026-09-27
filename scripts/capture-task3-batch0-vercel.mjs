import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {NORMALIZATION_VERSION} from '../lib/frozen-dataset.js';

const root=process.cwd();
const batchIndex=0,batchCount=4;
const source={
  provider:'Yahoo Finance chart endpoint',
  interval:'1d',
  period1:'1632700800',
  period2:'1790380800',
  range:null,
  includePrePost:false,
  events:['div','splits']
};
const calendar={developmentStart:'2021-09-27',validationStart:'2024-09-20',finalStart:'2026-01-01'};
const pub=path.join(root,'public','task3-batch0');
const tmp=path.join(root,'.task3-batch0');
fs.rmSync(pub,{recursive:true,force:true});fs.rmSync(tmp,{recursive:true,force:true});
fs.mkdirSync(pub,{recursive:true});fs.mkdirSync(tmp,{recursive:true});

function run(args,{cwd,env}={}){
  return new Promise((resolve,reject)=>{
    const p=spawn(process.execPath,args,{cwd:cwd||root,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
    let out='';
    p.stdout.on('data',d=>{out=(out+d.toString()).slice(-12000)});
    p.stderr.on('data',d=>{out=(out+d.toString()).slice(-12000)});
    p.on('exit',code=>code===0?resolve(out):reject(new Error('exit '+code+'\n'+out)));
  });
}
function sanitize(file){
  const j=JSON.parse(fs.readFileSync(file,'utf8'));
  delete j.generatedAt;
  if(j.dataset) delete j.dataset.file;
  return j;
}
function hash(x){return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex')}

await run(['scripts/test-frozen-dataset.mjs']);

const capDir=path.join(tmp,'capture');fs.mkdirSync(path.join(capDir,'data'),{recursive:true});
const snapshot=path.join(pub,'batch-0.json');
await run([path.join(root,'scripts/backtest-market-hunter-v2.mjs')],{
  cwd:capDir,
  env:{
    V2_BATCH_INDEX:'0',V2_BATCH_COUNT:'4',V2_RANGE:'5y',V2_HORIZONS:'5,10,20',
    V2_PERIOD1:source.period1,V2_PERIOD2:source.period2,V2_DATASET_CAPTURE:snapshot,
    V2_CAPTURE_REVISION:process.env.VERCEL_GIT_COMMIT_SHA||'47494e8a1416ca8d0ee4715e9381a2607348bb30',
    V2_DEVELOPMENT_START:calendar.developmentStart,V2_VALIDATION_START:calendar.validationStart,
    V2_FINAL_TEST_START:calendar.finalStart,V2_OPEN_FINAL_TEST:'0'
  }
});
const s=JSON.parse(fs.readFileSync(snapshot,'utf8'));

const commonEnv={
  V2_BATCH_INDEX:'0',V2_BATCH_COUNT:'4',V2_RANGE:'5y',V2_HORIZONS:'5,10,20',
  V2_DATASET_FILE:snapshot,V2_EXPECT_SNAPSHOT_ID:s.snapshotId,
  V2_EXPECT_DATA_SHA256:s.dataSha256,V2_EXPECT_STRUCTURE_SHA256:s.structureSha256,
  V2_EXPECT_NORMALIZATION_VERSION:s.normalizationVersion,V2_EXPECT_SOURCE_JSON:JSON.stringify(s.source),
  V2_FORBID_NETWORK:'1',V2_DEVELOPMENT_START:calendar.developmentStart,
  V2_VALIDATION_START:calendar.validationStart,V2_FINAL_TEST_START:calendar.finalStart,V2_OPEN_FINAL_TEST:'0'
};
const reports=[];
for(let n=1;n<=2;n++){
  const cwd=path.join(tmp,'offline-'+n);fs.mkdirSync(path.join(cwd,'data'),{recursive:true});
  await run([path.join(root,'scripts/backtest-market-hunter-v2.mjs')],{cwd,env:commonEnv});
  reports.push(sanitize(path.join(cwd,'data','v2-backtest-batch-0.json')));
}
const h1=hash(reports[0]),h2=hash(reports[1]);
if(h1!==h2)throw new Error('offline replay mismatch '+h1+' '+h2);

const manifest={
  format:'market-hunter-v2-numerical-snapshot-batch-v1',
  batchIndex:0,batchCount:4,
  normalizationVersion:NORMALIZATION_VERSION,
  source,validationCalendar:calendar,
  snapshotId:s.snapshotId,capturedAt:s.capturedAt,
  sha256:s.sha256,dataSha256:s.dataSha256,structureSha256:s.structureSha256,
  symbolCount:(s.symbols||[]).length,symbols:s.symbols||[],
  bytes:fs.statSync(snapshot).size,
  verification:{contractPassed:true,offlineReplayCount:2,networkForbidden:true,substantiveReportHash:h1,matched:true}
};
fs.writeFileSync(path.join(pub,'manifest.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(root,'public','index.html'),JSON.stringify(manifest));
console.log('TASK3_BATCH0 '+JSON.stringify(manifest));
