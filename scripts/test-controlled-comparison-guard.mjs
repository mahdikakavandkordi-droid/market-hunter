import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=process.cwd();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-compare-'));
const baseline=path.join(tmp,'baseline'),candidate=path.join(tmp,'candidate');
fs.mkdirSync(baseline);fs.mkdirSync(candidate);

const stages=['Early Watch','Recovery','Attractive Growth','Established Move'];
function report(batch){
  const byStage={};
  for(const s of stages){
    byStage[s]={
      scope:'development',
      overall:null,test:null,
      ranking:{trainThresholds:{q80:60,q90:70},purge:{prePurgeTrainCount:10,purgedTrainCount:1,trainCount:9,testCount:4},highPriority:{q80:{test:null}}}
    };
  }
  const horizons={};
  for(const h of [5,10,20])horizons[h]={scope:'development',byStage:structuredClone(byStage)};
  return {
    batchIndex:batch,batchCount:4,symbols:['AAA'+batch+'.TO','^GSPTSE'],
    dataset:{
      mode:'frozen',snapshotId:'snap-'+batch,dataSha256:String(batch+1).repeat(64).slice(0,64),
      structureSha256:String(batch+5).repeat(64).slice(0,64),normalizationVersion:'norm-v1',
      source:{provider:'Yahoo',interval:'1d',period1:'1',period2:'2',range:null,includePrePost:false,events:['div','splits']},
      artifactId:'dpl_same'
    },
    validation:{finalTestOpened:false,calendar:{developmentStart:'2021-09-27',validationStart:'2024-09-20',finalStart:'2026-01-01'}},
    horizons
  };
}
for(let i=0;i<4;i++){
  const j=report(i);
  fs.writeFileSync(path.join(baseline,'v2-backtest-batch-'+i+'.json'),JSON.stringify(j));
  fs.writeFileSync(path.join(candidate,'v2-backtest-batch-'+i+'.json'),JSON.stringify(j));
}
function run(){
  return spawnSync(process.execPath,[path.join(root,'scripts/compare-purged-backtest.mjs')],{
    cwd:tmp,
    env:{...process.env,V2_BASELINE_DIR:baseline,V2_CANDIDATE_DIR:candidate},
    encoding:'utf8'
  });
}
let r=run();
assert.equal(r.status,0,r.stderr||r.stdout);

const mutations=[
  ['data hash',x=>x.dataset.dataSha256='f'.repeat(64)],
  ['artifact',x=>x.dataset.artifactId='dpl_other'],
  ['calendar',x=>x.validation.calendar.validationStart='2024-10-01'],
  ['symbols',x=>x.symbols=['DIFFERENT.TO','^GSPTSE']],
  ['horizons',x=>delete x.horizons[20]]
];
for(const [name,mutate] of mutations){
  const file=path.join(candidate,'v2-backtest-batch-0.json');
  const x=report(0);mutate(x);fs.writeFileSync(file,JSON.stringify(x));
  r=run();
  assert.notEqual(r.status,0,name+' mismatch should fail controlled comparison');
  assert.match((r.stderr||'')+(r.stdout||''),/Validation identity mismatch/,name);
  fs.writeFileSync(file,JSON.stringify(report(0)));
}
console.log('Controlled comparison script guard integration tests passed');
