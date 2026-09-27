import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const root=process.cwd();
const pub=path.join(root,'public','validation');
fs.mkdirSync(pub,{recursive:true});
fs.writeFileSync(path.join(root,'public','index.html'),'<pre>Dataset drift capture</pre>');
const cwd=path.join(root,'.drift-capture');
fs.mkdirSync(path.join(cwd,'data'),{recursive:true});
const snap=path.join(root,'.drift-capture-b0.json');

const p=spawn(process.execPath,[path.join(root,'scripts/backtest-market-hunter-v2.mjs')],{
  cwd,
  env:{
    ...process.env,
    V2_BATCH_INDEX:'0',
    V2_BATCH_COUNT:'4',
    V2_RANGE:'5y',
    V2_HORIZONS:'5,10,20',
    V2_PERIOD1:'1632700800',
    V2_PERIOD2:'1790380800',
    V2_DATASET_CAPTURE:snap,
    V2_FINAL_TEST_START:'2026-01-01',
    V2_OPEN_FINAL_TEST:'0'
  },
  stdio:['ignore','pipe','pipe']
});
let out='';
p.stdout.on('data',d=>{out+=d.toString()});
p.stderr.on('data',d=>{out+=d.toString()});
p.on('exit',code=>{
  if(code===0){
    fs.copyFileSync(snap,path.join(pub,'current-batch0.json'));
    const j=JSON.parse(fs.readFileSync(snap,'utf8'));
    fs.writeFileSync(path.join(pub,'current-meta.json'),JSON.stringify({dataSha256:j.dataSha256,contentSha256:j.sha256,capturedAt:j.capturedAt,symbolCount:j.symbols?.length||0},null,2));
  }else{
    fs.writeFileSync(path.join(pub,'current-meta.json'),JSON.stringify({error:true,code,output:out.slice(-10000)},null,2));
  }
});
