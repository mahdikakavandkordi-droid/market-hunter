import fs from 'node:fs';
import path from 'node:path';

export function bypassApiUrl({projectId,teamId}){
  if(!projectId||!teamId)throw new Error('Bypass lease requires projectId and teamId');
  return 'https://api.vercel.com/v1/projects/'+encodeURIComponent(projectId)+'/protection-bypass?teamId='+encodeURIComponent(teamId);
}
export async function fetchWithTimeout(fetchImpl,url,opts={},timeoutMs=15000){
  const controller=new AbortController(),external=opts.signal;
  let externalAbort=null;
  if(external){
    if(external.aborted)controller.abort(external.reason);
    else{externalAbort=()=>controller.abort(external.reason);external.addEventListener('abort',externalAbort,{once:true})}
  }
  const timer=setTimeout(()=>controller.abort(new Error('request timeout after '+timeoutMs+'ms')),timeoutMs);
  try{return await fetchImpl(url,{...opts,signal:controller.signal})}
  finally{clearTimeout(timer);if(external&&externalAbort)external.removeEventListener('abort',externalAbort)}
}
export function writeLeaseFile(file,lease){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(lease));fs.chmodSync(file,0o600)}
export function readLeaseFile(file){if(!fs.existsSync(file))return null;return JSON.parse(fs.readFileSync(file,'utf8'))}
export function removeLeaseFile(file){if(fs.existsSync(file))fs.unlinkSync(file)}
export async function revokeLease({fetchImpl=fetch,token,lease,timeoutMs=15000}){
  if(!lease?.secret)return {status:'noop',reason:'missing_secret'};
  if(!token)throw new Error('VERCEL_TOKEN is required for bypass cleanup');
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  async function patch(secret){
    const res=await fetchWithTimeout(fetchImpl,bypassApiUrl(lease),{method:'PATCH',redirect:'follow',headers,body:JSON.stringify({revoke:{secret,regenerate:false}})},timeoutMs);
    return {res,text:await res.text()};
  }
  let attempt=await patch(lease.secret);
  if(attempt.res.ok)return {status:'revoked',httpStatus:attempt.res.status,method:'exact_secret'};
  if(![400,404].includes(attempt.res.status)||!lease.note)throw new Error('Vercel bypass revoke failed HTTP '+attempt.res.status);
  const projectUrl='https://api.vercel.com/v9/projects/'+encodeURIComponent(lease.projectId)+'?teamId='+encodeURIComponent(lease.teamId);
  const stateRes=await fetchWithTimeout(fetchImpl,projectUrl,{redirect:'follow',headers},timeoutMs),stateText=await stateRes.text();
  if(!stateRes.ok)throw new Error('Vercel project-state lookup failed HTTP '+stateRes.status);
  const state=JSON.parse(stateText),matches=Object.entries(state.protectionBypass||{}).filter(([,meta])=>meta?.note===lease.note);
  if(matches.length===0)return {status:'noop',reason:'note_not_present_after_failed_exact_revoke'};
  if(matches.length!==1)throw new Error('Vercel bypass cleanup note is not unique');
  attempt=await patch(matches[0][0]);
  if(!attempt.res.ok)throw new Error('Vercel bypass resolved-note revoke failed HTTP '+attempt.res.status);
  return {status:'revoked',httpStatus:attempt.res.status,method:'resolved_unique_note'};
}
export async function revokeLeaseFile({file,fetchImpl=fetch,token,timeoutMs=15000,removeOnSuccess=true}){
  const lease=readLeaseFile(file);
  if(!lease)return {status:'noop',reason:'lease_file_missing'};
  const result=await revokeLease({fetchImpl,token,lease,timeoutMs});
  if(removeOnSuccess)removeLeaseFile(file);
  return result;
}
