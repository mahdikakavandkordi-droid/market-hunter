const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));

function ret(a,i,n){
  if(i<n||!Number.isFinite(a[i]?.c)||!Number.isFinite(a[i-n]?.c)||a[i-n].c===0)return null;
  return a[i].c/a[i-n].c-1;
}
function sma(a,i,n,key='c'){
  if(i<n-1)return null;
  let s=0;
  for(let k=i-n+1;k<=i;k++){const v=a[k]?.[key];if(!Number.isFinite(v))return null;s+=v}
  return s/n;
}
function rsi(a,i,n=14){
  if(i<n)return null;
  let g=0,l=0;
  for(let k=i-n+1;k<=i;k++){
    const d=a[k].c-a[k-1].c;
    if(d>0)g+=d;else l-=d;
  }
  if(l===0)return g>0?100:50;
  const rs=(g/n)/(l/n);
  return 100-(100/(1+rs));
}
function benchmarkIndex(bars,date){
  let z=-1;
  for(let i=0;i<bars.length;i++){
    if((bars[i]?.date||'')<=date)z=i;else break;
  }
  return z;
}
function add(parts,name,value,weight){
  if(!Number.isFinite(value))return;
  parts.push({name,value:clamp(value),weight});
}
export function momentumShadow(daily,i,dir,benchmarkDaily=[],benchmarkSymbol=null){
  const bar=daily?.[i];
  if(!bar||!bar.date||!Number.isFinite(bar.c))return {available:false,score:null,bucket:'unavailable'};

  const ret20=ret(daily,i,20),ret60=ret(daily,i,60),rsi14=rsi(daily,i,14);
  const ma20=sma(daily,i,20),ma50=sma(daily,i,50);
  const ma20Prev=i>=24?sma(daily,i-5,20):null;
  const ma20Slope5=Number.isFinite(ma20)&&Number.isFinite(ma20Prev)&&ma20Prev!==0?ma20/ma20Prev-1:null;
  const avgVol20=sma(daily,i,20,'v');
  const volumeRatio20=Number.isFinite(bar.v)&&Number.isFinite(avgVol20)&&avgVol20>0?bar.v/avgVol20:null;

  const bi=benchmarkIndex(benchmarkDaily,bar.date);
  const benchmarkRet20=bi>=0?ret(benchmarkDaily,bi,20):null;
  const benchmarkRet60=bi>=0?ret(benchmarkDaily,bi,60):null;
  const rs20=Number.isFinite(ret20)&&Number.isFinite(benchmarkRet20)?ret20-benchmarkRet20:null;
  const rs60=Number.isFinite(ret60)&&Number.isFinite(benchmarkRet60)?ret60-benchmarkRet60:null;

  const parts=[];
  add(parts,'return20',Number.isFinite(ret20)?(dir*ret20+.10)/.20:null,20);
  add(parts,'return60',Number.isFinite(ret60)?(dir*ret60+.20)/.40:null,20);
  add(parts,'rsi14',Number.isFinite(rsi14)?(dir*(rsi14-50)+20)/40:null,15);

  if(Number.isFinite(ma20))add(parts,'price_vs_ma20',dir*(bar.c-ma20)>=0?1:0,7);
  if(Number.isFinite(ma20)&&Number.isFinite(ma50))add(parts,'ma20_vs_ma50',dir*(ma20-ma50)>=0?1:0,7);
  if(Number.isFinite(ma20Slope5))add(parts,'ma20_slope5',(.5+dir*ma20Slope5/.04),6);

  add(parts,'volume_ratio20',Number.isFinite(volumeRatio20)?(volumeRatio20-.75)/1.25:null,10);
  add(parts,'relative_strength20',Number.isFinite(rs20)?(dir*rs20+.08)/.16:null,8);
  add(parts,'relative_strength60',Number.isFinite(rs60)?(dir*rs60+.15)/.30:null,7);

  const availableWeight=parts.reduce((s,x)=>s+x.weight,0);
  const weighted=parts.reduce((s,x)=>s+x.value*x.weight,0);
  const score=availableWeight?Math.round(1000*weighted/availableWeight)/10:null;
  const bucket=score==null?'unavailable':score>=70?'high':score>=50?'medium':'low';

  return {
    available:score!=null,
    score,bucket,asOfDate:bar.date,direction:dir===1?'long':'short',
    ret20,ret60,rsi14,ma20,ma50,ma20Slope5,volumeRatio20,
    benchmarkSymbol,benchmarkRet20,benchmarkRet60,rs20,rs60,
    components:Object.fromEntries(parts.map(x=>[x.name,{score:Math.round(x.value*1000)/10,weight:x.weight}]))
  };
}

export function momentumBucketSummary(trades,statsFn,costR=.05){
  const out={};
  for(const bucket of ['high','medium','low','unavailable']){
    const group=trades.filter(x=>(x.momentumShadow?.bucket||'unavailable')===bucket);
    out[bucket]={raw:statsFn(group,0),afterCost:statsFn(group,costR)};
  }
  return out;
}
