import fs from 'node:fs';
import {MARKET_PULSE_VERSION,MARKET_PULSE_UNIVERSE,dayKey,round,pct,pulseMetrics,trendRegime,shortTermCondition} from '../lib/market-pulse-engine.js';

const range=process.env.MARKET_PULSE_BACKTEST_RANGE||'10y';
const horizons=[5,10,20];

async function fetchRows(symbol){
  const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?range='+range+'&interval=1d&includePrePost=false&events=div%2Csplits';
  const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 MarketHunterMarketPulseBacktest/1.0'}});
  if(!res.ok)throw new Error(symbol+': HTTP '+res.status);
  const j=await res.json(),z=j?.chart?.result?.[0],q=z?.indicators?.quote?.[0]||{},adj=z?.indicators?.adjclose?.[0]?.adjclose||q.close||[];
  if(!z)throw new Error(symbol+': unavailable');
  return (z.timestamp||[]).map((t,i)=>{
    const raw=q.close?.[i],factor=Number.isFinite(adj[i])&&Number.isFinite(raw)&&raw?adj[i]/raw:1;
    return {t,close:adj[i],rawClose:raw,high:Number.isFinite(q.high?.[i])?q.high[i]*factor:null,low:Number.isFinite(q.low?.[i])?q.low[i]*factor:null,volume:q.volume?.[i]};
  }).filter(x=>Number.isFinite(x.close)&&x.close>0&&Number.isFinite(x.high)&&Number.isFinite(x.low));
}
const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const median=a=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
function stats(rows){
  const r=rows.map(x=>x.forwardReturn).filter(Number.isFinite);
  if(!r.length)return null;
  return {
    n:r.length,mean:round(avg(r)),median:round(median(r)),
    positiveRate:round(r.filter(x=>x>0).length/r.length*100,1),
    avgMAE:round(avg(rows.map(x=>x.mae))),avgMFE:round(avg(rows.map(x=>x.mfe))),
    hitPlus5:round(rows.filter(x=>Number.isFinite(x.mfe)&&x.mfe>=5).length/rows.length*100,1),
    hitMinus5:round(rows.filter(x=>Number.isFinite(x.mae)&&x.mae<=-5).length/rows.length*100,1)
  };
}
function splitStats(rows){
  const sorted=[...rows].sort((a,b)=>a.date.localeCompare(b.date)),cut=Math.floor(sorted.length*.7);
  return {overall:stats(sorted),train:stats(sorted.slice(0,cut)),recent:stats(sorted.slice(cut))};
}

const result={version:MARKET_PULSE_VERSION,generatedAt:new Date().toISOString(),range,note:'State validation only. Horizons are market sessions, not calendar days. No forecast labels are promoted to UI yet.',markets:{}};

for(const item of MARKET_PULSE_UNIVERSE){
  process.stdout.write('backtest '+item.key+'... ');
  try{
    const rows=await fetchRows(item.symbol),events=[];
    for(let i=220;i<rows.length-20;i++){
      const hist=rows.slice(0,i+1),m=pulseMetrics(hist);
      if(!m)continue;
      const regime=trendRegime(m),condition=shortTermCondition(m),date=dayKey(rows[i].t),entry=rows[i].close;
      for(const h of horizons){
        if(i+h>=rows.length)continue;
        const path=rows.slice(i+1,i+h+1).map(x=>pct(x.close,entry)).filter(Number.isFinite);
        events.push({
          date,horizon:h,regime,condition,stateKey:regime+' | '+condition,
          forwardReturn:round(pct(rows[i+h].close,entry)),
          mae:round(path.length?Math.min(...path):null),
          mfe:round(path.length?Math.max(...path):null)
        });
      }
    }
    const byHorizon={};
    for(const h of horizons){
      const pool=events.filter(x=>x.horizon===h);
      const states=[...new Set(pool.map(x=>x.stateKey))].sort();
      byHorizon[h]={
        overall:splitStats(pool),
        byState:Object.fromEntries(states.map(s=>[s,splitStats(pool.filter(x=>x.stateKey===s))])),
        byRegime:Object.fromEntries([...new Set(pool.map(x=>x.regime))].sort().map(s=>[s,splitStats(pool.filter(x=>x.regime===s))])),
        byCondition:Object.fromEntries([...new Set(pool.map(x=>x.condition))].sort().map(s=>[s,splitStats(pool.filter(x=>x.condition===s))]))
      };
    }
    result.markets[item.key]={...item,history:{start:dayKey(rows[220].t),end:dayKey(rows.at(-1).t),sessions:rows.length},horizons:byHorizon};
    console.log(rows.length+' sessions');
  }catch(e){
    result.markets[item.key]={...item,error:e.message};
    console.log('SKIP '+e.message);
  }
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/market-pulse-state-backtest.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({version:result.version,markets:Object.fromEntries(Object.entries(result.markets).map(([k,v])=>[k,{error:v.error||null,history:v.history||null}]))},null,2));
