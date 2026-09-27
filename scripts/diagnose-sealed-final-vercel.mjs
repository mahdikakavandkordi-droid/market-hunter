import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const root=process.cwd();
const pub=path.join(root,'public','validation');
fs.mkdirSync(pub,{recursive:true});
fs.writeFileSync(path.join(root,'public','index.html'),'<pre>Sealed final diagnostics</pre>');

function run(cmd,args,opts={}){
  return new Promise(resolve=>{
    const p=spawn(cmd,args,{...opts,stdio:['ignore','pipe','pipe']});
    let out='';
    p.stdout.on('data',d=>{out+=d.toString()});
    p.stderr.on('data',d=>{out+=d.toString()});
    p.on('exit',code=>resolve({code,output:out.slice(-12000)}));
  });
}

const steps=[];
steps.push({name:'test-validation-split',...(await run(process.execPath,['scripts/test-validation-split.mjs'],{cwd:root,env:process.env}))});
steps.push({name:'test-frozen-dataset',...(await run(process.execPath,['scripts/test-frozen-dataset.mjs'],{cwd:root,env:process.env}))});

if(steps.every(x=>x.code===0)){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/frozen/market-hunter-v2-lock-2026-09-27/manifest.json'),'utf8'));
  const batch=manifest.batches[0];
  const cwd=path.join(root,'.sealed-diagnostic');
  fs.mkdirSync(path.join(cwd,'data'),{recursive:true});
  steps.push({name:'locked-batch-0',...(await run(process.execPath,[path.join(root,'scripts/backtest-market-hunter-v2.mjs')],{
    cwd,
    env:{
      ...process.env,
      V2_BATCH_INDEX:'0',
      V2_BATCH_COUNT:String(manifest.batchCount),
      V2_RANGE:'5y',
      V2_HORIZONS:'5,10,20',
      V2_PERIOD1:String(manifest.source.period1),
      V2_PERIOD2:String(manifest.source.period2),
      V2_EXPECT_DATA_SHA256:String(batch.dataSha256),
      V2_FINAL_TEST_START:'2026-01-01',
      V2_OPEN_FINAL_TEST:'0'
    }
  }))});
}
fs.writeFileSync(path.join(pub,'diagnostic.json'),JSON.stringify({generatedAt:new Date().toISOString(),steps},null,2));
console.log(JSON.stringify(steps.map(x=>({name:x.name,code:x.code}))));
