import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {fetchYahoo,normalizeYahoo,hash} from '../../v3/data.mjs';
import {pairedBootstrap,holm} from '../../v3/diagnostics.mjs';
import {extensionLedger,FEATURES} from './engine.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../../../');
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
export function scores(rows){return {n:rows.length,events:rows.reduce((s,r)=>s+r.actual,0),models:Object.fromEntries(Object.keys(FEATURES).map(k=>[k,{brier:mean(rows.map(r=>(r.probabilities[k]-r.actual)**2)),logLoss:mean(rows.map(r=>-r.actual*Math.log(r.probabilities[k])-(1-r.actual)*Math.log(1-r.probabilities[k]))),meanProbability:mean(rows.map(r=>r.probabilities[k])),eventRate:mean(rows.map(r=>r.actual)),bins:Array.from({length:5},(_,i)=>{const s=rows.filter(r=>Math.min(4,Math.floor(r.probabilities[k]*5))===i);return {lower:i/5,n:s.length,predicted:mean(s.map(r=>r.probabilities[k])),actual:mean(s.map(r=>r.actual))};})}]))};}
export function diagnostics(rows){
 if(!rows.length||rows.some((r,i)=>i&&r.t!==rows[i-1].t+1))throw Error('Invalid native forecast axis');
 return Object.fromEntries(['all','calm'].map(pop=>{
  const selected=pop==='all'?rows:rows.filter(r=>!r.currentHigh),s=scores(selected);
  const tests=[];
  for(const benchmark of ['level','full'])for(const candidate of Object.keys(FEATURES).filter(k=>k!=='level'&&k!==benchmark)){
   const d=rows.map(r=>pop==='calm'&&r.currentHigh?0:(r.probabilities[candidate]-r.actual)**2-(r.probabilities[benchmark]-r.actual)**2);
   const test=pairedBootstrap(d,{block:20,reps:9999});
   tests.push({candidate,benchmark,skill:100*(1-s.models[candidate].brier/s.models[benchmark].brier),...test,blockSensitivity:[10,40].map(block=>pairedBootstrap(d,{block,reps:9999}))});
  }
  return [pop,{...s,tests,byYear:Object.fromEntries([...new Set(rows.map(r=>r.date.slice(0,4)))].map(y=>[y,scores(selected.filter(r=>r.date.startsWith(y)))])),offsets:Array.from({length:10},(_,offset)=>({offset,...scores(selected.filter(r=>(r.t-rows[0].t)%10===offset))}))}];
 }));
}
export async function run(output,parent,replay=null,reuseInputs=false){
 await mkdir(output,{recursive:false});for(const d of ['source','inputs','raw','ledgers','fits'])await mkdir(path.join(output,d));
 const manifest={recordedAt:new Date().toISOString(),classification:'historical exploratory; no blind holdout; no tuning',files:{},errors:[],status:'incomplete'};
 const save=async(name,data)=>{const bytes=typeof data==='string'?data:JSON.stringify(data,null,2)+'\n';await writeFile(path.join(output,name),bytes,{flag:'wx'});manifest.files[name]=hash(bytes);};
 for(const name of ['PROTOCOL.md','engine.mjs','run.mjs'])await save('source/'+name,await readFile(path.join(here,name),'utf8'));
 for(const [name,relative] of [['risk-engine','../engine.mjs'],['base-engine','../../engine.mjs'],['data','../../v3/data.mjs'],['diagnostics','../../v3/diagnostics.mjs']])await save('source/'+name+'.mjs',await readFile(path.join(here,relative),'utf8'));
 const previous=replay?JSON.parse(await readFile(path.join(replay,'manifest.json'),'utf8')):null;
 if(previous){if(previous.status!=='complete')throw Error('Incomplete replay');for(const [name,h] of Object.entries(previous.files))if(hash(await readFile(path.join(replay,name)))!==h)throw Error('Replay hash mismatch '+name);if(!reuseInputs)for(const name of Object.keys(manifest.files))if(manifest.files[name]!==previous.files[name])throw Error('Replay source mismatch '+name);manifest.inputReuse={path:replay,manifestHash:hash(await readFile(path.join(replay,'manifest.json'))),strictSourceReplay:!reuseInputs};}
 const report={...manifest,markets:[],instrumentPolicy:'sector ETFs adjusted closes; broad indices raw closes',primaryFamily:[],secondaryFamily:[]};
 const specs=[{id:'tsx',symbol:'^GSPTSE'},{id:'sp500',symbol:'^GSPC'},...['XFN','XEG','XMA','XIT'].map(symbol=>({id:symbol.toLowerCase(),symbol:symbol+'.TO',type:'etf',priceField:'adjusted'}))];
 const parentManifest=JSON.parse(await readFile(path.join(parent,'manifest.json'),'utf8'));
 if(parentManifest.status!=='complete')throw Error('Incomplete source parent');
 await save('inputs/parent-manifest.json',JSON.stringify(parentManifest,null,2)+'\n');
 for(const spec of specs){
  let dataset=null;
  if(spec.type&&!previous){try{dataset=await fetchYahoo({...spec,id:'tsx'},{from:'2005-01-01',asof:'2026-10-13'});await save('raw/'+spec.id+'.json',dataset.raw);await save('inputs/'+spec.id+'-metadata.json',{spec,range:[dataset.bars[0].date,dataset.bars.at(-1).date],url:dataset.url,retrievedAt:dataset.retrievedAt,warnings:dataset.warnings,rejected:dataset.rejected,rawSha256:dataset.rawSha256,calendarOverride:'Canadian calendar via normalizer id=tsx'});}catch(e){manifest.errors.push({id:spec.id,error:e.message});console.error('DATA FAILED',spec.id,e.message);continue;}}
  if(spec.type&&previous){await save('raw/'+spec.id+'.json',await readFile(path.join(replay,'raw/'+spec.id+'.json'),'utf8'));await save('inputs/'+spec.id+'-metadata.json',await readFile(path.join(replay,'inputs/'+spec.id+'-metadata.json'),'utf8'));}
  for(const period of ['pre2020','post2020']){
   const name='inputs/'+period+'-'+spec.id+'.json';let bytes;
   if(previous)bytes=await readFile(path.join(replay,name),'utf8');
   else if(dataset)bytes=JSON.stringify(dataset.bars.filter(b=>period==='pre2020'?b.date<'2020-01-01':b.date>='2020-01-01'),null,2)+'\n';
   else{const original='inputs/'+period+'/'+spec.id+'.json';bytes=await readFile(path.join(parent,original),'utf8');if(hash(bytes)!==parentManifest.files[original])throw Error('Parent input hash mismatch');}
   await save(name,bytes);const bars=JSON.parse(bytes),ledger=extensionLedger(bars),metrics=diagnostics(ledger.records);
   await save('ledgers/'+period+'-'+spec.id+'.json',ledger.records);await save('fits/'+period+'-'+spec.id+'.json',ledger.fits);
   report.markets.push({spec,period,bars:bars.length,first:ledger.records[0].date,last:ledger.records.at(-1).date,metrics});
   console.log(period,spec.id,JSON.stringify(Object.fromEntries(metrics.all.tests.filter(t=>t.benchmark==='level').map(t=>[t.candidate,Number(t.skill.toFixed(2))]))));
  }
 }
 const items=report.markets.flatMap(m=>Object.entries(m.metrics).flatMap(([population,s])=>s.tests.map(t=>({id:m.spec.id,period:m.period,population,candidate:t.candidate,benchmark:t.benchmark,p:t.centeredTwoSidedP,skill:t.skill}))));
 report.primaryFamily=holm(items.filter(x=>x.benchmark==='level'));report.secondaryFamily=holm(items.filter(x=>x.benchmark==='full'));
 if(report.markets.length===12&&!manifest.errors.length)manifest.status='complete';report.status=manifest.status;report.errors=manifest.errors;
 await save('summary.json',report);await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const [output,parent,replay,flag]=process.argv.slice(2);run(output,parent,replay,flag==='--reuse-inputs').then(r=>{if(r.status!=='complete')process.exitCode=2;}).catch(e=>{console.error(e);process.exitCode=2;});}
