import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const root=process.cwd();
const period1='1632700800';
const period2='1790380800';
const setId='market-hunter-v2-lock-2026-09-27';
const tmp=path.join(root,'.dataset-lock');
const pub=path.join(root,'public','frozen',setId);
fs.rmSync(tmp,{recursive:true,force:true});
fs.mkdirSync(tmp,{recursive:true});
fs.mkdirSync(pub,{recursive:true});

function runBatch(i){
  const cwd=path.join(tmp,'run-'+i);
  fs.mkdirSync(path.join(cwd,'data'),{recursive:true});
  const snapshot=path.join(tmp,'snapshot-'+i+'.json');
  return new Promise((resolve,reject)=>{
    const p=spawn(process.execPath,[path.join(root,'scripts/backtest-market-hunter-v2.mjs')],{
      cwd,
      env:{
        ...process.env,
        V2_BATCH_INDEX:String(i),
        V2_BATCH_COUNT:'4',
        V2_RANGE:'5y',
        V2_HORIZONS:'5,10,20',
        V2_PERIOD1:period1,
        V2_PERIOD2:period2,
        V2_DATASET_CAPTURE:snapshot
      },
      stdio:['ignore','pipe','pipe']
    });
    let tail='';
    p.stdout.on('data',d=>{tail=(tail+d.toString()).slice(-6000)});
    p.stderr.on('data',d=>{tail=(tail+d.toString()).slice(-6000)});
    p.on('exit',code=>{
      if(code!==0)return reject(new Error('batch '+i+' failed '+code+'\n'+tail));
      const j=JSON.parse(fs.readFileSync(snapshot,'utf8'));
      resolve({
        batchIndex:i,
        snapshotId:j.snapshotId,
        capturedAt:j.capturedAt,
        dataSha256:j.dataSha256,
        contentSha256:j.sha256,
        symbolCount:(j.symbols||[]).length,
        bytes:fs.statSync(snapshot).size
      });
    });
  });
}

const batches=await Promise.all([0,1,2,3].map(runBatch));
batches.sort((a,b)=>a.batchIndex-b.batchIndex);
const manifest={
  format:'market-hunter-v2-dataset-lock-v1',
  setId,
  createdAt:new Date().toISOString(),
  purpose:'Deterministic validation lock. Backtests must use this exact UTC source window and match the expected normalized-data SHA-256 for their batch; otherwise abort.',
  source:{
    provider:'Yahoo Finance chart endpoint',
    interval:'1d',
    period1,
    period2,
    period1Utc:'2021-09-27T00:00:00Z',
    period2ExclusiveUtc:'2026-09-26T00:00:00Z',
    includePrePost:false,
    events:['div','splits']
  },
  batchCount:4,
  engineCommit:'2c8349fda791acaf85311b5bde6cc1e2f17ef17a',
  batches
};
fs.writeFileSync(path.join(pub,'manifest.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(root,'public','index.html'),'<pre>Market Hunter deterministic dataset lock</pre>');
console.log('DATASET_LOCK '+JSON.stringify(manifest));
