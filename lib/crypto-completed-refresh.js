import {completedCryptoDailyRows} from './completed-daily-session.js';

const DAY=86400000;
const day=t=>new Date(t*1000).toISOString().slice(0,10);
const same=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b));

// A long-history response can lag the provider's recent daily window. Recover
// only consecutive, fully closed UTC bars from the SAME symbol/provider, after
// verifying an overlapping bar. Never replace history or use a live quote.
export async function refreshCompletedCryptoRows({symbol,rows,nowMs=Date.now(),fetcher=fetch}){
  const dayStart=Math.floor(nowMs/DAY)*DAY,expected=(dayStart-DAY)/1000;
  const last=rows.at(-1);
  if(!last||last.t>=expected)return {rows,recovery:null};
  const start=(dayStart-40*DAY)/1000;
  const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+
    '?period1='+start+'&period2='+dayStart/1000+'&interval=1d&includePrePost=false&events=div%2Csplits';
  const res=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0 MarketHunterMarketPulse/1.0'}});
  if(!res.ok)throw new Error('recent_crypto_window: HTTP '+res.status);
  const body=await res.json(),z=body?.chart?.result?.[0],m=z?.meta,q=z?.indicators?.quote?.[0],adj=z?.indicators?.adjclose?.[0]?.adjclose;
  if(m?.symbol!==symbol||m.currency!=='USD'||m.instrumentType!=='CRYPTOCURRENCY'||m.dataGranularity!=='1d'||!q)throw new Error('recent_crypto_window: identity mismatch');
  const recent=completedCryptoDailyRows((z.timestamp||[]).map((t,i)=>({t,close:q.close?.[i],rawClose:q.close?.[i],high:q.high?.[i],low:q.low?.[i],volume:q.volume?.[i],adjusted:adj?.[i]})),nowMs)
    .filter(r=>Number.isInteger(r.t)&&r.t%86400===0&&[r.close,r.high,r.low].every(v=>Number.isFinite(v)&&v>0)&&r.high>=r.close&&r.low<=r.close&&r.high>=r.low&&(!Number.isFinite(r.adjusted)||same(r.close,r.adjusted)));
  const overlap=recent.filter(r=>r.t===last.t);
  if(overlap.length!==1||!['close','high','low'].every(k=>same(overlap[0][k],last[k])))throw new Error('recent_crypto_window: overlapping session mismatch');
  const additions=recent.filter(r=>r.t>last.t);
  if(!additions.length||additions.at(-1).t!==expected||additions.some((r,i)=>r.t!==(i?additions[i-1].t:last.t)+86400))throw new Error('recent_crypto_window: completed sessions still missing or unordered');
  const clean=additions.map(({adjusted,...r})=>r);
  return {rows:[...rows,...clean],recovery:{method:'yahoo-completed-crypto-window-v1',overlapSession:day(last.t),appendedSessions:clean.map(r=>day(r.t)),checkedAt:new Date(nowMs).toISOString()}};
}
