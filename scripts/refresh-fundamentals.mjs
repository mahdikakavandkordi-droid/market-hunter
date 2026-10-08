// Bounded public SEC collection. No portfolio, scanner or paper-engine mutations.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PILOT,chooseFiling} from '../lib/fundamental-pilot.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args=process.argv.slice(2),arg=(name,fallback)=>{const index=args.indexOf(name);return index<0?fallback:args[index+1]};
const asOf=arg('--as-of',new Date().toISOString()),userAgent=arg('--user-agent',process.env.SEC_USER_AGENT);
if(!Number.isFinite(Date.parse(asOf))||!asOf.includes('T'))throw new Error('Invalid collection cutoff');
if(!userAgent||userAgent.length<15)throw new Error('Set an identifying SEC_USER_AGENT with a real application/contact URL');
const cache=path.resolve(arg('--cache',path.join(root,'../fundamental-source-cache')));
const input=path.resolve(arg('--inputs',path.join(root,'data/fundamentals/inputs')));
const output=path.resolve(arg('--output',path.join(root,'data/research/fundamental-pilot')));
await fs.mkdir(cache,{recursive:true});await fs.mkdir(input,{recursive:true});
const checks={},selections={};let lastRequest=0;
async function fetchSource(url){
 const elapsed=Date.now()-lastRequest;if(elapsed<500)await new Promise(resolve=>setTimeout(resolve,500-elapsed));
 lastRequest=Date.now();
 return execFileSync('python3',[path.join(root,'scripts/fetch-fundamental-source.py'),url,userAgent],{encoding:'utf8',timeout:25000,maxBuffer:25*1024*1024});
}
let scan={};try{scan=JSON.parse(await fs.readFile(path.join(root,'data/v2-latest-scan.json'),'utf8'));}catch{}
const targets=new Set([...PILOT.map(x=>x.symbol),...(scan.integratedSurfacePicks??[]).map(x=>x.symbol)]);
for(const spec of PILOT.filter(x=>targets.has(x.symbol))){
 const symbol=spec.symbol.split('.')[0],checkedAt=new Date().toISOString();
 try{
  const raw=await fetchSource(`https://data.sec.gov/submissions/CIK${spec.cik}.json`);
  const submissions=JSON.parse(raw),filing=chooseFiling(submissions,spec,asOf);
  let existing=null;try{existing=JSON.parse(await fs.readFile(path.join(input,`${symbol}.json`),'utf8'));}catch{}
  // Retry incomplete reconciliation, even when accession did not change.
  let prior=null;try{const report=JSON.parse(await fs.readFile(path.join(output,'latest.json'),'utf8'));prior=report.snapshots.find(x=>x.symbol===spec.symbol);}catch{}
  if(existing?.proofs?.accession===filing.accession&&prior?.filing.accession===filing.accession&&prior.status==='complete'){
   checks[spec.symbol]={status:'unchanged',checkedAt,accession:filing.accession,reportDate:filing.reportDate};continue;
  }
  checks[spec.symbol]={status:'pending',checkedAt,accession:filing.accession,reportDate:filing.reportDate};
  const facts=await fetchSource(`https://data.sec.gov/api/xbrl/companyfacts/CIK${spec.cik}.json`);
  const html=await fetchSource(filing.url);
  await fs.writeFile(path.join(cache,`${symbol}-submissions.json`),raw);
  await fs.writeFile(path.join(cache,`${symbol}-facts.json`),facts);
  await fs.writeFile(path.join(cache,`${symbol}-filing.html`),html);
  selections[symbol]={...filing,asOf,retrievedAt:new Date().toISOString()};
  await fs.writeFile(path.join(cache,'selection.json'),JSON.stringify(selections));
  execFileSync('python3',[path.join(root,'scripts/prepare-fundamental-fixtures.py'),cache,input,symbol],{stdio:'pipe'});
  checks[spec.symbol].status='collected';
 }catch(error){checks[spec.symbol]={...checks[spec.symbol],status:'failed',checkedAt,reason:error.message.split('\n')[0]};}
}
await fs.mkdir(path.join(root,'data/fundamentals'),{recursive:true});
await fs.writeFile(path.join(root,'data/fundamentals/source-checks.json'),JSON.stringify(checks,null,2)+'\n');
execFileSync(process.execPath,[path.join(root,'scripts/build-fundamental-pilot.mjs'),input,output,asOf],{cwd:root,stdio:'inherit'});
console.log(JSON.stringify({asOf,checks}));
