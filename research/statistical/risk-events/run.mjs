import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {MARKETS,hash} from '../v3/data.mjs';
import {holm} from '../v3/diagnostics.mjs';
import {CONFIG,riskLedger} from './engine.mjs';
import {summarizeRisk} from './diagnostics.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const sourceNames=['engine.mjs','diagnostics.mjs','run.mjs','PROTOCOL-2026-10-14.md','../engine.mjs','../v3/data.mjs','../v3/diagnostics.mjs'];
const sourcePath=name=>name.startsWith('../')?'source/'+name.slice(3):'source/risk-events/'+name;
async function verifiedParent(directory,period){
 const rawManifest=await readFile(path.join(directory,'manifest.json'),'utf8'),manifest=JSON.parse(rawManifest);
 if(manifest.status!=='complete')throw Error('Source parent is incomplete '+period);
 if(period==='pre2020'&&(manifest.schemaVersion!=='pre2020-v1'||manifest.asof!=='2019-12-31'))throw Error('Incorrect pre2020 vintage');
 if(period==='post2020'&&(manifest.schemaVersion!==3||manifest.from!=='2020-01-01'||manifest.asof!=='2026-10-13'))throw Error('Incorrect post2020 vintage');
 const root=path.resolve(directory);
 for(const [name,expected] of Object.entries(manifest.files)){
  const filename=path.resolve(root,name);if(!filename.startsWith(root+path.sep))throw Error('Invalid evidence file path');
  if(hash(await readFile(filename))!==expected)throw Error('Parent input hash mismatch '+period+' '+name);
 }
 return {rawManifest,manifest,sha256:hash(rawManifest)};
}
export async function runRisk({output,pre2020,post2020,input=null,bootstrapReps=CONFIG.bootstrapReps}={}){
 if(!output||(!input&&(!pre2020||!post2020)))throw Error('New output and both parent bundles (or exact replay) required');
 const sourceSha256={},sourceBytes={};
 for(const name of sourceNames){sourceBytes[name]=await readFile(path.join(here,name),'utf8');sourceSha256[name]=hash(sourceBytes[name]);}
 const recordedAt=new Date().toISOString();let gitParent=null;try{gitParent=execFileSync('git',['rev-parse','HEAD'],{cwd:here,encoding:'utf8'}).trim();}catch{}
 output=path.resolve(output);await mkdir(output,{recursive:false});
 for(const dir of ['source','source/risk-events','source/v3','inputs','inputs/pre2020','inputs/post2020','ledgers','fits'])await mkdir(path.join(output,dir));
 const manifest={schemaVersion:'risk-event-v1',recordedAt,gitParent,sourceSha256,config:CONFIG,bootstrapReps,files:{},parents:{},status:'incomplete'};
 const save=async(name,data)=>{const bytes=typeof data==='string'?data:JSON.stringify(data,null,2)+'\n';await writeFile(path.join(output,name),bytes,{flag:'wx'});manifest.files[name]=hash(bytes);};
 for(const name of sourceNames)await save(sourcePath(name),sourceBytes[name]);
 let previous=null;
 if(input){
  previous=JSON.parse(await readFile(path.join(input,'manifest.json'),'utf8'));
  if(previous.status!=='complete'||previous.schemaVersion!==manifest.schemaVersion)throw Error('Complete risk-event evidence required for replay');
  if(JSON.stringify(previous.sourceSha256)!==JSON.stringify(sourceSha256)||JSON.stringify(previous.config)!==JSON.stringify(CONFIG)||previous.bootstrapReps!==bootstrapReps)throw Error('Replay source/config mismatch');
  const root=path.resolve(input);
  for(const [name,expected] of Object.entries(previous.files)){
   const filename=path.resolve(root,name);if(!filename.startsWith(root+path.sep))throw Error('Invalid replay file path');
   if(hash(await readFile(filename))!==expected)throw Error('Risk replay hash mismatch '+name);
  }
 }
 const report={schemaVersion:manifest.schemaVersion,recordedAt,gitParent,classification:'NEW-TARGET EXPLORATORY ANALYSIS ON TWO ALREADY-INSPECTED HISTORICAL VINTAGES; NOT BLIND VALIDATION',config:CONFIG,sourceSha256,bootstrapReps,status:'incomplete',periods:{},errors:[],primaryFamilyDefinition:'36 h10 paired Brier comparisons vs calibrated one-feature level: nine markets, two periods, all/calm origin populations; Holm'};
 for(const period of ['pre2020','post2020']){
  const parent=previous?{rawManifest:await readFile(path.join(input,'inputs',period,'original-manifest.json'),'utf8'),...previous.parents[period]}:await verifiedParent(period==='pre2020'?pre2020:post2020,period);
  const metadata=JSON.parse(parent.rawManifest);manifest.parents[period]={sha256:hash(parent.rawManifest),sourceRange:{from:metadata.from,asof:metadata.asof}};
  await save('inputs/'+period+'/original-manifest.json',parent.rawManifest);
  report.periods[period]={sourceManifestSha256:manifest.parents[period].sha256,range:manifest.parents[period].sourceRange,markets:[]};
  for(const spec of MARKETS){
   try{
    const bytes=await readFile(path.join(previous?input:(period==='pre2020'?pre2020:post2020),previous?'inputs/'+period:'bars',spec.id+'.json'),'utf8');
    if(hash(bytes)!==metadata.files['bars/'+spec.id+'.json'])throw Error('Original normalized-bar hash mismatch');
    const ds=metadata.datasets[spec.id];if(JSON.stringify(ds.spec)!==JSON.stringify(spec))throw Error('Risk instrument identity mismatch');
    await save('inputs/'+period+'/'+spec.id+'.json',bytes);
    const bars=JSON.parse(bytes),ledger=riskLedger(bars),metrics=summarizeRisk(ledger.records,{bootstrapReps});
    if(metrics.length!==3||metrics.some(h=>Object.values(h.all.models).some(v=>!Number.isFinite(v.brier)||!Number.isFinite(v.logLoss))))throw Error('Incomplete/nonfinite risk metrics');
    await save('ledgers/'+period+'-'+spec.id+'.json',ledger.records);await save('fits/'+period+'-'+spec.id+'.json',ledger.fits);
    report.periods[period].markets.push({...spec,range:ds.range,barCount:bars.length,metrics,maxFitGradient:Math.max(...ledger.fits.flatMap(f=>[f.full.maxAbsGradient,f.level.maxAbsGradient]))});
    const main=metrics.find(h=>h.horizonBars===CONFIG.primaryHorizon);
    console.log('RISK '+period+' '+spec.id+' h10 Brier skill vs level all='+main.skillAll.level.toFixed(2)+'%, calm='+(main.skillCalm.level?.toFixed(2)??'NA')+'%; events='+main.all.events+'/'+main.all.n);
   }catch(e){report.errors.push({period,id:spec.id,error:e.message});console.error('RISK FAILED '+period+' '+spec.id+' '+e.message);}
  }
 }
 const family=Object.entries(report.periods).flatMap(([period,group])=>group.markets.flatMap(m=>{
  const main=m.metrics.find(h=>h.horizonBars===CONFIG.primaryHorizon);
  return ['all','calm'].map(population=>({period,id:m.id,population,horizonBars:CONFIG.primaryHorizon,selectedN:main.tests[population].selectedN,p:main.tests[population].selectedN?main.tests[population].centeredTwoSidedP:1,meanLossDifference:main.tests[population].meanLossDifference}));
 }));
 report.primaryFamilyHolm=family.length===36?holm(family):[];
 if(!report.errors.length&&family.length===36&&Object.values(report.periods).every(p=>p.markets.length===9))report.status=manifest.status='complete';
 await save('summary.json',report);await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),opt=(flag,def)=>{const i=args.indexOf(flag);return i<0?def:args[i+1];};
 try{const r=await runRisk({output:opt('--output-dir',null),pre2020:opt('--pre2020-bundle',null),post2020:opt('--post2020-bundle',null),input:opt('--input-bundle',null)});if(r.status!=='complete')process.exitCode=2;}
 catch(e){console.error(e.message);process.exitCode=2;}
}
