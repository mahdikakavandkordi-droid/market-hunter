import fs from 'node:fs';
import path from 'node:path';
import {fetchWithTimeout} from '../lib/vercel-bypass-lease.js';

const token=process.env.VERCEL_TOKEN;
if(!token)throw new Error('VERCEL_TOKEN is required');
const registry=JSON.parse(fs.readFileSync(process.env.V2_DATASET_REGISTRY||'data/frozen/market-hunter-v2-numerical-snapshot/registry.json','utf8'));
const a=registry.artifact||{};
const timeoutMs=Math.max(1000,Number(process.env.VERCEL_HTTP_TIMEOUT_MS||15000));
const targetPrefix=process.env.VERCEL_BYPASS_NOTE_PREFIX||'MH cleanup probe ';
const output=process.env.VERCEL_RECONCILE_PROOF||'data/vercel-bypass-reconcile-proof.json';
const auth={Authorization:'Bearer '+token,'Content-Type':'application/json'};
const projectApi='https://api.vercel.com/v9/projects/'+encodeURIComponent(a.projectId)+'?teamId='+encodeURIComponent(a.teamId);
const bypassApi='https://api.vercel.com/v1/projects/'+encodeURIComponent(a.projectId)+'/protection-bypass?teamId='+encodeURIComponent(a.teamId);

async function req(url,opts={}){
  const r=await fetchWithTimeout(fetch,url,{...opts,headers:{...auth,...(opts.headers||{})}},timeoutMs);
  return {r,text:await r.text()};
}
async function state(){
  const {r,text}=await req(projectApi,{redirect:'follow'});
  if(!r.ok)throw new Error('GET project failed HTTP '+r.status);
  const j=JSON.parse(text);
  const entries=Object.entries(j.protectionBypass||{}).map(([secret,meta])=>({secret,meta}));
  return entries;
}
async function revoke(secret){
  const {r,text}=await req(bypassApi,{method:'PATCH',redirect:'follow',body:JSON.stringify({revoke:{secret,regenerate:false}})});
  if(!r.ok){
    let code=null,message=null;
    try{const j=JSON.parse(text);code=j?.error?.code||j?.code||null;message=j?.error?.message||j?.message||null}catch{}
    throw new Error('revoke matched bypass failed HTTP '+r.status+(code?' code='+code:'')+(message?' message='+message:''));
  }
}

const before=await state();
const targets=before.filter(x=>String(x.meta?.note||'').startsWith(targetPrefix));
const notes=targets.map(x=>String(x.meta?.note||''));
for(const x of targets)await revoke(x.secret);
const after=await state();
const remaining=after.filter(x=>String(x.meta?.note||'').startsWith(targetPrefix)).map(x=>String(x.meta?.note||''));
const proof={
  format:'market-hunter-vercel-bypass-reconcile-v1',
  targetPrefix,
  matchingBefore:targets.length,
  matchedNotes:notes,
  matchingAfter:remaining.length,
  remainingNotes:remaining,
  secretsLogged:false
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(proof,null,2)+'\n');
if(remaining.length)throw new Error('Matching probe bypass entries remain after reconciliation');
console.log('PASS: reconciled '+targets.length+' Market Hunter probe bypass entries; no matching entries remain');
