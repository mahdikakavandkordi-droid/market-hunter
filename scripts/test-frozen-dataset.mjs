import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  captureFrozenDataset,loadFrozenDataset,
  frozenDataDigest,structuralDataDigest,
  NORMALIZATION_VERSION,FROZEN_DATASET_FORMAT
} from '../lib/frozen-dataset.js';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mh-freeze-v2-'));
const file=path.join(dir,'snapshot.json');
const source={
  provider:'Yahoo Finance chart endpoint',
  interval:'1d',
  period1:'1632700800',
  period2:'1790380800',
  range:null,
  includePrePost:false,
  events:['div','splits']
};
const symbols=['ABC.TO','^GSPTSE'];
const data={
  'ABC.TO':{
    rows:[{t:1,close:10.1,rawClose:10,rawHigh:11,rawLow:9,high:11.11,low:9.09,volume:100}],
    splitDays:new Set(['2026-01-02']),
    splitEvents:[{date:'2026-01-02',numerator:2,denominator:1,splitRatio:'2:1'}],
    dividends:[{date:'2026-01-03',amount:.1}]
  },
  '^GSPTSE':{
    rows:[{t:1,close:100.2,rawClose:100,rawHigh:101,rawLow:99,high:101.202,low:99.198,volume:1000}],
    splitDays:new Set(),splitEvents:[],dividends:[]
  }
};

const changedAdjusted=structuredClone(data);
changedAdjusted['ABC.TO']={
  ...changedAdjusted['ABC.TO'],
  splitDays:new Set(['2026-01-02']),
  rows:changedAdjusted['ABC.TO'].rows.map(r=>({...r,close:999,high:1098.9,low:899.1}))
};
assert.equal(
  structuralDataDigest({source,batchIndex:0,batchCount:4,symbols,data}),
  structuralDataDigest({source,batchIndex:0,batchCount:4,symbols,data:changedAdjusted}),
  'structural diagnostic should ignore adjusted-value-only mutation'
);
assert.notEqual(
  frozenDataDigest({source,batchIndex:0,batchCount:4,symbols,data}),
  frozenDataDigest({source,batchIndex:0,batchCount:4,symbols,data:changedAdjusted}),
  'numerical hash must change when adjusted calculation inputs change'
);

const cap=captureFrozenDataset(file,{
  source,batchIndex:0,batchCount:4,symbols,data,
  engineVersion:'engine-test',captureRevision:'commit-test'
});
assert.equal(cap.format,FROZEN_DATASET_FORMAT);
assert.equal(cap.normalizationVersion,NORMALIZATION_VERSION);
assert.match(cap.dataSha256,/^[a-f0-9]{64}$/);
assert.match(cap.structureSha256,/^[a-f0-9]{64}$/);

const expected={
  expectedSnapshotId:cap.snapshotId,
  expectedDataSha256:cap.dataSha256,
  expectedStructureSha256:cap.structureSha256,
  expectedSource:source,
  expectedNormalizationVersion:NORMALIZATION_VERSION,
  expectedBatchIndex:0,
  expectedBatchCount:4,
  expectedSymbols:symbols
};
const loaded=loadFrozenDataset(file,expected);
assert.equal(loaded.dataSha256,cap.dataSha256);
assert.equal(loaded.structureSha256,cap.structureSha256);
assert.equal(loaded.data['ABC.TO'].rows[0].close,10.1);

assert.throws(()=>loadFrozenDataset(file,{...expected,expectedDataSha256:'0'.repeat(64)}),/designated numerical hash mismatch/);
assert.throws(()=>loadFrozenDataset(file,{...expected,expectedSnapshotId:'wrong'}),/snapshot ID mismatch/);
assert.throws(()=>loadFrozenDataset(file,{...expected,expectedBatchIndex:1}),/batch index mismatch/);
assert.throws(()=>loadFrozenDataset(file,{...expected,expectedBatchCount:5}),/batch count mismatch/);
assert.throws(()=>loadFrozenDataset(file,{...expected,expectedSymbols:['ABC.TO']}),/symbol membership\/order mismatch/);
assert.throws(()=>loadFrozenDataset(file,{...expected,expectedSymbols:['^GSPTSE','ABC.TO']}),/symbol membership\/order mismatch/);
assert.throws(()=>loadFrozenDataset(file,{...expected,expectedSource:{...source,period2:'999'}}),/source metadata mismatch/);
assert.throws(()=>loadFrozenDataset(file,{...expected,expectedNormalizationVersion:'wrong'}),/normalization version mismatch/);

const tampered=JSON.parse(fs.readFileSync(file,'utf8'));
tampered.data['ABC.TO'].rows[0].close=999;
fs.writeFileSync(file,JSON.stringify(tampered));
assert.throws(()=>loadFrozenDataset(file,expected),/integrity hash mismatch/);

console.log('Numerical frozen dataset contract tests passed');
