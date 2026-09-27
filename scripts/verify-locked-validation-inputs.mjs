import fs from 'node:fs';
import path from 'node:path';
import {loadFrozenDataset} from '../lib/frozen-dataset.js';

function stable(v){
  if(Array.isArray(v))return v.map(stable);
  if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));
  return v;
}
function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b))}
function must(condition,message){if(!condition)throw new Error(message)}

const registryFile=process.env.V2_DATASET_REGISTRY||'data/frozen/market-hunter-v2-numerical-snapshot/registry.json';
const manifestFile=process.env.V2_DATASET_LOCK_MANIFEST||'data/frozen/market-hunter-v2-numerical-snapshot/manifest.json';
const snapshotDir=process.env.V2_SNAPSHOT_DIR||'data/frozen/market-hunter-v2-numerical-snapshot/files';

must(fs.existsSync(registryFile),'Numerical snapshot registry missing: '+registryFile);
must(fs.existsSync(manifestFile),'Locked validation manifest missing: '+manifestFile);

const registry=JSON.parse(fs.readFileSync(registryFile,'utf8'));
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));

must(registry.format==='market-hunter-v2-numerical-snapshot-registry-v1','Unsupported snapshot registry format');
must(registry.status==='VERIFIED_READY','Registered snapshot artifact is not VERIFIED_READY');
must(typeof registry.artifact?.deploymentId==='string'&&registry.artifact.deploymentId.startsWith('dpl_'),'Registry missing immutable Vercel deployment ID');
must(manifest.format==='market-hunter-v2-numerical-snapshot-manifest-v1','Unsupported validation manifest format');
must(manifest.batchCount===registry.batchCount,'Registry/manifest batchCount mismatch');
must(manifest.normalizationVersion===registry.normalizationVersion,'Registry/manifest normalization mismatch');
must(same(manifest.source,registry.source),'Registry/manifest source mismatch');
must(same(manifest.validationCalendar,registry.validationCalendar),'Registry/manifest validation calendar mismatch');
must(Array.isArray(manifest.batches)&&manifest.batches.length===manifest.batchCount,'Manifest batch membership incomplete');

manifest.artifact={
  ...(manifest.artifact||{}),
  id:registry.artifact.deploymentId,
  deploymentId:registry.artifact.deploymentId,
  deploymentUrl:registry.artifact.deploymentUrl,
  provider:registry.artifact.provider
};

const seen=new Set();
for(const batch of manifest.batches){
  must(Number.isInteger(batch.batchIndex),'Invalid manifest batch index');
  must(!seen.has(batch.batchIndex),'Duplicate manifest batch index '+batch.batchIndex);
  seen.add(batch.batchIndex);
  must(Array.isArray(batch.symbols)&&batch.symbols.length>0,'Manifest batch '+batch.batchIndex+' missing exact symbols');
  const file=path.resolve(snapshotDir,batch.file);
  must(fs.existsSync(file),'Locked snapshot file missing for batch '+batch.batchIndex+': '+file);
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
for(let i=0;i<manifest.batchCount;i++)must(seen.has(i),'Manifest missing batch '+i);

fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
console.log('Locked validation snapshot preflight passed for '+manifest.batches.length+' batches using artifact '+registry.artifact.deploymentId);
