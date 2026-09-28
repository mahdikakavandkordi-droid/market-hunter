import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const archiveRef=process.env.MH_ARCHIVE_REF||'locked-v2-validation-36420714736-archive-v1';
const archiveRoot=process.env.MH_ARCHIVE_ROOT||'archive/locked-v2-validation/run-36420714736';
const outputDir=path.resolve(process.env.EARLY_WATCH_STABILITY_OUT||'data/research/early-watch-episode-stability-reproduced');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-ew-episode-stability-'));
const dataDir=path.join(tmp,'data');
const manifestDir=path.join(dataDir,'frozen/market-hunter-v2-numerical-snapshot');
fs.mkdirSync(manifestDir,{recursive:true});

function fail(m){throw new Error(m)}
function gitShow(rel){
  const spec=archiveRef+':'+archiveRoot+'/'+rel;
  const r=spawnSync('git',['show',spec],{cwd:repoRoot,encoding:'utf8',maxBuffer:64*1024*1024});
  if(r.status!==0)fail('git show failed for '+spec+': '+String(r.stderr||r.stdout).trim());
  return r.stdout;
}
function run(script){
  const r=spawnSync(process.execPath,[path.join(repoRoot,script)],{
    cwd:tmp,
    encoding:'utf8',
    maxBuffer:64*1024*1024,
    env:{
      ...process.env,
      V2_OPEN_FINAL_TEST:'0',
      V2_DATASET_LOCK_MANIFEST:'data/frozen/market-hunter-v2-numerical-snapshot/manifest.json',
      PREVIOUS_EARLY_WATCH_REPLAY:'data/v2-early-watch-surface-replay.json',
      EARLY_WATCH_STABILITY_OUT:outputDir
    }
  });
  if(r.status!==0)fail(script+' failed:\n'+String(r.stderr||r.stdout).trim());
  process.stdout.write(r.stdout||'');
}

for(let i=0;i<4;i++){
  fs.writeFileSync(path.join(dataDir,'v2-backtest-batch-'+i+'.json'),gitShow('raw-reports/batch-'+i+'/v2-backtest-batch-'+i+'.json'));
}
fs.writeFileSync(path.join(manifestDir,'manifest.json'),gitShow('snapshot/manifest.json'));
fs.writeFileSync(path.join(dataDir,'v2-early-watch-surface-replay.json'),gitShow('evidence/v2-early-watch-surface-replay.json'));

fs.mkdirSync(outputDir,{recursive:true});
run('scripts/analyze-early-watch-episode-stability.mjs');
run('scripts/audit-early-watch-episode-stability.mjs');

const summary=JSON.parse(fs.readFileSync(path.join(outputDir,'summary.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(outputDir,'audit.json'),'utf8'));
if(summary.source?.finalTestOpened!==false||audit.finalTestOpened!==false)fail('Historical Final was not sealed');
if(audit.failedChecks!==0)fail('Independent audit has failures');

console.log('PASS: reproduced Early Watch episode-stability analysis from '+archiveRef);
console.log('outputDir='+outputDir);
