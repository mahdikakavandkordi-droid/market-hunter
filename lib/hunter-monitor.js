import {metrics} from './market-hunter-v2-engine.js';
const date=row=>new Date(row.t*1000).toISOString().slice(0,10);
const pct=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b>0?(a/b-1)*100:null;
// A derived read-only view. Original decisions and outcomes are never modified.
export function buildHunterMonitor({sessions=[],episodes=[],outcomes=[],symbolRows=new Map(),benchmarkRows=[],generatedAt=new Date().toISOString()}){
  const ordered=[...sessions].sort((a,b)=>a.marketDate.localeCompare(b.marketDate));
  const latest=ordered.at(-1);if(!latest)throw new Error('no_canonical_sessions');
  const first=new Map();
  for(const e of [...episodes].filter(e=>e.scope==='stage').sort((a,b)=>a.startDate.localeCompare(b.startDate))){if(!first.has(e.symbol))first.set(e.symbol,e);}
  const classified=new Map((latest.classified||[]).map(x=>[x.symbol,x.stage]));
  const surfaced=new Set(Object.values(latest.stagePicks||{}).flat().map(x=>x.symbol));
  const bench=benchmarkRows.filter(x=>date(x)<=latest.marketDate);
  const rows=[...first.values()].map(e=>{
    const series=(symbolRows.get(e.symbol)||[]).filter(x=>date(x)<=latest.marketDate);
    const exact=series.find(x=>date(x)===latest.marketDate);
    const entry=e.decision||{};
    const m=exact?metrics(series,bench):null;
    const isNew=e.startDate===latest.marketDate;
    const value=exact&&!isNew?pct(exact.close,entry.price):null;
    const entrySupport=Number.isFinite(entry.localLow)?entry.localLow:null;
    const supportBroken=!!exact&&((entrySupport!==null&&entrySupport<entry.price&&exact.close<entrySupport)||m?.lowBroken===true);
    const cooling=!!m&&(m.momentumShift<0||m.dist20<0);
    const status=!exact?'unavailable':isNew?'new':supportBroken?'support_broken':cooling?'cooling':value>0?'progress':'watch';
    const reasons=!exact?['quote_unavailable']:isNew?['no_post_selection_session']:supportBroken?['support_broken']:cooling?[...(m.momentumShift<0?['momentum_fading']:[]),...(m.dist20<0?['below_ma20']:[])]:value>0?['above_first_selection']:['no_positive_follow_through'];
    const previous=series.filter(x=>date(x)<latest.marketDate).at(-1);
    const benchmark0=bench.find(x=>date(x)===e.startDate),benchmark1=bench.find(x=>date(x)===latest.marketDate);
    const benchmarkReturn=benchmark0&&benchmark1?pct(benchmark1.close,benchmark0.close):null;
    return {symbol:e.symbol,name:entry.name||e.symbol,firstDate:e.startDate,entryStage:e.entryStage,entryPrice:entry.price,entrySupport,
      price:exact?.close??null,asOf:exact?latest.marketDate:null,dayChangePct:exact&&previous?pct(exact.close,previous.close):null,
      sinceSelectionPct:value,benchmarkReturnPct:benchmarkReturn,excessReturnPct:Number.isFinite(value)&&Number.isFinite(benchmarkReturn)?value-benchmarkReturn:null,
      currentStage:classified.get(e.symbol)||null,surfaced:surfaced.has(e.symbol),status,reasons,
      momentumShift:m?.momentumShift??null,dist20:m?.dist20??null,support:m?.localLow??null,
      sessionsSinceSelection:bench.filter(x=>date(x)>e.startDate).length};
  });
  const matured=outcomes.filter(x=>x.scope==='stage');
  return {version:'hunter-monitor-v1',generatedAt,marketAsOf:latest.marketDate,firstRecordedDate:ordered[0].marketDate,completeSessions:ordered.length,
    note:'Descriptive selection tracking, not executed trades. Dates and holding periods differ. Missing quotes are retained explicitly.',
    summary:{total:rows.length,up:rows.filter(x=>x.sinceSelectionPct>0).length,down:rows.filter(x=>x.sinceSelectionPct<0).length,new:rows.filter(x=>x.status==='new').length,missing:rows.filter(x=>x.status==='unavailable').length},
    maturedByHorizon:Object.fromEntries([5,10,20].map(h=>{const a=matured.filter(x=>x.horizonSessions===h);return [h,{episodes:a.length,uniqueSymbols:new Set(a.map(x=>x.symbol)).size,meanReturnPct:a.length?a.reduce((s,x)=>s+x.returnPct,0)/a.length:null}]})),rows};
}
export const MONITOR_BASE='https://raw.githubusercontent.com/mahdikakavandkordi-droid/market-hunter/research/market-hunter-forward-validation/data/research/market-hunter-forward-validation/';
export async function loadHunterMonitor({fetcher=fetch}={}){
  const r=await fetcher(MONITOR_BASE+'monitor.json?v='+Math.floor(Date.now()/60000),{cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error('hunter_monitor_unavailable');
  const d=await r.json();
  if(d?.version!=='hunter-monitor-v1'||!Array.isArray(d.rows)||!d.marketAsOf)throw new Error('invalid_hunter_monitor');
  return d;
}
