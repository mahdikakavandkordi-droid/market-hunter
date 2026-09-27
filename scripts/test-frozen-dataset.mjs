import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {captureFrozenDataset,loadFrozenDataset,frozenDataDigest,structuralDataDigest} from '../lib/frozen-dataset.js';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mh-freeze-'));
const file=path.join(dir,'snapshot.json');
const source={
  'ABC.TO':{rows:[{t:1,close:10,rawClose:10,rawHigh:11,rawLow:9,high:11,low:9,volume:100}],splitDays:new Set(['2026-01-02']),splitEvents:[{date:'2026-01-02',numerator:2,denominator:1,splitRatio:'2:1'}],dividends:[{date:'2026-01-03',amount:.1}]},
  '^GSPTSE':{rows:[{t:1,close:100,rawClose:100,rawHigh:101,rawLow:99,high:101,low:99,volume:1000}],splitDays:new Set(),splitEvents:[],dividends:[]}
};
const cap=captureFrozenDataset(file,{range:'5y',batchIndex:0,batchCount:4,symbols:['ABC.TO','^GSPTSE'],data:source,engineVersion:'test'});
assert.match(cap.sha256,/^[a-f0-9]{64}$/);
assert.match(cap.dataSha256,/^[a-f0-9]{64}$/);
assert.match(cap.structureSha256,/^[a-f0-9]{64}$/);
assert.equal(cap.dataSha256,frozenDataDigest({range:'5y',batchIndex:0,batchCount:4,symbols:['ABC.TO','^GSPTSE'],data:source}));
const loaded=loadFrozenDataset(file,{expectedRange:'5y',expectedBatchIndex:0,expectedBatchCount:4,expectedSymbols:['ABC.TO','^GSPTSE']});
assert.equal(loaded.sha256,cap.sha256);
assert.equal(loaded.dataSha256,cap.dataSha256);
assert.equal(loaded.structureSha256,cap.structureSha256);
assert.equal(loaded.data['ABC.TO'].rows[0].close,10);
assert.ok(loaded.data['ABC.TO'].splitDays.has('2026-01-02'));

const tampered=JSON.parse(fs.readFileSync(file,'utf8'));
tampered.data['ABC.TO'].rows[0].close=999;
fs.writeFileSync(file,JSON.stringify(tampered));
assert.throws(()=>loadFrozenDataset(file),/(hash mismatch|data fingerprint mismatch)/);

console.log('Frozen dataset capture/load tests passed');

const noisy={
  'ABC.TO':{rows:[{t:1,close:10.00009,rawClose:10,rawHigh:11,rawLow:9,high:11.0001,low:8.9999,volume:100}],splitDays:new Set(['2026-01-02']),splitEvents:[{date:'2026-01-02',numerator:2,denominator:1,splitRatio:'2:1'}],dividends:[{date:'2026-01-03',amount:.1}]},
  '^GSPTSE':source['^GSPTSE']
};
assert.equal(
  structuralDataDigest({range:'5y',batchIndex:0,batchCount:4,symbols:['ABC.TO','^GSPTSE'],data:source}),
  structuralDataDigest({range:'5y',batchIndex:0,batchCount:4,symbols:['ABC.TO','^GSPTSE'],data:noisy})
);
assert.notEqual(
  frozenDataDigest({range:'5y',batchIndex:0,batchCount:4,symbols:['ABC.TO','^GSPTSE'],data:source}),
  frozenDataDigest({range:'5y',batchIndex:0,batchCount:4,symbols:['ABC.TO','^GSPTSE'],data:noisy})
);
console.log('Structural fingerprint ignores adjusted-float noise but detects raw-source changes');
