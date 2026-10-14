import {CONFIG,riskFeatures,fitProbability,probability} from '../engine.mjs';
export const FEATURES=Object.freeze({level:[0],full:[0,1,2,3],acceleration:[0,1],shock:[0,2],downside:[0,3]});
export function extensionLedger(bars){
 const {rows,returns:r}=riskFeatures(bars),h=10,records=[],fits=[];
 const outcome=row=>+(Math.sqrt(r.slice(row.t+1,row.t+h+1).reduce((s,x)=>s+x*x,0)/h)>row.threshold);
 let models,last=-Infinity;
 for(const row of rows){
  if(row.t+h>=bars.length)break;
  const known=rows.filter(v=>v.t+h<=row.t);
  if(known.length<CONFIG.minTrain)continue;
  if(!models||row.t-last>=CONFIG.refit){
   models=Object.fromEntries(Object.entries(FEATURES).map(([key,indices])=>[key,fitProbability(known.map(v=>({x:indices.map(i=>v.x[i]),y:outcome(v)})))]));
   last=row.t;fits.push({date:row.date,n:known.length,lastTrainingOrigin:known.at(-1).date,lastTrainingLabelEnd:bars[known.at(-1).t+h].date,models});
  }
  records.push({t:row.t,date:row.date,currentHigh:row.currentHigh,threshold:row.threshold,features:row.x,actual:outcome(row),targetEnd:bars[row.t+h].date,fitDate:bars[last].date,probabilities:Object.fromEntries(Object.entries(FEATURES).map(([key,indices])=>[key,probability(models[key],indices.map(i=>row.x[i]))]))});
 }
 return {records,fits};
}
