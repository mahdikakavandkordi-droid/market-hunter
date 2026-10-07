import {createHash} from 'node:crypto';
import {MODEL} from './engine.mjs';
const HOUR=3600000,EPS=1e-9;
const terminal=new Set(['closed','cancelled','skipped']);
const clone=x=>structuredClone(x),iso=t=>new Date(t).toISOString();
const finite=Number.isFinite;
export function canonical(value) {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
export function configHash(config) {
  return hash({model:MODEL,version:config.version,execution:config.execution,portfolio:config.portfolio,universes:config.universes});
}
const signalKey=s=>[s.symbol,s.dir,s.signalCompletedAt].join('|');
const barHash=b=>hash({t:b.t,endT:b.endT,o:b.o,h:b.h,l:b.l,c:b.c});
function validateConfig(config,cohort) {
  const r=config?.portfolio,e=config?.execution,u=config?.universes?.[cohort];
  if(config?.version!==MODEL.version||!u||!['stock','crypto'].includes(u.mode)
    ||!Array.isArray(u.symbols)||new Set(u.symbols).size!==u.symbols.length
    ||![r?.startingCapital,r?.targetRiskPct,r?.maxPositionPct,r?.maxOpenRiskPct,r?.maxPositions,e?.maxHoldBars,e?.minRewardRisk,e?.stockEntryHours,e?.cryptoEntryHours].every(x=>finite(x)&&x>0)
    ||!finite(r.costR)||r.costR<0||!Number.isInteger(r.maxPositions)||!Number.isInteger(e.maxHoldBars)
    ||r.targetRiskPct>r.maxOpenRiskPct||r.maxPositionPct>1||r.maxOpenRiskPct>1)throw Error('invalid_paper_config');
  return u;
}
export function createLedger(config,{cohort,forwardStart}={}) {
  const u=validateConfig(config,cohort),start=Date.parse(forwardStart);
  if(!finite(start))throw Error('explicit_forward_start_required');
  return {version:MODEL.version,cohort,mode:u.mode,configHash:configHash(config),forwardStart:iso(start),
    revision:0,updatedAt:null,trades:[],runs:[],realizedEquityCurve:[{t:iso(start),equity:config.portfolio.startingCapital}],markedEquitySeries:[]};
}
function equity(ledger,rules){return rules.startingCapital+ledger.trades.filter(t=>t.status==='closed').reduce((s,t)=>s+t.pnl,0)}
function open(ledger){return ledger.trades.filter(t=>t.status==='open')}
function cancel(t,reason,time){t.status='cancelled';t.cancelReason=reason;t.cancelledAt=iso(time)}
function validateSignal(s){
  if(!s||s.version!==MODEL.version||s.status!=='signal_confirmed'||![1,-1].includes(s.dir)
    ||typeof s.symbol!=='string'||!s.decisionId||!finite(Date.parse(s.signalCompletedAt))
    ||!finite(Date.parse(s.signalT))||Date.parse(s.signalT)>=Date.parse(s.signalCompletedAt)
    ||![s.signalClose,s.stop,s.target].every(x=>finite(x)&&x>0)
    ||s.dir*(s.signalClose-s.stop)<=0||s.dir*(s.target-s.signalClose)<=0)throw Error('invalid_signal_snapshot');
}
function prepareFeed(feed,now,mode) {
  if(!feed||feed.status!=='available'||!Array.isArray(feed.bars))return {bars:[],blocked:'source_unavailable',gapSet:new Set()};
  const bars=feed.bars.filter(b=>finite(b.endT)&&b.endT<=now),gapSet=new Set(feed.gapBeforeTimes||[]);
  for(let i=0;i<bars.length;i++) {
    const b=bars[i];
    if(![b.t,b.endT,b.o,b.h,b.l,b.c].every(finite)||b.endT<=b.t||Math.min(b.o,b.h,b.l,b.c)<=0
      ||b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c,b.h)
      ||(i&&(b.t<=bars[i-1].t||b.t<bars[i-1].endT)))return {bars:[],blocked:'invalid_execution_feed',gapSet};
    if(mode==='crypto'&&i&&b.t!==bars[i-1].endT)gapSet.add(b.t);
  }
  return {bars,gapSet,blocked:null,review:feed.review||null};
}
function settle(ledger,t,b,config) {
  const gs=t.dir===1?b.o<=t.stop:b.o>=t.stop,gt=t.dir===1?b.o>=t.target:b.o<=t.target;
  const hs=t.dir===1?b.l<=t.stop:b.h>=t.stop,ht=t.dir===1?b.h>=t.target:b.l<=t.target;
  let price=null,reason=null;
  if(gs){price=b.o;reason='stop_gap_open'}
  else if(gt){price=t.target;reason='target_gap_boundary'}
  else if(hs){price=t.stop;reason=ht?'stop_target_collision_stop_first':'stop'}
  else if(ht){price=t.target;reason='target'}
  else if(t.holdingBars>=config.execution.maxHoldBars){price=b.c;reason='max_hold_close'}
  if(price===null)return;
  t.status='closed';t.portfolioStatus='closed';t.exitT=iso(b.endT);t.exitPrice=price;t.exitReason=reason;t.exitTimeConvention='bar_end';
  t.R=t.dir*(price-t.entry)/t.risk;
  t.cost=t.riskAmount*config.portfolio.costR;t.pnl=t.riskAmount*t.R-t.cost;
  t.executionAudit={gapThroughStop:gs,gapThroughTarget:gt,stopTargetCollision:!gs&&!gt&&hs&&ht,
    exitBarStartT:iso(b.t),exitBarEndT:iso(b.endT),shortExecution:'hypothetical_direction_price'};
  t.accountEquityAfter=equity(ledger,config.portfolio);
  ledger.realizedEquityCurve.push({t:ledger.observedAt,eventT:t.exitT,equity:t.accountEquityAfter});
}
function admit(ledger,t,b,config) {
  const rules=config.portfolio;
  // A recovered historical entry must not use profits or collateral released by
  // exits that happened later, including exits recorded in an earlier run.
  const historicalEquity=rules.startingCapital+ledger.trades.filter(p=>p.status==='closed'&&Date.parse(p.exitT)<=b.t).reduce((s,p)=>s+p.pnl,0);
  const eq=Math.min(equity(ledger,rules),historicalEquity);
  const positions=ledger.trades.filter(p=>p.status==='open'||(p.status==='closed'&&Date.parse(p.entryT)<=b.t&&Date.parse(p.exitT)>b.t));
  const risk=t.dir*(b.o-t.stop),reward=t.dir*(t.target-b.o);
  if(!(risk>0&&reward>0)){cancel(t,'entry_through_stop_or_target',b.t);return}
  if(reward/risk<config.execution.minRewardRisk){cancel(t,'entry_reward_risk',b.t);return}
  const cash=eq-positions.reduce((s,p)=>s+p.notional,0),openRisk=positions.reduce((s,p)=>s+p.riskAmount,0);
  let reason=positions.length>=rules.maxPositions?'max_positions':eq<=0?'insolvent':null;
  const riskCapacity=Math.max(0,rules.maxOpenRiskPct*eq-openRisk);
  if(!reason&&riskCapacity<=EPS)reason='max_open_risk';
  if(!reason&&cash<=EPS)reason='no_cash';
  if(reason){t.status='skipped';t.skipReason=reason;t.skippedAt=iso(b.t);return}
  const quantity=Math.min(rules.targetRiskPct*eq/risk,riskCapacity/risk,rules.maxPositionPct*eq/b.o,cash/b.o);
  if(!(quantity>EPS)){t.status='skipped';t.skipReason='allocation_too_small';t.skippedAt=iso(b.t);return}
  Object.assign(t,{status:'open',portfolioStatus:'open',entry:b.o,entryT:iso(b.t),entryObservedAt:ledger.observedAt,
    risk,quantity,notional:quantity*b.o,riskAmount:quantity*risk,accountEquityBefore:eq,
    holdingBars:0,lastEvaluatedEndT:null,usedBars:{},entryObservationClass:'prospective'});
}

/** Incremental account advancement. Entries/exits are ordered by bar open/end
 * time, not by eventual outcomes. Only admitted positions contribute to equity. */
export function advanceAccount(prior,{config,observedAt,runKey,signals=[],feeds={}}={}) {
  verifyLedger(prior,config);
  const now=Date.parse(observedAt),start=Date.parse(prior.forwardStart);
  if(!finite(now)||now<start||!runKey||prior.configHash!==configHash(config))throw Error('invalid_run_or_changed_config');
  if(prior.updatedAt&&now<Date.parse(prior.updatedAt))throw Error('out_of_order_run');
  const inputHash=hash({observedAt,signals,feeds}),previousRun=prior.runs.find(r=>r.runKey===runKey);
  if(previousRun){if(previousRun.inputHash!==inputHash)throw Error('run_key_reused_with_different_input');return clone(prior)}
  const ledger=clone(prior),u=config.universes[ledger.cohort],prepared={},issues=[];
  ledger.observedAt=iso(now);
  for(const symbol of u.symbols) {
    const f=prepareFeed(feeds[symbol],now,ledger.mode);prepared[symbol]=f;
    if(f.blocked){issues.push({symbol,error:f.blocked});continue}
    const byStart=new Map(f.bars.map(b=>[String(b.t),b]));
    for(const t of ledger.trades.filter(t=>t.symbol===symbol&&!terminal.has(t.status))) {
      if(t.lifecycleDataGap?.type==='provider_revision_requires_review') {
        f.blocked='provider_revision_requires_review';issues.push({symbol,error:f.blocked});break;
      }
      if(Object.entries(t.usedBars||{}).some(([time,fingerprint])=>byStart.has(time)&&barHash(byStart.get(time))!==fingerprint)) {
        f.blocked='provider_revision_requires_review';issues.push({symbol,error:f.blocked});break;
      }
    }
    if(f.review){f.blocked=f.review;issues.push({symbol,error:f.review})}
  }
  for(const s of [...signals].sort((a,b)=>a.symbol.localeCompare(b.symbol)||a.decisionId.localeCompare(b.decisionId))) {
    validateSignal(s);if(!u.symbols.includes(s.symbol))throw Error('signal_outside_cohort');
    const completed=Date.parse(s.signalCompletedAt);
    if(completed<start||completed>now)continue;
    const id=signalKey(s);if(ledger.trades.some(t=>t.id===id))continue;
    // No queue of old daily breakouts is replayed into forward decisions.
    if(feeds[s.symbol]?.latestDailyCompletedAt!==s.signalCompletedAt)continue;
    const t={id,decisionId:s.decisionId,symbol:s.symbol,dir:s.dir,status:'pending_entry',signalT:s.signalT,
      signalAvailableAt:iso(now),firstObservedAt:iso(now),signalCompletedAt:s.signalCompletedAt,
      stop:s.stop,target:s.target,signalSnapshot:clone(s),snapshotHash:hash(s),configHash:ledger.configHash,
      deadline:iso(completed+(u.mode==='crypto'?config.execution.cryptoEntryHours:config.execution.stockEntryHours)*HOUR)};
    if(ledger.trades.some(p=>p.symbol===s.symbol&&['pending_entry','open'].includes(p.status))) {
      t.status='skipped';t.skipReason='symbol_already_pending_or_open';t.skippedAt=iso(now);
    }
    ledger.trades.push(t);
  }
  const events=[];
  for(const [symbol,f] of Object.entries(prepared))if(!f.blocked)for(const b of f.bars) {
    events.push({time:b.t,phase:1,symbol,b},{time:b.endT,phase:0,symbol,b});
  }
  events.sort((a,b)=>a.time-b.time||a.phase-b.phase||a.symbol.localeCompare(b.symbol));
  for(const event of events) {
    const {symbol,b,phase}=event,f=prepared[symbol];
    const list=ledger.trades.filter(t=>t.symbol===symbol&&!terminal.has(t.status)).sort((a,b)=>a.id.localeCompare(b.id));
    for(const t of list) {
      if(phase===1&&t.status==='pending_entry') {
        if(b.t<Date.parse(t.signalAvailableAt))continue;
        if(b.t>Date.parse(t.deadline)){cancel(t,'entry_expired',b.t);continue}
        if(f.gapSet.has(b.t)){t.lifecycleDataGap={type:'entry_path_gap',beforeT:iso(b.t)};continue}
        if(t.lifecycleDataGap) {
          if(t.lifecycleDataGap.type==='entry_path_gap') {
            const blocked=Date.parse(t.lifecycleDataGap.beforeT);
            if(!f.bars.some(x=>x.t===blocked)||f.gapSet.has(blocked))continue;
          }else if(!['source_unavailable','invalid_execution_feed'].includes(t.lifecycleDataGap.type))continue;
          delete t.lifecycleDataGap;
        }
        admit(ledger,t,b,config);
      }else if(phase===0&&t.status==='open') {
        if(b.t<Date.parse(t.entryT)||b.endT<=Date.parse(t.lastEvaluatedEndT||t.entryT))continue;
        const last=t.lastEvaluatedEndT?f.bars.findIndex(x=>x.endT===Date.parse(t.lastEvaluatedEndT)):-1;
        if(t.lastEvaluatedEndT&&last<0){t.lifecycleDataGap={type:'last_evaluated_bar_unavailable'};continue}
        const current=f.bars.findIndex(x=>x.t===b.t);
        if(t.lastEvaluatedEndT&&current!==last+1){t.lifecycleDataGap={type:'holding_path_gap'};continue}
        if(b.t!==Date.parse(t.entryT)&&f.gapSet.has(b.t)){t.lifecycleDataGap={type:'holding_path_gap',beforeT:iso(b.t)};continue}
        // Resolved gaps can resume only once the exact next required bar returns.
        delete t.lifecycleDataGap;
        t.holdingBars++;t.lastEvaluatedEndT=iso(b.endT);t.usedBars[String(b.t)]=barHash(b);
        settle(ledger,t,b,config);
      }
    }
  }
  for(const t of ledger.trades)if(t.status==='pending_entry'&&now>Date.parse(t.deadline))cancel(t,t.lifecycleDataGap||prepared[t.symbol]?.blocked?'entry_expired_unverified_path':'entry_expired',now);
  for(const t of ledger.trades.filter(t=>!terminal.has(t.status)))if(prepared[t.symbol]?.blocked)t.lifecycleDataGap={type:prepared[t.symbol].blocked};
  const observation=markAccount(ledger,config,prepared,now,runKey);
  ledger.markedEquitySeries.push(observation);
  ledger.runs.push({runKey,inputHash,observedAt:iso(now),issues});
  ledger.revision++;ledger.updatedAt=iso(now);delete ledger.observedAt;
  return ledger;
}

function markAccount(ledger,config,feeds,now,runKey) {
  const eq=equity(ledger,config.portfolio),positions=[],missingSymbols=[],staleSymbols=[];
  let unrealized=0;
  for(const t of open(ledger)) {
    const f=feeds[t.symbol],b=f?.bars.at(-1),age=b?now-b.endT:Infinity;
    let markStatus=!b||f?.blocked?'missing':b.endT<Date.parse(t.entryT)?'pre_entry_or_invalid_mark':age>(ledger.mode==='crypto'?12:120)*HOUR?'stale':'fresh';
    if(t.lifecycleDataGap)markStatus='lifecycle_requires_review';
    const valid=['fresh','stale'].includes(markStatus),pnl=valid?t.dir*t.quantity*(b.c-t.entry):null;
    if(valid)unrealized+=pnl;else missingSymbols.push(t.symbol);
    if(markStatus==='stale')staleSymbols.push(t.symbol);
    positions.push({...clone(t),markPrice:valid?b.c:null,markT:valid?iso(b.endT):null,markStatus,unrealizedPnl:pnl});
  }
  return {runKey,observedAt:iso(now),quality:missingSymbols.length?'incomplete_missing_marks':staleSymbols.length?'stale_marks':'fresh',
    markedEquity:missingSymbols.length?null:eq+unrealized,totalUnrealizedPnl:missingSymbols.length?null:unrealized,
    missingSymbols,staleSymbols,positions};
}
function drawdown(curve,capital) {
  let peak=capital,dd=0,seen=false;
  for(const x of curve)if(finite(x)){seen=true;peak=Math.max(peak,x);dd=Math.min(dd,x/peak-1)}
  return seen?dd:null;
}
export function accountReport(ledger,config) {
  if(ledger.configHash!==configHash(config))throw Error('changed_config');
  const rules=config.portfolio,eq=equity(ledger,rules),positions=open(ledger),entered=ledger.trades.filter(t=>['open','closed'].includes(t.status)),observation=ledger.markedEquitySeries.at(-1);
  const marked=observation?.markedEquity??(positions.length?null:eq);
  return {rules,startingCapital:rules.startingCapital,cash:eq-positions.reduce((s,t)=>s+t.notional,0),
    reservedEntryNotional:positions.reduce((s,t)=>s+t.notional,0),openRiskAmount:positions.reduce((s,t)=>s+t.riskAmount,0),
    realizedCurrentEquity:eq,realizedReturnPct:eq/rules.startingCapital-1,
    realizedMaxDrawdownPct:drawdown(ledger.realizedEquityCurve.map(x=>x.equity),rules.startingCapital),
    realizedEquityCurve:clone(ledger.realizedEquityCurve),markedCurrentEquity:marked,
    markedReturnPct:marked===null?null:marked/rules.startingCapital-1,
    markedObservedMaxDrawdownPct:drawdown(ledger.markedEquitySeries.map(x=>x.markedEquity),rules.startingCapital),
    markedObservation:clone(observation||{quality:'not_observed',positions:[]}),markedEquitySeries:clone(ledger.markedEquitySeries),
    open:clone(observation?.positions||positions),entered:clone(entered),enteredCount:entered.length,openCount:positions.length,
    closedCount:entered.filter(t=>t.status==='closed').length,skippedCount:ledger.trades.filter(t=>t.status==='skipped').length,
    pendingCount:ledger.trades.filter(t=>t.status==='pending_entry').length,
    costAccounting:{closedTradeCostR:rules.costR,chargedOnceOnSettlement:true,openMarkedEquityIncludesHypotheticalExitCost:false},
    limitations:['nominal_quote_currency_accounts','hypothetical_short_no_borrow_or_funding','fixed_R_cost_no_variable_spread_or_FX','completed_bar_marks_not_live_quotes']};
}
export function verifyLedger(ledger,config) {
  validateConfig(config,ledger?.cohort);
  if(ledger.version!==MODEL.version||ledger.mode!==config.universes[ledger.cohort].mode||ledger.configHash!==configHash(config)||!finite(Date.parse(ledger.forwardStart))
    ||!Number.isInteger(ledger.revision)||ledger.revision<0||!Array.isArray(ledger.trades)||!Array.isArray(ledger.runs)
    ||!Array.isArray(ledger.realizedEquityCurve)||!Array.isArray(ledger.markedEquitySeries))throw Error('corrupt_ledger');
  if(new Set(ledger.trades.map(t=>t.id)).size!==ledger.trades.length||new Set(ledger.runs.map(t=>t.runKey)).size!==ledger.runs.length)throw Error('duplicate_ledger_identity');
  for(const t of ledger.trades) {
    if(hash(t.signalSnapshot)!==t.snapshotHash||t.id!==signalKey(t.signalSnapshot)||t.configHash!==ledger.configHash
      ||!config.universes[ledger.cohort].symbols.includes(t.symbol)||!['pending_entry','open','closed','cancelled','skipped'].includes(t.status))throw Error('corrupt_decision');
    validateSignal(t.signalSnapshot);
    if(['open','closed'].includes(t.status)&&(![t.entry,t.risk,t.quantity,t.riskAmount,t.notional].every(x=>finite(x)&&x>0)||!finite(Date.parse(t.entryT))||Date.parse(t.entryT)<Date.parse(t.signalAvailableAt)))throw Error('corrupt_position');
    if(t.status==='closed'&&(![t.pnl,t.R,t.cost,t.exitPrice].every(finite)||!finite(Date.parse(t.exitT))))throw Error('corrupt_outcome');
    const near=(a,b)=>Math.abs(a-b)<=1e-7*Math.max(1,Math.abs(a),Math.abs(b));
    if(['open','closed'].includes(t.status)&&(!near(t.notional,t.quantity*t.entry)||!near(t.riskAmount,t.quantity*t.risk)||!near(t.risk,t.dir*(t.entry-t.stop))))throw Error('corrupt_position_arithmetic');
    if(t.status==='closed'&&(!near(t.R,t.dir*(t.exitPrice-t.entry)/t.risk)||!near(t.cost,t.riskAmount*config.portfolio.costR)||!near(t.pnl,t.riskAmount*t.R-t.cost)))throw Error('corrupt_outcome_arithmetic');
  }
  return ledger;
}
export function assertPreserved(before,after,config) {
  verifyLedger(before,config);verifyLedger(after,config);
  if(before.cohort!==after.cohort||before.forwardStart!==after.forwardStart||after.revision!==before.revision+1)throw Error('invalid_ledger_transition');
  for(const old of before.trades) {
    const next=after.trades.find(t=>t.id===old.id);
    if(!next||next.snapshotHash!==old.snapshotHash||next.firstObservedAt!==old.firstObservedAt
      ||next.signalAvailableAt!==old.signalAvailableAt||next.stop!==old.stop||next.target!==old.target)throw Error('decision_rewrite');
    if(terminal.has(old.status)&&canonical(next)!==canonical(old))throw Error('terminal_record_rewrite');
    if(old.status==='open'&&['entry','entryT','risk','quantity','riskAmount','notional'].some(k=>next[k]!==old[k]))throw Error('position_reallocation');
  }
  for(const key of ['runs','realizedEquityCurve','markedEquitySeries'])if(canonical(after[key].slice(0,before[key].length))!==canonical(before[key]))throw Error('history_rewrite');
}
