import {metrics} from './market-hunter-v2-engine.js';
import {summarizeHunterQuality} from './hunter-quality.js';
import {selectionBasis,measuredOutcomes,coverageForSessions} from './hunter-measurement.js';
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
    const basis=selectionBasis(series,e.startDate,entry.price);
    const m=exact?metrics(series,bench):null;
    const isNew=e.startDate===latest.marketDate;
    const available=!!exact&&basis.status==='available';
    const value=available&&!isNew?pct(exact.close,basis.entryPrice):null;
    const entrySupport=Number.isFinite(entry.localLow)&&available?entry.localLow*basis.scale:null;
    const supportBroken=available&&((entrySupport!==null&&entrySupport<basis.entryPrice&&exact.close<entrySupport)||m?.lowBroken===true);
    const cooling=!!m&&(m.momentumShift<0||m.dist20<0);
    const status=!available?'unavailable':isNew?'new':supportBroken?'support_broken':cooling?'cooling':value>0?'progress':'watch';
    const reasons=!exact?['quote_unavailable']:!available?['entry_basis_unavailable']:isNew?['no_post_selection_session']:supportBroken?['support_broken']:cooling?[...(m.momentumShift<0?['momentum_fading']:[]),...(m.dist20<0?['below_ma20']:[])]:value>0?['above_first_selection']:['no_positive_follow_through'];
    const previous=series.filter(x=>date(x)<latest.marketDate).at(-1);
    const benchmark0=bench.find(x=>date(x)===e.startDate),benchmark1=bench.find(x=>date(x)===latest.marketDate);
    const benchmarkReturn=benchmark0&&benchmark1?pct(benchmark1.close,benchmark0.close):null;
    const homeDates=ordered.filter(s=>(s.integrated||[]).some(p=>p.symbol===e.symbol)).map(s=>s.marketDate);
    return {symbol:e.symbol,name:entry.name||e.symbol,firstDate:e.startDate,entryStage:e.entryStage,entryPrice:entry.price,entrySupport,measurementBasis:basis,
      firstHomeDate:homeDates[0]||null,everOnHome:homeDates.length>0,onHome:(latest.integrated||[]).some(p=>p.symbol===e.symbol),
      price:exact?.close??null,asOf:exact?latest.marketDate:null,dayChangePct:exact&&previous?pct(exact.close,previous.close):null,
      sinceSelectionPct:value,benchmarkReturnPct:benchmarkReturn,excessReturnPct:Number.isFinite(value)&&Number.isFinite(benchmarkReturn)?value-benchmarkReturn:null,
      currentStage:classified.get(e.symbol)||null,surfaced:surfaced.has(e.symbol),status,reasons,
      momentumShift:m?.momentumShift??null,dist20:m?.dist20??null,support:m?.localLow??null,
      sessionsSinceSelection:bench.filter(x=>date(x)>e.startDate).length};
  });
  const projected=measuredOutcomes(outcomes,symbolRows,benchmarkRows,latest.marketDate);
  const matured=projected.filter(x=>x.scope==='stage'&&x.targetDate<=latest.marketDate);
  return {version:'hunter-monitor-v1',generatedAt,marketAsOf:latest.marketDate,firstRecordedDate:ordered[0].marketDate,completeSessions:ordered.length,
    note:'Descriptive selection tracking, not executed trades. Dates and holding periods differ. Missing quotes are retained explicitly.',
    coverage:coverageForSessions(ordered,benchmarkRows,latest.marketDate),
    measurement:{version:'same-source-adjusted-endpoints-v1',originalLedgerPreserved:true,records:projected.filter(x=>x.targetDate<=latest.marketDate).length,
      excluded:projected.filter(x=>x.targetDate<=latest.marketDate&&x.status!=='available').length,
      changed:projected.filter(x=>x.targetDate<=latest.marketDate&&Number.isFinite(x.returnPct)&&Number.isFinite(x.recordedReturnPct)&&Math.abs(x.returnPct-x.recordedReturnPct)>.1).length},
    quality:summarizeHunterQuality(projected,latest.marketDate),
    summary:{total:rows.length,up:rows.filter(x=>x.sinceSelectionPct>0).length,down:rows.filter(x=>x.sinceSelectionPct<0).length,new:rows.filter(x=>x.status==='new').length,missing:rows.filter(x=>x.status==='unavailable').length},
    maturedByHorizon:Object.fromEntries([5,10,20].map(h=>{const a=matured.filter(x=>x.horizonSessions===h),usable=a.filter(x=>Number.isFinite(x.returnPct));return [h,{episodes:a.length,excludedMissing:a.length-usable.length,uniqueSymbols:new Set(usable.map(x=>x.symbol)).size,meanReturnPct:usable.length?usable.reduce((s,x)=>s+x.returnPct,0)/usable.length:null}]})),rows};
}
export const MONITOR_BASE='https://raw.githubusercontent.com/mahdikakavandkordi-droid/market-hunter/research/market-hunter-forward-validation/data/research/market-hunter-forward-validation/';
export async function loadHunterMonitor({fetcher=fetch}={}){
  const r=await fetcher(MONITOR_BASE+'monitor.json?v='+Math.floor(Date.now()/60000),{cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error('hunter_monitor_unavailable');
  const d=await r.json();
  if(d?.version!=='hunter-monitor-v1'||!Array.isArray(d.rows)||!d.marketAsOf)throw new Error('invalid_hunter_monitor');
  return d;
}
