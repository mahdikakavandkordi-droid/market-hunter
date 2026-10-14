import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {MARKETS,fetchYahoo,normalizeYahoo,hash} from './data.mjs';
import {CONFIG,volatilityLedger} from './models.mjs';
import {summarizeLedger,holm} from './diagnostics.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const sourceFiles=['data.mjs','models.mjs','diagnostics.mjs','replicate-pre2020.mjs','PRE2020-PROTOCOL-2026-10-14.md'];
const fixedHashes={
 'models.mjs':'b4ba9a7e31c45d2947dec55eebad2e05d1b111d5398299296b6a745ba781452a',
 'diagnostics.mjs':'cf69b45cb525efa97c39883a09b9b85de2020bce5ea9c1a30236739338fde03f'
};
export async function replicate({output,input=null,fetcher=fetch}={}){
 if(!output)throw Error('Explicit output directory required');
 const from='2005-01-01',asof='2019-12-31',sourceSha256={};
 const sources={};
 for(const name of sourceFiles){sources[name]=await readFile(path.join(here,name),'utf8');sourceSha256[name]=hash(sources[name]);if(fixedHashes[name]&&fixedHashes[name]!==sourceSha256[name])throw Error('Frozen algorithm hash mismatch '+name);}
 const protocolRecordedAt=new Date().toISOString();
 output=path.resolve(output);await mkdir(output,{recursive:false});
 for(const dir of ['source','raw','bars','ledgers','fits'])await mkdir(path.join(output,dir));
 let gitParent=null;try{gitParent=execFileSync('git',['rev-parse','HEAD'],{cwd:here,encoding:'utf8'}).trim();}catch{}
 const manifest={schemaVersion:'pre2020-v1',classification:'EXTERNAL HISTORICAL REPLICATION; not prospective blind validation',from,asof,protocolRecordedAt,gitParent,sourceSha256,config:CONFIG,files:{},datasets:{},status:'incomplete'};
 const save=async(name,data)=>{const bytes=typeof data==='string'?data:JSON.stringify(data,null,2)+'\n';await writeFile(path.join(output,name),bytes,{flag:'wx'});manifest.files[name]=hash(bytes);};
 // Protocol and frozen algorithm bytes are committed to the evidence BEFORE fetch.
 for(const [name,bytes] of Object.entries(sources))await save('source/'+name,bytes);
 let previous=null;
 if(input){
  previous=JSON.parse(await readFile(path.join(input,'manifest.json'),'utf8'));
  if(previous.schemaVersion!==manifest.schemaVersion||previous.status!=='complete')throw Error('Complete matching replication bundle required');
  if(JSON.stringify(previous.sourceSha256)!==JSON.stringify(sourceSha256))throw Error('Replay code/protocol hash mismatch');
  for(const [name,expected] of Object.entries(previous.files))if(hash(await readFile(path.join(input,name)))!==expected)throw Error('Replay evidence hash mismatch '+name);
  manifest.parentManifestSha256=hash(await readFile(path.join(input,'manifest.json')));
 }
 const report={schemaVersion:manifest.schemaVersion,classification:manifest.classification,from,asOf:asof,protocolRecordedAt,sourceSha256,config:CONFIG,status:'incomplete',markets:[],errors:[],
  primaryFamily:'unchanged harLog vs EWMA variance QLIKE; 9 markets x 3 horizons; Holm; exploratory',directionAndMacro:'not run; frozen',portfolioPerformance:'not evaluated'};
 for(const spec of MARKETS){
  try{
   let d;
   if(previous){
    const meta=previous.datasets[spec.id],raw=await readFile(path.join(input,'raw',spec.id+'.json'),'utf8');
    if(JSON.stringify(meta.spec)!==JSON.stringify(spec))throw Error('Instrument identity mismatch');
    d={...normalizeYahoo(raw,spec,{from,asof,retrievedAt:meta.retrievedAt}),raw,url:meta.url,retrievedAt:meta.retrievedAt,rawSha256:hash(raw)};
    if(JSON.stringify(d.bars)!==await readFile(path.join(input,'bars',spec.id+'.json'),'utf8').then(s=>JSON.stringify(JSON.parse(s))))throw Error('Normalized replay bars mismatch');
   }else d=await fetchYahoo(spec,{from,asof,fetcher});
   await save('raw/'+spec.id+'.json',d.raw);await save('bars/'+spec.id+'.json',d.bars);
   manifest.datasets[spec.id]={spec,url:d.url,retrievedAt:d.retrievedAt,rawSha256:d.rawSha256,range:[d.bars[0].date,d.bars.at(-1).date],barCount:d.bars.length,timezone:d.timezone,rejected:d.rejected,warnings:d.warnings,sessionPolicy:d.sessionPolicy,calendar:d.calendar};
   console.log('INPUT '+spec.id+' '+d.bars.length+' bars '+d.bars[0].date+'..'+d.bars.at(-1).date);
   const ledger=volatilityLedger(d.bars),volatility=summarizeLedger(ledger.records);
   if(volatility.length!==3||volatility.some(v=>Object.values(v.models).some(x=>Object.values(x).some(a=>!Number.isFinite(a)))))throw Error('Incomplete/nonfinite evaluation');
   await save('ledgers/'+spec.id+'.json',ledger.records);await save('fits/'+spec.id+'.json',ledger.fits);
   report.markets.push({...spec,range:manifest.datasets[spec.id].range,barCount:d.bars.length,volatility});
   console.log('SCORE '+spec.id+' h20 MSE vs EWMA '+volatility.at(-1).comparisons.ewma.volatilityMseSkillPct.toFixed(2)+'%');
  }catch(e){
   const attempts=[];for(const [i,a] of (e.attempts??[]).entries()){
    const name='raw/'+spec.id+'-failed-'+i+'.json';if(a.raw!==null)await save(name,a.raw);
    attempts.push({host:a.host,error:a.error,retrievedAt:a.retrievedAt,file:a.raw!==null?name:null});
   }
   report.errors.push({id:spec.id,error:e.message,attempts});console.error('FAILED '+spec.id+' '+e.message);
  }
 }
 const family=report.markets.flatMap(m=>m.volatility.map(v=>({id:m.id,horizonBars:v.horizonBars,p:v.comparisons.ewma.qlike.centeredTwoSidedP})));
 report.primaryFamilyHolm=family.length===27?holm(family):[];
 if(report.errors.length===0&&report.markets.length===9&&family.length===27)report.status=manifest.status='complete';
 await save('summary.json',report);
 await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),opt=(flag,def)=>{const i=args.indexOf(flag);return i<0?def:args[i+1];};
 try{const r=await replicate({output:opt('--output-dir',null),input:opt('--input-bundle',null)});if(r.status!=='complete')process.exitCode=2;}
 catch(e){console.error(e.message);process.exitCode=2;}
}
