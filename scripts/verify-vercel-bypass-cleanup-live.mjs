import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  fetchWithTimeout,writeLeaseFile,revokeLeaseFile,revokeLease
} from '../lib/vercel-bypass-lease.js';

const token=process.env.VERCEL_TOKEN;
if(!token)throw new Error('VERCEL_TOKEN is required');
const registryFile=process.env.V2_DATASET_REGISTRY||'data/frozen/market-hunter-v2-numerical-snapshot/registry.json';
const outputFile=process.env.VERCEL_BYPASS_PROOF||'data/vercel-bypass-cleanup-proof.json';
const timeoutMs=Math.max(1000,Number(process.env.VERCEL_HTTP_TIMEOUT_MS||15000));
const registry=JSON.parse(fs.readFileSync(registryFile,'utf8'));
const a=registry.artifact||{};
if(!a.projectId||!a.teamId||!a.deploymentUrl||!a.manifestPath)throw new Error('registry missing Vercel artifact metadata');

const auth={Authorization:'Bearer '+token,'Content-Type':'application/json'};
const projectApi='https://api.vercel.com/v9/projects/'+encodeURIComponent(a.projectId)+'?teamId='+encodeURIComponent(a.teamId);
const bypassApi='https://api.vercel.com/v1/projects/'+encodeURIComponent(a.projectId)+'/protection-bypass?teamId='+encodeURIComponent(a.teamId);
const manifestUrl='https://'+a.deploymentUrl+a.manifestPath;
const runId=process.env.GITHUB_RUN_ID||'local';
const prefix='MH cleanup probe '+runId;

async function req(url,opts={}){
  const r=await fetchWithTimeout(fetch,url,{...opts,headers:{...auth,...(opts.headers||{})}},timeoutMs);
  const text=await r.text();
  return {r,text};
}
async function patch(body){
  return req(bypassApi,{method:'PATCH',body:JSON.stringify(body),redirect:'follow'});
}
function parseJson(text){try{return JSON.parse(text)}catch{return null}}
async function listNotes(){
  const {r,text}=await req(projectApi,{redirect:'follow'});
  if(!r.ok)throw new Error('GET project failed HTTP '+r.status);
  const j=parseJson(text)||{};
  const entries=Object.values(j.protectionBypass||{});
  return entries.map(x=>typeof x?.note==='string'?x.note:null).filter(Boolean);
}
async function generate(secret,note){
  const {r}=await patch({generate:{secret,note}});
  if(!r.ok)throw new Error('generate bypass failed HTTP '+r.status);
}
async function verifyAccess(secret,expectOk){
  let last=null;
  for(let i=0;i<15;i++){
    const r=await fetchWithTimeout(fetch,manifestUrl,{
      redirect:'manual',
      headers:{'x-vercel-protection-bypass':secret}
    },timeoutMs);
    last=r;
    if(expectOk&&r.ok)return true;
    if(!expectOk&&(r.status===401||r.status===403||r.status===302))return true;
    await new Promise(res=>setTimeout(res,200+100*i));
  }
  throw new Error('bypass access expectation failed; last HTTP '+last?.status);
}
function secret(){return crypto.randomBytes(24).toString('hex').slice(0,32)}

const proof={
  format:'market-hunter-vercel-bypass-cleanup-proof-v1',
  runId,
  priorValidationRunId:36420714736,
  staleBefore:{checked:false,matchingNotes:[]},
  concurrency:{aWorked:false,bWorked:false,aRevoked:false,bSurvivedA:false,bRevoked:false},
  cancellationFallback:{created:false,leaseWritten:false,revoked:false,blockedAfterCleanup:false},
  finalState:{checked:false,probeNotesRemaining:[]},
  noSecretsLogged:true
};

const secrets=[];
const cleanup=[];
try{
  const before=await listNotes();
  proof.staleBefore.checked=true;
  proof.staleBefore.matchingNotes=before.filter(n=>
    n.includes('Temporary locked Market Hunter validation')||
    n.includes('Market Hunter locked validation run 36420714736')
  );

  const aSecret=secret(),bSecret=secret();
  secrets.push(aSecret,bSecret);
  const noteA=prefix+' A',noteB=prefix+' B';
  await generate(aSecret,noteA); cleanup.push({secret:aSecret,projectId:a.projectId,teamId:a.teamId});
  await generate(bSecret,noteB); cleanup.push({secret:bSecret,projectId:a.projectId,teamId:a.teamId});
  await verifyAccess(aSecret,true); proof.concurrency.aWorked=true;
  await verifyAccess(bSecret,true); proof.concurrency.bWorked=true;

  await revokeLease({token,lease:{secret:aSecret,projectId:a.projectId,teamId:a.teamId},timeoutMs});
  proof.concurrency.aRevoked=true;
  cleanup.splice(cleanup.findIndex(x=>x.secret===aSecret),1);
  await verifyAccess(aSecret,false);
  await verifyAccess(bSecret,true); proof.concurrency.bSurvivedA=true;

  await revokeLease({token,lease:{secret:bSecret,projectId:a.projectId,teamId:a.teamId},timeoutMs});
  proof.concurrency.bRevoked=true;
  cleanup.splice(cleanup.findIndex(x=>x.secret===bSecret),1);
  await verifyAccess(bSecret,false);

  // Simulated hard-cancellation fallback: process-level finally is intentionally skipped.
  // The independent cleanup command's exact-secret lease-file path is exercised directly.
  const cSecret=secret(); secrets.push(cSecret);
  const noteC=prefix+' cancellation-fallback';
  await generate(cSecret,noteC);
  proof.cancellationFallback.created=true;
  cleanup.push({secret:cSecret,projectId:a.projectId,teamId:a.teamId});
  const leaseFile=path.join('.tmp','probe-cancellation-'+runId+'.json');
  writeLeaseFile(leaseFile,{secret:cSecret,projectId:a.projectId,teamId:a.teamId,runId,note:noteC});
  proof.cancellationFallback.leaseWritten=true;
  await verifyAccess(cSecret,true);
  await revokeLeaseFile({file:leaseFile,token,timeoutMs});
  proof.cancellationFallback.revoked=true;
  cleanup.splice(cleanup.findIndex(x=>x.secret===cSecret),1);
  await verifyAccess(cSecret,false);
  proof.cancellationFallback.blockedAfterCleanup=true;

  const after=await listNotes();
  proof.finalState.checked=true;
  proof.finalState.probeNotesRemaining=after.filter(n=>n.startsWith(prefix));
} finally {
  for(const lease of cleanup){
    try{await revokeLease({token,lease,timeoutMs})}catch{}
  }
  fs.mkdirSync(path.dirname(outputFile),{recursive:true});
  fs.writeFileSync(outputFile,JSON.stringify(proof,null,2)+'\n');
}

if(proof.staleBefore.matchingNotes.length){
  throw new Error('Stale Market Hunter validation automation bypass entries were present before probe: '+proof.staleBefore.matchingNotes.join(' | '));
}
if(!proof.concurrency.aWorked||!proof.concurrency.bWorked||!proof.concurrency.aRevoked||!proof.concurrency.bSurvivedA||!proof.concurrency.bRevoked){
  throw new Error('Concurrent bypass isolation proof failed');
}
if(!proof.cancellationFallback.revoked||!proof.cancellationFallback.blockedAfterCleanup){
  throw new Error('Cancellation fallback cleanup proof failed');
}
if(proof.finalState.probeNotesRemaining.length){
  throw new Error('Probe bypass notes remain after cleanup');
}
console.log('PASS: live Vercel bypass cleanup and concurrency isolation verified; no probe bypass remains');
