export const INDEX_QUOTES=[['^GSPTSE','TSX'],['^GSPC','S&P 500'],['^IXIC','Nasdaq'],['GC=F','Gold futures'],['SI=F','Silver futures'],['BTC-USD','Bitcoin'],['ETH-USD','Ethereum']];
export function torontoClock(now=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,weekday:parts.weekday,minute:Number(parts.hour)*60+Number(parts.minute)};
}
export function regularWindow(now=new Date()){
  const c=torontoClock(now);return !['Sat','Sun'].includes(c.weekday)&&c.minute>=570&&c.minute<960;
}
export function normalizeQuote(result,symbol,name,now=new Date()){
  const m=result?.meta||{},price=m.regularMarketPrice,previous=m.chartPreviousClose??m.previousClose;
  const timestamp=m.regularMarketTime,age=now.getTime()/1000-timestamp;
  if(!Number.isFinite(price)||price<=0||!Number.isFinite(timestamp)||age< -60)throw Error('invalid_quote');
  const sessionDate=torontoClock(new Date(timestamp*1000)).date;
  const period=m.currentTradingPeriod?.regular;
  return {symbol,name,price,currency:m.currency||null,previousClose:Number.isFinite(previous)&&previous>0?previous:null,
    changePct:Number.isFinite(previous)&&previous>0?(price/previous-1)*100:null,
    volume:Number.isFinite(m.regularMarketVolume)?m.regularMarketVolume:null,
    quoteAt:new Date(timestamp*1000).toISOString(),sessionDate,stale:sessionDate!==torontoClock(now).date||age>1800,
    sessionStart:period?.start??null,sessionEnd:period?.end??null};
}
export function benchmarkOpen(quote,now=new Date()){
  const sec=now.getTime()/1000;
  return regularWindow(now)&&quote.sessionDate===torontoClock(now).date&&!quote.stale&&
    Number.isFinite(quote.sessionStart)&&Number.isFinite(quote.sessionEnd)&&sec>=quote.sessionStart&&sec<quote.sessionEnd;
}
export async function fetchQuote(symbol,name,now=new Date()){
  let last;
  for(const host of ['query1','query2']){
    try{
      const r=await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m&includePrePost=false`,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'MarketHunter-Intraday/1.0'}});
      if(!r.ok)throw Error('http_'+r.status);
      const p=await r.json();return normalizeQuote(p.chart?.result?.[0],symbol,name,now);
    }catch(e){last=e;}
  }
  throw last;
}
