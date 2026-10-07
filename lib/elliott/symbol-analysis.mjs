import {analyzeElliott,indicators} from './engine.mjs';
const DAY=86400000;
const MARKET=Object.freeze({us:{mode:'stock',reference:'SPY'},ca:{mode:'stock',reference:'XIU.TO'},crypto:{mode:'crypto'},metals:{mode:'stock',reference:'SPY'}});
const iso=t=>new Date(t).toISOString();
const parts=(t,zone)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(t)).map(x=>[x.type,x.value]));
const day=(t,zone)=>{const p=parts(t,zone);return `${p.year}-${p.month}-${p.day}`};
function stockCompletion(date) {
  const guess=Date.parse(date+'T17:00:00Z'),p=parts(guess,'America/Toronto');
  return guess+(17*60-(Number(p.hour)*60+Number(p.minute)))*60000;
}
export function resolveSymbol(input,market) {
  if(!Object.hasOwn(MARKET,market))throw new Error('invalid_market');
  if(typeof input!=='string')throw new Error('invalid_symbol');
  let symbol=input.trim().toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(symbol))throw new Error('invalid_symbol');
  if(market!=='ca'&&symbol.endsWith('.TO'))throw new Error('market_symbol_mismatch');
  if(market!=='crypto'&&symbol.endsWith('-USD'))throw new Error('market_symbol_mismatch');
  if(market==='ca'&&!symbol.endsWith('.TO'))symbol+='.TO';
  if(market==='crypto'&&!symbol.endsWith('-USD'))symbol+='-USD';
  return {symbol,market,...MARKET[market]};
}

export async function fetchChart(symbol,{fetcher=fetch,range="2y",interval="1d"}={}) {
  if(!((range==="2y"&&interval==="1d")||(range==="60d"&&interval==="1h")))throw Error("unsupported_chart_window");
  let failure;
  for(const host of ['query1','query2']) {
    try {
      const url=`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
      const r=await fetcher(url,{headers:{'User-Agent':'MarketHunterElliott/1.0'},signal:AbortSignal.timeout(7000)});
      if(!r.ok)throw new Error('provider_http_'+r.status);
      const payload=await r.json(),chart=payload?.chart?.result?.[0];
      if(!chart?.timestamp?.length||!chart?.indicators?.quote?.[0])throw new Error('provider_no_quotes');
      return chart;
    }catch(e){failure=e}
  }
  throw new Error('provider_unavailable',{cause:failure});
}

export function normalizeChart(chart,{mode,asOf}) {
  if(!Number.isFinite(asOf))throw new Error('invalid_asOf');
  const q=chart?.indicators?.quote?.[0],times=chart?.timestamp;
  if(!q||!Array.isArray(times)||times.length>1100)throw new Error('invalid_provider_shape');
  const regular=chart.meta?.currentTradingPeriod?.regular||{},rows=[],invalidDates=[],seen=new Set(),seenDates=new Set();
  for(let i=0;i<times.length;i++) {
    const t=times[i]*1000;
    if(!Number.isFinite(t)||seen.has(t))throw new Error('invalid_provider_timestamp');
    seen.add(t);
    const date=mode==='crypto'?iso(t).slice(0,10):day(t,'America/Toronto');
    let endT=mode==='crypto'?(Math.floor(t/DAY)+1)*DAY:stockCompletion(date);
    if(mode==='crypto'&&t%DAY!==0)throw new Error('invalid_crypto_daily_grid');
    if(mode==='stock'&&Number.isFinite(regular.start)&&Number.isFinite(regular.end)
      &&regular.end>regular.start&&date===day(regular.start*1000,'America/Toronto'))endT=regular.end*1000;
    if(endT>asOf)continue;
    if(seenDates.has(date))throw new Error('duplicate_provider_date');
    seenDates.add(date);
    const row={t,endT,date,o:q.open?.[i],h:q.high?.[i],l:q.low?.[i],c:q.close?.[i],v:q.volume?.[i]??null};
    if(![row.o,row.h,row.l,row.c].every(x=>Number.isFinite(x)&&x>0)
      ||row.h<Math.max(row.o,row.c,row.l)||row.l>Math.min(row.o,row.c,row.h)||endT<=t) {
      invalidDates.push(date);continue;
    }
    if(rows.length&&t<=rows.at(-1).t)throw new Error('unordered_provider_rows');
    rows.push(row);
  }
  return {rows,invalidDates};
}

export function detectGaps(rows,{mode,referenceDates=[],invalidDates=[]}) {
  const gaps=[];
  const bad=new Set(invalidDates);
  for(let i=1;i<rows.length;i++) {
    const prev=rows[i-1],curr=rows[i];
    const missing=mode==='crypto'?curr.t-prev.t!==DAY:
      referenceDates.some(d=>d>prev.date&&d<curr.date)||[...bad].some(d=>d>prev.date&&d<curr.date);
    if(missing)gaps.push(curr.t);
  }
  return gaps;
}

export async function loadSymbolAnalysis(input,market,{fetcher=fetch,nowMs=Date.now()}={}) {
  const instrument=resolveSymbol(input,market),{symbol,mode,reference}=instrument;
  const [chart,calendar]=await Promise.all([fetchChart(symbol,{fetcher}),
    reference?(symbol===reference?Promise.resolve(null):fetchChart(reference,{fetcher})):Promise.resolve(null)]);
  if(chart.meta?.symbol && chart.meta.symbol.toUpperCase()!==symbol)throw new Error('provider_symbol_mismatch');
  const type=chart.meta?.instrumentType;
  if(mode==='crypto'&&type&&type!=='CRYPTOCURRENCY')throw new Error('provider_market_mismatch');
  if(mode==='stock'&&type&&!['EQUITY','ETF'].includes(type))throw new Error('provider_market_mismatch');
  if(mode==='stock'&&chart.meta?.exchangeTimezoneName&&!['America/New_York','America/Toronto'].includes(chart.meta.exchangeTimezoneName))throw new Error('provider_market_mismatch');
  const own=normalizeChart(chart,{mode,asOf:nowMs});
  const ref=mode==='stock'?normalizeChart(calendar||chart,{mode,asOf:nowMs}):null;
  if(ref?.invalidDates.length||ref?.rows.length===0)throw new Error('reference_calendar_unavailable');
  const referenceDates=ref?.rows.map(b=>b.date)||[];
  const gaps=detectGaps(own.rows,{mode,referenceDates,invalidDates:own.invalidDates});
  const regular=(calendar||chart).meta?.currentTradingPeriod?.regular||{};
  let expected=mode==='crypto'?iso(Math.floor(nowMs/DAY)*DAY-DAY).slice(0,10):referenceDates.at(-1);
  if(mode==='stock'&&Number.isFinite(regular.start)&&Number.isFinite(regular.end)
    &&regular.end>regular.start&&nowMs>=regular.end*1000+300000) {
    const completedDate=day(regular.start*1000,'America/Toronto');
    if(completedDate>expected)throw new Error('reference_calendar_unavailable');
  }
  const latest=own.rows.at(-1);
  const splitEvents=Object.values(chart.events?.splits||{}).filter(e=>{
    const t=Number(e.date)*1000;return Number.isFinite(t)&&t>=(own.rows[0]?.t??Infinity)&&t<=nowMs;
  });
  const reasons=[];
  if(own.rows.length<30)reasons.push('insufficient_history');
  if(!latest||latest.date!==expected)reasons.push('stale_data');
  if(own.invalidDates.length)reasons.push('invalid_source_rows');
  if(splitEvents.length)reasons.push('split_event_requires_review');
  if(mode==='stock'&&own.rows.some(b=>!referenceDates.includes(b.date)))reasons.push('off_reference_calendar');
  const usable=reasons.length===0;
  // A missing path resets structure. A stale/split-corrupted source is never
  // presented as a current eligible setup, even if an old pattern exists.
  const analysis=usable?analyzeElliott(own.rows,{symbol,asOf:nowMs,gapBeforeTimes:gaps}):null;
  return {version:'elliott-symbol-analysis-v1',symbol,market,mode,timeframe:'1D',
    name:chart.meta?.shortName||chart.meta?.longName||symbol,currency:chart.meta?.currency||null,
    generatedAt:iso(nowMs),dataAsOf:latest?iso(latest.endT):null,source:'Yahoo Finance observed daily quotes',
    quality:{usable,status:usable?(gaps.length?'gapped_history':'available'):reasons[0],reasons,
      knownGaps:gaps.length,invalidRows:own.invalidDates.length,expectedCompletedDate:expected||null,
      reference:reference||null,calendarConvention:mode==='crypto'?'continuous UTC days':'observed reference ETF sessions',
      completionConvention:mode==='crypto'?'UTC midnight':'provider current-session end; historical 17:00 Toronto conservative'},
    bars:own.rows,analysis,
    indicators:usable?indicators(own.rows.slice(gaps.length?own.rows.findIndex(b=>b.t===gaps.at(-1)):0)):null,
    limitations:['research_counts_not_certain','observed_provider_calendar','unsupported_complex_patterns',
      'analysis_does_not_place_orders',...(mode==='crypto'?['aggregate_crypto_volume_not_exchange_specific']:[])]};
}
