// Independent cross-asset statistical research. No imports from Market Hunter or SMC.
// All predictors are computed using data available at the close of observation t.
// An outcome ending at t+h becomes trainable only at (or after) t+h.

const avg = a => a.reduce((s,x)=>s+x,0)/a.length;
const std = a => { const m=avg(a); return Math.sqrt(avg(a.map(v => (v-m)**2))); };
const sigmoid = z => 1/(1+Math.exp(-Math.max(-35,Math.min(35,z))));

export const HORIZONS = [5,10,20];
export const FEATURES = ['return_1','return_5','return_20','return_60','sma20_distance','realized_vol20'];

function solve(matrix, vector) {
  const n=vector.length, a=matrix.map((row,i)=>[...row,vector[i]]);
  for(let j=0;j<n;j++) {
    let p=j;
    for(let i=j+1;i<n;i++) if(Math.abs(a[i][j])>Math.abs(a[p][j]))p=i;
    [a[j],a[p]]=[a[p],a[j]];
    if(Math.abs(a[j][j])<1e-12)throw new Error('Singular normal equation');
    const z=a[j][j];
    for(let k=j;k<=n;k++)a[j][k]/=z;
    for(let i=0;i<n;i++)if(i!==j) {
      const v=a[i][j];
      for(let k=j;k<=n;k++)a[i][k]-=v*a[j][k];
    }
  }
  return a.map(row=>row[n]);
}

export function makeFeatures(bars) {
  const rows=[];
  for(let t=60;t<bars.length;t++) {
    const c=bars[t].close;
    const logret=n=>Math.log(c/bars[t-n].close);
    const daily=Array.from({length:20},(_,k)=>Math.log(bars[t-k].close/bars[t-k-1].close));
    const sma20=avg(bars.slice(t-19,t+1).map(r=>r.close));
    rows.push({t,date:bars[t].date,x:[logret(1),logret(5),logret(20),logret(60),c/sma20-1,std(daily)]});
  }
  return rows;
}

export function train(rows,{lambda=20}={}) {
  if(rows.length<40)throw new Error('Insufficient training rows');
  const d=rows[0].x.length,k=d+1;
  const mu=Array.from({length:d},(_,j)=>avg(rows.map(r=>r.x[j])));
  const sd=Array.from({length:d},(_,j)=>Math.max(1e-8,std(rows.map(r=>r.x[j]))));
  const X=rows.map(r=>[1,...r.x.map((x,j)=>(x-mu[j])/sd[j])]);
  const y=rows.map(r=>r.y);
  const outcome=y.map(v=>+(v>0));
  const yMean=avg(y),prior=avg(outcome);

  // Ridge on realized h-bar log returns.
  const A=Array.from({length:k},()=>Array(k).fill(0)),B=Array(k).fill(0);
  for(let i=0;i<rows.length;i++)for(let j=0;j<k;j++){
    B[j]+=X[i][j]*y[i];
    for(let z=0;z<k;z++)A[j][z]+=X[i][j]*X[i][z];
  }
  for(let j=1;j<k;j++)A[j][j]+=lambda;
  const ridge=solve(A,B);

  // Regularized logistic regression (Newton/IRLS) on positive-horizon returns.
  let logistic=[Math.log(Math.max(.01,prior)/Math.max(.01,1-prior)),...Array(d).fill(0)];
  for(let iter=0;iter<15;iter++){
    const G=Array(k).fill(0),H=Array.from({length:k},()=>Array(k).fill(0));
    for(let i=0;i<rows.length;i++){
      const p=sigmoid(X[i].reduce((s,v,j)=>s+v*logistic[j],0)),weight=p*(1-p);
      for(let j=0;j<k;j++){
        G[j]+=(p-outcome[i])*X[i][j];
        for(let q=0;q<k;q++)H[j][q]+=weight*X[i][j]*X[i][q];
      }
    }
    for(let j=1;j<k;j++){G[j]+=lambda*logistic[j];H[j][j]+=lambda;}
    const delta=solve(H,G);
    let maxDelta=0;
    for(let j=0;j<k;j++){
      const bounded=Math.max(-2,Math.min(2,delta[j]));
      logistic[j]-=bounded; maxDelta=Math.max(maxDelta,Math.abs(bounded));
    }
    if(maxDelta<1e-6)break;
  }
  return {mu,sd,ridge,logistic,yMean,prior,trainedSamples:rows.length};
}

export function predict(model,x){
  const X=[1,...x.map((v,j)=>(v-model.mu[j])/model.sd[j])];
  return {
    expectedLogReturn:X.reduce((s,v,j)=>s+v*model.ridge[j],0),
    probabilityUp:sigmoid(X.reduce((s,v,j)=>s+v*model.logistic[j],0))
  };
}

export function backtest(bars,{horizons=HORIZONS,minTrainingSamples=252,refitBars=21,lambda=20}={}){
  // Bars are a single instrument, strictly ascending; no calendar alignment between asset classes.
  if(bars.length<minTrainingSamples+140)throw new Error('Too little history to assess');
  for(let i=0;i<bars.length;i++){
    if(!Number.isFinite(bars[i].close)||bars[i].close<=0)throw new Error('Invalid close');
    if(i>0 && bars[i].date<=bars[i-1].date)throw new Error('Bars must have unique increasing dates');
  }
  const features=makeFeatures(bars),out=[];
  for(const h of horizons){
    let fitted=null,lastFit=-Infinity;
    const predictions=[];
    for(const row of features){
      if(row.t+h>=bars.length)break; // only score fully realized target windows
      // CRITICAL PURGE: exclude all candidate labels which end after today's close.
      const matured=features.filter(v=>v.t+h<=row.t);
      if(matured.length<minTrainingSamples)continue;
      if(!fitted || row.t-lastFit>=refitBars){
        const training=matured.map(v=>({...v,y:Math.log(bars[v.t+h].close/bars[v.t].close)}));
        fitted=train(training,{lambda}); lastFit=row.t;
      }
      const y=Math.log(bars[row.t+h].close/bars[row.t].close);
      predictions.push({date:row.date,t:row.t,actual:y,
        ...predict(fitted,row.x),prior:fitted.prior,yMean:fitted.yMean,
        trendUp:row.x[2]>0});
    }
    if(!predictions.length)continue;
    const mse=fn=>avg(predictions.map(p=>fn(p)**2));
    const outcome=p=>+(p.actual>0);
    const baselineBrier=mse(p=>p.prior-outcome(p));
    const modelBrier=mse(p=>p.probabilityUp-outcome(p));
    const baselineMse=mse(p=>p.yMean-p.actual);
    const modelMse=mse(p=>p.expectedLogReturn-p.actual);
    const mae=fn=>avg(predictions.map(p=>Math.abs(fn(p))))*100;
    const accuracy=fn=>100*avg(predictions.map(p=>+(fn(p)===Boolean(outcome(p)))));
    const independent=predictions.filter((_,i)=>i%h===0);
    const independentAccuracy=100*avg(independent.map(p=>+((p.probabilityUp>=0.5)===Boolean(outcome(p)))));
    out.push({horizonBars:h,count:predictions.length,first:predictions[0].date,last:predictions.at(-1).date,
      directionAccuracy:accuracy(p=>p.probabilityUp>=0.5),
      historicalPriorAccuracy:accuracy(p=>p.prior>=0.5),
      trend20Accuracy:accuracy(p=>p.trendUp),
      independentDirectionAccuracy:independentAccuracy,
      independentCount:independent.length,
      brierSkillPct:100*(1-modelBrier/baselineBrier),
      mseSkillPct:100*(1-modelMse/baselineMse),
      meanAbsoluteErrorPct:mae(p=>p.expectedLogReturn-p.actual),
      baselineAbsoluteErrorPct:mae(p=>p.yMean-p.actual),
      baselinePositiveRate:avg(predictions.map(p=>outcome(p)))});
  }
  return out;
}

export function forecast(bars,h,{minTrainingSamples=252,lambda=20}={}){
  const f=makeFeatures(bars);
  const matured=f.filter(v=>v.t+h<bars.length);
  if(matured.length<minTrainingSamples)throw new Error('Insufficient labeled history');
  const model=train(matured.map(v=>({...v,y:Math.log(bars[v.t+h].close/bars[v.t].close)})),{lambda});
  return {asOf:bars.at(-1).date,horizonBars:h,...predict(model,f.at(-1).x),trainedSamples:model.trainedSamples};
}
