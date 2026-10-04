import {dailyStock,dailyCrypto} from '../smc-forward-runtime.mjs';

export const identity=t=>[t.symbol,t.signalT,t.dir].join('|');
export function atr(bars,i,n=14){
  if(i<n)return null;
  let sum=0;
  for(let j=i-n+1;j<=i;j++)sum+=Math.max(bars[j].h-bars[j].l,Math.abs(bars[j].h-bars[j-1].c),Math.abs(bars[j].l-bars[j-1].c));
  return sum/n;
}
export function trendSignal(daily,bars,i,mode,rules){
  if(i<Math.max(rules.breakoutBars,rules.atrBars))return null;
  const b=bars[i],date=(mode==='crypto'?dailyCrypto([b]):dailyStock([b]))[0].date;
  const completed=daily.filter(d=>d.date<date);
  if(completed.length<rules.dailySma)return null;
  const tail=completed.slice(-rules.dailySma),mean=tail.reduce((s,d)=>s+d.c,0)/tail.length,last=tail.at(-1);
  const history=bars.slice(i-rules.breakoutBars,i);
  const high=Math.max(...history.map(b=>b.h)),low=Math.min(...history.map(b=>b.l));
  const dir=last.c>mean&&b.c>high?1:last.c<mean&&b.c<low?-1:0;
  const a=atr(bars,i,rules.atrBars);
  if(!dir||!(a>0))return null;
  return {symbol:null,signalT:new Date(b.t).toISOString(),dir,status:'pending_entry',signalSnapshot:{signalCompletedAt:new Date(b.endT).toISOString(),dailyAsOf:last.date,dailyClose:last.c,dailySma:mean,breakoutHigh:high,breakoutLow:low,atr14:a,signalClose:b.c},entryT:null,entry:null,stop:null,target:null,risk:null,R:null,exitT:null};
}

// Every state step uses only completed bars; a close-derived trail activates on
// the following bar. Previously evaluated source bars are never silently replayed.
export function advanceTrade(old,bars,gaps,rules,observedAt){
  const t=structuredClone(old);
  if(t.status==='closed')return t;
  if(t.status==='pending_entry'){
    const si=bars.findIndex(b=>b.t===Date.parse(t.signalT));
    if(si<0){t.lifecycleDataGap={type:'signal_history_unavailable'};return t}
    // A paper decision cannot be filled at an open that predates observation.
    const available=Date.parse(t.decisionAvailableAt||t.firstObservedAt);
    const ei=bars.findIndex((b,i)=>i>si&&b.t>=available);
    if(ei<0)return t;
    for(let i=si+1;i<=ei;i++)if(gaps.has(i)){t.lifecycleDataGap={type:'entry_gap',details:gaps.get(i)};return t}
    const b=bars[ei],risk=rules.initialStopAtr*t.signalSnapshot.atr14;
    if(!(risk>0)){t.lifecycleDataGap={type:'invalid_signal_atr'};return t}
    t.entry=b.o;t.entryT=new Date(b.t).toISOString();t.risk=risk;t.stop=t.entry-t.dir*risk;
    t.currentStop=t.stop;t.bestClose=t.entry;t.holdingBars=0;t.status='open';
    t.entryObservationClass=t.historicalDiagnostic?'historical_simulated':Date.parse(t.firstObservedAt)<=b.t?'prospective':'reconstructed';
    t.entryObservedAt=observedAt;t.lastEvaluatedEndT=null;delete t.lifecycleDataGap;
  }
  const ei=bars.findIndex(b=>b.t===Date.parse(t.entryT));
  if(ei<0){t.lifecycleDataGap={type:'entry_history_unavailable'};return t}
  let next=ei;
  if(t.lastEvaluatedEndT){
    const last=bars.findIndex(b=>b.endT===Date.parse(t.lastEvaluatedEndT));
    if(last<0){t.lifecycleDataGap={type:'last_observed_bar_unavailable'};return t}
    next=last+1;
  }
  for(let i=next;i<bars.length;i++){
    if(i>ei&&gaps.has(i)){t.lifecycleDataGap={type:'holding_path_gap',details:gaps.get(i)};return t}
    const b=bars[i],gap=t.dir===1?b.o<=t.currentStop:b.o>=t.currentStop;
    const hit=t.dir===1?b.l<=t.currentStop:b.h>=t.currentStop;
    t.holdingBars++;t.lastEvaluatedEndT=new Date(b.endT).toISOString();delete t.lifecycleDataGap;
    if(gap||hit||t.holdingBars>=rules.maxHoldBars){
      // Gapped stops fill at the adverse open, rather than assuming a boundary
      // price. Fixed-R cost comparison is accompanied by this convention flag.
      const price=gap?b.o:hit?t.currentStop:b.c;
      t.status='closed';t.R=t.dir*(price-t.entry)/t.risk;
      t.exitT=new Date(b.endT).toISOString();t.exitPriceAssumed=price;t.exitTimeConvention='bar_end';
      t.exitReason=gap?'stop_gap_open':hit?'trailing_or_initial_stop':'max_hold_close';
      t.executionAudit={gapThroughStop:gap,gapFillAssumption:gap?'adverse observed open':'boundary stop / completed time-exit close',exitBarStartT:new Date(b.t).toISOString(),exitBarEndT:t.exitT};
      return t;
    }
    t.bestClose=t.dir===1?Math.max(t.bestClose,b.c):Math.min(t.bestClose,b.c);
    const a=atr(bars,i,rules.atrBars);
    if(a>0){const trail=t.bestClose-t.dir*rules.trailingStopAtr*a;t.currentStop=t.dir===1?Math.max(t.currentStop,trail):Math.min(t.currentStop,trail)}
  }
  return t;
}

export function updateSymbol(prior,bars,daily,gaps,{symbol,mode,rules,forwardStart,observedAt,runKey,configHash,historicalDiagnostic=false}){
  const old=prior.filter(t=>t.symbol===symbol).map(t=>advanceTrade(t,bars,gaps,rules,observedAt));
  const by=new Map(old.map(t=>[identity(t),t]));
  const start=Date.parse(forwardStart);
  for(let i=0;i<bars.length;i++){
    const b=bars[i];if(b.endT<start)continue;
    if([...by.values()].some(t=>t.status!=='closed' || Date.parse(t.exitT)>b.t))continue;
    if(Array.from({length:rules.breakoutBars},(_,k)=>i-k).some(j=>gaps.has(j)))continue;
    const s=trendSignal(daily,bars,i,mode,rules);if(!s)continue;s.symbol=symbol;
    const id=identity(s);if(by.has(id))continue;
    const t={...s,decisionId:id,historicalDiagnostic,decisionAvailableAt:historicalDiagnostic?s.signalSnapshot.signalCompletedAt:observedAt,firstObservedAt:observedAt,firstObservedProvenance:{tracker:'trend-breakout-v1',runKey,configHash},entryObservationClass:'pending'};
    by.set(id,advanceTrade(t,bars,gaps,rules,observedAt));
  }
  return [...by.values()];
}

export function stats(trades,cost=0){
  const closed=trades.filter(t=>t.status==='closed'&&Number.isFinite(t.R)).sort((a,b)=>a.exitT.localeCompare(b.exitT));
  const r=closed.map(t=>t.R-cost),gain=r.filter(x=>x>0).reduce((a,b)=>a+b,0),loss=-r.filter(x=>x<0).reduce((a,b)=>a+b,0);
  let equity=0,peak=0,dd=0;for(const x of r){equity+=x;peak=Math.max(peak,equity);dd=Math.min(dd,equity-peak)}
  return {n:r.length,wr:r.length?r.filter(x=>x>0).length/r.length:null,pf:loss?gain/loss:null,avgR:r.length?equity/r.length:null,sumR:equity,maxDD:dd};
}
export function groupedStats(trades,cost){
  const out={};for(const g of ['prospective','reconstructed','historical_simulated','pending','legacy_unprovenanced']){const ts=trades.filter(t=>(t.firstObservedAt?t.entryObservationClass:'legacy_unprovenanced')===g);out[g]={raw:stats(ts),afterCost:stats(ts,cost),open:ts.filter(t=>t.status==='open').length}}
  return out;
}
