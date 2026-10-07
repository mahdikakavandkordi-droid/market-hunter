import {aggregateCrypto4H,aggregateExchange4H,buildGapBeforeIndex,zonedParts} from './research-bars.mjs';
import {digest} from './features.mjs';
const DAY=86400000,HOUR=3600000,iso=t=>new Date(t).toISOString();
export async function chart(symbol,range,interval,{fetcher=fetch}={}) {
  let error;
  for(const host of ['query1','query2'])try{
    const url=`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=splits`;
    const r=await fetcher(url,{signal:AbortSignal.timeout(18000),headers:{'User-Agent':'MarketHunterWaveML/1.0'}}),raw=await r.json();
    const c=raw.chart?.result?.[0];if(!r.ok||!c?.timestamp?.length)throw Error('source_failure_'+r.status);
    if(c.meta?.symbol?.toUpperCase()!==symbol)throw Error('source_identity_mismatch');
    return {url,c,raw,checksum:digest(raw)};
  }catch(e){error=e}
  throw error;
}
export function normalize(c,{mode,interval,asOf}) {
  if(mode==='stock'&&!['America/New_York','America/Toronto'].includes(c.meta?.exchangeTimezoneName))throw Error('foreign_session');
  if(mode==='crypto'&&c.meta?.instrumentType!=='CRYPTOCURRENCY')throw Error('foreign_instrument');
  if(mode==='stock'&&!['EQUITY','ETF'].includes(c.meta?.instrumentType))throw Error('foreign_instrument');
  const q=c.indicators?.quote?.[0],rows=[],invalid=[],seen=new Set(),dropped=[];
  for(let i=0;i<c.timestamp.length;i++) {
    const t=c.timestamp[i]*1000;if(!Number.isFinite(t)||seen.has(t))throw Error('duplicate_or_invalid_time');seen.add(t);
    const date=mode==='crypto'?iso(t).slice(0,10):zonedParts(t).date;
    let endT=t+HOUR;
    if(interval==='1d') {
      if(mode==='crypto'){if(t%DAY!==0)throw Error('crypto_daily_grid');endT=t+DAY}
      else {const guess=Date.parse(date+'T17:00:00Z'),p=zonedParts(guess);endT=guess+(17*60-p.hour*60-p.minute)*60000}
    }else if(mode==='crypto'&&t%HOUR!==0){dropped.push({t,reason:'off_hour_grid'});continue}
    if(endT>asOf){dropped.push({t,reason:'not_completed'});continue}
    const b={t,endT,date,o:q?.open?.[i],h:q?.high?.[i],l:q?.low?.[i],c:q?.close?.[i],v:q?.volume?.[i]??null};
    if(![b.o,b.h,b.l,b.c].every(x=>Number.isFinite(x)&&x>0)||b.h<Math.max(b.o,b.l,b.c)||b.l>Math.min(b.o,b.h,b.c)){invalid.push({t,date});continue}
    if(rows.length&&t<=rows.at(-1).t)throw Error('unordered_time');rows.push(b);
  }
  return {rows,invalid,dropped};
}
export function makeSnapshot(symbol,market,dailySource,hourlySource,referenceDates,asOf) {
  const mode=market==='crypto'?'crypto':'stock',daily=normalize(dailySource.c,{mode,interval:'1d',asOf}),hourly=normalize(hourlySource.c,{mode,interval:'1h',asOf});
  const splits=Object.values(dailySource.c.events?.splits||{}).map(e=>({t:e.date*1000,date:mode==='crypto'?iso(e.date*1000).slice(0,10):zonedParts(e.date*1000).date})).filter(e=>Number.isFinite(e.t)&&e.t<=asOf);
  const gaps=[];
  for(let i=1;i<daily.rows.length;i++) {
    const a=daily.rows[i-1],b=daily.rows[i];
    if((mode==='crypto'?b.t-a.t!==DAY:referenceDates.some(d=>d>a.date&&d<b.date))||daily.invalid.some(x=>x.date>a.date&&x.date<=b.date)||splits.some(s=>s.date>a.date&&s.date<=b.date))gaps.push(b.t);
  }
  const execution=mode==='crypto'?aggregateCrypto4H(hourly.rows,{nowMs:asOf}):aggregateExchange4H(hourly.rows,{nowMs:asOf});
  const exGaps=buildGapBeforeIndex(execution.bars,{mode,diagnostics:execution.diagnostics,tradingDates:referenceDates});
  const mismatches=[];
  for(const d of daily.rows) {
    const xs=execution.bars.filter(b=>b.date===d.date);
    if(xs.length!==(mode==='crypto'?6:2))continue;
    if(Math.abs(xs[0].o-d.o)/d.o>.005||Math.abs(xs.at(-1).c-d.c)/d.c>.005)mismatches.push(d.date);
  }
  // Same-day hourly/daily consistency is known by that day's conservative close.
  // Flag it; do not repair prices or reset all past features based on future data.
  for(const d of daily.rows)if(mismatches.includes(d.date))gaps.push(d.t);
  return {version:'wave-ml-source-snapshot-v1',symbol,market,mode,asOf:iso(asOf),currency:dailySource.c.meta.currency||null,
    sources:{daily:{url:dailySource.url,checksum:dailySource.checksum},hourly:{url:hourlySource.url,checksum:hourlySource.checksum}},
    daily:daily.rows,dailyGapBeforeTimes:[...new Set(gaps)].sort((a,b)=>a-b),hourly:hourly.rows,
    executionBars:execution.bars,executionGapBeforeTimes:[...exGaps.keys()].map(i=>execution.bars[i].t),
    quality:{calendar:mode==='crypto'?'continuous_UTC':'observed_reference_ETF_not_authoritative',splits,dailyInvalid:daily.invalid,
      hourlyInvalid:hourly.invalid,dailyDropped:daily.dropped,hourlyDropped:hourly.dropped,
      aggregationDiagnostics:execution.diagnostics,priceMismatchDates:mismatches,
      executionCalendarApproval:mode==='crypto'?'continuous':'pending_authoritative_short_session_validation'}};
}
