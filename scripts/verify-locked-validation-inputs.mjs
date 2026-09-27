import fs from 'node:fs';
import path from 'node:path';
import {loadFrozenDataset} from '../lib/frozen-dataset.js';

const manifestFile=process.env.V2_DATASET_LOCK_MANIFEST||'data/frozen/market-hunter-v2-numerical-snapshot/manifest.json';
const snapshotDir=process.env.V2_SNAPSHOT_DIR||'data/frozen/market-hunter-v2-numerical-snapshot/files';
if(!fs.existsSync(manifestFile))throw new Error('Locked validation manifest missing: '+manifestFile);
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
if(manifest.format!=='market-hunter-v2-numerical-snapshot-manifest-v1')throw new Error('Unsupported validation manifest format');
if(!Array.isArray(manifest.batches)||manifest.batches.length!==manifest.batchCount)throw new Error('Manifest batch membership incomplete');
for(const batch of manifest.batches){
  const file=path.resolve(snapshotDir,batch.file);
  if(!fs.existsSync(file))throw new Error('Locked snapshot file missing for batch '+batch.batchIndex+': '+file);
  loadFrozenDataset(file,{
    expectedSnapshotId:batch.snapshotId,
    expectedDataSha256:batch.dataSha256,
    expectedStructureSha256:batch.structureSha256,
    expectedSource:manifest.source,
    expectedNormalizationVersion:manifest.normalizationVersion,
    expectedBatchIndex:batch.batchIndex,
    expectedBatchCount:manifest.batchCount,
    expectedSymbols:batch.symbols
  });
}
console.log('Locked validation snapshot preflight passed for '+manifest.batches.length+' batches');
