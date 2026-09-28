import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {buildResearchReport} from '../lib/backtest-report-builder.js';

const root=process.cwd();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-compare-'));
const baseline=path.join(tmp,'baseline'),candidate=path.join(tmp,'candidate');
fs.mkdirSync(baseline);fs.mkdirSync(candidate);

const stages=['Early Watch','Recovery','Attractive Growth','Established Move'];
function report(batch){
  const calendar={developmentStart:'2021-09-27',validationStart:'2024-09-20',finalStart:'2026-01-01'};
  const features={};
  const rawEvents=[];
  for(const stage of stages)for(const horizon of [5,10,20]){
    for(const [id,date,outcomeDate] of [
      ['train','2023-01-02','2023-02-02'],
      ['purged','2024-09-19','2024-10-20'],
      ['validation','2025-01-02','2025-02-02']
    ])rawEvents.push({symbol:id+stage,date,outcomeDate,stage,horizon,rankScore:70,features,forwardReturn:1,excessReturn:1});
  }
  return buildResearchReport({
    version:'fixture',generatedAt:'fixed',batchIndex:batch,batchCount:4,symbols:['AAA'+batch+'.TO'],
    dataset:{mode:'frozen',snapshotId:'snap-'+batch,dataSha256:String(batch+1).repeat(64),
      structureSha256:String(batch+5).repeat(64),normalizationVersion:'norm-v1',
      source:{provider:'Yahoo'},artifactId:'dpl_same'},
    validation:{},validationCalendar:calendar,finalTestStart:calendar.finalStart,openFinalTest:false,
    horizons:[5,10,20],rawEvents,surfaceReplayCandidates:[],recoverySurfaceReplayCandidates:[],
    attractiveGrowthSurfaceReplayCandidates:[],establishedMoveSurfaceReplayCandidates:[],scanCalendar:[]
  });
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
const output=JSON.parse(fs.readFileSync(path.join(tmp,'data/purged-split-impact.json'),'utf8'));
assert.equal(output.summary.totalPurgedAcrossStageHorizonReports,48);
assert.ok(output.rows.every(x=>x.purgedTrainCount===1&&x.prePurgeTrainCount===2&&x.trainCount===1&&x.testCount===1));

const mutations=[
  ['missing counts',x=>delete x.horizons[5].byStage['Early Watch'].ranking.fold.counts],
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
  assert.match((r.stderr||'')+(r.stdout||''),/Validation identity mismatch|Missing fixed-calendar fold counts/,name);
  fs.writeFileSync(file,JSON.stringify(report(0)));
}
console.log('Controlled comparison script guard integration tests passed');

