import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const root=process.cwd();
const period1='1632700800';
const period2='1790380800';
const tmp=path.join(root,'.struct-lock');
const pub=path.join(root,'public','validation');
fs.rmSync(tmp,{recursive:true,force:true});
fs.mkdirSync(tmp,{recursive:true});
fs.mkdirSync(pub,{recursive:true});
fs.writeFileSync(path.join(root,'public','index.html'),'<pre>Structural dataset lock capture</pre>');

function run(cmd,args,opts={}){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args,{...opts,stdio:['ignore','pipe','pipe']});
    let out='';
    p.stdout.on('data',d=>{out=(out+d.toString()).slice(-10000)});
    p.stderr.on('data',d=>{out=(out+d.toString()).slice(-10000)});
    p.on('exit',code=>code===0?resolve(out):reject(new Error('exit '+code+'\n'+out)));
  });
}

await run(process.execPath,['scripts/test-validation-split.mjs'],{cwd:root,env:process.env});
await run(process.execPath,['scripts/test-frozen-dataset.mjs'],{cwd:root,env:process.env});

const batches=await Promise.all([0,1,2,3].map(async i=>{
  const cwd=path.join(tmp,'run-'+i);
  fs.mkdirSync(path.join(cwd,'data'),{recursive:true});
  const snap=path.join(tmp,'snapshot-'+i+'.json');
  await run(process.execPath,[path.join(root,'scripts/backtest-market-hunter-v2.mjs')],{
    cwd,
    env:{
      ...process.env,
      V2_BATCH_INDEX:String(i),
      V2_BATCH_COUNT:'4',
      V2_RANGE:'5y',
      V2_HORIZONS:'5,10,20',
      V2_PERIOD1:period1,
      V2_PERIOD2:period2,
      V2_DATASET_CAPTURE:snap,
      V2_FINAL_TEST_START:'2026-01-01',
      V2_OPEN_FINAL_TEST:'0'
    }
  });
  const j=JSON.parse(fs.readFileSync(snap,'utf8'));
  return {
    batchIndex:i,
    capturedAt:j.capturedAt,
    structureSha256:j.structureSha256,
    adjustedDataSha256:j.dataSha256,
    symbolCount:(j.symbols||[]).length,
    bytes:fs.statSync(snap).size
  };
}));
batches.sort((a,b)=>a.batchIndex-b.batchIndex);
const manifest={
  format:'market-hunter-v2-structural-lock-v1',
  createdAt:new Date().toISOString(),
  source:{
    provider:'Yahoo Finance chart endpoint',
    interval:'1d',
    period1,period2,
    period1Utc:'2021-09-27T00:00:00Z',
    period2ExclusiveUtc:'2026-09-26T00:00:00Z',
    includePrePost:false,
    events:['div','splits']
  },
  policy:{
    structuralFingerprint:'Exact SHA-256 over timestamp, raw OHLC, volume, split events and dividend events.',
    adjustedPrice:'Yahoo adjusted-price values are used for calculations but excluded from the structural fingerprint because repeated requests showed sub-mill precision noise without raw-data changes.',
    experimentRule:'Baseline and candidate variants must run from one fetched data object in the same process.'
  },
  batchCount:4,
  engineCommit:'0af837f4388e0f9734f9d28e67800fcf4e1603c1',
  batches
};
fs.writeFileSync(path.join(pub,'structural-lock.json'),JSON.stringify(manifest,null,2));
console.log('STRUCTURAL_LOCK '+JSON.stringify(manifest));
