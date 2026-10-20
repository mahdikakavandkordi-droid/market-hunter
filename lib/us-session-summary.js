const day=t=>Number.isFinite(t)?new Date(t*1000).toISOString().slice(0,10):null;
const positive=n=>Number.isFinite(n)&&n>0;

// Recover only the last, entirely missing close pair from a completed session's
// explicit summary in the SAME provider payload. Historical rows stay untouched.
// No estimates, previous-price carry, quote from another day or other feed.
export function recoverUSSessionSummary(payload,symbol,nowMs=Date.now()){
  const m=payload?.meta,q=payload?.indicators?.quote?.[0],a=payload?.indicators?.adjclose?.[0]?.adjclose;
  const timestamps=payload?.timestamp,n=(timestamps?.length||0)-1;
  if(!m||!q||!Array.isArray(a)||n<1||m.symbol!==symbol||m.currency!=='USD'||m.instrumentType!=='EQUITY'||m.dataGranularity!=='1d')return null;
  if(q.close?.[n]!=null||a[n]!=null)return null;
  const t=timestamps[n],previous=timestamps[n-1],regular=m.currentTradingPeriod?.regular;
  const start=regular?.start,end=regular?.end,quoteTime=m.regularMarketTime;
  if(![t,previous,start,end,quoteTime,nowMs].every(Number.isFinite)||end<=start)return null;
  if(nowMs<end*1000+15*60000||Math.abs(quoteTime-end)>60||day(t)!==day(end)||day(quoteTime)!==day(t)||previous>=t)return null;
  const close=m.regularMarketPrice,high=m.regularMarketDayHigh,low=m.regularMarketDayLow,volume=m.regularMarketVolume;
  if(![close,high,low,volume].every(positive)||high<low||close<low||close>high)return null;
  // At the latest session adjusted close can equal raw close only on the current
  // normalization basis. Require that basis already established immediately
  // before it, with no intervening dividend/split event.
  const previousRaw=q.close?.[n-1],previousAdjusted=a[n-1];
  if(!positive(previousRaw)||!positive(previousAdjusted)||Math.abs(previousAdjusted/previousRaw-1)>1e-6)return null;
  const events=[...Object.values(payload.events?.dividends||{}),...Object.values(payload.events?.splits||{})];
  if(events.some(e=>!Number.isFinite(e.date)||(day(e.date)>day(previous)&&day(e.date)<=day(t))))return null;
  const row={t,close,rawClose:close,high,low,volume};
  return {row,evidence:{method:'yahoo-completed-session-summary-v1',symbol,date:day(t),providerTime:quoteTime,sessionEnd:end,close,high,low,volume,previousAdjustmentFactor:previousAdjusted/previousRaw}};
}
