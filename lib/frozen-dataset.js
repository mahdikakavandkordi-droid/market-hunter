import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const FORMAT='market-hunter-v2-frozen-dataset-v1';

function stablePayload({snapshotId,capturedAt,range,batchIndex,batchCount,symbols,engineVersion,data}){
  const serialized={};
  for(const symbol of symbols){
    const pack=data[symbol]||{rows:[],splitDays:new Set()};
    serialized[symbol]={
      rows:Array.isArray(pack.rows)?pack.rows:[],
      splitDays:[...(pack.splitDays instanceof Set?pack.splitDays:new Set(pack.splitDays||[]))].sort()
    };
  }
  return {format:FORMAT,snapshotId,capturedAt,range,batchIndex,batchCount,symbols:[...symbols],engineVersion,data:serialized};
}
function digest(payload){
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
export function frozenDataDigest({range,batchIndex,batchCount,symbols,data}){
  const serialized={};
  for(const symbol of symbols){
    const pack=data[symbol]||{rows:[],splitDays:new Set()};
    serialized[symbol]={
      rows:Array.isArray(pack.rows)?pack.rows:[],
      splitDays:[...(pack.splitDays instanceof Set?pack.splitDays:new Set(pack.splitDays||[]))].sort()
    };
  }
  return digest({range,batchIndex,batchCount,symbols:[...symbols],data:serialized});
}
export function captureFrozenDataset(file,{range,batchIndex,batchCount,symbols,data,engineVersion}){
  const capturedAt=new Date().toISOString();
  const snapshotId='v2-'+capturedAt.slice(0,10)+'-b'+batchIndex+'of'+batchCount;
  const payload=stablePayload({snapshotId,capturedAt,range,batchIndex,batchCount,symbols,engineVersion,data});
  const sha256=digest(payload);
  const dataSha256=frozenDataDigest({range,batchIndex,batchCount,symbols,data});
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify({...payload,sha256,dataSha256}));
  return {snapshotId,capturedAt,sha256,dataSha256,file};
}
export function loadFrozenDataset(file,{expectedRange,expectedBatchIndex,expectedBatchCount,expectedSymbols}={}){
  const raw=JSON.parse(fs.readFileSync(file,'utf8'));
  if(raw.format!==FORMAT)throw new Error('Unsupported frozen dataset format: '+raw.format);
  const {sha256,dataSha256,...payload}=raw;
  const actual=digest(payload);
  if(!sha256||sha256!==actual)throw new Error('Frozen dataset hash mismatch for '+file);
  if(expectedRange&&raw.range!==expectedRange)throw new Error('Frozen dataset range mismatch: '+raw.range+' != '+expectedRange);
  if(Number.isFinite(expectedBatchIndex)&&raw.batchIndex!==expectedBatchIndex)throw new Error('Frozen dataset batch index mismatch');
  if(Number.isFinite(expectedBatchCount)&&raw.batchCount!==expectedBatchCount)throw new Error('Frozen dataset batch count mismatch');
  if(expectedSymbols){
    const have=new Set(raw.symbols||[]);
    const missing=expectedSymbols.filter(x=>!have.has(x));
    if(missing.length)throw new Error('Frozen dataset missing symbols: '+missing.join(', '));
  }
  const data={};
  for(const [symbol,pack] of Object.entries(raw.data||{})){
    data[symbol]={rows:Array.isArray(pack.rows)?pack.rows:[],splitDays:new Set(pack.splitDays||[])};
  }
  const actualDataSha256=frozenDataDigest({range:raw.range,batchIndex:raw.batchIndex,batchCount:raw.batchCount,symbols:raw.symbols||[],data});
  if(dataSha256&&dataSha256!==actualDataSha256)throw new Error('Frozen dataset data fingerprint mismatch for '+file);
  return {format:raw.format,snapshotId:raw.snapshotId,capturedAt:raw.capturedAt,range:raw.range,batchIndex:raw.batchIndex,batchCount:raw.batchCount,symbols:raw.symbols||[],engineVersion:raw.engineVersion,sha256,dataSha256:actualDataSha256,data};
}
