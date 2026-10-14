// Phase 2 independent RESEARCH: daily-close HAR-style volatility,
 // explicit price regimes and lagged macro information. No trading logic.
import {makeFeatures,train,predict} from './engine.mjs';

const mean = a=>a.reduce((s,v)=>s+v,0)/a.length;
const variance = a=>{const m=mean(a);return mean(a.map(v=>(v-m)**2));};
const deviation = a=>Math.sqrt(variance(a));
const sqMean=a=>Math.sqrt(mean(a.map(x=>x*x)));
const logret=(a,b)=>Math.log(a/b);
const brier=(p,y)=>(p-y)**2;

export function volRows(bars){
  // A HAR-style model constructed from DAILY closes, NOT actual high-frequency realized volatility.
  const r=bars.map((v,i)=>i===0?null:logret(v.close,bars[i-1].close));
  const rows=[];
  for(let t=60;t<bars.length;t++){
    const v5=sqMean(r.slice(t-4,t+1));
    const v20=sqMean(r.slice(t-19,t+1));
    const v60=sqMean(r.slice(t-59,t+1));
    rows.push({t,date:bars[t].date,volNow:v20,x:[Math.log(Math.max(1e-8,v5)),Math.log(Math.max(1e-8,v20)),Math.log(Math.max(1e-8,v60))]});
  }
  return rows;
}
function ridgeFit(rows,lambda=20){
  const n=rows.length,d=rows[0].x.length;
  const mu=Array.from({length:d},(_,j)=>mean(rows.map(v=>v.x[j])));
  const sd=Array.from({length:d},(_,j)=>Math.max(1e-8,deviation(rows.map(v=>v.x[j]))));
  const xs=rows.map(row=>[1,...row.x.map((v,j)=>(v-mu[j])/sd[j])]);
  const a=Array.from({length:d+1},()=>Array(d+1).fill(0));
  const b=Array(d+1).fill(0);
  for(let i=0;i<n;i++)for(let j=0;j<=d;j++){
    b[j]+=xs[i][j]*rows[i].target;
    for(let k=0;k<=d;k++)a[j][k]+=xs[i][j]*xs[i][k];
  }
  for(let j=1;j<=d;j++)a[j][j]+=lambda;
  // Gauss elimination with pivoting.
  const m=a.map((row,i)=>[...row,b[i]]);
  for(let j=0;j<=d;j++){
    let best=j;
    for(let k=j+1;k<=d;k++)if(Math.abs(m[k][j])>Math.abs(m[best][j]))best=k;
    [m[j],m[best]]=[m[best],m[j]];
    if(Math.abs(m[j][j])<1e-12)throw Error('Singular HAR-style ridge');
    const pivot=m[j][j];
    for(let k=j;k<=d+1;k++)m[j][k]/=pivot;
    for(let k=0;k<=d;k++)if(k!==j){const z=m[k][j];for(let l=j;l<=d+1;l++)m[k][l]-=z*m[j][l];}
  }
  return {beta:m.map(v=>v[d+1]),mu,sd,baseline:mean(rows.map(r=>Math.exp(r.target)))};
}
function ridgePredict(model,x){
  const z=[1,...x.map((v,j)=>(v-model.mu[j])/model.sd[j])];
  return Math.exp(z.reduce((s,v,j)=>s+v*model.beta[j],0));
}
function metrics(rows,target,predictor){
  return {mse:mean(rows.map(row=>(row[predictor]-row[target])**2)),
    mae:mean(rows.map(row=>Math.abs(row[predictor]-row[target])))};
}
export function volatilityBacktest(bars,{horizons=[5,10,20],minTrain=252,refit=21}={}){
  const rows=volRows(bars),ret=bars.map((v,i)=>i>0?logret(v.close,bars[i-1].close):0),out=[];
  for(const h of horizons){
    const samples=[];let model=null,refitAt=-Infinity;
    for(const row of rows){
      if(row.t+h>=bars.length)break;
      // Every future variance target comes exclusively from (t,t+h] known as of evaluation t.
      const matured=rows.filter(v=>v.t+h<=row.t);
      if(matured.length<minTrain)continue;
      if(!model||row.t-refitAt>=refit){
        model=ridgeFit(matured.map(v=>({
          x:v.x,target:Math.log(Math.max(1e-8,sqMean(ret.slice(v.t+1,v.t+h+1))))
        })));
        refitAt=row.t;
      }
      const actual=sqMean(ret.slice(row.t+1,row.t+h+1));
      samples.push({date:row.date,actual,har:ridgePredict(model,row.x),persistence:row.volNow,mean:model.baseline});
    }
    if(!samples.length)continue;
    const modelM=metrics(samples,'actual','har');
    const persistM=metrics(samples,'actual','persistence');
    const meanM=metrics(samples,'actual','mean');
    out.push({horizonBars:h,n:samples.length,first:samples[0].date,last:samples.at(-1).date,
      harMSE:modelM.mse,harMAE:modelM.mae,
      persistenceMSE:persistM.mse,persistenceMAE:persistM.mae,
      historicalMeanMSE:meanM.mse,historicalMeanMAE:meanM.mae,
      skillVsPersistencePct:100*(1-modelM.mse/persistM.mse),
      skillVsMeanPct:100*(1-modelM.mse/meanM.mse),
      maeSkillVsPersistencePct:100*(1-modelM.mae/persistM.mae)});
  }
  return out;
}

export function regimeRows(bars,{horizon=20}={}){
  const ret=bars.map((b,i)=>i?logret(b.close,bars[i-1].close):0);
  const volatility=(t,n)=>sqMean(ret.slice(t-n+1,t+1));
  const out=[];
  // SMA200 and a trailing 252-session rolling quantile computed at t (never global/full-sample).
  for(let t=475;t+horizon<bars.length;t++){
    const sma200=mean(bars.slice(t-199,t+1).map(x=>x.close));
    const v20=volatility(t,20);
    const history=Array.from({length:252},(_,j)=>volatility(t-251+j,20)).sort((a,b)=>a-b);
    const highVol=v20>history[Math.floor(history.length/2)];
    const upTrend=bars[t].close>sma200;
    out.push({date:bars[t].date,regime:(upTrend?'up':'down')+'-'+(highVol?'highvol':'lowvol'),
      actual:logret(bars[t+horizon].close,bars[t].close)});
  }
  const buckets={};
  for(const r of out){
    const group=buckets[r.regime]??=[];
    group.push(r);
  }
  return Object.entries(buckets).map(([regime,items])=>({
    regime,count:items.length,positiveRatePct:100*mean(items.map(v=>+(v.actual>0))),
    meanForwardLogReturnPct:100*mean(items.map(v=>v.actual)),
    medianForwardLogReturnPct:100*items.map(v=>v.actual).sort((a,b)=>a-b)[Math.floor(items.length/2)]
  })).sort((a,b)=>a.regime.localeCompare(b.regime));
}

// Dated macro joins always use strictly PRIOR calendar dates, deliberately conservative
// for crypto UTC closes and asynchronous world-market sessions.
export function macroFeatures(date,contexts,{maxCalendarStaleness=8}={}){
  const outputs=[];
  for(const [symbol,lookbacks,transform] of [
    ['vix',[0,5], 'logchange'],['us10y',[0,20],'levelchange'],
    ['dxy',[0,20],'logchange'],['oil',[0,20],'logchange'],['spx',[0,5,20],'logchange']]){
    const bars=contexts[symbol];
    if(!bars||bars.length<60)return null;
    let lo=0,hi=bars.length;
    while(lo<hi){const mid=(lo+hi)>>1; if(bars[mid].date<date)lo=mid+1;else hi=mid;}
    const idx=lo-1;
    if(idx<30)return null;
    const stale=Math.floor((Date.parse(date+'T00:00:00Z')-Date.parse(bars[idx].date+'T00:00:00Z'))/86400000);
    if(stale>maxCalendarStaleness)return null;
    const c=bars[idx].close;
    if(symbol==='vix')outputs.push(Math.log(c),logret(c,bars[idx-5].close));
    if(symbol==='us10y')outputs.push(c/100,(c-bars[idx-20].close)/100);
    if(symbol==='dxy'||symbol==='oil')outputs.push(logret(c,bars[idx-20].close));
    if(symbol==='spx')outputs.push(logret(c,bars[idx-5].close),logret(c,bars[idx-20].close));
  }
  return outputs.every(Number.isFinite)?outputs:null;
}
export const MACRO_FEATURES=['log_vix_prior','vix_ret5_prior','us10y_yield_prior','us10y_change20_prior',
 'dollar_ret20_prior','oil_ret20_prior','spx_ret5_prior','spx_ret20_prior'];

export function macroBacktest(bars,contexts,{horizons=[5,10,20],minTrain=252,refit=21,lambda=20}={}){
  const own=makeFeatures(bars);
  const rows=own.map(row=>({...row,macro:macroFeatures(row.date,contexts)})).filter(v=>v.macro);
  if(rows.length<minTrain+80)throw Error('Insufficient fully lagged macro observations');
  const results=[];
  for(const h of horizons){
    let priceModel=null,macroModel=null,lastRefit=-Infinity;
    const scores=[];
    for(const row of rows){
      if(row.t+h>=bars.length)break;
      const known=rows.filter(v=>v.t+h<=row.t);
      if(known.length<minTrain)continue;
      if(!priceModel||row.t-lastRefit>=refit){
        const y=v=>logret(bars[v.t+h].close,bars[v.t].close);
        priceModel=train(known.map(v=>({x:v.x,y:y(v)})),{lambda});
        macroModel=train(known.map(v=>({x:[...v.x,...v.macro],y:y(v)})),{lambda});
        lastRefit=row.t;
      }
      const actual=logret(bars[row.t+h].close,bars[row.t].close);
      const p=predict(priceModel,row.x);
      const m=predict(macroModel,[...row.x,...row.macro]);
      scores.push({date:row.date,actual,prior:priceModel.prior,priceProb:p.probabilityUp,
        macroProb:m.probabilityUp,priceReturn:p.expectedLogReturn,macroReturn:m.expectedLogReturn});
    }
    if(!scores.length)continue;
    const actual=s=>+(s.actual>0);
    const mse=(key)=>mean(scores.map(v=>(v[key]-v.actual)**2));
    const bs=(key)=>mean(scores.map(v=>brier(v[key],actual(v))));
    const correct=(key)=>100*mean(scores.map(v=>+((v[key]>=.5)===Boolean(actual(v)))));
    results.push({horizonBars:h,n:scores.length,first:scores[0].date,last:scores.at(-1).date,
      priorBrier:bs('prior'),priceBrier:bs('priceProb'),macroBrier:bs('macroProb'),
      macroBrierSkillVsPriorPct:100*(1-bs('macroProb')/bs('prior')),
      macroBrierSkillVsPricePct:100*(1-bs('macroProb')/bs('priceProb')),
      macroReturnMseSkillVsPricePct:100*(1-mse('macroReturn')/mse('priceReturn')),
      historicalPriorAccuracy:correct('prior'),priceAccuracy:correct('priceProb'),macroAccuracy:correct('macroProb')});
  }
  return results;
}
