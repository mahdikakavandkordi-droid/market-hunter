import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {hash,fetchYahoo} from '../../v3/data.mjs';
import {verifyState,advance} from './engine.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const SOURCES={
 'forward/PROTOCOL.md':'PROTOCOL.md','forward/engine.mjs':'engine.mjs','forward/run.mjs':'run.mjs',
 'risk-events/engine.mjs':'../engine.mjs','engine.mjs':'../../engine.mjs','v3/data.mjs':'../../v3/data.mjs'
};
export const SPECS=[{id:'sp500',symbol:'^GSPC',type:'index',priceField:'close'},{id:'xit',symbol:'XIT.TO',type:'etf',priceField:'adjusted'}];
export function summarize(state){
 const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
 const summary={classification:'prospective operational record; no trading signal',recordedAt:state.updatedAt,genesisHash:state.genesisHash,events:state.events.length,
  markets:Object.fromEntries(SPECS.map(({id})=>{
   const forecasts=state.events.filter(e=>e.kind==='forecast'&&e.market===id),outcomes=state.events.filter(e=>e.kind==='outcome'&&e.market===id),pairs=outcomes.map(o=>({...o,forecast:forecasts.find(f=>f.eventHash===o.forecastHash)}));
   const score=rows=>({n:rows.length,positive:rows.reduce((s,r)=>s+r.actual,0),models:Object.fromEntries(['full','level'].map(k=>[k,{brier:mean(rows.map(r=>(r.forecast.probabilities[k]-r.actual)**2)),logLoss:mean(rows.map(r=>-r.actual*Math.log(r.forecast.probabilities[k])-(1-r.actual)*Math.log(1-r.forecast.probabilities[k]))),meanProbability:mean(rows.map(r=>r.forecast.probabilities[k])),eventRate:mean(rows.map(r=>r.actual))}]))});
   let episodes=0,last=null;for(const o of pairs.sort((a,b)=>a.forecast.t-b.forecast.t)){if(o.actual){if(last!==o.forecast.t-1)episodes++;last=o.forecast.t;}}
   return [id,{lastObserved:state.markets[id].bars.at(-1).date,forecasts:forecasts.length,matured:outcomes.length,pending:forecasts.length-outcomes.length,missed:state.events.filter(e=>e.kind==='missed'&&e.market===id).length,positiveLabelEpisodes:episodes,lastForecast:forecasts.at(-1)?{date:forecasts.at(-1).date,probabilities:forecasts.at(-1).probabilities}:null,all:score(pairs),calm:score(pairs.filter(r=>!r.forecast.currentHigh))}];
  })),interpretation:'descriptive only; no sequential significance testing'};
 summary.endpointReady=Object.values(summary.markets).every(m=>m.matured>=504&&m.positiveLabelEpisodes>=30);
 summary.capReached=state.updatedAt?.slice(0,10)>='2029-10-14';return summary;
}
export async function run({output,input=null,seed=null,archive=null,fetcher=fetch}={}){
 if(!output||Boolean(input)===Boolean(seed))throw Error('One prior checkpoint OR seed bundle required; new output directory required');
 const sourceBytes={},sourceHashes={};for(const [name,relative] of Object.entries(SOURCES)){sourceBytes[name]=await readFile(path.join(here,relative),'utf8');sourceHashes[name]=hash(sourceBytes[name]);}
 const previousDir=input??seed,parentRaw=await readFile(path.join(previousDir,'manifest.json'),'utf8'),parent=JSON.parse(parentRaw);
 if(parent.status!=='complete')throw Error('Incomplete prior bundle');
 for(const [name,h] of Object.entries(parent.files)){
  const absolute=path.resolve(previousDir,name);if(!absolute.startsWith(path.resolve(previousDir)+path.sep))throw Error('Invalid prior path');
  if(hash(await readFile(absolute))!==h)throw Error('Prior evidence hash mismatch '+name);
 }
 let state;
 if(input){
  state=verifyState(JSON.parse(await readFile(path.join(input,'state.json'),'utf8')));
  if(JSON.stringify(state.genesis.sourceHashes)!==JSON.stringify(sourceHashes))throw Error('Frozen-source mismatch; no silent model upgrade');
 }else{
  const seedBars=Object.fromEntries(await Promise.all(SPECS.map(async spec=>{
   const bars=JSON.parse(await readFile(path.join(seed,'inputs/post2020-'+spec.id+'.json'),'utf8'));
   if(bars[0].date<'2020-01-01'||bars.at(-1).date!=='2026-10-13')throw Error('Wrong bootstrap range');
   return [spec.id,bars];
  })));
  const genesis={recordedAt:new Date().toISOString(),startOrigin:'2026-10-14',sourceHashes,seedManifestHash:hash(parentRaw),seedBars};
  state={schema:'risk-forward-v1',genesis,genesisHash:hash(JSON.stringify(genesis)),events:[],markets:Object.fromEntries(SPECS.map(s=>[s.id,{spec:s,bars:structuredClone(seedBars[s.id])}]))};
 }
 await mkdir(output,{recursive:false});for(const d of ['source','raw'])await mkdir(path.join(output,d));
 const manifest={schema:'risk-forward-checkpoint-v1',status:'incomplete',files:{},previousManifestHash:hash(parentRaw),sourceHashes};
 const save=async(name,data)=>{const bytes=typeof data==='string'?data:JSON.stringify(data,null,2)+'\n';await writeFile(path.join(output,name),bytes,{flag:'wx'});manifest.files[name]=hash(bytes);};
 for(const [name,bytes] of Object.entries(sourceBytes))await save('source/'+name.replaceAll('/','__'),bytes);
 if(input)for(const name of Object.keys(parent.files).filter(n=>n.startsWith('raw/'))){await copyFile(path.join(input,name),path.join(output,name));manifest.files[name]=parent.files[name];}
 const outcomes=[];
 if(input){
  for(const spec of SPECS){
   try{
    const now=new Date().toISOString(),asof=now.slice(0,10);
    // All Toronto instruments use the existing strict Canadian-calendar path.
    const data=await fetchYahoo({...spec,id:spec.id==='xit'?'tsx':spec.id},{from:'2020-01-01',asof,fetcher});
    if(JSON.parse(data.raw).chart.result[0].meta.symbol!==spec.symbol)throw Error('Provider symbol identity mismatch');
    const rawName='raw/'+spec.id+'-'+data.rawSha256+'.json';if(!manifest.files[rawName])await save(rawName,data.raw);
    const next=structuredClone(state),recordedAt=new Date().toISOString();
    const result=advance(next,spec.id,data.bars,{recordedAt,rawSha256:data.rawSha256});
    state=next;outcomes.push({market:spec.id,...result,retrievedAt:data.retrievedAt,rejected:data.rejected,warnings:data.warnings});
   }catch(e){outcomes.push({market:spec.id,status:'failed',error:e.message});}
  }
 }
 state.updatedAt=new Date().toISOString();verifyState(state);
 await save('state.json',state);await save('summary.json',{...summarize(state),iteration:outcomes,bootstrapOnly:!input});
 manifest.status='complete';manifest.dataStatus=outcomes.some(o=>o.status==='failed')?'partial-fetch-failure':'ok';
 await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 if(archive)execFileSync('python3',['-c','import pathlib,sys,zipfile; root=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"x",zipfile.ZIP_DEFLATED); [z.write(p,p.relative_to(root)) for p in root.rglob("*") if p.is_file()]; z.close()',path.resolve(output),path.resolve(archive)]);
 console.log(JSON.stringify({...summarize(state),iteration:outcomes,bootstrapOnly:!input},null,2));
 return {state,manifest};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),opt=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};
 run({output:opt('--output-dir'),input:opt('--input-bundle'),seed:opt('--seed-bundle'),archive:opt('--archive')}).catch(e=>{console.error(e);process.exitCode=2;});
}
