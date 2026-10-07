import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {digest} from '../lib/wave-ml/features.mjs';
import {buildSplitsV2} from '../lib/wave-ml/splits-v2.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base='data/research/wave-ml-v1/',DAY=86400000;
const read=p=>fs.readFileSync(path.join(root,p));
const json=p=>JSON.parse(read(p));
const compressed=p=>JSON.parse(gunzipSync(Buffer.from(read(p).toString().trim(),'base64')));
const sha=p=>createHash('sha256').update(read(p)).digest('hex');
const protectedPaths=[base+'contract.json',base+'evaluation-v2-contract.json',base+'official-calendar.json',base+'task3-calendar-report.json',base+'evaluation-v2-task2-report.json',base+'dataset/manifest.json',base+'dataset/feature-manifest.json',base+'dataset/task3-calendar-accepted-labels.json.gz.b64',base+'dataset/evaluation-v2-splits.json.gz.b64','lib/wave-ml/features.mjs','lib/wave-ml/labels.mjs','lib/wave-ml/calendar.mjs','lib/wave-ml/splits.mjs'];
const before=Object.fromEntries(protectedPaths.map(p=>[p,sha(p)]));
const testFiles=['scripts/test-wave-ml-features.mjs','scripts/test-wave-ml-labels.mjs','scripts/test-wave-ml-calendar.mjs','scripts/test-wave-ml-splits-v2.mjs'];
const testOutput=execFileSync(process.execPath,['--test','--test-reporter=tap',...testFiles],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
assert.match(testOutput,/# tests 46\b/);assert.match(testOutput,/# pass 46\b/);assert.match(testOutput,/# fail 0\b/);
const replay=JSON.parse(execFileSync(process.execPath,['scripts/build-wave-ml-splits-v2.mjs'],{cwd:root,encoding:'utf8',maxBuffer:1024*1024}));
const c=json(base+'evaluation-v2-contract.json'),prior=json(base+'evaluation-v2-task2-report.json');
const input=compressed(base+'dataset/task3-calendar-accepted-labels.json.gz.b64');
const output=compressed(base+'dataset/evaluation-v2-splits.json.gz.b64'),split=output.split,labels=input.labels;
assert.equal(digest(c),'cba7232a7b4f9075c77c1199a4ab02c64c1368229f9f81426f621ca0e970ca6a');
assert.equal(digest(output),prior.manifestHash);assert.equal(replay.manifestHash,prior.manifestHash);
assert.equal(digest(split),prior.splitHash);assert.equal(digest(output.featureTags),prior.featureTagsHash);
assert.equal(digest(labels),prior.acceptedLabelHash);
assert.equal(digest(buildSplitsV2(labels,c,{asOf:Date.parse(input.asOf)})),prior.splitHash);
assert.equal(labels.length,66420);assert.equal(output.featureTags.length,78468);assert.equal(split.records.length,labels.length*3);
const byId=new Map(labels.map(r=>[r.id,r])),windows=new Map(split.windows.map(w=>[w.name,w]));
assert.equal(byId.size,labels.length);
const pairs=new Map(),dayMax=new Map();
for(const r of labels){
 assert.ok(!c.split.holdoutSymbols.includes(r.symbol));assert.ok(Date.parse(r.availableAt)<Date.parse(c.split.developmentDecisionEndExclusive));
 const day=Math.floor(Date.parse(r.availableAt)/DAY)*DAY,key=r.symbol+'|'+r.availableAt;
 if(!pairs.has(key))pairs.set(key,[]);pairs.get(key).push(r);
 if(r.status==='resolved')dayMax.set(day,Math.max(dayMax.get(day)??-Infinity,Date.parse(r.informationEnd)));
}
const counts={},coverage={},roleByPair=new Map();let marchSpilloverRows=0,fitRows=0,evaluationRows=0;
for(const r of split.records){
 const l=byId.get(r.id),w=windows.get(r.fold);assert.ok(l&&w);
 assert.deepEqual(Object.keys(r).sort(),['id','fold','utcDecisionDay','partition','cohortRole','role','reason'].sort());
 const t=Date.parse(l.availableAt),day=Math.floor(t/DAY)*DAY,end=Date.parse(l.informationEnd),start=Date.parse(w.decisionStart),deadline=Date.parse(w.outcomeCutoffExclusive);
 assert.equal(r.utcDecisionDay,new Date(day).toISOString().slice(0,10));
 const isEvaluation=w.kind==='development_validation'&&day>=start&&day+DAY<=Date.parse(w.decisionEndExclusive);
 assert.equal(r.cohortRole==='evaluate',isEvaluation);
 const pairKey=l.symbol+'|'+l.availableAt,pair=pairs.get(pairKey),roleKey=r.fold+'|'+pairKey;
 if(roleByPair.has(roleKey))assert.equal(roleByPair.get(roleKey),r.role);roleByPair.set(roleKey,r.role);
 if(r.role==='fit'||r.role==='evaluate'){
  assert.equal(pair.length,2);assert.equal(new Set(pair.map(x=>x.dir)).size,2);assert.ok(pair.every(x=>x.status==='resolved'));
 }
 if(r.role==='fit'){
  fitRows++;assert.ok(day+DAY<=Date.parse(w.fitDecisionEndExclusive));assert.ok(dayMax.get(day)<start);assert.ok(end<start&&end<=Date.parse(input.asOf));assert.equal(isEvaluation,false);
 }
 if(r.role==='evaluate'){
  evaluationRows++;assert.equal(isEvaluation,true);assert.ok(end<deadline);assert.ok(Date.parse(input.asOf)>=deadline);
  if(r.fold==='validation_2'&&end>=Date.parse(c.split.developmentDecisionEndExclusive))marchSpilloverRows++;
 }
 const countKey=[r.fold,r.role,l.market,l.dir].join('|'),coverageKey=[r.fold,r.cohortRole,l.market,l.dir].join('|');
 counts[countKey]=(counts[countKey]||0)+1;coverage[coverageKey]=(coverage[coverageKey]||0)+1;
}
assert.deepEqual(counts,prior.counts);assert.deepEqual(coverage,prior.coverage);assert.equal(marchSpilloverRows,1745);
const notMature=buildSplitsV2(labels,c,{asOf:Date.parse(c.split.finalTestStart)-1});
assert.equal(notMature.records.filter(r=>r.role==='evaluate').length,0);
const cohortView=s=>s.records.filter(r=>r.cohortRole==='evaluate').map(({id,fold,cohortRole})=>({id,fold,cohortRole}));
assert.deepEqual(cohortView(notMature),cohortView(split));
// Change development-validation outcomes only. This cannot affect either
// earlier validation fitting cohort. It may affect final-refit candidates.
const perturbed=labels.map(r=>Date.parse(r.availableAt)>=Date.parse(c.split.validationStart)?{...r,informationEnd:'2026-06-15T00:00:00.000Z',netR:1e9,class:'test_only_perturbation'}:r);
const changed=buildSplitsV2(perturbed,c,{asOf:Date.parse(input.asOf)});
for(const name of ['validation_1','validation_2']){
 const training=s=>s.records.filter(r=>r.fold===name&&r.cohortRole==='fit_candidate');
 assert.deepEqual(training(changed),training(split));
}
for(const object of [input,output,split]){assert.equal(object.finalLabelsOpened??false,false);assert.equal(object.trainingStarted??false,false);}
assert.equal(split.records.filter(r=>r.fold==='final_fit_only'&&r.role==='evaluate').length,0);
const after=Object.fromEntries(protectedPaths.map(p=>[p,sha(p)]));assert.deepEqual(after,before);
const report={version:'wave-ml-evaluation-v2-task3-verification-1',evaluationContractHash:digest(c),observationCutoff:input.asOf,manifestHash:digest(output),splitHash:digest(split),featureTagsHash:digest(output.featureTags),acceptedLabelHash:digest(labels),tests:{total:46,passed:46,failed:0,newV2:20,priorV1:26},audited:{featureRows:output.featureTags.length,developmentLabelRows:labels.length,foldRows:split.records.length,admittedFitRows:fitRows,admittedEvaluationRows:evaluationRows,marchEvaluationRowsWithAprilOrLaterInformationEnd:marchSpilloverRows},checks:{decisionCohortIndependentOfExit:true,wholeWindowMaturityGate:true,strictOutcomeDeadline:true,wholeDay75DayEmbargo:true,globalDayTrainingIntervalPurge:true,pairedDirections:true,reservedAndGapLabelExclusion:true,noFinalEvaluationRows:true,noOutcomeValuesInSplit:true,futureValidationPerturbationPreservesEarlierFit:true,offlineReplayHashUnchanged:true,protectedFilesByteUnchanged:true},protectedFileSha256:before,finalLabelsOpened:false,trainingStarted:false,researchTrainingReady:false,status:'task3_verified; task4_readiness_review_pending; no_model_fit_or_performance_claim'};
const destination=base+'evaluation-v2-task3-report.json';
if(fs.existsSync(path.join(root,destination)))assert.deepEqual(json(destination),report,'task3_report_replay_changed');
else fs.writeFileSync(path.join(root,destination),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({tests:report.tests,audited:report.audited,manifestHash:report.manifestHash,checks:report.checks,finalLabelsOpened:false,trainingStarted:false,researchTrainingReady:false}));
