import {atr,identity,stats,groupedStats} from '../trend-breakout/engine.mjs';
export {identity,stats,groupedStats};
const DAY=86400000,HOUR=3600000;

// Daily quotes are not considered complete until 17:00 Toronto time for
// stocks (7.5 hours after the regular open), or the next UTC day for crypto.
// The extra stock hour is conservative on full and shortened sessions.
export function completedDaily(rows,mode,observedAt){
 const now=Date.parse(observedAt);
 return rows.map(b=>({...b,endT:b.t+(mode==='crypto'?DAY:7.5*HOUR)}))
  .filter(b=>b.endT<=now).sort((a,b)=>a.t-b.t);
}
function mean(bars,i,n){return bars.slice(i-n+1,i+1).reduce((s,b)=>s+b.c,0)/n}
export function reversalSignal(daily,i,rules,mode){
 const pi=i-1;
 if(!daily[i])return null;
 if(pi<Math.max(rules.dailySma-1,rules.meanBars-1,rules.atrBars))return null;
 const dip=daily[pi],confirm=daily[i],a=atr(daily,pi,rules.atrBars);
 if(!(a>0))return null;
 const trend=mean(daily,pi,rules.dailySma),target=mean(daily,pi,rules.meanBars);
 const dollarVolume=daily.slice(pi-rules.meanBars+1,pi+1).reduce((s,b)=>s+(b.v||0)*b.c,0)/rules.meanBars;
 if(mode!=='crypto'&&dollarVolume<rules.minAverageDollarVolume)return null;
 if(!(dip.c>trend&&dip.c<=target-rules.oversoldAtr*a&&confirm.c>dip.h&&confirm.c>confirm.o&&confirm.c<target))return null;
 const stop=dip.l-rules.stopBufferAtr*a;
 if(!(stop>0&&confirm.c>stop&&(target-confirm.c)/(confirm.c-stop)>=rules.minRewardRisk))return null;
 return {symbol:null,signalT:new Date(confirm.t).toISOString(),dir:1,status:'pending_entry',
  signalSnapshot:{signalCompletedAt:new Date(confirm.endT).toISOString(),dailyAsOf:confirm.date,dipDate:dip.date,dipClose:dip.c,dipHigh:dip.h,dipLow:dip.l,dailySma:trend,meanTarget:target,atr14:a,averageDollarVolume:dollarVolume,signalClose:confirm.c,initialStop:stop},
  entryT:null,entry:null,stop:null,target:null,risk:null,R:null,exitT:null};
}
export function advanceTrade(old,bars,gaps,rules,observedAt){
 const t=structuredClone(old);
 if(['closed','cancelled'].includes(t.status))return t;
 const available=Date.parse(t.decisionAvailableAt),expires=Date.parse(t.signalSnapshot.signalCompletedAt)+t.entryWaitHours*HOUR;
 if(t.status==='pending_entry'){
  const ei=bars.findIndex(b=>b.t>=available&&b.t>=Date.parse(t.signalSnapshot.signalCompletedAt)&&b.endT<=Date.parse(observedAt));
  if(ei<0){if(Date.parse(observedAt)>expires){t.status='cancelled';t.cancelReason='entry_window_expired';t.cancelledAt=observedAt}return t}
  const b=bars[ei];
  if(b.t>expires){t.status='cancelled';t.cancelReason='entry_window_expired';t.cancelledAt=observedAt;return t}
  if(gaps.has(ei)){t.lifecycleDataGap={type:'entry_gap',details:gaps.get(ei)};return t}
  // Missing completed bars between the recorded decision and candidate open
  // cannot be silently crossed, even when the candidate itself looks valid.
  if(bars.some((x,i)=>x.endT>=available&&x.t<=b.t&&gaps.has(i))){t.lifecycleDataGap={type:'entry_path_gap'};return t}
  const stop=t.signalSnapshot.initialStop,target=t.signalSnapshot.meanTarget,risk=b.o-stop;
  if(!(risk>0&&target>b.o&&(target-b.o)/risk>=rules.minRewardRisk)){
   t.status='cancelled';t.cancelReason='entry_open_invalid_reward_or_stop';t.cancelledAt=observedAt;return t;
  }
  Object.assign(t,{entry:b.o,entryT:new Date(b.t).toISOString(),stop,currentStop:stop,target,risk,status:'open',holdingBars:0,lastEvaluatedEndT:null,
   entryObservationClass:t.historicalDiagnostic?'historical_simulated':'prospective',entryObservedAt:observedAt});delete t.lifecycleDataGap;
 }
 const ei=bars.findIndex(b=>b.t===Date.parse(t.entryT));
 if(ei<0){t.lifecycleDataGap={type:'entry_history_unavailable'};return t}
 let next=ei;
 if(t.lastEvaluatedEndT){const last=bars.findIndex(b=>b.endT===Date.parse(t.lastEvaluatedEndT));if(last<0){t.lifecycleDataGap={type:'last_observed_bar_unavailable'};return t}next=last+1}
 for(let i=next;i<bars.length;i++){
  const b=bars[i];if(b.endT>Date.parse(observedAt))break;
  if(i>ei&&gaps.has(i)){t.lifecycleDataGap={type:'holding_path_gap',details:gaps.get(i)};return t}
  const stopGap=b.o<=t.stop,targetGap=b.o>=t.target,stopHit=b.l<=t.stop,targetHit=b.h>=t.target;
  t.holdingBars++;t.lastEvaluatedEndT=new Date(b.endT).toISOString();delete t.lifecycleDataGap;
  const timeout=t.holdingBars>=rules.maxHoldBars;
  if(stopGap||targetGap||stopHit||targetHit||timeout){
   // Open is known first; ambiguous intrabar stop/target touches are stop-first.
   // A favorable target gap fills at target, not at a better invented price.
   const price=stopGap?b.o:targetGap?t.target:stopHit?t.stop:targetHit?t.target:b.c;
   Object.assign(t,{status:'closed',R:(price-t.entry)/t.risk,exitT:new Date(b.endT).toISOString(),exitPriceAssumed:price,exitTimeConvention:'bar_end',
    exitReason:stopGap?'stop_gap_open':targetGap?'target_gap_boundary':stopHit?'initial_stop':targetHit?'mean_target':'max_hold_close',
    executionAudit:{gapThroughStop:stopGap,gapThroughTarget:targetGap,stopTargetCollision:!stopGap&&!targetGap&&stopHit&&targetHit,collisionPolicy:'stop_first',exitBarStartT:new Date(b.t).toISOString(),exitBarEndT:new Date(b.endT).toISOString()}});
   return t;
  }
 }
 return t;
}
export function updateSymbol(prior,bars,daily,gaps,{symbol,mode,rules,forwardStart,observedAt,runKey,configHash,historicalDiagnostic=false}){
 const by=new Map(prior.filter(t=>t.symbol===symbol).map(t=>{const n=advanceTrade(t,bars,gaps,rules,observedAt);return [identity(n),n]}));
 const days=completedDaily(daily,mode,observedAt),start=Date.parse(forwardStart);
 const indices=historicalDiagnostic?days.map((_,i)=>i):[days.length-1];
 for(const i of indices){
  const d=days[i];if(!d||d.endT<start)continue;
  // Only the latest completed daily decision is discoverable prospectively.
  // A recovered old pattern is never backfilled as a live signal.
  if([...by.values()].some(t=>!['closed','cancelled'].includes(t.status)||(t.exitT&&Date.parse(t.exitT)>=d.endT)))continue;
  const wait=mode==='crypto'?rules.cryptoEntryWaitHours:rules.stockEntryWaitHours;
  if(!historicalDiagnostic&&Date.parse(observedAt)-d.endT>wait*HOUR)continue;
  const signal=reversalSignal(days,i,rules,mode);if(!signal)continue;signal.symbol=symbol;
  const id=identity(signal);if(by.has(id))continue;
  const t={...signal,decisionId:id,entryWaitHours:wait,historicalDiagnostic,decisionAvailableAt:historicalDiagnostic?signal.signalSnapshot.signalCompletedAt:observedAt,
   firstObservedAt:observedAt,firstObservedProvenance:{tracker:'mean-reversion-v1',runKey,configHash},entryObservationClass:'pending'};
  by.set(id,advanceTrade(t,bars,gaps,rules,observedAt));
 }
 return [...by.values()];
}
