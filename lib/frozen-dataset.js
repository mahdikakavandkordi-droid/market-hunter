import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const FROZEN_DATASET_FORMAT='market-hunter-v2-frozen-dataset-v2';
export const NORMALIZATION_VERSION='market-hunter-yahoo-normalization-v2-2026-09-27';

function digest(value){
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function canonicalSource(source={}){
  return {
    provider:String(source.provider||''),
    interval:String(source.interval||''),
    period1:source.period1==null?null:String(source.period1),
    period2:source.period2==null?null:String(source.period2),
    range:source.range==null?null:String(source.range),
    includePrePost:Boolean(source.includePrePost),
    events:[...(source.events||[])].map(String).sort()
  };
}

function serializeData(symbols,data){
  const serialized={};
  for(const symbol of symbols){
    const pack=data[symbol]||{rows:[],splitDays:new Set()};
    serialized[symbol]={
      rows:Array.isArray(pack.rows)?pack.rows:[],
      splitDays:[...(pack.splitDays instanceof Set?pack.splitDays:new Set(pack.splitDays||[]))].sort(),
      splitEvents:Array.isArray(pack.splitEvents)?pack.splitEvents:[],
      dividends:Array.isArray(pack.dividends)?pack.dividends:[]
    };
  }
  return serialized;
}

function numericalPayload({source,batchIndex,batchCount,symbols,data,normalizationVersion=NORMALIZATION_VERSION}){
  return {
    format:FROZEN_DATASET_FORMAT,
    normalizationVersion,
    source:canonicalSource(source),
    batchIndex,
    batchCount,
    symbols:[...symbols],
    data:serializeData(symbols,data)
  };
}

export function frozenDataDigest(args){
  return digest(numericalPayload(args));
}

export function structuralDataDigest({source,batchIndex,batchCount,symbols,data,normalizationVersion=NORMALIZATION_VERSION}){
  const structural={};
  for(const symbol of symbols){
    const pack=data[symbol]||{rows:[],splitDays:new Set()};
    structural[symbol]={
      rows:(Array.isArray(pack.rows)?pack.rows:[]).map(r=>[
        r.t,
        Number.isFinite(r.rawClose)?r.rawClose:null,
        Number.isFinite(r.rawHigh)?r.rawHigh:null,
        Number.isFinite(r.rawLow)?r.rawLow:null,
        Number.isFinite(r.volume)?r.volume:null
      ]),
      splitEvents:Array.isArray(pack.splitEvents)?pack.splitEvents:[],
      dividends:Array.isArray(pack.dividends)?pack.dividends:[]
    };
  }
  return digest({
    format:'market-hunter-v2-structural-fingerprint-v2',
    normalizationVersion,
    source:canonicalSource(source),
    batchIndex,batchCount,symbols:[...symbols],data:structural
  });
}

export function captureFrozenDataset(file,{
  source,batchIndex,batchCount,symbols,data,
  engineVersion=null,captureRevision=null,
  normalizationVersion=NORMALIZATION_VERSION
}){
  const capturedAt=new Date().toISOString();
  const normalizedSource=canonicalSource(source);
  const dataSha256=frozenDataDigest({
    source:normalizedSource,batchIndex,batchCount,symbols,data,normalizationVersion
  });
  const structureSha256=structuralDataDigest({
    source:normalizedSource,batchIndex,batchCount,symbols,data,normalizationVersion
  });
  const snapshotId='mhv2-'+capturedAt.slice(0,10)+'-b'+batchIndex+'of'+batchCount+'-'+dataSha256.slice(0,12);
  const payload={
    format:FROZEN_DATASET_FORMAT,
    snapshotId,capturedAt,
    normalizationVersion,
    source:normalizedSource,
    batchIndex,batchCount,
    symbols:[...symbols],
    engineVersion,
    captureRevision,
    data:serializeData(symbols,data)
  };
  const sha256=digest(payload);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify({...payload,sha256,dataSha256,structureSha256}));
  return {
    format:FROZEN_DATASET_FORMAT,
    snapshotId,capturedAt,normalizationVersion,
    source:normalizedSource,
    batchIndex,batchCount,
    symbols:[...symbols],
    engineVersion,captureRevision,
    sha256,dataSha256,structureSha256,file
  };
}

function sameJson(a,b){
  return JSON.stringify(a)===JSON.stringify(b);
}

export function loadFrozenDataset(file,{
  expectedSnapshotId,
  expectedDataSha256,
  expectedStructureSha256,
  expectedSource,
  expectedNormalizationVersion,
  expectedBatchIndex,
  expectedBatchCount,
  expectedSymbols
}={}){
  const raw=JSON.parse(fs.readFileSync(file,'utf8'));
  if(raw.format!==FROZEN_DATASET_FORMAT)throw new Error('Unsupported frozen dataset format: '+raw.format);

  const {sha256,dataSha256,structureSha256,...payload}=raw;
  const actualFileSha=digest(payload);
  if(!sha256||sha256!==actualFileSha)throw new Error('Frozen dataset integrity hash mismatch for '+file);

  const source=canonicalSource(raw.source);
  if(expectedSnapshotId&&raw.snapshotId!==expectedSnapshotId)throw new Error('Frozen dataset snapshot ID mismatch');
  if(expectedNormalizationVersion&&raw.normalizationVersion!==expectedNormalizationVersion)throw new Error('Frozen dataset normalization version mismatch');
  if(Number.isFinite(expectedBatchIndex)&&raw.batchIndex!==expectedBatchIndex)throw new Error('Frozen dataset batch index mismatch');
  if(Number.isFinite(expectedBatchCount)&&raw.batchCount!==expectedBatchCount)throw new Error('Frozen dataset batch count mismatch');
  if(expectedSource&&!sameJson(source,canonicalSource(expectedSource)))throw new Error('Frozen dataset source metadata mismatch');
  if(expectedSymbols&&!sameJson(raw.symbols||[],expectedSymbols))throw new Error('Frozen dataset symbol membership/order mismatch');

  const data={};
  for(const [symbol,pack] of Object.entries(raw.data||{})){
    data[symbol]={
      rows:Array.isArray(pack.rows)?pack.rows:[],
      splitDays:new Set(pack.splitDays||[]),
      splitEvents:Array.isArray(pack.splitEvents)?pack.splitEvents:[],
      dividends:Array.isArray(pack.dividends)?pack.dividends:[]
    };
  }

  const actualDataSha256=frozenDataDigest({
    source,batchIndex:raw.batchIndex,batchCount:raw.batchCount,
    symbols:raw.symbols||[],data,normalizationVersion:raw.normalizationVersion
  });
  const actualStructureSha256=structuralDataDigest({
    source,batchIndex:raw.batchIndex,batchCount:raw.batchCount,
    symbols:raw.symbols||[],data,normalizationVersion:raw.normalizationVersion
  });

  if(!dataSha256||dataSha256!==actualDataSha256)throw new Error('Frozen dataset numerical fingerprint mismatch for '+file);
  if(!structureSha256||structureSha256!==actualStructureSha256)throw new Error('Frozen dataset structural fingerprint mismatch for '+file);
  if(expectedDataSha256&&actualDataSha256!==expectedDataSha256)throw new Error('Frozen dataset designated numerical hash mismatch');
  if(expectedStructureSha256&&actualStructureSha256!==expectedStructureSha256)throw new Error('Frozen dataset designated structural hash mismatch');

  return {
    format:raw.format,snapshotId:raw.snapshotId,capturedAt:raw.capturedAt,
    normalizationVersion:raw.normalizationVersion,source,
    batchIndex:raw.batchIndex,batchCount:raw.batchCount,symbols:raw.symbols||[],
    engineVersion:raw.engineVersion,captureRevision:raw.captureRevision,
    sha256:actualFileSha,dataSha256:actualDataSha256,structureSha256:actualStructureSha256,
    data
  };
}
