import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/frozen/market-hunter-v2-lock-2026-09-27/manifest.json'),'utf8'));
const tmp=path.join(root,'.sealed-final-count');
const pub=path.join(root,'public','validation');
fs.rmSync(tmp,{recursive:true,force:true});
fs.mkdirSync(tmp,{recursive:true});
fs.mkdirSync(pub,{recursive:true});

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

const results=await Promise.all(manifest.batches.map(async batch=>{
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
      V2_EXPECT_DATA_SHA256:String(batch.dataSha256),
      V2_FINAL_TEST_START:'2026-01-01',
      V2_OPEN_FINAL_TEST:'0'
    }
  });
  const report=JSON.parse(fs.readFileSync(path.join(cwd,'data','v2-backtest-batch-'+batch.batchIndex+'.json'),'utf8'));
  const counts=[];
  for(const h of ['5','10','20']){
    for(const stage of ['Early Watch','Recovery','Attractive Growth','Established Move']){
      const r=report.horizons?.[h]?.byStage?.[stage]?.ranking;
      counts.push({
        horizon:Number(h),stage,
        finalSealedCount:r?.finalSealed?.count??null,
        finalOpened:r?.finalSealed?.opened??null,
        developmentTrainCount:r?.purge?.trainCount??null,
        developmentTestCount:r?.purge?.testCount??null,
        finalBoundaryPurgedCount:r?.purge?.finalBoundaryPurgedCount??null
      });
    }
  }
  return {
    batchIndex:batch.batchIndex,
    datasetSha256:report.dataset?.dataSha256||null,
    finalTestStart:report.validation?.finalTestStart||null,
    finalTestOpened:report.validation?.finalTestOpened??null,
    counts
  };
}));

const aggregate={};
for(const stage of ['Early Watch','Recovery','Attractive Growth','Established Move']){
  aggregate[stage]={};
  for(const h of [5,10,20]){
    const xs=results.flatMap(x=>x.counts).filter(x=>x.stage===stage&&x.horizon===h);
    aggregate[stage][h]={
      finalSealedCount:xs.reduce((s,x)=>s+(x.finalSealedCount||0),0),
      developmentTrainCount:xs.reduce((s,x)=>s+(x.developmentTrainCount||0),0),
      developmentTestCount:xs.reduce((s,x)=>s+(x.developmentTestCount||0),0),
      finalBoundaryPurgedCount:xs.reduce((s,x)=>s+(x.finalBoundaryPurgedCount||0),0)
    };
  }
}
const out={
  generatedAt:new Date().toISOString(),
  finalTestStart:'2026-01-01',
  opened:false,
  note:'Count-only sealed-period audit. No final-period performance metrics are exposed.',
  datasetLock:manifest.setId,
  batches:results,
  aggregate
};
fs.writeFileSync(path.join(pub,'sealed-final-counts.json'),JSON.stringify(out,null,2));
fs.writeFileSync(path.join(root,'public','index.html'),'<pre>Sealed final count validation</pre>');
console.log('SEALED_FINAL_COUNTS '+JSON.stringify({opened:out.opened,aggregate}));
