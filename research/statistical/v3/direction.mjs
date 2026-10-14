import {makeFeatures,train,predict} from '../engine.mjs';
import {macroFeatures} from '../phase2.mjs';
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
function gradient(model,rows,lambda){
 const g=Array(model.logistic.length).fill(0);
 for(const row of rows){const p=predict(model,row.x).probabilityUp,y=+(row.y>0),x=[1,...row.x.map((v,j)=>(v-model.mu[j])/model.sd[j])];
  for(let j=0;j<x.length;j++)g[j]+=(p-y)*x[j];
 }
 for(let j=1;j<g.length;j++)g[j]+=lambda*model.logistic[j];
 return {maxAbsGradient:Math.max(...g.map(Math.abs)),convergenceRecordedByLegacy:false};
}
export function directionLedger(bars,contexts,{horizons=[5,10,20],minTrain=252,refit=21,lambda=20}={}){
 const own=makeFeatures(bars),rows=own.map(r=>{
  const macro=macroFeatures(r.date,contexts),macroAsOf={};
  if(macro)for(const [key,series] of Object.entries(contexts)){
   const latest=series.findLast(b=>b.date<r.date);
   if(latest?.availableAt&&bars[r.t].availableAt&&latest.availableAt>bars[r.t].availableAt)throw Error('Macro observation not available at decision '+key+' '+r.date);
   macroAsOf[key]={date:latest.date,availableAt:latest.availableAt??null};
  }
  return {...r,macro,macroAsOf};
 }).filter(r=>r.macro);
 const records=[],fits=[];
 for(const h of horizons){
  let p,m,last=-Infinity;
  for(const row of rows){
   if(row.t+h>=bars.length)break;
   const known=rows.filter(r=>r.t+h<=row.t);
   if(known.length<minTrain)continue;
   if(!p||row.t-last>=refit){
    const py=known.map(r=>({x:r.x,y:Math.log(bars[r.t+h].close/bars[r.t].close)})),my=known.map((r,i)=>({x:[...r.x,...r.macro],y:py[i].y}));
    p=train(py,{lambda});m=train(my,{lambda});last=row.t;
    fits.push({horizonBars:h,date:row.date,trainingLastOrigin:known.at(-1).date,trainingLabelEnd:bars[known.at(-1).t+h].date,price:p,macro:m,priceGradient:gradient(p,py,lambda),macroGradient:gradient(m,my,lambda)});
   }
   const pp=predict(p,row.x),mp=predict(m,[...row.x,...row.macro]);
   const fullyMatured=own.filter(r=>r.t+h<=row.t);
   const y=fullyMatured.map(r=>Math.log(bars[r.t+h].close/bars[r.t].close));
   records.push({t:row.t,date:row.date,horizonBars:h,targetEndDate:bars[row.t+h].date,actualLogReturn:Math.log(bars[row.t+h].close/bars[row.t].close),
    price:pp,macro:mp,prior:p.prior,historicalMean:p.yMean,dailyUpdatedOwnPrior:mean(y.map(v=>+(v>0))),dailyUpdatedOwnMean:mean(y),
    trainingFitDate:bars[last].date,decisionAvailableAt:bars[row.t].availableAt??null,macroAsOf:row.macroAsOf});
  }
 }
 if(horizons.some(h=>!records.some(r=>r.horizonBars===h)))throw Error('Incomplete direction horizons');
 return {records,fits,macroSpecification:'USO adjusted-close oil proxy, no silent fallback; previous-calendar-date joins; revised exploratory specification'};
}
export function summarizeDirection(records){
 const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
 return [...new Set(records.map(r=>r.horizonBars))].map(h=>{
  const rows=records.filter(r=>r.horizonBars===h);
  const keys=['price','macro','prior','dailyUpdatedOwnPrior'];
  const scores=Object.fromEntries(keys.map(k=>{
   const values=rows.map(r=>({p:typeof r[k]==='number'?r[k]:r[k].probabilityUp,y:+(r.actualLogReturn>0)}));
   return [k,{brier:mean(values.map(({p,y})=>(p-y)**2)),logLoss:mean(values.map(({p,y})=>-y*Math.log(Math.max(1e-12,p))-(1-y)*Math.log(Math.max(1e-12,1-p)))),accuracy:mean(values.map(({p,y})=>+((p>=.5)===Boolean(y)))),meanProbability:mean(values.map(v=>v.p)),positiveRate:mean(values.map(v=>v.y)),
    fixedBins:Array.from({length:5},(_,i)=>{const selected=values.filter(v=>Math.min(4,Math.floor(v.p*5))===i);return {lower:i/5,upper:(i+1)/5,n:selected.length,p:selected.length?mean(selected.map(v=>v.p)):null,y:selected.length?mean(selected.map(v=>v.y)):null};})}];
  }));
  const returnMSE=Object.fromEntries(['price','macro','historicalMean','dailyUpdatedOwnMean','zero'].map(k=>[k,mean(rows.map(r=>((k==='zero'?0:typeof r[k]==='number'?r[k]:r[k].expectedLogReturn)-r.actualLogReturn)**2))]));
  return {horizonBars:h,n:rows.length,first:rows[0].date,last:rows.at(-1).date,scores,returnMSE,macroBrierSkillVsPricePct:100*(1-scores.macro.brier/scores.price.brier)};
 });
}
