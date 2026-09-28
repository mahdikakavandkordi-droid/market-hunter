import fs from 'node:fs';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {sha256Json,stableStringify} from './healthy-trend-pullback-forward.js';

// Hash the exact JSON-compatible payload that is persisted, not a later refetch.
export function saveSnapshot(root,value){
  const payload=JSON.parse(JSON.stringify(value));
  const hash=sha256Json(payload),ref={sha256:hash,path:`snapshots/${hash}.json.gz`};
  const file=path.join(root,ref.path);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  if(fs.existsSync(file))loadSnapshot(root,ref);
  else{
    fs.writeFileSync(file+'.tmp',gzipSync(stableStringify(payload)));
    fs.renameSync(file+'.tmp',file);
  }
  return ref;
}

export function loadSnapshot(root,ref){
  if(!ref||!/^[a-f0-9]{64}$/.test(ref.sha256)||ref.path!==`snapshots/${ref.sha256}.json.gz`)
    throw new Error('invalid_snapshot_reference');
  const payload=JSON.parse(gunzipSync(fs.readFileSync(path.join(root,ref.path))).toString('utf8'));
  if(sha256Json(payload)!==ref.sha256)throw new Error('snapshot_hash_mismatch:'+ref.path);
  return payload;
}

export function assertModernInputs(inputs){
  if(inputs.some(x=>x.schemaVersion!==2||!x.snapshot||!Array.isArray(x.observations)))
    throw new Error('legacy_forward_store_requires_explicit_migration');
}

// Journal order, not a timestamp or a later refetch, determines the winner.
// A crash between journal publication and observations publication is recoverable
// by deriving precisely the same immutable observations on the next run.
export function canonicalObservations(inputs){
  assertModernInputs(inputs);
  const days=new Set(),out=[];
  for(const input of inputs){
    if(days.has(input.marketAsOf))continue;
    const obs=input.observations;
    if(obs.length!==3||new Set(obs.map(x=>x.model)).size!==3||
      !obs.every(x=>['complete_nonzero','complete_zero_pick'].includes(x.status)))continue;
    days.add(input.marketAsOf);out.push(...obs);
  }
  return out;
}
