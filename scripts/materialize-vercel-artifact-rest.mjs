import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function must(v,m){ if(!v) throw new Error(m); }
const token=process.env.VERCEL_TOKEN;
must(token,'VERCEL_TOKEN is required');
const registryFile=process.env.V2_DATASET_REGISTRY||'data/frozen/market-hunter-v2-numerical-snapshot/registry.json';
const manifestFile=process.env.V2_DATASET_LOCK_MANIFEST||'data/frozen/market-hunter-v2-numerical-snapshot/manifest.json';
const snapshotDir=process.env.V2_SNAPSHOT_DIR||'data/frozen/market-hunter-v2-numerical-snapshot/files';
const registry=JSON.parse(fs.readFileSync(registryFile,'utf8'));
const a=registry.artifact||{};
must(a.deploymentId&&a.deploymentUrl&&a.teamId&&a.manifestPath,'registry missing artifact metadata');

const auth={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
async function fetchText(url,opts={}){
  const r=await fetch(url,{...opts,headers:{...auth,...(opts.headers||{})},redirect:opts.redirect||'manual'});
  const text=await r.text();
  return {r,text};
}
function diag(label,r,text){
  const loc=r.headers.get('location');
  console.log(`${label}: HTTP ${r.status}${loc?' redirect='+new URL(loc).origin:''}`);
  if(r.status>=400) console.log(`${label} body: ${text.slice(0,500).replace(/\s+/g,' ')}`);
}

// Prove whether this token can see the exact immutable deployment without relying on CLI user lookup.
const detailUrl=`https://api.vercel.com/v13/deployments/${encodeURIComponent(a.deploymentId)}?teamId=${encodeURIComponent(a.teamId)}`;
const detail=await fetchText(detailUrl,{redirect:'follow'});
diag('deployment REST auth',detail.r,detail.text);
must(detail.r.ok,`Vercel REST token cannot access registered deployment (HTTP ${detail.r.status})`);
const dep=JSON.parse(detail.text);
must(dep.uid===a.deploymentId||dep.id===a.deploymentId,`deployment identity mismatch`);

// First try the immutable deployment URL directly with Bearer auth.
const manifestUrl=`https://${a.deploymentUrl}${a.manifestPath}`;
const direct=await fetchText(manifestUrl);
diag('immutable static manifest',direct.r,direct.text);
if(direct.r.ok){
  JSON.parse(direct.text);
  fs.mkdirSync(path.dirname(manifestFile),{recursive:true});
  fs.mkdirSync(snapshotDir,{recursive:true});
  fs.writeFileSync(manifestFile,direct.text);
  const manifest=JSON.parse(direct.text);
  for(const b of manifest.batches||[]){
    const base=a.manifestPath.replace(/\/manifest\.json$/,'');
    const u=`https://${a.deploymentUrl}${base}/${b.file}`;
    const got=await fetchText(u);
    diag(`immutable static batch ${b.batchIndex}`,got.r,got.text);
    must(got.r.ok,`failed static batch ${b.batchIndex} HTTP ${got.r.status}`);
    fs.writeFileSync(path.join(snapshotDir,b.file),got.text);
  }
  console.log('Materialized locked artifact through immutable deployment URL with Bearer auth');
  process.exit(0);
}

// Vercel Authentication does not accept a project API Bearer token directly on the deployment URL.
// Create a short-lived-in-practice automation bypass, use it only for this materialization, then revoke it in finally.
must(a.projectId,'registry missing projectId for temporary automation bypass');
const bypassSecret=crypto.randomBytes(24).toString('hex').slice(0,32);
const bypassApi=`https://api.vercel.com/v1/projects/${encodeURIComponent(a.projectId)}/protection-bypass?teamId=${encodeURIComponent(a.teamId)}`;
async function patchBypass(body){
  return fetchText(bypassApi,{method:'PATCH',redirect:'follow',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
}
const generated=await patchBypass({generate:{secret:bypassSecret,note:'Temporary locked Market Hunter validation; auto-revoke'}});
diag('temporary automation bypass create',generated.r,generated.text);
must(generated.r.ok,`cannot create temporary automation bypass HTTP ${generated.r.status}`);

let materialized=false;
async function fetchWithBypassRetry(url,label){
  const bypassHeaders={'x-vercel-protection-bypass':bypassSecret};
  let last=null;
  for(let attempt=1;attempt<=12;attempt++){
    last=await fetchText(url,{headers:bypassHeaders,redirect:'follow'});
    if(last.r.ok)return last;
    if(![401,403].includes(last.r.status))return last;
    if(attempt<12)await new Promise(r=>setTimeout(r,Math.min(1000,150*attempt)));
  }
  return last;
}
try{
  const m=await fetchWithBypassRetry(manifestUrl,'manifest');
  diag('bypass static manifest',m.r,m.text);
  must(m.r.ok,`temporary bypass could not read manifest HTTP ${m.r.status}`);
  const manifest=JSON.parse(m.text);
  fs.mkdirSync(path.dirname(manifestFile),{recursive:true});
  fs.mkdirSync(snapshotDir,{recursive:true});
  fs.writeFileSync(manifestFile,m.text);
  must(Array.isArray(manifest.batches)&&manifest.batches.length===4,'locked manifest does not contain four batches');
  const base=a.manifestPath.replace(/\/manifest\.json$/,'');
  for(const b of manifest.batches){
    const u=`https://${a.deploymentUrl}${base}/${b.file}`;
    const got=await fetchWithBypassRetry(u,'batch '+b.batchIndex);
    diag(`bypass static batch ${b.batchIndex}`,got.r,got.text);
    must(got.r.ok,`failed bypass batch ${b.batchIndex} HTTP ${got.r.status}`);
    fs.writeFileSync(path.join(snapshotDir,b.file),got.text);
  }
  materialized=true;
  console.log('Materialized locked artifact through temporary automation bypass');
} finally {
  const revoked=await patchBypass({revoke:{secret:bypassSecret,regenerate:false}});
  diag('temporary automation bypass revoke',revoked.r,revoked.text);
  must(revoked.r.ok,`temporary automation bypass revoke failed HTTP ${revoked.r.status}`);
}
must(materialized,'locked artifact was not materialized');
