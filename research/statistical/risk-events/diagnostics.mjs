import {CONFIG} from './engine.mjs';
import {pairedBootstrap} from '../v3/diagnostics.mjs';
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const brier=(r,k)=>(r.probabilities[k]-r.actual)**2;
function auc(rows,k){
 const ordered=rows.map(r=>({p:r.probabilities[k],y:r.actual})).sort((a,b)=>a.p-b.p);
 const pos=ordered.reduce((s,r)=>s+r.y,0),neg=ordered.length-pos;if(!pos||!neg)return null;
 let rankSum=0;for(let i=0;i<ordered.length;){let j=i+1;while(j<ordered.length&&ordered[j].p===ordered[i].p)j++;const rank=(i+1+j)/2;for(let n=i;n<j;n++)if(ordered[n].y)rankSum+=rank;i=j;}
 return (rankSum-pos*(pos+1)/2)/(pos*neg);
}
function scores(rows){
 const keys=['full','level','prior','state','ewmaGaussian','hardPersistence'];
 let episodes=0,lastPositiveT=null;
 for(const r of rows)if(r.actual){if(lastPositiveT!==r.t-1)episodes++;lastPositiveT=r.t;}
 return {n:rows.length,events:rows.reduce((s,r)=>s+r.actual,0),eventRate:mean(rows.map(r=>r.actual)),eventEpisodes:episodes,
  models:Object.fromEntries(keys.map(k=>[k,{brier:mean(rows.map(r=>brier(r,k))),logLoss:mean(rows.map(r=>{const p=Math.max(1e-12,Math.min(1-1e-12,r.probabilities[k]));return -r.actual*Math.log(p)-(1-r.actual)*Math.log(1-p);})),meanProbability:mean(rows.map(r=>r.probabilities[k])),auc:auc(rows,k),
   calibrationBins:Array.from({length:5},(_,i)=>{const items=rows.filter(r=>Math.min(4,Math.floor(r.probabilities[k]*5))===i);return {lower:i/5,upper:(i+1)/5,n:items.length,predicted:mean(items.map(r=>r.probabilities[k])),actual:mean(items.map(r=>r.actual))};}),
   alerts:CONFIG.alertCutoffs.map(cutoff=>{let tp=0,fp=0,fn=0,tn=0;for(const r of rows){const alert=r.probabilities[k]>=cutoff;if(alert&&r.actual)tp++;else if(alert)fp++;else if(r.actual)fn++;else tn++;}return {cutoff,tp,fp,fn,tn,alertRate:rows.length?(tp+fp)/rows.length:null,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,falsePositiveRate:fp+tn?fp/(fp+tn):null};})}]))};
}
export function summarizeRisk(records,{bootstrapReps=CONFIG.bootstrapReps}={}){
 return CONFIG.horizons.map(h=>{
  const rows=records.filter(r=>r.horizonBars===h);if(!rows.length)throw Error('Missing risk horizon '+h);
  if(rows.some((r,i)=>i&&r.t!==rows[i-1].t+1))throw Error('Noncontiguous native forecast axis');
  const all=scores(rows),calm=scores(rows.filter(r=>!r.currentHigh)),high=scores(rows.filter(r=>r.currentHigh));
  const tests=Object.fromEntries(['all','calm'].map(population=>{
   const differences=rows.map(r=>(population==='all'||!r.currentHigh)?brier(r,'full')-brier(r,'level'):0);
   return [population,{...pairedBootstrap(differences,{block:2*h,reps:bootstrapReps}),nativeAxisWeighted:population==='calm',selectedN:population==='all'?rows.length:calm.n,
    conditionalMeanDifference:population==='all'?all.models.full.brier-all.models.level.brier:calm.n?calm.models.full.brier-calm.models.level.brier:null,
    blockSensitivity:[h,4*h].map(block=>pairedBootstrap(differences,{block,reps:bootstrapReps}))}];
  }));
  const years=[...new Set(rows.map(r=>r.date.slice(0,4)))];
  const skills=population=>Object.fromEntries(['level','prior','state','ewmaGaussian','hardPersistence'].map(k=>[k,population.n&&population.models[k].brier>0?100*(1-population.models.full.brier/population.models[k].brier):null]));
  return {horizonBars:h,first:rows[0].date,last:rows.at(-1).date,all,calm,high,skillAll:skills(all),skillCalm:skills(calm),tests,
   byYear:Object.fromEntries(years.map(y=>{const subset=rows.filter(r=>r.date.startsWith(y));return [y,{all:scores(subset),calm:scores(subset.filter(r=>!r.currentHigh))}];})),
   allOffsets:Array.from({length:h},(_,offset)=>{const selected=rows.filter((_,i)=>i%h===offset);return {offset,all:scores(selected),calm:scores(selected.filter(r=>!r.currentHigh))};})};
 });
}
