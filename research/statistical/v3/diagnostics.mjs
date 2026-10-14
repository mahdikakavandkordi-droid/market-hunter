const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const quantile=(sorted,p)=>{const i=(sorted.length-1)*p,j=Math.floor(i);return sorted[j]+(sorted[Math.min(j+1,sorted.length-1)]-sorted[j])*(i-j);};
export const LOSSES={
 volatilityMSE:(r,k)=>(r.forecasts[k]-r.actual)**2,
 volatilityMAE:(r,k)=>Math.abs(r.forecasts[k]-r.actual),
 varianceMSE:(r,k)=>(r.forecasts[k]**2-r.actualVariance)**2,
 qlike:(r,k)=>{const f=Math.max(1e-12,r.forecasts[k]**2);return Math.log(f)+r.actualVariance/f;}
};
// Fixed-seed circular moving-block bootstrap. CI/p-values are exploratory,
// require approximate stationarity and are not a blind-validation certificate.
export function pairedBootstrap(differences,{block=40,reps=999,seed=20261014}={}){
 const n=differences.length,observed=mean(differences),prefix=[0];
 const b=Math.min(block,n);
 for(let i=0;i<2*n;i++)prefix.push(prefix.at(-1)+differences[i%n]);
 const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 const estimates=[];
 for(let j=0;j<reps;j++){
  let sum=0,count=0;
  while(count<n){const start=Math.floor(rng()*n),len=Math.min(b,n-count);sum+=prefix[start+len]-prefix[start];count+=len;}
  estimates.push(sum/n);
 }
 const centeredP=(1+estimates.filter(x=>Math.abs(x-observed)>=Math.abs(observed)).length)/(reps+1);
 estimates.sort((a,b)=>a-b);
 return {n,blockLength:b,reps,meanLossDifference:observed,ci95:[quantile(estimates,.025),quantile(estimates,.975)],centeredTwoSidedP:centeredP,assumption:'circular block bootstrap; approximate stationarity; historical exploratory inference'};
}
export function holm(items){
 const ordered=items.map((x,i)=>({...x,index:i})).sort((a,b)=>a.p-b.p);let maximum=0;
 for(let i=0;i<ordered.length;i++){maximum=Math.max(maximum,Math.min(1,ordered[i].p*(ordered.length-i)));ordered[i].adjustedP=maximum;}
 return ordered.sort((a,b)=>a.index-b.index).map(({index,...x})=>x);
}
function score(rows,key){
 return Object.fromEntries(Object.entries(LOSSES).map(([name,fn])=>[name,mean(rows.map(r=>fn(r,key)))]));
}
function skill(model,baseline){return baseline>0?100*(1-model/baseline):null;}
export function summarizeLedger(records,{bootstrapReps=999}={}){
 if(!records.length)throw Error('No forecast records');
 const out=[];
 for(const h of [...new Set(records.map(r=>r.horizonBars))]){
  const rows=records.filter(r=>r.horizonBars===h),keys=Object.keys(rows[0].forecasts);
  if(rows.some((r,i)=>i&&r.t!==rows[i-1].t+1))throw Error('Noncontiguous evaluation origins: offset analysis needs native t');
  const models=Object.fromEntries(keys.map(k=>[k,score(rows,k)]));
  const comparisons={};
  for(const k of keys.filter(k=>k!=='harLog')){
   const differences=rows.map(r=>LOSSES.volatilityMSE(r,'harLog')-LOSSES.volatilityMSE(r,k));
   const q=rows.map(r=>LOSSES.qlike(r,'harLog')-LOSSES.qlike(r,k));
   comparisons[k]={volatilityMseSkillPct:skill(models.harLog.volatilityMSE,models[k].volatilityMSE),
    volatilityMaeSkillPct:skill(models.harLog.volatilityMAE,models[k].volatilityMAE),
    varianceMseSkillPct:skill(models.harLog.varianceMSE,models[k].varianceMSE),
    // QLIKE can be negative; ratio skills on this additive loss are meaningless.
    qlikeMeanDifference:mean(q),volatilityMSE:pairedBootstrap(differences,{block:2*h,reps:bootstrapReps}),
    qlike:pairedBootstrap(q,{block:2*h,reps:bootstrapReps}),
    blockSensitivity:[h,4*h].map(block=>pairedBootstrap(q,{block,reps:bootstrapReps})),
    allOffsets:Array.from({length:h},(_,offset)=>{
     const selected=rows.filter((_,i)=>i%h===offset),a=score(selected,'harLog'),b=score(selected,k);
     return {offset,n:selected.length,volatilityMseSkillPct:skill(a.volatilityMSE,b.volatilityMSE),qlikeMeanDifference:a.qlike-b.qlike};
    })};
  }
  const years=[...new Set(rows.map(r=>r.date.slice(0,4)))];
  const grouped=items=>({n:items.length,models:Object.fromEntries(keys.map(k=>[k,score(items,k)]))});
  const byYear=Object.fromEntries(years.map(y=>[y,grouped(rows.filter(r=>r.date.startsWith(y)))]));
  const leaveOneYearOut=Object.fromEntries(years.map(y=>[y,grouped(rows.filter(r=>!r.date.startsWith(y)))]));
  const regimes=[...new Set(rows.map(r=>r.regime))];
  const byRegime=Object.fromEntries(regimes.map(regime=>{
   const items=rows.filter(r=>r.regime===regime);let episodes=0,previous=null;
   for(const r of rows){if(r.regime===regime&&previous!==regime)episodes++;previous=r.regime;}
   return [regime,{...grouped(items),episodes}];
  }));
  const calibration=Object.fromEntries(keys.map(k=>{
   const x=rows.map(r=>r.forecasts[k]),y=rows.map(r=>r.actual),mx=mean(x),my=mean(y);
   const denom=mean(x.map(v=>(v-mx)**2)),slope=denom>0?mean(x.map((v,i)=>(v-mx)*(y[i]-my)))/denom:null;
   const edges=[0,.005,.01,.02,.04,.08,Infinity];
   const bins=edges.slice(0,-1).map((lower,i)=>{
    const selected=rows.filter(r=>r.forecasts[k]>=lower&&r.forecasts[k]<edges[i+1]);
    return {lower,upper:Number.isFinite(edges[i+1])?edges[i+1]:null,n:selected.length,meanForecast:selected.length?mean(selected.map(r=>r.forecasts[k])):null,meanActual:selected.length?mean(selected.map(r=>r.actual)):null};
   });
   const high=rows.filter(r=>r.actual>.02);
   return [k,{meanForecast:mx,meanActual:my,meanError:mx-my,descriptiveSlope:slope,descriptiveIntercept:slope===null?null:my-slope*mx,
    underpredictionRate:mean(x.map((v,i)=>+(v<y[i]))),highRealizedDailyRmsThreshold:.02,highRiskN:high.length,
    highRiskUnderpredictionRate:high.length?mean(high.map(r=>+(r.forecasts[k]<r.actual))):null,bins,
    interpretation:'descriptive; fixed absolute bins; no fitted recalibration or significance claim'}];
  }));
  out.push({horizonBars:h,n:rows.length,first:rows[0].date,last:rows.at(-1).date,models,comparisons,byYear,leaveOneYearOut,byRegime,calibration});
 }
 return out;
}
