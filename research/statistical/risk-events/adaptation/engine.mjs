import {CONFIG,riskFeatures,fitProbability,probability} from '../engine.mjs';
const clip=p=>Math.max(1e-12,Math.min(1-1e-12,p));
const logit=p=>Math.log(clip(p)/(1-clip(p)));
const sigmoid=x=>clip(1/(1+Math.exp(-Math.max(-35,Math.min(35,x)))));
export function fitOffset(rows,key){
 let offset=0;
 for(let iteration=0;iteration<100;iteration++){
  let g=20*offset,h=20;
  for(const r of rows){const p=sigmoid(logit(r.probabilities[key])+offset);g+=p-r.actual;h+=p*(1-p);}
  const step=g/h;offset-=step;if(Math.abs(step)<1e-12)break;
 }
 const gradient=20*offset+rows.reduce((s,r)=>s+sigmoid(logit(r.probabilities[key])+offset)-r.actual,0);
 if(Math.abs(gradient)>1e-6)throw Error('Offset convergence failed');
 return {offset,n:rows.length,penalty:20,lastOrigin:rows.at(-1).date,lastLabelEnd:rows.at(-1).targetEnd,gradient};
}
export function adaptationLedger(bars){
 const {rows,returns:r}=riskFeatures(bars),h=10,history=[],records=[],fits=[];
 const outcome=row=>+(Math.sqrt(r.slice(row.t+1,row.t+h+1).reduce((s,x)=>s+x*x,0)/h)>row.threshold);
 let models,last=-Infinity,offsets,lastCalibration=-Infinity;
 for(const row of rows){
  if(row.t+h>=bars.length)break;
  const known=rows.filter(v=>v.t+h<=row.t);
  if(known.length<CONFIG.minTrain)continue;
  if(!models||row.t-last>=CONFIG.refit){
   models={};
   for(const window of ['expanding','rolling'])for(const form of ['Full','Level']){
    const training=window==='rolling'?known.slice(-504):known;
    models[window+form]=fitProbability(training.map(v=>({x:form==='Level'?[v.x[0]]:v.x,y:outcome(v)})));
   }
   last=row.t;fits.push({kind:'training',date:row.date,lastLabelEnd:bars[known.at(-1).t+h].date,n:known.length,models});
  }
  const p=Object.fromEntries(Object.entries(models).map(([key,model])=>[key,probability(model,key.endsWith('Level')?[row.x[0]]:row.x)]));
  const available=history.filter(v=>v.t+h<=row.t).slice(-504);
  if(available.length>=252&&(!offsets||row.t-lastCalibration>=21)){
   offsets=Object.fromEntries(['Full','Level'].map(form=>[form,fitOffset(available,'expanding'+form)]));
   lastCalibration=row.t;fits.push({kind:'calibration',date:row.date,offsets});
  }
  const record={t:row.t,date:row.date,currentHigh:row.currentHigh,actual:outcome(row),targetEnd:bars[row.t+h].date,fitDate:bars[last].date,probabilities:{...p}};
  history.push(record);
  if(offsets){
   const probabilities={...p,...Object.fromEntries(['Full','Level'].map(form=>['calibrated'+form,sigmoid(logit(p['expanding'+form])+offsets[form].offset)]))};
   records.push({...record,calibrationFitDate:bars[lastCalibration].date,probabilities});
  }
 }
 return {history,records,fits};
}
