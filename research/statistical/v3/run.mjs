import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {MARKETS,CONTEXTS,fetchYahoo,normalizeYahoo,hash} from './data.mjs';
import {CONFIG,volatilityLedger} from './models.mjs';
import {summarizeLedger,holm} from './diagnostics.mjs';
import {directionLedger,summarizeDirection} from './direction.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const sourceFiles=['data.mjs','models.mjs','diagnostics.mjs','direction.mjs','run.mjs','../engine.mjs','../phase2.mjs'];
async function sources(){return Object.fromEntries(await Promise.all(sourceFiles.map(async name=>[name,hash(await readFile(path.join(here,name)))])));}
export function assertComplete(report){
 if(report.errors.length||report.markets.length!==MARKETS.length||Object.keys(report.contexts).length!==CONTEXTS.length)throw Error('Incomplete research run');
 for(const m of report.markets){
  if(m.volatility.length!==3||m.direction.length!==3)throw Error('Missing required horizons '+m.id);
  for(const h of m.volatility)for(const values of Object.values(h.models))if(Object.values(values).some(v=>!Number.isFinite(v)))throw Error('Nonfinite volatility metrics '+m.id);
  for(const h of m.direction)if(!Number.isFinite(h.macroBrierSkillVsPricePct))throw Error('Nonfinite macro '+m.id);
 }
}
export async function runResearch({from='2020-01-01',asof='2026-10-13',output,input=null,replay=true,bootstrapReps=999,fetcher=fetch}={}){
 if(!output)throw Error('Explicit --output-dir required');
 output=path.resolve(output);
 // New directory required: do not overwrite an original or an earlier run.
 await mkdir(output,{recursive:false});
 for(const sub of ['raw','bars','ledgers','fits','source','source/v3'])await mkdir(path.join(output,sub));
 let codeCommit=null,workingTreeDirty=null;try{codeCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:here,encoding:'utf8'}).trim();workingTreeDirty=Boolean(execFileSync('git',['status','--porcelain'],{cwd:here,encoding:'utf8'}).trim());}catch{}
 const sourceSha256=await sources();
 const report={schemaVersion:3,generated:new Date().toISOString(),from,asOf:asof,classification:'EXPLORATORY historical replay; revised data vintage/specification; NOT blind validation',
  codeCommit,workingTreeDirty,sourceSha256,config:CONFIG,bootstrapReps,status:'incomplete',markets:[],contexts:{},errors:[],
  primaryExploratoryFamily:'harLog vs fixed EWMA; variance QLIKE; 9 markets x 3 horizons; Holm; no confirmatory claim',
  restrictions:'No trading, allocation, production calls or prospective schedule. Private raw-provider bundle; do not commit/rehost raw Yahoo bars.'};
 const manifest={schemaVersion:3,generated:report.generated,from,asof,codeCommit,workingTreeDirty,sourceSha256,config:CONFIG,bootstrapReps,files:{},datasets:{},status:'incomplete'};
 const save=async(name,content)=>{const bytes=typeof content==='string'?content:JSON.stringify(content,null,2)+'\n';await writeFile(path.join(output,name),bytes,{flag:'wx'});manifest.files[name]=hash(bytes);};
 let previous=null;
 if(input){
  previous=JSON.parse(await readFile(path.join(input,'manifest.json'),'utf8'));
  if(previous.schemaVersion!==3||previous.status!=='complete')throw Error('Replay requires complete v3 evidence');
  if(previous.from!==from||previous.asof!==asof)throw Error('Replay date range mismatch');
  if(previous.bootstrapReps!==bootstrapReps||JSON.stringify(previous.config)!==JSON.stringify(CONFIG))throw Error('Replay configuration mismatch');
  if(replay&&JSON.stringify(previous.sourceSha256)!==JSON.stringify(sourceSha256))throw Error('Replay source hashes differ; use --data-bundle for a separately labelled new experiment');
  for(const [name,expected] of Object.entries(previous.files))if(hash(await readFile(path.join(input,name)))!==expected)throw Error('Evidence hash mismatch '+name);
  report.inputManifestSha256=hash(await readFile(path.join(input,'manifest.json')));
  report.inputMode=replay?'exact-offline-replay':'new-code-on-preserved-data-vintage';
  manifest.parentManifestSha256=report.inputManifestSha256;
  manifest.inputMode=report.inputMode;
 }
 for(const name of sourceFiles)await save('source/'+(name.startsWith('../')?name.slice(3):'v3/'+name),await readFile(path.join(here,name),'utf8'));
 const loaded={};
 for(const spec of [...MARKETS,...CONTEXTS]){
  try{
   let data;
   if(previous){
    const meta=previous.datasets[spec.id],raw=await readFile(path.join(input,'raw',spec.id+'.json'),'utf8');
    if(!meta||JSON.stringify(meta.spec)!==JSON.stringify(spec))throw Error('Replay instrument identity mismatch');
    data={...normalizeYahoo(raw,spec,{from,asof,retrievedAt:meta.retrievedAt}),raw,url:meta.url,retrievedAt:meta.retrievedAt,rawSha256:hash(raw)};
    const saved=JSON.parse(await readFile(path.join(input,'bars',spec.id+'.json'),'utf8'));
    if(JSON.stringify(saved)!==JSON.stringify(data.bars))throw Error('Replay normalized bars mismatch '+spec.id);
   }else data=await fetchYahoo(spec,{from,asof,fetcher});
   await save('raw/'+spec.id+'.json',data.raw);
   await save('bars/'+spec.id+'.json',data.bars);
   manifest.datasets[spec.id]={spec,retrievedAt:data.retrievedAt,url:data.url,rawSha256:data.rawSha256,barCount:data.bars.length,
    range:[data.bars[0].date,data.bars.at(-1).date],timezone:data.timezone,adjustmentPolicy:data.adjustmentPolicy,sessionPolicy:data.sessionPolicy,rejected:data.rejected,warnings:data.warnings};
   loaded[spec.id]=data.bars;
   console.log('INPUT '+spec.id+' '+data.bars.length+' complete bars; '+data.rejected.length+' logged exclusions; '+data.warnings.length+' calendar warnings');
  }catch(e){
   const attempts=[];
   for(const [i,a] of (e.attempts??[]).entries()){
    const name='raw/'+spec.id+'-failed-attempt-'+i+'.json';if(a.raw!==null)await save(name,a.raw);
    attempts.push({host:a.host,error:a.error,retrievedAt:a.retrievedAt,url:a.url,file:a.raw!==null?name:null});
   }
   report.errors.push({stage:'input',id:spec.id,error:e.message,attempts});console.error('INPUT FAILED '+spec.id+' '+e.message);
  }
 }
 for(const spec of CONTEXTS)if(loaded[spec.id])report.contexts[spec.id]=manifest.datasets[spec.id];
 const contexts={vix:loaded.vix,us10y:loaded.us10y,dxy:loaded.dxy,oil:loaded.oil,spx:loaded.sp500};
 if(!Object.values(contexts).every(Boolean))report.errors.push({stage:'macro',error:'Required macro context incomplete; no successful-run classification permitted'});
 for(const spec of MARKETS){
  if(!loaded[spec.id])continue;
  try{
   const ledger=volatilityLedger(loaded[spec.id]);
   const volatility=summarizeLedger(ledger.records,{bootstrapReps});
   await save('ledgers/'+spec.id+'-volatility.json',ledger.records);
   await save('fits/'+spec.id+'-volatility.json',ledger.fits);
   if(!Object.values(contexts).every(Boolean))throw Error('Required direction contexts missing');
   const d=directionLedger(loaded[spec.id],contexts);
   await save('ledgers/'+spec.id+'-direction.json',d.records);
   await save('fits/'+spec.id+'-direction.json',d.fits);
   const gradients=d.fits.flatMap(f=>[f.priceGradient.maxAbsGradient,f.macroGradient.maxAbsGradient]);
   report.markets.push({...spec,barCount:loaded[spec.id].length,range:manifest.datasets[spec.id].range,volatility,direction:summarizeDirection(d.records),
    logisticDiagnostic:{maxAbsGradient:Math.max(...gradients),fitsOver1eMinus4:gradients.filter(v=>v>1e-4).length,n:gradients.length},macroSpecification:d.macroSpecification});
   console.log('SCORED '+spec.id+' volatility and matched direction; h20 HAR vs EWMA MSE '+volatility.find(v=>v.horizonBars===20).comparisons.ewma.volatilityMseSkillPct.toFixed(2)+'%');
  }catch(e){report.errors.push({stage:'evaluation',id:spec.id,error:e.message});console.error('EVALUATION FAILED '+spec.id+' '+e.message);}
 }
 const family=report.markets.flatMap(m=>m.volatility.map(v=>({id:m.id,horizonBars:v.horizonBars,p:v.comparisons.ewma.qlike.centeredTwoSidedP})));
 report.primaryFamilyHolm=family.length===27?holm(family):[];
 try{assertComplete(report);report.status='complete';manifest.status='complete';}catch(e){report.errors.push({stage:'completeness',error:e.message});}
 await save('summary.json',report);
 const lines=['# Research v3: exploratory volatility comparison','',`As of ${asof}; status ${report.status}. Original records are preserved separately.`,
  '', 'MSE skill is relative forecast-error reduction, NOT a portfolio return. Historical/bootstrap inference remains exploratory.',
  '', '| Market | h20 HAR vs vol20 MSE | vs EWMA MSE | vs GARCH MSE | QLIKE difference vs EWMA | 95% block interval |', '|---|---:|---:|---:|---:|---|'];
 for(const m of report.markets){const v=m.volatility.find(v=>v.horizonBars===20),c=v.comparisons;lines.push(`| ${m.id} | ${c.persistence20.volatilityMseSkillPct.toFixed(2)}% | ${c.ewma.volatilityMseSkillPct.toFixed(2)}% | ${c.garch.volatilityMseSkillPct.toFixed(2)}% | ${c.ewma.qlikeMeanDifference.toFixed(4)} | ${c.ewma.qlike.ci95.map(x=>x.toFixed(4)).join(', ')} |`);}
 lines.push('', 'Negative QLIKE differences favor HAR. Interval: circular block bootstrap, 999 replications by default, primary block length 2h; sensitivity h and 4h. Approximate stationarity is an assumption.',
  '', 'GARCH is a restricted variance-targeted zero-mean Gaussian GARCH(1,1), parameters estimated on a fixed grid within training data. HAR variance uses daily squared-close returns with 1/5/22 averages; it is not intraday HAR-RV.',
  '', 'Daily/annual losses, all non-overlap offsets, calibration, regime error tables and Holm results are in summary.json. Complete raw inputs, timestamps, fit snapshots and dated predictions are retained in this private evidence bundle.',
  '', 'No prospective collection or live allocation is activated.', '',...report.errors.map(e=>'- ERROR '+JSON.stringify(e)));
 await save('SUMMARY.md',lines.join('\n')+'\n');
 await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),opt=(flag,def)=>{const i=args.indexOf(flag);return i<0?def:args[i+1];};
 try{
  const exact=opt('--input-bundle',null),vintage=opt('--data-bundle',null);
  if(exact&&vintage)throw Error('Choose exact --input-bundle OR revised --data-bundle');
  const report=await runResearch({from:opt('--from','2020-01-01'),asof:opt('--asof','2026-10-13'),output:opt('--output-dir',null),input:exact??vintage,replay:!vintage});if(report.status!=='complete')process.exitCode=2;
 }
 catch(e){console.error(e.message);process.exitCode=2;}
}
