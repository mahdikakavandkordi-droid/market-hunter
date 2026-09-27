import assert from 'node:assert/strict';
import {assertLockedValidationReport,assertComparableValidationReports,extractValidationIdentity} from '../lib/validation-identity.js';

function report(){
  return {
    batchIndex:0,batchCount:4,symbols:['AAA.TO','BBB.TO','^GSPTSE'],
    dataset:{
      mode:'frozen',snapshotId:'snap-0',dataSha256:'a'.repeat(64),structureSha256:'b'.repeat(64),
      normalizationVersion:'norm-v1',
      source:{provider:'Yahoo',interval:'1d',period1:'1',period2:'2',range:null,includePrePost:false,events:['div','splits']},
      artifactId:'dpl_same'
    },
    validation:{finalTestOpened:false,calendar:{developmentStart:'2021-09-27',validationStart:'2024-09-20',finalStart:'2026-01-01'}},
    horizons:{5:{scope:'development'},10:{scope:'development'},20:{scope:'development'}}
  };
}
const a=report(),b=report();
assert.doesNotThrow(()=>assertLockedValidationReport(a));
assert.doesNotThrow(()=>assertComparableValidationReports(a,b));
assert.deepEqual(extractValidationIdentity(a).horizons,[5,10,20]);

const cases=[
  ['numerical hash',x=>x.dataset.dataSha256='c'.repeat(64)],
  ['structural hash',x=>x.dataset.structureSha256='c'.repeat(64)],
  ['snapshot',x=>x.dataset.snapshotId='snap-other'],
  ['normalization',x=>x.dataset.normalizationVersion='norm-v2'],
  ['source',x=>x.dataset.source.period2='3'],
  ['artifact',x=>x.dataset.artifactId='dpl_other'],
  ['calendar',x=>x.validation.calendar.validationStart='2024-10-01'],
  ['symbols',x=>x.symbols=['AAA.TO','^GSPTSE']],
  ['symbol order',x=>x.symbols=['BBB.TO','AAA.TO','^GSPTSE']],
  ['batch',x=>x.batchIndex=1],
  ['horizons',x=>delete x.horizons[20]]
];
for(const [name,mutate] of cases){
  const x=report();mutate(x);
  assert.throws(()=>assertComparableValidationReports(a,x),/Validation identity mismatch/,name);
}
const live=report();live.dataset.mode='live';
assert.throws(()=>assertLockedValidationReport(live),/dataset.mode must be frozen/);
const missingArtifact=report();missingArtifact.dataset.artifactId='';
assert.throws(()=>assertLockedValidationReport(missingArtifact),/artifactId/);
const opened=report();opened.validation.finalTestOpened=true;
assert.throws(()=>assertLockedValidationReport(opened),/final test must remain closed/);
const wrongScope=report();wrongScope.horizons[10].scope='historical-final';
assert.throws(()=>assertLockedValidationReport(wrongScope),/scope=development/);

const copiedArtifact=report();copiedArtifact.dataset.artifactId='dpl_copy';
assert.throws(()=>assertComparableValidationReports(a,copiedArtifact),/Validation identity mismatch/);
assert.doesNotThrow(()=>assertComparableValidationReports(a,copiedArtifact,{requireSameArtifact:false}));

console.log('Validation identity guard tests passed');
