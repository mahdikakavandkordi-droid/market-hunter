import fs from 'node:fs';
import path from 'node:path';

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

// Fallback: inspect Vercel deployment file API. This also tells us whether the Git deployment tree exposes the generated snapshot files.
const filesUrl=`https://api.vercel.com/v6/deployments/${encodeURIComponent(a.deploymentId)}/files?teamId=${encodeURIComponent(a.teamId)}`;
const listed=await fetchText(filesUrl,{redirect:'follow'});
diag('deployment files REST auth',listed.r,listed.text);
must(listed.r.ok,`cannot list deployment files HTTP ${listed.r.status}`);
const tree=JSON.parse(listed.text);
const flat=[];
function walk(nodes,prefix=''){
  for(const n of nodes||[]){
    const p=prefix?prefix+'/'+n.name:n.name;
    flat.push({...n,path:p});
    if(Array.isArray(n.children)) walk(n.children,p);
  }
}
walk(tree);
const candidates=flat.filter(x=>/task3-numerical-snapshot\/(manifest\.json|batch-[0-3]\.json)$/.test(x.path));
console.log('deployment file tree entries='+flat.length+' targetMatches='+candidates.length);
for(const c of candidates) console.log('target file: '+c.path+' uid='+c.uid);
throw new Error('Immutable static URL requires Vercel Authentication and deployment file tree did not provide a completed materialization path. REST token itself is valid; use an account-scoped CLI token or a protection bypass secret.');
