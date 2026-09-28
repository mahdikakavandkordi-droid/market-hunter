import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {UNIVERSE} from '../lib/universe.js';
import {captureFrozenDataset,NORMALIZATION_VERSION} from '../lib/frozen-dataset.js';

// Synthetic end-to-end contract test, not market-performance evidence.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-locked-pipeline-'));
try{
 fs.symlinkSync(path.join(root,'scripts'),path.join(tmp,'scripts'),'dir');
 fs.symlinkSync(path.join(root,'lib'),path.join(tmp,'lib'),'dir');
 const files=path.join(tmp,'snapshots');fs.mkdirSync(files);
 const calendar={developmentStart:'2021-09-27',validationStart:'2024-09-20',finalStart:'2026-01-01'};
 const source={provider:'synthetic integration fixture',interval:'1d',period1:'1704067200',period2:'1767225600',range:null,includePrePost:false,events:['div','splits']};
 const manifest={format:'market-hunter-v2-numerical-snapshot-manifest-v1',batchCount:4,normalizationVersion:NORMALIZATION_VERSION,source,validationCalendar:calendar,artifact:{deploymentId:'dpl_synthetic_fixture'},batches:[]};
 const cdr=new Set(UNIVERSE.filter(x=>x[2]==='CDR').map(x=>x[0]));
 const rows=[];
 for(let i=0,t=1704067200;i<390;t+=86400){
   const day=new Date(t*1000).getUTCDay();if(day===0||day===6)continue;
   const close=30+Math.sin(i/12)*4+i*.025;
   rows.push({t,close,rawClose:close,high:close+1,rawHigh:close+1,low:close-1,rawLow:close-1,volume:1000000});i++;
 }
 for(let batchIndex=0;batchIndex<4;batchIndex++){
   const symbols=UNIVERSE.filter((_,i)=>i%4===batchIndex).map(x=>x[0]);
   const needed=[...new Set([...symbols,...symbols.map(s=>cdr.has(s)?'^IXIC':'^GSPTSE')])];
   const data=Object.fromEntries(needed.map(s=>[s,{rows:s===symbols[0]||s.startsWith('^')?rows:[],splitDays:new Set(),splitEvents:[],dividends:[]}]));
   const file='batch-'+batchIndex+'.json';
   const snap=captureFrozenDataset(path.join(files,file),{source,batchIndex,batchCount:4,symbols:needed,data});
   manifest.batches.push({...snap,file});
 }
 const manifestFile=path.join(tmp,'manifest.json');fs.writeFileSync(manifestFile,JSON.stringify(manifest));
 const env={...process.env,V2_DATASET_LOCK_MANIFEST:manifestFile,V2_SNAPSHOT_DIR:files,V2_HORIZONS:'5,10,20',V2_FORBID_NETWORK:'1',V2_REPORT_DIR:path.join(tmp,'data')};
 // Explicit fixture paths must not inherit a caller's dataset overrides.
 delete env.V2_DATASET_FILE;
 const run=(script,extra={})=>{
   const r=spawnSync(process.execPath,[path.join(root,'scripts',script)],{cwd:tmp,env:{...env,...extra},encoding:'utf8',maxBuffer:8*1024*1024});
   assert.equal(r.status,0,r.error?.message||r.stderr||r.stdout);
 };
 const substantive=r=>{const copy=structuredClone(r);delete copy.generatedAt;delete copy.dataset.file;return copy;};
 for(let batch=0;batch<4;batch++){
   run('run-locked-v2-backtest.mjs',{V2_BATCH_INDEX:String(batch)});
   const file=path.join(tmp,'data','v2-backtest-batch-'+batch+'.json');
   const first=JSON.parse(fs.readFileSync(file,'utf8'));
   assert.deepEqual(first.dataset.symbols,manifest.batches[batch].symbols);
   assert.equal(first.symbols.some(x=>x.startsWith('^')),false);
   assert.deepEqual(first.latestPicks,[]);
   run('run-locked-v2-backtest.mjs',{V2_BATCH_INDEX:String(batch)});
   assert.deepEqual(substantive(JSON.parse(fs.readFileSync(file,'utf8'))),substantive(first));
 }
 run('analyze-early-watch-surface-replay.mjs');
 const replay=JSON.parse(fs.readFileSync(path.join(tmp,'data/v2-early-watch-surface-replay.json'),'utf8'));
 assert.equal(replay.validationIdentity.historicalFinalOpened,false);
 assert.deepEqual(replay.validationIdentity.horizons,[5,10,20]);
 assert.ok(replay.horizons[5].selection.scanDays>0);
 console.log('Synthetic locked runner x4, repeatability, and Early Watch consumer pipeline passed');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
