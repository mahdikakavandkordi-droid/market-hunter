import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {buildSplitsV2,partitionV2} from '../lib/wave-ml/splits-v2.mjs';
import {digest} from '../lib/wave-ml/features.mjs';
const root=path.resolve(new URL('..',import.meta.url).pathname),base=path.join(root,'data/research/wave-ml-v1');
const contract=JSON.parse(fs.readFileSync(path.join(base,'evaluation-v2-contract.json'))),DAY=86400000,ASOF=Date.parse('2026-10-07T23:01:09.135Z');
function pair(time,end=time,{symbol='AAPL',market='us',status='resolved'}={}){return [1,-1].map(dir=>({id:[symbol,time,dir].join('|'),symbol,market,dir,availableAt:time,informationEnd:end,status,partition:'train',netR:dir,class:dir===1?'target_first':'stop_first'}));}
const build=(rows,asOf=ASOF,c=contract)=>buildSplitsV2(rows,c,{asOf});
const fold=(out,name)=>out.records.filter(r=>r.fold===name);
function roles(rows,name='validation_2',asOf=ASOF){return fold(build(rows,asOf),name).map(r=>r.role);}
test('March decisions with April/May results remain in March validation',()=>{
 const rows=pair('2026-03-10T21:05:00Z','2026-05-01T21:00:00Z');assert.deepEqual(roles(rows),['evaluate','evaluate']);assert.ok(fold(build(rows),'validation_1').every(r=>r.role==='excluded'));
});
test('early and late exits have identical evaluation membership after maturity',()=>{
 const early=pair('2026-03-10T21:05:00Z','2026-03-11T21:00:00Z'),late=pair('2026-03-10T21:05:00Z','2026-05-01T21:00:00Z');assert.deepEqual(fold(build(early),'validation_2'),fold(build(late),'validation_2'));
});
test('no early-resolved subset scores before the whole-window deadline',()=>{
 const rows=[...pair('2026-01-10T00:05:00Z','2026-01-11T00:00:00Z'),...pair('2026-03-10T00:05:00Z','2026-05-01T00:00:00Z')];
 const before=build(rows,Date.parse('2026-06-14T23:59:59.999Z'));assert.equal(before.records.filter(r=>r.role==='evaluate').length,0);assert.equal(before.windows.filter(r=>r.readyForScoring).length,0);
 assert.equal(build(rows,Date.parse('2026-06-15T00:00:00Z')).records.filter(r=>r.role==='evaluate').length,4);
});
test('outcome cutoff is strict; one late unrelated symbol cannot remove another evaluation pair',()=>{
 const a=pair('2026-03-10T21:05:00Z','2026-06-14T23:59:59.999Z'),b=pair('2026-03-10T21:05:00Z','2026-06-15T00:00:00Z',{symbol:'RY.TO',market:'ca'});
 const records=fold(build([...a,...b]),'validation_2');assert.ok(records.filter(r=>a.some(x=>x.id===r.id)).every(r=>r.role==='evaluate'));assert.ok(records.filter(r=>b.some(x=>x.id===r.id)).every(r=>r.role==='excluded'&&r.cohortRole==='evaluate'));
});
test('UTC decision boundaries assign Jan 1, Mar 1, Apr 1, Jun 15 and Jul 24 correctly',()=>{
 const cases=[['2023-01-01T00:00:00Z','outside'],['2025-12-31T23:59:59.999Z','train_candidate'],['2026-01-01T00:00:00Z','validation_1'],['2026-02-28T23:59:59.999Z','validation_1'],['2026-03-01T00:00:00Z','validation_2'],['2026-03-31T23:59:59.999Z','validation_2'],['2026-04-01T00:00:00Z','maturity_gap'],['2026-06-14T23:59:59.999Z','maturity_gap'],['2026-06-15T00:00:00Z','development_final_time'],['2026-07-24T00:00:00Z','outside']];
 for(const [t,p] of cases)assert.equal(partitionV2('AAPL',t,contract),p);
});
test('all reserved histories are excluded; only new final features get sealed tags',()=>{
 for(const symbol of contract.split.holdoutSymbols){assert.equal(partitionV2(symbol,'2026-03-01T00:05:00Z',contract),'reserved_symbol');assert.equal(partitionV2(symbol,'2026-06-15T00:05:00Z',contract),'sealed_final');assert.throws(()=>build(pair('2025-08-01T00:05:00Z','2025-08-02T00:00:00Z',{symbol})),/reserved/);}
});
test('gap/final label inputs reject before split generation',()=>{
 for(const t of ['2026-04-01T00:00:00Z','2026-05-01T00:00:00Z','2026-06-15T00:00:00Z','2026-07-01T00:00:00Z'])assert.throws(()=>build(pair(t)),/reserved_gap_or_final/);
});
test('75-day embargo applies to the complete UTC day and both directions',()=>{
 const before=pair('2025-10-17T21:05:00Z','2025-11-01T21:00:00Z'),inside=pair('2025-10-18T00:00:00Z','2025-11-01T21:00:00Z');assert.ok(roles(before,'validation_1').every(r=>r==='fit'));assert.ok(roles(inside,'validation_1').every(r=>r==='excluded'));
});
test('exact fitting interval purge groups markets in the same UTC day',()=>{
 const a=pair('2025-08-01T00:05:00Z','2025-08-10T00:00:00Z',{symbol:'BTC-USD',market:'crypto'}),b=pair('2025-08-01T21:05:00Z','2026-01-01T00:00:00Z');assert.ok(fold(build([...a,...b]),'validation_1').every(r=>r.role==='excluded'&&r.reason==='training_information_interval_purge'));
 b.forEach(r=>r.informationEnd='2025-12-31T23:59:59.999Z');assert.ok(fold(build([...a,...b]),'validation_1').every(r=>r.role==='fit'));
});
test('fitting cannot use an outcome not yet observed at asOf',()=>{
 const rows=pair('2025-08-01T00:05:00Z','2025-09-01T00:00:00Z');assert.ok(fold(build(rows,Date.parse('2025-08-15')),'validation_1').every(r=>r.role==='excluded'&&r.reason==='training_outcome_not_observed'));
});
test('March rows never enter March validation model fitting but may enter final-refit metadata',()=>{
 const rows=pair('2026-03-01T00:05:00Z','2026-05-01T00:00:00Z'),out=build(rows);assert.ok(fold(out,'validation_2').every(r=>r.role==='evaluate'));assert.ok(fold(out,'validation_1').every(r=>r.role==='excluded'));assert.ok(fold(out,'final_fit_only').every(r=>r.role==='fit'));assert.equal(out.trainingStarted,false);
});
test('unresolved/incomplete pairs remain evaluation coverage with no numeric target admission',()=>{
 const rows=pair('2026-03-01T00:05:00Z','2026-03-02T00:00:00Z');rows[1].status='unresolved';assert.ok(fold(build(rows),'validation_2').every(r=>r.role==='excluded'&&r.cohortRole==='evaluate'));
 assert.ok(fold(build(rows.slice(0,1)),'validation_2').every(r=>r.role==='excluded'&&r.cohortRole==='evaluate'));
});
test('future validation outcome/return perturbations cannot change earlier training assignments',()=>{
 const past=pair('2025-08-01T00:05:00Z','2025-08-02T00:00:00Z'),future=pair('2026-03-01T00:05:00Z','2026-04-01T00:00:00Z');const before=build([...past,...future]);future.forEach(r=>{r.informationEnd='2026-05-20T00:00:00Z';r.netR=1e9;r.class='time_exit';});const after=build([...past,...future]);
 assert.deepEqual(before.records.filter(r=>past.some(x=>x.id===r.id)),after.records.filter(r=>past.some(x=>x.id===r.id)));
});
test('outcome values/classes never appear in split records',()=>{
 const rows=pair('2026-03-01T00:05:00Z','2026-04-01T00:00:00Z');const before=build(rows);rows.forEach(r=>{r.netR=-1e8;r.class='time_exit';});assert.equal(digest(before),digest(build(rows)));assert.ok(before.records.every(r=>!('netR' in r)&&!('class' in r)));
});
test('duplicate IDs, invalid times, directions and pair market disagreement fail closed',()=>{
 const rows=pair('2025-08-01T00:05:00Z');assert.throws(()=>build([...rows,...rows]),/duplicate/);
 for(const patch of [{availableAt:'bad'},{informationEnd:'2025-07-01T00:00:00Z'},{dir:0},{status:'unknown'}]){const x=structuredClone(rows);Object.assign(x[0],patch);assert.throws(()=>build(x),/invalid/);}
 const mismatch=structuredClone(rows);mismatch[1].market='ca';assert.throws(()=>build(mismatch),/market_mismatch/);assert.throws(()=>buildSplitsV2(rows,contract),/explicit/);
});
test('contradictory V2 decision/deadline/gap configuration rejects',()=>{
 for(const mutate of [c=>c.split.validationWindows[0].outcomeCutoffExclusive='2026-03-01T00:00:00Z',c=>c.split.maturityGap.decisionsAllowedInFit=true,c=>c.split.embargoDays=0,c=>c.split.validationStart='2026-02-01T00:00:00Z',c=>c.split.validationOutcomeCutoffExclusive='2026-05-01T00:00:00Z',c=>c.split.globalUTC=false]){const c=structuredClone(contract);mutate(c);assert.throws(()=>build([],ASOF,c),/invalid_v2/);}
});
function isolatedRunner(){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'wave-ml-v2-tests-')),dest=path.join(tmp,'data/research/wave-ml-v1');
 fs.mkdirSync(path.join(tmp,'scripts'),{recursive:true});fs.mkdirSync(path.join(tmp,'lib/wave-ml'),{recursive:true});fs.mkdirSync(path.join(dest,'dataset'),{recursive:true});
 for(const f of ['scripts/build-wave-ml-splits-v2.mjs','lib/wave-ml/splits-v2.mjs','lib/wave-ml/features.mjs'])fs.copyFileSync(path.join(root,f),path.join(tmp,f));
 const parent=JSON.parse(fs.readFileSync(path.join(base,'contract.json'))),calendar={version:'synthetic_fixture'};
 const labels=[...pair('2025-08-01T00:05:00Z','2025-08-02T00:00:00Z'),...pair('2026-03-01T00:05:00Z','2026-04-01T00:00:00Z')];
 const matrix={columns:[],rows:labels.map(({id,symbol,market,dir,availableAt})=>({id,symbol,market,dir,availableAt,values:[]}))},source={contractHash:digest(parent),asOf:new Date(ASOF).toISOString(),entries:[]};
 const features={contractHash:digest(parent),manifestHash:digest(source),featureFiles:[{symbol:'AAPL',file:'AAPL.features.json.gz.b64',checksum:digest(matrix)}]};
 const input={version:'wave-ml-task3-calendar-accepted-v2',contractHash:digest(parent),sourceManifestHash:digest(source),featureManifestHash:digest(features),calendarHash:digest(calendar),asOf:source.asOf,labels,split:{version:'synthetic_old_split'}};
 const accepted={asOf:input.asOf,contractHash:input.contractHash,sourceManifestHash:input.sourceManifestHash,featureManifestHash:input.featureManifestHash,calendarHash:input.calendarHash,labelHash:digest(labels),splitHash:digest(input.split),calendarApproved:true,finalLabelsOpened:false,trainingStarted:false};
 const write=(file,value)=>fs.writeFileSync(path.join(dest,file),JSON.stringify(value));
 const zip=(file,value)=>fs.writeFileSync(path.join(dest,'dataset',file),gzipSync(JSON.stringify(value)).toString('base64')+'\n');
 write('contract.json',parent);write('evaluation-v2-contract.json',contract);write('official-calendar.json',calendar);write('dataset/manifest.json',source);write('dataset/feature-manifest.json',features);write('task3-calendar-report.json',accepted);zip('AAPL.features.json.gz.b64',matrix);zip('task3-calendar-accepted-labels.json.gz.b64',input);
 return {tmp,dest,accepted,input,matrix,features,write,zip,run:()=>execFileSync(process.execPath,[path.join(tmp,'scripts/build-wave-ml-splits-v2.mjs')],{encoding:'utf8',stdio:'pipe'}),cleanup:()=>fs.rmSync(tmp,{recursive:true,force:true})};
}
test('isolated offline runner replays byte-identical manifests without source calls',()=>{
 const f=isolatedRunner();try{f.run();const file=path.join(f.dest,'dataset/evaluation-v2-splits.json.gz.b64'),before=fs.readFileSync(file);f.run();assert.deepEqual(fs.readFileSync(file),before);}finally{f.cleanup();}
});
test('runner rejects modified source feature bytes and label bytes',()=>{
 for(const kind of ['feature','label']){const f=isolatedRunner();try{if(kind==='feature'){f.matrix.rows[0].dir=-1;f.zip('AAPL.features.json.gz.b64',f.matrix);}else{f.input.labels[0].informationEnd='2025-08-03T00:00:00Z';f.zip('task3-calendar-accepted-labels.json.gz.b64',f.input);}assert.throws(()=>f.run(),/checksum|provenance/);}finally{f.cleanup();}}
});
test('runner rejects inconsistent observation/certification metadata',()=>{
 for(const patch of [{asOf:'2027-01-01T00:00:00Z'},{finalLabelsOpened:true},{trainingStarted:true},{calendarApproved:false}]){const f=isolatedRunner();try{f.write('task3-calendar-report.json',{...f.accepted,...patch});assert.throws(()=>f.run(),/provenance/);}finally{f.cleanup();}}
});
test('runner refuses changed existing split/report output',()=>{
 for(const kind of ['manifest','report']){const f=isolatedRunner();try{f.run();if(kind==='manifest')f.zip('evaluation-v2-splits.json.gz.b64',{modified:true});else f.write('evaluation-v2-task2-report.json',{modified:true});assert.throws(()=>f.run(),/replay_changed/);}finally{f.cleanup();}}
});
