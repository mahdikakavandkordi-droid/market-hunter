import {metrics,classify} from '../lib/market-hunter-v2-engine.js';
import {UNIVERSE} from '../lib/universe.js';

const UNIVERSE_META=new Map(UNIVERSE.map(([symbol,name,sector])=>[symbol,{name,sector}]));

const CDR_BENCHMARK={
  'AAPL.TO':'^IXIC','MSFT.TO':'^IXIC','NVDA.TO':'^IXIC','AMZN.TO':'^IXIC',
  'GOOG.TO':'^IXIC','META.TO':'^IXIC','TSLA.TO':'^IXIC','AMD.TO':'^IXIC','COST.TO':'^GSPC'
};

function dayKey(t){return new Date(t*1000).toISOString().slice(0,10)}
function pct(a,b){return Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a/b-1)*100:null}
function sinceEntryStats(rows,benchRows,entry){
  if(!entry?.date||!(Number(entry.price)>0))return null;
  const held=rows.filter(x=>dayKey(x.t)>=entry.date);
  if(!held.length)return {sessions:0,partialHistory:true};
  const entryPrice=Number(entry.price),current=held.at(-1)?.close;
  const maxHigh=Math.max(...held.map(x=>Number.isFinite(x.high)?x.high:x.close).filter(Number.isFinite));
  let peak=null,maxDrawdown=0;
  for(const x of held){
    const close=x.close;if(!Number.isFinite(close))continue;
    peak=peak===null?close:Math.max(peak,close);
    if(peak>0)maxDrawdown=Math.min(maxDrawdown,(close/peak-1)*100);
  }
  const benchHeld=(benchRows||[]).filter(x=>dayKey(x.t)>=entry.date);
  const benchmarkReturn=benchHeld.length>=2?pct(benchHeld.at(-1).close,benchHeld[0].close):null;
  const sinceEntryReturn=pct(current,entryPrice);
  return {
    sessions:held.length,
    partialHistory:dayKey(rows[0].t)>entry.date,
    sinceEntryReturn,
    maxGainPct:pct(maxHigh,entryPrice),
    maxDrawdownPct:maxDrawdown,
    benchmarkReturnPct:benchmarkReturn,
    excessVsBenchmarkPct:Number.isFinite(sinceEntryReturn)&&Number.isFinite(benchmarkReturn)?sinceEntryReturn-benchmarkReturn:null
  };
}
async function chart(symbol,deadline=Date.now()+22000){
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d&includePrePost=false&events=div%2Csplits`;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Math.max(1,Math.min(9000,deadline-Date.now())));
  try{
    const r=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0 MarketHunter/1.0'}});
    if(!r.ok)throw new Error(`${symbol} ${r.status}`);
    const j=await r.json(),res=j?.chart?.result?.[0];
    if(!res)throw new Error(`${symbol} unavailable`);
    const q=res.indicators?.quote?.[0]||{},adj=res.indicators?.adjclose?.[0]?.adjclose||q.close||[];
    const sessionEnd=res.meta?.currentTradingPeriod?.regular?.end;
    const currentSession=sessionEnd?dayKey(sessionEnd):null;
    const rows=(res.timestamp||[]).map((t,i)=>({
      t,close:adj[i],rawClose:q.close?.[i],high:q.high?.[i],low:q.low?.[i],volume:q.volume?.[i]
    })).filter(x=>Number.isFinite(x.close)&&x.close>0&&Number.isFinite(x.rawClose)&&x.rawClose>0)
      .filter(x=>dayKey(x.t)!==currentSession||Date.now()>=sessionEnd*1000);
    return {symbol,rows,currency:res.meta?.currency||null,exchangeName:res.meta?.exchangeName||null};
  }finally{clearTimeout(timer)}
}

async function mapLimit(values,limit,worker){
  const out=new Array(values.length);let next=0;
  async function run(){while(true){const i=next++;if(i>=values.length)return;try{out[i]={status:'fulfilled',value:await worker(values[i])}}catch(reason){out[i]={status:'rejected',reason}}}}
  await Promise.all(Array.from({length:Math.min(limit,values.length)},()=>run()));
  return out;
}

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  const raw=String(req.query.symbols||'');
  const symbols=[...new Set(raw.split(',').map(x=>x.trim().toUpperCase()).filter(x=>/^[A-Z0-9.^-]{1,16}$/.test(x)))].slice(0,30);
  const entryMap=new Map();
  for(const token of String(req.query.entries||'').split(',').filter(Boolean)){
    const [symbol,date,price]=token.split('|');
    const clean=String(symbol||'').trim().toUpperCase();
    if(symbols.includes(clean)&&/^\d{4}-\d{2}-\d{2}$/.test(date||'')&&Number(price)>0)entryMap.set(clean,{date,price:Number(price)});
  }
  if(!symbols.length)return res.status(200).json({generatedAt:new Date().toISOString(),items:[],failures:[]});
  const deadline=Date.now()+23000;
  const benchmarks=[...new Set(symbols.map(s=>CDR_BENCHMARK[s]||'^GSPTSE'))];
  try{
    const benchResults=await mapLimit(benchmarks,3,s=>chart(s,deadline));
    const benchMap=new Map();
    benchResults.forEach((r,i)=>{if(r.status==='fulfilled')benchMap.set(benchmarks[i],r.value.rows)});
    const results=await mapLimit(symbols,5,s=>chart(s,deadline));
    const items=[],failures=[];
    results.forEach((r,i)=>{
      const symbol=symbols[i];
      if(r.status!=='fulfilled'){failures.push({symbol,reason:String(r.reason?.message||r.reason||'unavailable')});return}
      const benchmark=CDR_BENCHMARK[symbol]||'^GSPTSE',bench=benchMap.get(benchmark);
      if(!bench){failures.push({symbol,reason:'benchmark_unavailable'});return}
      const m=metrics(r.value.rows,bench);
      if(!m){failures.push({symbol,reason:'insufficient_history'});return}
      const stage=classify(m),meta=UNIVERSE_META.get(symbol)||{};
      const entryStats=sinceEntryStats(r.value.rows,bench,entryMap.get(symbol));
      items.push({
        symbol,name:meta.name||symbol,sector:meta.sector||null,price:m.last,currency:r.value.currency,benchmark,entryStats,
        stage:stage||null,
        ret5:m.ret5,ret20:m.ret20,ret60:m.ret60,
        momentumShift:m.momentumShift,rs20:m.rs20,rs60:m.rs60,rsi14:m.rsi14,atr14Pct:m.atr14Pct,
        dist20:m.dist20,dist50:m.dist50,pullback60:m.pullback60,weeklyUp:m.weeklyUp,
        swingTrend:m.swingTrend,higherLow:m.higherLow,higherHigh:m.higherHigh,
        localLow:m.localLow,localHigh:m.localHigh,
        lowBroken:m.lowBroken,highBroken:m.highBroken,
        freshReclaimAge:m.freshReclaimAge,freshHighBreakAge:m.freshHighBreakAge,
        lowState:m.lowBroken===true?'local_low_broken':(Number.isFinite(m.freshReclaimAge)&&m.freshReclaimAge<=3?'failed_low_break':'local_low_held'),
        highState:m.highBroken===true?'local_high_broken':'local_high_intact',
        support:m.localLow,resistance:m.localHigh,
        upDownVolumeRatio:m.upDownVolumeRatio,maxRvol5:m.maxRvol5,
        asOf:r.value.rows.length?dayKey(r.value.rows.at(-1).t):null
      });
    });
    res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({generatedAt:new Date().toISOString(),items,failures});
  }catch(e){
    return res.status(500).json({error:'portfolio_monitor_failed',message:String(e?.message||e)});
  }
}
