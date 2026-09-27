import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

const root=process.cwd();
const setId='market-hunter-v2-raw-2026-09-27';
const outDir=path.join(root,'frozen-capture');
const publicDir=path.join(root,'public','frozen',setId);
fs.rmSync(outDir,{recursive:true,force:true});
fs.mkdirSync(outDir,{recursive:true});
fs.mkdirSync(publicDir,{recursive:true});

function run(cmd,args,opts={}){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args,{...opts,stdio:['ignore','pipe','pipe']});
    let tail='';
    p.stdout.on('data',d=>{tail=(tail+d.toString()).slice(-8000)});
    p.stderr.on('data',d=>{tail=(tail+d.toString()).slice(-8000)});
    p.on('exit',code=>code===0?resolve(tail):reject(new Error('exit '+code+'\n'+tail)));
  });
}

await run(process.execPath,['scripts/test-validation-split.mjs'],{cwd:root,env:process.env});
await run(process.execPath,['scripts/test-frozen-dataset.mjs'],{cwd:root,env:process.env});

await Promise.all([0,1,2,3].map(async i=>{
  const cwd=path.join(outDir,'run-'+i);
  fs.mkdirSync(path.join(cwd,'data'),{recursive:true});
  const snapshot=path.join(outDir,'v2-backtest-raw-batch-'+i+'.json');
  await run(process.execPath,[path.join(root,'scripts/backtest-market-hunter-v2.mjs')],{
    cwd,
    env:{
      ...process.env,
      V2_BATCH_INDEX:String(i),
      V2_BATCH_COUNT:'4',
      V2_RANGE:'5y',
      V2_HORIZONS:'5,10,20',
      V2_DATASET_CAPTURE:snapshot
    }
  });
}));

const batches=[];
for(let i=0;i<4;i++){
  const src=path.join(outDir,'v2-backtest-raw-batch-'+i+'.json');
  const raw=fs.readFileSync(src);
  const j=JSON.parse(raw.toString('utf8'));
  const file='v2-backtest-raw-batch-'+i+'.json';
  fs.copyFileSync(src,path.join(publicDir,file));
  const timestamps=[];
  for(const pack of Object.values(j.data||{})){
    for(const row of pack.rows||[])if(Number.isFinite(row.t))timestamps.push(row.t);
  }
  batches.push({
    batchIndex:i,
    file,
    snapshotId:j.snapshotId,
    capturedAt:j.capturedAt,
    contentSha256:j.sha256,
    fileSha256:crypto.createHash('sha256').update(raw).digest('hex'),
    bytes:raw.length,
    symbolCount:(j.symbols||[]).length,
    firstTimestamp:timestamps.length?Math.min(...timestamps):null,
    lastTimestamp:timestamps.length?Math.max(...timestamps):null
  });
}
const manifest={
  format:'market-hunter-v2-frozen-dataset-set-v1',
  setId,
  createdAt:new Date().toISOString(),
  purpose:'Immutable raw-data basis for Market Hunter V2 validation experiments. Use these files instead of refetching Yahoo during comparisons.',
  source:{
    provider:'Yahoo Finance chart endpoint',
    range:'5y',
    interval:'1d',
    includePrePost:false,
    events:['div','splits']
  },
  batchCount:4,
  engineCommit:'95c6efb7a0a01f884dbb31d96a27f841e3390b26',
  batches
};
const manifestText=JSON.stringify(manifest,null,2);
fs.writeFileSync(path.join(publicDir,'manifest.json'),manifestText);
fs.writeFileSync(path.join(root,'public','index.html'),'<pre>Market Hunter frozen validation dataset</pre>');
console.log('FROZEN_DATASET_MANIFEST '+JSON.stringify({setId,batches:batches.map(x=>({batchIndex:x.batchIndex,bytes:x.bytes,contentSha256:x.contentSha256,fileSha256:x.fileSha256,symbolCount:x.symbolCount}))}));
