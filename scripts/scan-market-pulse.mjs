import fs from 'node:fs';
import {MARKET_PULSE_VERSION,MARKET_PULSE_UNIVERSE,round,dayKey,pulseMetrics,descriptiveState,scenarioLevels} from '../lib/market-pulse-engine.js';

const range=process.env.MARKET_PULSE_RANGE||'10y';

async function fetchRows(symbol){
  const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?range='+range+'&interval=1d&includePrePost=false&events=div%2Csplits';
  const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 MarketHunterMarketPulse/1.0'}});
  if(!res.ok)throw new Error(symbol+': HTTP '+res.status);
  const j=await res.json(),z=j?.chart?.result?.[0],q=z?.indicators?.quote?.[0]||{},adj=z?.indicators?.adjclose?.[0]?.adjclose||q.close||[];
  if(!z)throw new Error(symbol+': unavailable');
  const rows=(z.timestamp||[]).map((t,i)=>{
    const rawClose=q.close?.[i],factor=Number.isFinite(adj[i])&&Number.isFinite(rawClose)&&rawClose?adj[i]/rawClose:1;
    return {t,close:adj[i],rawClose,high:Number.isFinite(q.high?.[i])?q.high[i]*factor:null,low:Number.isFinite(q.low?.[i])?q.low[i]*factor:null,volume:q.volume?.[i]};
  }).filter(x=>Number.isFinite(x.close)&&x.close>0&&Number.isFinite(x.high)&&Number.isFinite(x.low));
  return {rows,currency:z.meta?.currency||null,exchange:z.meta?.exchangeName||null};
}

const markets=[];
for(const item of MARKET_PULSE_UNIVERSE){
  process.stdout.write('pulse '+item.symbol+'... ');
  try{
    const data=await fetchRows(item.symbol),m=pulseMetrics(data.rows);
    if(!m){console.log('insufficient');continue}
    const state=descriptiveState(m),levels=scenarioLevels(m);
    const row={
      ...item,
      version:MARKET_PULSE_VERSION,
      asOf:dayKey(data.rows.at(-1).t),
      currency:data.currency,
      exchange:data.exchange,
      price:round(m.last),
      returns:{d1:round(m.ret1),d5:round(m.ret5),d20:round(m.ret20),d60:round(m.ret60),d120:round(m.ret120)},
      trend:{daily:m.dailyTrend,weekly:m.weeklyTrend,ma20:round(m.ma20),ma50:round(m.ma50),ma200:round(m.ma200),dist20:round(m.dist20),dist50:round(m.dist50),dist200:round(m.dist200)},
      momentum:{rsi14:round(m.rsi14,1),momentumShift:round(m.momentumShift),atr14Pct:round(m.atr14Pct,1)},
      structure:{swingTrend:m.swingTrend,higherHigh:m.higherHigh,higherLow:m.higherLow,highBroken:m.highBroken,lowBroken:m.lowBroken,localHigh:round(m.localHigh),localLow:round(m.localLow)},
      range:{pullback20:round(m.pullback20),pullback60:round(m.pullback60),pullback252:round(m.pullback252),rebound20:round(m.rebound20),rebound60:round(m.rebound60)},
      levels:{support:round(m.support),resistance:round(m.resistance),...levels},
      descriptiveState:state
    };
    markets.push(row);
    console.log(row.asOf,state.state);
  }catch(e){console.log('SKIP '+e.message)}
}

const equity=markets.filter(x=>x.group==='Equity Index');
const metals=markets.filter(x=>x.group==='Commodity');
const crypto=markets.filter(x=>x.group==='Crypto');
const breadthLike={
  equityParticipation:equity.length?round(equity.filter(x=>x.returns.d20>0).length/equity.length*100,1):null,
  metalsParticipation:metals.length?round(metals.filter(x=>x.returns.d20>0).length/metals.length*100,1):null,
  cryptoParticipation:crypto.length?round(crypto.filter(x=>x.returns.d20>0).length/crypto.length*100,1):null
};
const report={
  version:MARKET_PULSE_VERSION,
  generatedAt:new Date().toISOString(),
  purpose:'Cross-market context and scenario framing. Descriptive only until historical state validation is completed.',
  universe:MARKET_PULSE_UNIVERSE,
  markets,
  crossMarket:breadthLike
};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/market-pulse-latest.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
