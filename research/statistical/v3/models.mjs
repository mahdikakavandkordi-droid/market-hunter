const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
export const CONFIG=Object.freeze({horizons:[5,10,20],minTrain:252,refit:21,lambda:20,ewmaDecay:.94,meanReversion:.5,floor:1e-12});
export function ridgeFit(rows,lambda=20){
 const d=rows[0].x.length;
 const mu=Array.from({length:d},(_,j)=>mean(rows.map(r=>r.x[j])));
 const sd=mu.map((m,j)=>Math.max(1e-8,Math.sqrt(mean(rows.map(r=>(r.x[j]-m)**2)))));
 const xs=rows.map(r=>[1,...r.x.map((x,j)=>(x-mu[j])/sd[j])]);
 const a=Array.from({length:d+1},()=>Array(d+2).fill(0));
 for(let i=0;i<rows.length;i++)for(let j=0;j<=d;j++){
  for(let k=0;k<=d;k++)a[j][k]+=xs[i][j]*xs[i][k];
  a[j][d+1]+=xs[i][j]*rows[i].y;
 }
 for(let j=1;j<=d;j++)a[j][j]+=lambda;
 for(let j=0;j<=d;j++){
  let best=j;for(let k=j+1;k<=d;k++)if(Math.abs(a[k][j])>Math.abs(a[best][j]))best=k;
  [a[j],a[best]]=[a[best],a[j]];
  if(Math.abs(a[j][j])<1e-12)throw Error('Singular ridge');
  const pivot=a[j][j];for(let k=j;k<=d+1;k++)a[j][k]/=pivot;
  for(let k=0;k<=d;k++)if(k!==j){const z=a[k][j];for(let l=j;l<=d+1;l++)a[k][l]-=z*a[j][l];}
 }
 return {mu,sd,beta:a.map(r=>r[d+1]),lambda,n:rows.length};
}
export const ridgePredict=(m,x)=>m.beta[0]+x.reduce((s,v,j)=>s+(v-m.mu[j])/m.sd[j]*m.beta[j+1],0);

// Restricted variance-targeted, zero-mean Gaussian GARCH(1,1). A fixed grid
// estimates parameters using past returns ONLY; no horizon/OOS grid selection.
// Explicitly not an unconstrained optimizer or a claim of canonical GARCH fit.
export function fitGarch(returns){
 const v=Math.max(CONFIG.floor,mean(returns.map(r=>r*r)));
 let best=null;
 for(const alpha of [.03,.07,.12,.18])for(const beta of [.7,.8,.9,.95]){
  if(alpha+beta>=.999)continue;
  const omega=v*(1-alpha-beta);let state=v,nll=0;
  for(const r of returns){nll+=Math.log(state)+r*r/state;state=omega+alpha*r*r+beta*state;}
  if(!best||nll<best.nll)best={alpha,beta,omega,state,nll,longRun:v,n:returns.length,fit:'fixed-grid-variance-targeted'};
 }
 return best;
}
export function garchForecast(m,state,h){
 let v=state,total=0;
 for(let i=0;i<h;i++){total+=v;v=m.omega+(m.alpha+m.beta)*v;}
 return total/h;
}

export function volatilityLedger(bars,config=CONFIG){
 const cfg={...CONFIG,...config};
 const r=bars.map((b,i)=>i?Math.log(b.close/bars[i-1].close):0);
 const rms=(t,n)=>Math.sqrt(mean(r.slice(t-n+1,t+1).map(x=>x*x)));
 const variance=(t,n)=>mean(r.slice(t-n+1,t+1).map(x=>x*x));
 const future=(t,h)=>mean(r.slice(t+1,t+h+1).map(x=>x*x));
 const logFeatures=t=>[5,20,60].map(n=>Math.log(Math.max(1e-8,rms(t,n))));
 const harFeatures=t=>[1,5,22].map(n=>variance(t,n));
 let ewma=variance(20,20);const ewm=[];
 for(let t=21;t<bars.length;t++){ewma=cfg.ewmaDecay*ewma+(1-cfg.ewmaDecay)*r[t]**2;ewm[t]=ewma;}
 const records=[],fits=[];
 for(const h of cfg.horizons){
  let logModel,harModel,garch,last=-Infinity,garchState;
  for(let t=60;t+h<bars.length;t++){
   const trainEnd=t-h,n=trainEnd-60+1;
   if(n<cfg.minTrain)continue;
   if(!logModel||t-last>=cfg.refit){
    const origins=Array.from({length:n},(_,i)=>60+i);
    logModel=ridgeFit(origins.map(s=>({x:logFeatures(s),y:Math.log(Math.max(1e-8,Math.sqrt(future(s,h))))})),cfg.lambda);
    harModel=ridgeFit(origins.map(s=>({x:harFeatures(s),y:future(s,h)})),cfg.lambda);
    logModel.mean=mean(origins.map(s=>Math.sqrt(future(s,h))));
    logModel.meanVariance=mean(origins.map(s=>future(s,h)));
    garch=fitGarch(r.slice(1,t+1));garchState=garch.state;last=t;
    fits.push({horizonBars:h,decisionDate:bars[t].date,trainingLastOrigin:bars[trainEnd].date,trainingLabelEnd:bars[t].date,logModel,harModel,garch});
   }else garchState=garch.omega+garch.alpha*r[t]**2+garch.beta*garchState;
   const varActual=future(t,h),harLog=Math.exp(ridgePredict(logModel,logFeatures(t)));
   const vol20=rms(t,20),volMean=logModel.mean;
   const varianceForecasts={harLog:harLog**2,persistence5:variance(t,5),persistence20:variance(t,20),persistence60:variance(t,60),mean:volMean**2,
    meanVariance:logModel.meanVariance,ewma:ewm[t],meanReversion:cfg.meanReversion*vol20**2+(1-cfg.meanReversion)*logModel.meanVariance,
    harVariance:Math.max(cfg.floor,ridgePredict(harModel,harFeatures(t))),garch:garchForecast(garch,garchState,h)};
   const forecasts=Object.fromEntries(Object.entries(varianceForecasts).map(([k,v])=>[k,Math.sqrt(Math.max(cfg.floor,v))]));
   // Median threshold is computed on the current and previous observations only.
   const past=Array.from({length:Math.min(252,t-19)},(_,i)=>rms(t-i,20)).sort((a,b)=>a-b);
   const sma200=t>=199?mean(bars.slice(t-199,t+1).map(b=>b.close)):null;
   const regime=sma200===null?null:(bars[t].close>sma200?'up':'down')+'-'+(vol20>past[Math.floor(past.length/2)]?'highvol':'lowvol');
   records.push({t,date:bars[t].date,decisionAvailableAt:bars[t].availableAt??null,horizonBars:h,targetStartDate:bars[t+1].date,targetEndDate:bars[t+h].date,
    targetAvailableAt:bars[t+h].availableAt??null,trainingFitDate:bars[last].date,trainingLastOrigin:bars[last-h].date,trainingLabelEnd:bars[last].date,
    actual:Math.sqrt(varActual),actualVariance:varActual,forecasts,regime});
  }
 }
 return {records,fits,config:cfg};
}
