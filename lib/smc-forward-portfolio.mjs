import {effectiveExitMs} from './smc-forward-runtime.mjs';

function finite(x){return Number.isFinite(x)}
function clone(x){return structuredClone(x)}

export function latestCompletedMark(bars,observedAt,{freshnessMs,source='completed_4h_close'}={}){
  if(!Array.isArray(bars)||!bars.length)return null;
  const observedMs=Date.parse(observedAt);
  const candidates=bars.filter(b=>finite(b?.c)&&finite(b?.endT)&&b.endT<=observedMs);
  if(!candidates.length)return null;
  const b=candidates.at(-1),ageMs=Math.max(0,observedMs-b.endT);
  return {
    price:b.c,markT:new Date(b.endT).toISOString(),source,ageMs,
    status:finite(freshnessMs)&&ageMs>freshnessMs?'stale':'fresh'
  };
}

function markedObservation(open,cash,marksBySymbol,observedAt,runKey){
  let missing=false,stale=false,totalUnrealized=0,knownOpenValue=0;
  const positions=open.map(p=>{
    const mark=marksBySymbol.get(p.symbol)||null;
    if(!mark||!finite(mark.price)){
      missing=true;
      return {...p,markPrice:null,markT:null,markStatus:'missing',unrealizedPnl:null,markedPositionValue:null};
    }
    const unrealized=p.dir*p.quantity*(mark.price-p.entry);
    totalUnrealized+=unrealized;
    knownOpenValue+=p.notional+unrealized;
    if(mark.status==='stale')stale=true;
    return {...p,markPrice:mark.price,markT:mark.markT,markStatus:mark.status,markSource:mark.source,unrealizedPnl:unrealized,markedPositionValue:p.notional+unrealized};
  });
  const markedEquity=missing?null:cash+knownOpenValue;
  return {
    runKey,observedAt,quality:missing?'incomplete_missing_marks':(stale?'stale_marks':'fresh'),
    markedEquity,totalUnrealizedPnl:missing?null:totalUnrealized,
    missingSymbols:positions.filter(x=>x.markStatus==='missing').map(x=>x.symbol),
    staleSymbols:positions.filter(x=>x.markStatus==='stale').map(x=>x.symbol),
    positions
  };
}

export function appendMarkedSeries(priorSeries,observation){
  const series=Array.isArray(priorSeries)?priorSeries.map(clone):[];
  if(!series.some(x=>x.runKey===observation.runKey)){
    series.push({
      runKey:observation.runKey,observedAt:observation.observedAt,quality:observation.quality,
      markedEquity:observation.markedEquity,totalUnrealizedPnl:observation.totalUnrealizedPnl,
      missingSymbols:clone(observation.missingSymbols),staleSymbols:clone(observation.staleSymbols)
    });
  }
  series.sort((a,b)=>a.observedAt.localeCompare(b.observedAt));
  let peak=null,maxDD=0;
  for(const x of series){
    if(!finite(x.markedEquity))continue;
    peak=peak==null?x.markedEquity:Math.max(peak,x.markedEquity);
    maxDD=Math.min(maxDD,x.markedEquity/peak-1);
  }
  return {
    series,
    coverageStartAt:series.length?series[0].observedAt:null,
    observedMaxDrawdownPct:series.some(x=>finite(x.markedEquity))?maxDD:null
  };
}

export function simulatePortfolioMarked(trades,rules,{marksBySymbol=new Map(),observedAt,runKey,priorMarkedSeries=[]}={}){
  let cash=rules.startingCapital,peak=rules.startingCapital,realizedMaxDD=0;
  const open=[],entered=[],skipped=[],realizedEquityCurve=[{t:'start',equity:rules.startingCapital}];

  const realizedEquity=()=>cash+open.reduce((s,p)=>s+p.notional,0);
  const updateRealized=t=>{
    const e=realizedEquity();peak=Math.max(peak,e);realizedMaxDD=Math.min(realizedMaxDD,e/peak-1);
    realizedEquityCurve.push({t,equity:e});
  };
  const settleUntil=t=>{
    const due=open.filter(p=>finite(p.effectiveExitMs)&&p.effectiveExitMs<=t).sort((a,b)=>a.effectiveExitMs-b.effectiveExitMs||a.symbol.localeCompare(b.symbol));
    for(const p of due){
      const i=open.indexOf(p);if(i>=0)open.splice(i,1);
      const pnl=p.riskAmount*(p.R-rules.costR);
      cash+=p.notional+pnl;
      p.pnl=pnl;p.accountEquityAfter=realizedEquity();p.portfolioStatus='closed';
      updateRealized(new Date(p.effectiveExitMs).toISOString());
    }
  };

  const eligible=trades.filter(x=>x?.entryT&&finite(x?.entry)&&finite(x?.risk));
  for(const tr of [...eligible].sort((a,b)=>a.entryT.localeCompare(b.entryT)||a.symbol.localeCompare(b.symbol))){
    const t=Date.parse(tr.entryT);settleUntil(t);
    const eq=realizedEquity(),openRisk=open.reduce((s,p)=>s+p.riskAmount,0),stopPct=tr.risk/tr.entry;
    const riskCapacity=Math.max(0,rules.maxOpenRiskPct*eq-openRisk),targetRisk=Math.min(rules.targetRiskPct*eq,riskCapacity);
    if(open.length>=rules.maxPositions){skipped.push({...tr,reason:'max_positions'});continue}
    if(!(targetRisk>0)){skipped.push({...tr,reason:'max_open_risk'});continue}
    if(!(stopPct>0)){skipped.push({...tr,reason:'invalid_stop_distance'});continue}
    const notional=Math.min(targetRisk/stopPct,rules.maxPositionPct*eq,cash);
    if(!(notional>0)){skipped.push({...tr,reason:'no_cash'});continue}
    const riskAmount=notional*stopPct,quantity=notional/tr.entry,exitMs=tr.status==='closed'?effectiveExitMs(tr):null;
    const p={...tr,accountEquityBefore:eq,notional,allocationPct:notional/eq,quantity,stopPct,riskAmount,riskPctEquity:riskAmount/eq,pnl:null,portfolioStatus:tr.status,effectiveExitMs:exitMs,legacyExitTimingAdjusted:tr.status==='closed'&&tr.exitT&&tr.exitTimeConvention!=='bar_end'};
    cash-=notional;open.push(p);entered.push(p);updateRealized(tr.entryT);
  }
  settleUntil(Infinity);

  const realizedCurrentEquity=realizedEquity();
  const observation=markedObservation(open,cash,marksBySymbol,observedAt,runKey);
  const marked=appendMarkedSeries(priorMarkedSeries,observation);
  const markedCurrentEquity=observation.markedEquity;
  return {
    rules,
    startingCapital:rules.startingCapital,
    cash,
    reservedEntryNotional:open.reduce((s,p)=>s+p.notional,0),
    openRiskAmount:open.reduce((s,p)=>s+p.riskAmount,0),
    realizedCurrentEquity,
    realizedReturnPct:realizedCurrentEquity/rules.startingCapital-1,
    realizedMaxDrawdownPct:realizedMaxDD,
    realizedEquityCurve,
    markedCurrentEquity,
    markedReturnPct:finite(markedCurrentEquity)?markedCurrentEquity/rules.startingCapital-1:null,
    markedObservation:observation,
    markedEquitySeries:marked.series,
    markedSeriesCoverageStartAt:marked.coverageStartAt,
    markedObservedMaxDrawdownPct:marked.observedMaxDrawdownPct,
    enteredCount:entered.length,
    closedCount:entered.filter(x=>x.portfolioStatus==='closed').length,
    openCount:open.length,
    skippedCount:skipped.length,
    entered,open:observation.positions,skipped
  };
}
