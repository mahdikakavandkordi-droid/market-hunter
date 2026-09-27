import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/frozen/market-hunter-v2-lock-2026-09-27/manifest.json'),'utf8'));
const tmp=path.join(root,'.sealed-verify');
const pub=path.join(root,'public','validation');
fs.rmSync(tmp,{recursive:true,force:true});
fs.mkdirSync(tmp,{recursive:true});
fs.mkdirSync(pub,{recursive:true});
fs.writeFileSync(path.join(root,'public','index.html'),'<pre>Sealed final verification</pre>');

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

const batches=await Promise.all(manifest.batches.map(async batch=>{
  const cwd=path.join(tmp,'batch-'+batch.batchIndex);
  fs.mkdirSync(path.join(cwd,'data'),{recursive:true});
  await run(process.execPath,[path.join(root,'scripts/backtest-market-hunter-v2.mjs')],{
    cwd,
    env:{
      ...process.env,
      V2_BATCH_INDEX:String(batch.batchIndex),
      V2_BATCH_COUNT:String(manifest.batchCount),
      V2_RANGE:'5y',
      V2_HORIZONS:'5,10,20',
      V2_PERIOD1:String(manifest.source.period1),
      V2_PERIOD2:String(manifest.source.period2),
      V2_EXPECT_STRUCTURE_SHA256:String(batch.structureSha256),
      V2_FINAL_TEST_START:'2026-01-01',
      V2_OPEN_FINAL_TEST:'0'
    }
  });
  const report=JSON.parse(fs.readFileSync(path.join(cwd,'data','v2-backtest-batch-'+batch.batchIndex+'.json'),'utf8'));
  const counts=[];
  for(const h of ['5','10','20']){
    for(const stage of ['Early Watch','Recovery','Attractive Growth','Established Move']){
      const rr=report.horizons?.[h]?.byStage?.[stage]?.ranking;
      counts.push({
        horizon:Number(h),stage,
        finalSealedCount:rr?.finalSealed?.count??null,
        opened:rr?.finalSealed?.opened??null,
        trainCount:rr?.purge?.trainCount??null,
        testCount:rr?.purge?.testCount??null,
        finalBoundaryPurgedCount:rr?.purge?.finalBoundaryPurgedCount??null
      });
    }
  }
  return {
    batchIndex:batch.batchIndex,
    expectedStructureSha256:batch.structureSha256,
    actualStructureSha256:report.dataset?.structureSha256||null,
    adjustedDataSha256:report.dataset?.dataSha256||null,
    finalTestStart:report.validation?.finalTestStart||null,
    finalTestOpened:report.validation?.finalTestOpened??null,
    counts
  };
}));

const aggregate={};
for(const stage of ['Early Watch','Recovery','Attractive Growth','Established Move']){
  aggregate[stage]={};
  for(const h of [5,10,20]){
    const xs=batches.flatMap(x=>x.counts).filter(x=>x.stage===stage&&x.horizon===h);
    aggregate[stage][h]={
      finalSealedCount:xs.reduce((s,x)=>s+(x.finalSealedCount||0),0),
      trainCount:xs.reduce((s,x)=>s+(x.trainCount||0),0),
      testCount:xs.reduce((s,x)=>s+(x.testCount||0),0),
      finalBoundaryPurgedCount:xs.reduce((s,x)=>s+(x.finalBoundaryPurgedCount||0),0)
    };
  }
}
const out={
  generatedAt:new Date().toISOString(),
  status:'PASS',
  datasetLockFormat:manifest.format,
  finalTestStart:'2026-01-01',
  finalTestOpened:false,
  note:'Count-only verification. No sealed-period return, excess-return, hit-rate, MAE or MFE metrics are exposed.',
  batches,
  aggregate
};
fs.writeFileSync(path.join(pub,'sealed-final-verify.json'),JSON.stringify(out,null,2));
console.log('SEALED_FINAL_VERIFY '+JSON.stringify({status:out.status,aggregate}));
