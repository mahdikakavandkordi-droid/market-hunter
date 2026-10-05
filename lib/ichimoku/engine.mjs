import {atr,identity,stats,groupedStats} from '../trend-breakout/engine.mjs';
import {completedDaily} from '../mean-reversion/engine.mjs';
import {weekFromDate} from '../smc-forward-runtime.mjs';
export {identity,stats,groupedStats,completedDaily};
const HOUR=3600000;

function midpoint(rows,i,n){
  if(i<n-1)return null;
  const window=rows.slice(i-n+1,i+1);
  return (Math.max(...window.map(b=>b.h))+Math.min(...window.map(b=>b.l)))/2;
}
export function ichimoku(rows,i,rules){
  const tenkan=midpoint(rows,i,rules.tenkan),kijun=midpoint(rows,i,rules.kijun);
  // The cloud visible at i was computed displacement bars earlier.
  // Never compare price with a cloud computed from future bars.
  const origin=i-rules.displacement;
  const oldTenkan=midpoint(rows,origin,rules.tenkan),oldKijun=midpoint(rows,origin,rules.kijun);
  const spanB=midpoint(rows,origin,rules.senkouB);
  const spanA=oldTenkan==null||oldKijun==null?null:(oldTenkan+oldKijun)/2;
  return {tenkan,kijun,spanA,spanB,cloudTop:spanA==null||spanB==null?null:Math.max(spanA,spanB),cloudBottom:spanA==null||spanB==null?null:Math.min(spanA,spanB)};
}
export function priorWeeks(daily,signalDate){
  const current=weekFromDate(signalDate),groups=new Map();
  for(const b of daily){
    const key=weekFromDate(b.date);
    // Conservatively exclude the signal's entire calendar week, including Friday.
    if(key>=current)continue;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(b);
  }
  // The first source week may start midweek; discard it rather than assume completeness.
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).slice(1).map(([date,rows])=>({
    date,t:rows[0].t,endT:rows.at(-1).endT,o:rows[0].o,h:Math.max(...rows.map(b=>b.h)),
    l:Math.min(...rows.map(b=>b.l)),c:rows.at(-1).c,v:rows.reduce((s,b)=>s+(b.v||0),0)
  }));
}
export function signalAssessment(daily,i,rules,mode){
  const b=daily[i];
  if(!b||i<Math.max(rules.kijun,rules.atrBars,rules.liquidityBars))return {reason:'daily_warmup'};
  const weeks=priorWeeks(daily.slice(0,i+1),b.date),wi=weeks.length-1,w=ichimoku(weeks,wi,rules);
  if(w.cloudTop==null)return {reason:'weekly_cloud_warmup'};
  const weekly=weeks[wi],dir=weekly.c>w.cloudTop?1:weekly.c<w.cloudBottom?-1:0;
  if(!dir)return {reason:'weekly_inside_cloud'};
  const now=ichimoku(daily,i,rules),previous=ichimoku(daily,i-1,rules),prev=daily[i-1];
  const reclaimed=dir===1?prev.c<=previous.kijun&&b.c>now.kijun:prev.c>=previous.kijun&&b.c<now.kijun;
  if(!reclaimed)return {reason:'no_daily_kijun_reclaim'};
  const dollarVolume=daily.slice(i-rules.liquidityBars+1,i+1).reduce((s,x)=>s+(x.v||0)*x.c,0)/rules.liquidityBars;
  if(mode!=='crypto'&&dollarVolume<rules.minAverageDollarVolume)return {reason:'liquidity'};
  const a=atr(daily,i,rules.atrBars);
  if(!(a>0))return {reason:'invalid_atr'};
  return {reason:'signal',signal:{symbol:null,signalT:new Date(b.t).toISOString(),dir,status:'pending_entry',
    signalSnapshot:{signalCompletedAt:new Date(b.endT).toISOString(),dailyAsOf:b.date,signalClose:b.c,
      dailyKijun:now.kijun,previousKijun:previous.kijun,weeklyAsOf:weekly.date,weeklyClose:weekly.c,
      weeklyCloudTop:w.cloudTop,weeklyCloudBottom:w.cloudBottom,atr14:a,averageDollarVolume:dollarVolume},
    entryT:null,entry:null,stop:null,target:null,risk:null,R:null,exitT:null}};
}
export function advanceTrade(old,bars,daily,gaps,rules,mode,observedAt){
  const t=structuredClone(old),now=Date.parse(observedAt);
  if(['closed','cancelled'].includes(t.status))return t;
  const available=Date.parse(t.decisionAvailableAt),completed=Date.parse(t.signalSnapshot.signalCompletedAt);
  if(t.status==='pending_entry'){
    const expires=completed+t.entryWaitHours*HOUR;
    const ei=bars.findIndex(b=>b.t>=Math.max(available,completed)&&b.endT<=now);
    if(ei<0){if(now>expires)Object.assign(t,{status:'cancelled',cancelReason:'entry_window_expired',cancelledAt:observedAt});return t}
    const b=bars[ei];
    if(b.t>expires){Object.assign(t,{status:'cancelled',cancelReason:'entry_window_expired',cancelledAt:observedAt});return t}
    if(gaps.has(ei)||bars.some((b,i)=>b.endT>=available&&b.t<=bars[ei].t&&gaps.has(i))){t.lifecycleDataGap={type:'entry_path_gap'};return t}
    const risk=rules.initialStopAtr*t.signalSnapshot.atr14,stop=b.o-t.dir*risk;
    if(!(risk>0&&b.o>0&&stop>0)){Object.assign(t,{status:'cancelled',cancelReason:'invalid_entry_stop',cancelledAt:observedAt});return t}
    Object.assign(t,{entry:b.o,entryT:new Date(b.t).toISOString(),risk,stop,currentStop:stop,status:'open',holdingBars:0,lastEvaluatedEndT:null,
      entryObservationClass:t.historicalDiagnostic?'historical_simulated':'prospective',entryObservedAt:observedAt});
  }
  const ei=bars.findIndex(b=>b.t===Date.parse(t.entryT));
  if(ei<0){t.lifecycleDataGap={type:'entry_history_unavailable'};return t}
  let next=ei;
  if(t.lastEvaluatedEndT){const last=bars.findIndex(b=>b.endT===Date.parse(t.lastEvaluatedEndT));if(last<0){t.lifecycleDataGap={type:'last_observed_bar_unavailable'};return t}next=last+1}
  const days=completedDaily(daily,mode,observedAt);
  for(let i=next;i<bars.length;i++){
    const b=bars[i];if(b.endT>now)break;
    if(i>ei&&gaps.has(i)){t.lifecycleDataGap={type:'holding_path_gap',details:gaps.get(i)};return t}
    const d=days.findLast(x=>x.endT<=b.t),di=d?days.indexOf(d):-1,k=di<0?null:ichimoku(days,di,rules).kijun;
    const crossed=d&&d.endT>Date.parse(t.entryT)&&k!=null&&(t.dir===1?d.c<k:d.c>k);
    const exitKnownAt=t.historicalDiagnostic?d?.endT:Date.parse(t.kijunExitDecision?.observedAt);
    const plannedExit=(t.historicalDiagnostic?crossed:Boolean(t.kijunExitDecision))&&Number.isFinite(exitKnownAt)&&b.t>=exitKnownAt;
    const gap=t.dir===1?b.o<=t.stop:b.o>=t.stop,hit=t.dir===1?b.l<=t.stop:b.h>=t.stop;
    t.holdingBars++;t.lastEvaluatedEndT=new Date(b.endT).toISOString();delete t.lifecycleDataGap;
    const timeout=t.holdingBars>=rules.maxHoldBars;
    if(gap||plannedExit||hit||timeout){
      const price=gap||plannedExit?b.o:hit?t.stop:b.c;
      Object.assign(t,{status:'closed',R:t.dir*(price-t.entry)/t.risk,exitT:new Date(b.endT).toISOString(),exitPriceAssumed:price,exitTimeConvention:'bar_end',
        exitReason:gap?'stop_gap_open':plannedExit?'daily_kijun_exit_next_observed_open':hit?'initial_stop':'max_hold_close',
        executionAudit:{gapThroughStop:gap,exitBarStartT:new Date(b.t).toISOString(),exitBarEndT:new Date(b.endT).toISOString()}});
      return t;
    }
  }
  // Record the exit decision now, never retroactively fill an earlier open.
  const d=days.at(-1),k=d?ichimoku(days,days.length-1,rules).kijun:null;
  if(!t.historicalDiagnostic&&d&&d.endT>Date.parse(t.entryT)&&k!=null&&(t.dir===1?d.c<k:d.c>k)&&!t.kijunExitDecision)
    t.kijunExitDecision={observedAt,signalCompletedAt:new Date(d.endT).toISOString(),dailyAsOf:d.date,kijun:k};
  return t;
}
export function updateSymbol(prior,bars,daily,gaps,{symbol,mode,rules,forwardStart,observedAt,runKey,configHash,historicalDiagnostic=false}){
  const by=new Map(prior.filter(t=>t.symbol===symbol).map(t=>{const n=advanceTrade(t,bars,daily,gaps,rules,mode,observedAt);return [identity(n),n]}));
  const days=completedDaily(daily,mode,observedAt),indices=historicalDiagnostic?days.map((_,i)=>i):[days.length-1];
  for(const i of indices){
    const d=days[i];if(!d||d.endT<Date.parse(forwardStart))continue;
    if([...by.values()].some(t=>!['closed','cancelled'].includes(t.status)||(t.exitT&&Date.parse(t.exitT)>=d.endT)))continue;
    const wait=mode==='crypto'?rules.cryptoEntryWaitHours:rules.stockEntryWaitHours;
    if(!historicalDiagnostic&&Date.parse(observedAt)-d.endT>wait*HOUR)continue;
    const {signal}=signalAssessment(days,i,rules,mode);if(!signal)continue;signal.symbol=symbol;
    const id=identity(signal);if(by.has(id))continue;
    const t={...signal,decisionId:id,entryWaitHours:wait,historicalDiagnostic,
      decisionAvailableAt:historicalDiagnostic?signal.signalSnapshot.signalCompletedAt:observedAt,firstObservedAt:observedAt,
      firstObservedProvenance:{tracker:'ichimoku-v1',runKey,configHash},entryObservationClass:'pending'};
    by.set(id,advanceTrade(t,bars,daily,gaps,rules,mode,observedAt));
  }
  return [...by.values()];
}
