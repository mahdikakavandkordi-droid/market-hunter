import {train} from '../engine.mjs';
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const clip=p=>Math.max(1e-12,Math.min(1-1e-12,p));
export const CONFIG=Object.freeze({horizons:[5,10,20],primaryHorizon:10,thresholdLookback:252,thresholdQuantile:.8,firstOrigin:271,minTrain:252,refit:21,lambda:20,ewmaDecay:.94,floor:1e-12,alertCutoffs:[.25,.5,.75],bootstrapReps:999});
const quantile=(a,p)=>{const s=[...a].sort((x,y)=>x-y),i=(s.length-1)*p,j=Math.floor(i);return s[j]+(s[Math.min(j+1,s.length-1)]-s[j])*(i-j);};
function logGamma(z){
 const coefficients=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
 if(z<.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
 z-=1;let x=.99999999999980993;for(let i=0;i<coefficients.length;i++)x+=coefficients[i]/(z+i+1);
 const t=z+7.5;return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x);
}
export function chiSquareSurvival(x,df){
 if(!Number.isFinite(df)||df<=0||x<0)throw Error('Invalid chi-square inputs');
 if(x===Infinity)return 0;if(x===0)return 1;
 const a=df/2,z=x/2,scale=Math.exp(a*Math.log(z)-z-logGamma(a)),eps=1e-14,tiny=1e-300;
 if(z<a+1){let sum=1/a,term=sum;for(let n=1;n<=1000;n++){term*=z/(a+n);sum+=term;if(Math.abs(term)<Math.abs(sum)*eps)return Math.max(0,Math.min(1,1-sum*scale));}throw Error('Gamma series failed');}
 let b=z+1-a,c=1/tiny,d=1/b,h=d;
 for(let i=1;i<=1000;i++){const an=-i*(i-a);b+=2;d=an*d+b;if(Math.abs(d)<tiny)d=tiny;c=b+an/c;if(Math.abs(c)<tiny)c=tiny;d=1/d;const delta=d*c;h*=delta;if(Math.abs(delta-1)<eps)return Math.max(0,Math.min(1,scale*h));}
 throw Error('Gamma fraction failed');
}
export function riskFeatures(bars){
 for(let i=0;i<bars.length;i++){
  if(!Number.isFinite(bars[i].close)||bars[i].close<=0)throw Error('Invalid risk input price');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(bars[i].date)||(i&&bars[i].date<=bars[i-1].date))throw Error('Invalid risk input chronology');
 }
 const r=bars.map((b,i)=>i?Math.log(b.close/bars[i-1].close):0),v20=[],v5=[],ewma=[];
 const rms=(t,n)=>Math.sqrt(mean(r.slice(t-n+1,t+1).map(v=>v*v)));
 for(let t=20;t<bars.length;t++){v20[t]=rms(t,20);v5[t]=rms(t,5);ewma[t]=t===20?v20[t]**2:CONFIG.ewmaDecay*ewma[t-1]+(1-CONFIG.ewmaDecay)*r[t]**2;}
 const rows=[];
 for(let t=CONFIG.firstOrigin;t<bars.length;t++){
  const q=Math.max(CONFIG.floor,quantile(v20.slice(t-CONFIG.thresholdLookback+1,t+1),CONFIG.thresholdQuantile));
  const vol=Math.max(CONFIG.floor,v20[t]),last20=Math.log(bars[t].close/bars[t-20].close);
  rows.push({t,date:bars[t].date,threshold:q,currentVol:v20[t],currentHigh:v20[t]>q,ewma:ewma[t],x:[Math.log(vol/q),Math.log(Math.max(CONFIG.floor,v5[t])/vol),Math.abs(r[t])/vol,Math.max(0,-last20)/(vol*Math.sqrt(20))]});
 }
 return {rows,returns:r};
}
export function probability(model,x){
 if(model.constant!==undefined)return clip(model.constant);
 const z=model.beta[0]+x.reduce((s,v,j)=>s+(v-model.mu[j])/model.sd[j]*model.beta[j+1],0);
 return clip(1/(1+Math.exp(-Math.max(-35,Math.min(35,z)))));
}
export function fitProbability(rows){
 const n=rows.length,count=rows.reduce((s,r)=>s+r.y,0),prior=(count+.5)/(n+1);
 if(count===0||count===n)return {constant:prior,prior,n,fallback:'single-training-class',maxAbsGradient:0};
 const legacy=train(rows.map(r=>({x:r.x,y:r.y})),{lambda:CONFIG.lambda});
 const model={mu:legacy.mu,sd:legacy.sd,beta:legacy.logistic,prior,n,lambda:CONFIG.lambda};
 const gradient=Array(model.beta.length).fill(0);
 for(const row of rows){const p=probability(model,row.x),xs=[1,...row.x.map((v,j)=>(v-model.mu[j])/model.sd[j])];for(let j=0;j<xs.length;j++)gradient[j]+=(p-row.y)*xs[j];}
 for(let j=1;j<gradient.length;j++)gradient[j]+=CONFIG.lambda*model.beta[j];
 model.maxAbsGradient=Math.max(...gradient.map(Math.abs));
 if(model.maxAbsGradient>1e-4)throw Error('Unconverged risk logistic fit: '+model.maxAbsGradient);
 return model;
}
export function riskLedger(bars){
 const {rows,returns:r}=riskFeatures(bars),records=[],fits=[];
 for(const h of CONFIG.horizons){
  let full,level,prior,states,last=-Infinity;
  const outcome=row=>+(Math.sqrt(mean(r.slice(row.t+1,row.t+h+1).map(x=>x*x)))>row.threshold);
  for(const row of rows){
   if(row.t+h>=bars.length)break;
   const known=rows.filter(v=>v.t+h<=row.t);
   if(known.length<CONFIG.minTrain)continue;
   if(!full||row.t-last>=CONFIG.refit){
    const labels=known.map(v=>({...v,y:outcome(v)}));
    full=fitProbability(labels.map(v=>({x:v.x,y:v.y})));level=fitProbability(labels.map(v=>({x:[v.x[0]],y:v.y})));
    prior=(labels.reduce((s,v)=>s+v.y,0)+.5)/(labels.length+1);
    states=Object.fromEntries([false,true].map(state=>{const items=labels.filter(v=>v.currentHigh===state);return [String(state),items.length?(items.reduce((s,v)=>s+v.y,0)+.5)/(items.length+1):prior];}));
    last=row.t;fits.push({horizonBars:h,date:row.date,lastTrainingOrigin:known.at(-1).date,lastTrainingLabelEnd:bars[known.at(-1).t+h].date,n:known.length,full,level,prior,states});
   }
   const futureVol=Math.sqrt(mean(r.slice(row.t+1,row.t+h+1).map(x=>x*x))),actual=+(futureVol>row.threshold);
   const probabilities={full:probability(full,row.x),level:probability(level,[row.x[0]]),prior,state:states[String(row.currentHigh)],ewmaGaussian:clip(row.ewma<=CONFIG.floor**2?0:chiSquareSurvival(h*row.threshold**2/row.ewma,h)),hardPersistence:+row.currentHigh};
   if(Object.values(probabilities).some(p=>!Number.isFinite(p)||p<0||p>1))throw Error('Invalid risk probability');
   records.push({t:row.t,date:row.date,horizonBars:h,threshold:row.threshold,currentVol:row.currentVol,currentHigh:row.currentHigh,features:row.x,actual,futureVol,
    targetEndDate:bars[row.t+h].date,decisionAvailableAt:bars[row.t].availableAt??null,targetAvailableAt:bars[row.t+h].availableAt??null,fitDate:bars[last].date,lastTrainingOrigin:bars[last-h].date,lastTrainingLabelEnd:bars[last].date,probabilities});
  }
 }
 return {records,fits,config:CONFIG};
}
