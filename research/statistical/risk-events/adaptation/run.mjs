import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash} from '../../v3/data.mjs';
import {pairedBootstrap,holm} from '../../v3/diagnostics.mjs';
import {adaptationLedger} from './engine.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export const COMPARISONS=[['rollingFull','expandingFull'],['rollingFull','rollingLevel'],['calibratedFull','expandingFull'],['calibratedFull','calibratedLevel']];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
export function scores(rows){
 const keys=['expandingFull','expandingLevel','rollingFull','rollingLevel','calibratedFull','calibratedLevel'];
 return {n:rows.length,events:rows.reduce((s,r)=>s+r.actual,0),models:Object.fromEntries(keys.map(k=>[k,{brier:mean(rows.map(r=>(r.probabilities[k]-r.actual)**2)),logLoss:mean(rows.map(r=>-r.actual*Math.log(r.probabilities[k])-(1-r.actual)*Math.log(1-r.probabilities[k]))),meanProbability:mean(rows.map(r=>r.probabilities[k])),eventRate:mean(rows.map(r=>r.actual)),bins:Array.from({length:5},(_,i)=>{const items=rows.filter(r=>Math.min(4,Math.floor(r.probabilities[k]*5))===i);return {lower:i/5,n:items.length,predicted:mean(items.map(r=>r.probabilities[k])),actual:mean(items.map(r=>r.actual))};})}]))};
}
export function summarize(rows){
 if(!rows.length||rows.some((r,i)=>i&&r.t!==rows[i-1].t+1))throw Error('Invalid native forecast axis');
 return Object.fromEntries(['all','calm'].map(population=>{
  const selected=rows.filter(r=>population==='all'||!r.currentHigh),s=scores(selected);
  const tests=COMPARISONS.map(([candidate,benchmark])=>{
   const d=rows.map(r=>population==='calm'&&r.currentHigh?0:(r.probabilities[candidate]-r.actual)**2-(r.probabilities[benchmark]-r.actual)**2);
   return {candidate,benchmark,skill:100*(1-s.models[candidate].brier/s.models[benchmark].brier),...pairedBootstrap(d,{block:20,reps:9999}),sensitivity:[10,40].map(block=>pairedBootstrap(d,{block,reps:9999}))};
  });
  return [population,{...s,tests,byYear:Object.fromEntries([...new Set(rows.map(r=>r.date.slice(0,4)))].map(y=>[y,scores(selected.filter(r=>r.date.startsWith(y)))])),offsets:Array.from({length:10},(_,offset)=>({offset,...scores(selected.filter(r=>(r.t-rows[0].t)%10===offset))}))}];
 }));
}
export async function run(output,input,replay=false){
 await mkdir(output,{recursive:false});for(const d of ['source','inputs','ledgers','fits'])await mkdir(path.join(output,d));
 const manifest={status:'incomplete',recordedAt:new Date().toISOString(),files:{},classification:'historical exploratory; frozen comparisons; no independent holdout'};
 const save=async(name,data)=>{const bytes=typeof data==='string'?data:JSON.stringify(data,null,2)+'\n';await writeFile(path.join(output,name),bytes,{flag:'wx'});manifest.files[name]=hash(bytes);};
 for(const [name,relative] of [['PROTOCOL.md','PROTOCOL.md'],['engine.mjs','engine.mjs'],['run.mjs','run.mjs'],['risk-engine.mjs','../engine.mjs'],['base-engine.mjs','../../engine.mjs'],['data.mjs','../../v3/data.mjs'],['diagnostics.mjs','../../v3/diagnostics.mjs']])await save('source/'+name,await readFile(path.join(here,relative),'utf8'));
 const original=await readFile(path.join(input,'manifest.json'),'utf8'),parent=JSON.parse(original);
 if(parent.status!=='complete')throw Error('Incomplete parent');
 for(const [name,h] of Object.entries(parent.files))if(hash(await readFile(path.join(input,name)))!==h)throw Error('Parent hash mismatch '+name);
 if(replay)for(const [name,h] of Object.entries(manifest.files))if(parent.files[name]!==h)throw Error('Replay source mismatch '+name);
 await save('inputs/parent-manifest.json',replay?await readFile(path.join(input,'inputs/parent-manifest.json'),'utf8'):original);
 const report={classification:manifest.classification,recordedAt:manifest.recordedAt,markets:[],family:[],status:'incomplete'};
 for(const period of ['pre2020','post2020'])for(const id of ['tsx','sp500','xfn','xeg','xma','xit']){
  const name='inputs/'+period+'-'+id+'.json',bytes=await readFile(path.join(input,name),'utf8');await save(name,bytes);
  const ledger=adaptationLedger(JSON.parse(bytes)),metrics=summarize(ledger.records);
  await save('ledgers/'+period+'-'+id+'.json',ledger.records);await save('fits/'+period+'-'+id+'.json',ledger.fits);
  report.markets.push({id,period,first:ledger.records[0].date,last:ledger.records.at(-1).date,metrics});
  console.log(period,id,JSON.stringify(metrics.all.tests.map(t=>({candidate:t.candidate,benchmark:t.benchmark,skill:+t.skill.toFixed(2)}))));
 }
 report.family=holm(report.markets.flatMap(m=>Object.entries(m.metrics).flatMap(([population,s])=>s.tests.map(t=>({id:m.id,period:m.period,population,candidate:t.candidate,benchmark:t.benchmark,skill:t.skill,p:t.centeredTwoSidedP})))));
 if(report.family.length!==96)throw Error('Incomplete test family');manifest.status=report.status='complete';
 await save('summary.json',report);await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const [output,input,flag]=process.argv.slice(2);run(output,input,flag==='--replay').catch(e=>{console.error(e);process.exitCode=2;});}
