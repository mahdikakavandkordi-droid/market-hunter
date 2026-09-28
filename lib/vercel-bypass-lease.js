import fs from 'node:fs';
import path from 'node:path';

export function bypassApiUrl({projectId,teamId}){
  if(!projectId||!teamId)throw new Error('Bypass lease requires projectId and teamId');
  return 'https://api.vercel.com/v1/projects/'+encodeURIComponent(projectId)+'/protection-bypass?teamId='+encodeURIComponent(teamId);
}

export async function fetchWithTimeout(fetchImpl,url,opts={},timeoutMs=15000){
  const controller=new AbortController();
  const external=opts.signal;
  let externalAbort=null;
  if(external){
    if(external.aborted)controller.abort(external.reason);
    else{
      externalAbort=()=>controller.abort(external.reason);
      external.addEventListener('abort',externalAbort,{once:true});
    }
  }
  const timer=setTimeout(()=>controller.abort(new Error('request timeout after '+timeoutMs+'ms')),timeoutMs);
  try{
    return await fetchImpl(url,{...opts,signal:controller.signal});
  }finally{
    clearTimeout(timer);
    if(external&&externalAbort)external.removeEventListener('abort',externalAbort);
  }
}

export function writeLeaseFile(file,lease){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(lease));
  fs.chmodSync(file,0o600);
}

export function readLeaseFile(file){
  if(!fs.existsSync(file))return null;
  return JSON.parse(fs.readFileSync(file,'utf8'));
}

export function removeLeaseFile(file){
  if(fs.existsSync(file))fs.unlinkSync(file);
}

export async function revokeLease({fetchImpl=fetch,token,lease,timeoutMs=15000}){
  if(!lease?.secret)return {status:'noop',reason:'missing_secret'};
  if(!token)throw new Error('VERCEL_TOKEN is required for bypass cleanup');
  const res=await fetchWithTimeout(fetchImpl,bypassApiUrl(lease),{
    method:'PATCH',
    redirect:'follow',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({revoke:{secret:lease.secret,regenerate:false}})
  },timeoutMs);
  const text=await res.text();
  if(!res.ok)throw new Error('Vercel bypass revoke failed HTTP '+res.status);
  return {status:'revoked',httpStatus:res.status,responseText:text};
}

export async function revokeLeaseFile({file,fetchImpl=fetch,token,timeoutMs=15000,removeOnSuccess=true}){
  const lease=readLeaseFile(file);
  if(!lease)return {status:'noop',reason:'lease_file_missing'};
  const result=await revokeLease({fetchImpl,token,lease,timeoutMs});
  if(removeOnSuccess)removeLeaseFile(file);
  return result;
}

export async function withCleanup({work,cleanup}){
  let workError=null;
  try{
    return await work();
  }catch(error){
    workError=error;
    throw error;
  }finally{
    try{
      await cleanup();
    }catch(cleanupError){
      if(workError)workError.cleanupError=cleanupError;
      else throw cleanupError;
    }
  }
}
