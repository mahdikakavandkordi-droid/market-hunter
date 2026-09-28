import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  fetchWithTimeout,writeLeaseFile,readLeaseFile,revokeLeaseFile,withCleanup
} from '../lib/vercel-bypass-lease.js';

const token='test-token-never-log';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-vercel-lease-'));

function response(status=200,body={ok:true}){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
}

function makeRevokeFetch(active,revocations){
  return async (_url,opts)=>{
    const body=JSON.parse(opts.body);
    const secret=body?.revoke?.secret;
    revocations.push(secret);
    if(active.has(secret))active.delete(secret);
    return response(200,{protectionBypass:{}});
  };
}

// Failure during materialization must still run cleanup.
{
  let cleaned=0;
  await assert.rejects(
    withCleanup({
      work:async()=>{throw new Error('synthetic download failure')},
      cleanup:async()=>{cleaned++}
    }),
    /synthetic download failure/
  );
  assert.equal(cleaned,1);
}

// A hung HTTP request must abort on timeout instead of blocking cleanup forever.
{
  const hangingFetch=async (_url,opts)=>new Promise((_resolve,reject)=>{
    opts.signal.addEventListener('abort',()=>reject(opts.signal.reason||new Error('aborted')),{once:true});
  });
  const start=Date.now();
  await assert.rejects(fetchWithTimeout(hangingFetch,'https://example.invalid',{},25));
  assert.ok(Date.now()-start<1000,'timeout should terminate promptly');
}

// Simulated cancellation: the process did not get to its finally block, so the workflow always-step
// reads the private lease file and revokes exactly that run's secret.
{
  const active=new Set(['cancel-A']);
  const revocations=[];
  const leaseFile=path.join(tmp,'cancel-A.json');
  writeLeaseFile(leaseFile,{secret:'cancel-A',projectId:'prj_test',teamId:'team_test',runId:'run-A'});
  assert.equal(readLeaseFile(leaseFile).secret,'cancel-A');
  if(process.platform!=='win32')assert.equal(fs.statSync(leaseFile).mode&0o777,0o600);
  await revokeLeaseFile({file:leaseFile,fetchImpl:makeRevokeFetch(active,revocations),token,timeoutMs:100});
  assert.deepEqual(revocations,['cancel-A']);
  assert.equal(active.has('cancel-A'),false);
  assert.equal(fs.existsSync(leaseFile),false);
}

// Concurrent runs use distinct secrets and distinct workspace lease files.
// Cleanup for run A must never revoke run B's access.
{
  const active=new Set(['secret-A','secret-B']);
  const revocations=[];
  const fetchImpl=makeRevokeFetch(active,revocations);
  const fileA=path.join(tmp,'run-A.json');
  const fileB=path.join(tmp,'run-B.json');
  writeLeaseFile(fileA,{secret:'secret-A',projectId:'prj_test',teamId:'team_test',runId:'run-A'});
  writeLeaseFile(fileB,{secret:'secret-B',projectId:'prj_test',teamId:'team_test',runId:'run-B'});

  await revokeLeaseFile({file:fileA,fetchImpl,token,timeoutMs:100});
  assert.equal(active.has('secret-A'),false);
  assert.equal(active.has('secret-B'),true,'run A cleanup removed run B access');

  await revokeLeaseFile({file:fileB,fetchImpl,token,timeoutMs:100});
  assert.equal(active.size,0);
  assert.deepEqual(revocations,['secret-A','secret-B']);
}

console.log('Vercel bypass lease cleanup tests passed');
