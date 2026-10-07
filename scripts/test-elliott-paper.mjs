import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createLedger,advanceAccount,accountReport,verifyLedger,assertPreserved,hash} from '../lib/elliott/paper-account.mjs';
import {readLedger,writeLedger} from '../lib/elliott/ledger-store.mjs';
const T=Date.UTC(2025,0,1),H=3600000,BAR=4*H,iso=t=>new Date(t).toISOString();
function config(symbols=['A'],mode='crypto') {return {version:'elliott-v1',execution:{maxHoldBars:60,minRewardRisk:2,stockEntryHours:120,cryptoEntryHours:36},portfolio:{startingCapital:1000,targetRiskPct:.01,maxPositionPct:.25,maxOpenRiskPct:.04,maxPositions:4,costR:.05},universes:{test:{symbols,mode}}}}
function signal(symbol='A',dir=1,at=T) {return {version:'elliott-v1',symbol,dir,status:'signal_confirmed',decisionId:symbol+'|'+dir+'|'+at,
  signalT:iso(at-86400000),signalCompletedAt:iso(at),signalClose:100,stop:dir===1?90:110,target:dir===1?130:70}}
function bar(t=T,o=100,h=105,l=95,c=101){return {t,endT:t+BAR,o,h,l,c}}
function feed(bars=[],at=T,gaps=[]) {return {status:'available',bars,latestDailyCompletedAt:iso(at),gapBeforeTimes:gaps}}
function start(cfg=config(),signals=[signal()],feeds={A:feed()},at=T) {
  return advanceAccount(createLedger(cfg,{cohort:'test',forwardStart:iso(T)}),{config:cfg,observedAt:iso(at),runKey:'start',signals,feeds});
}
function step(prior,cfg,feeds,at,key='next',signals=[]) {return advanceAccount(prior,{config:cfg,observedAt:iso(at),runKey:key,feeds,signals})}

test('late feed recovery cannot spend a later profit from a previous run',()=>{
  const cfg=config(['A','B']);cfg.portfolio.maxPositions=1;
  let ledger=start(cfg,[signal('A'),signal('B')],{A:feed(),B:feed()});
  ledger=step(ledger,cfg,{A:feed([bar(T,100,132,95,130)]),B:{status:'unavailable',bars:[]}},T+BAR,'A-profit');
  assert.equal(ledger.trades.find(t=>t.symbol==='A').status,'closed');
  ledger=step(ledger,cfg,{A:feed([bar(T,100,132,95,130)]),B:feed([bar()])},T+2*BAR,'B-recovers');
  assert.equal(ledger.trades.find(t=>t.symbol==='B').status,'skipped');
  assert.equal(ledger.trades.find(t=>t.symbol==='B').skipReason,'max_positions');
});

test('first observation prevents a fabricated past-open entry',()=>{
  const cfg=config(),ledger=start(cfg,[signal()],{A:feed([bar()])},T+BAR+H);
  assert.equal(ledger.trades[0].status,'pending_entry');
  const next=step(ledger,cfg,{A:feed([bar(),bar(T+BAR),bar(T+2*BAR)])},T+3*BAR);
  assert.equal(next.trades[0].entryT,iso(T+2*BAR));assert.equal(next.trades[0].holdingBars,1);
});

test('long admission, fixed risk allocation and target settlement',()=>{
  const cfg=config(),initial=start(cfg);
  let ledger=step(initial,cfg,{A:feed([bar()])},T+BAR);
  const t=ledger.trades[0];assert.equal(t.status,'open');assert.equal(t.quantity,1);assert.equal(t.riskAmount,10);
  assert.equal(accountReport(ledger,cfg).cash,900);
  ledger=step(ledger,cfg,{A:feed([bar(),bar(T+BAR,101,132,100,130)])},T+2*BAR,'close');
  assert.equal(ledger.trades[0].R,3);assert.equal(ledger.trades[0].pnl,29.5);
  assert.equal(accountReport(ledger,cfg).realizedCurrentEquity,1029.5);
  assertPreserved(initial,step(initial,cfg,{A:feed([bar()])},T+BAR),cfg);
});

test('short settlement has symmetric directional P/L without crediting sale proceeds',()=>{
  const cfg=config(),initial=start(cfg,[signal('A',-1)]);
  let ledger=step(initial,cfg,{A:feed([bar(T,100,105,95,99)])},T+BAR);
  assert.equal(accountReport(ledger,cfg).cash,900);
  ledger=step(ledger,cfg,{A:feed([bar(T,100,105,95,99),bar(T+BAR,99,100,68,70)])},T+2*BAR,'close');
  assert.equal(ledger.trades[0].R,3);assert.equal(ledger.trades[0].pnl,29.5);
});

test('adverse stop gap uses open, favorable target gap uses boundary',()=>{
  for(const dir of [1,-1]) {
    const cfg=config(),initial=start(cfg,[signal('A',dir)]),first=step(initial,cfg,{A:feed([bar()])},T+BAR);
    const g=dir===1?bar(T+BAR,80,85,75,82):bar(T+BAR,120,125,115,122);
    const lost=step(first,cfg,{A:feed([bar(),g])},T+2*BAR,'gap');
    assert.equal(lost.trades[0].R,-2);assert.equal(lost.trades[0].exitReason,'stop_gap_open');
    const favorable=dir===1?bar(T+BAR,140,145,135,142):bar(T+BAR,60,65,55,62);
    const won=step(first,cfg,{A:feed([bar(),favorable])},T+2*BAR,'target');
    assert.equal(won.trades[0].R,3);assert.equal(won.trades[0].exitReason,'target_gap_boundary');
  }
});

test('intrabar collision is stop-first but an opening target gap resolves first',()=>{
  const cfg=config(),first=step(start(cfg),cfg,{A:feed([bar()])},T+BAR);
  const collision=step(first,cfg,{A:feed([bar(),bar(T+BAR,100,140,80,100)])},T+2*BAR,'collision');
  assert.equal(collision.trades[0].R,-1);assert.equal(collision.trades[0].executionAudit.stopTargetCollision,true);
  const gap=step(first,cfg,{A:feed([bar(),bar(T+BAR,140,145,80,100)])},T+2*BAR,'gap');
  assert.equal(gap.trades[0].R,3);
});

test('reward/risk is rechecked at entry; price through a boundary is cancelled',()=>{
  const cfg=config();
  for(const [o,reason] of [[115,'entry_reward_risk'],[85,'entry_through_stop_or_target'],[140,'entry_through_stop_or_target']]) {
    const next=step(start(cfg),cfg,{A:feed([bar(T,o,o+1,o-1,o)])},T+BAR);
    assert.equal(next.trades[0].status,'cancelled');assert.equal(next.trades[0].cancelReason,reason);
    assert.equal(accountReport(next,cfg).realizedCurrentEquity,1000);
  }
});

test('four-position/collateral cap skips fifth deterministically',()=>{
  const symbols=['E','D','C','B','A'],cfg=config(symbols),signals=symbols.map(s=>({...signal(s),stop:99,target:103}));
  const feeds=Object.fromEntries(symbols.map(s=>[s,feed()])),initial=start(cfg,signals,feeds);
  const next=step(initial,cfg,Object.fromEntries(symbols.map(s=>[s,feed([bar(T,100,100.5,99.5,100)])])),T+BAR);
  const report=accountReport(next,cfg);assert.equal(report.openCount,4);assert.equal(report.skippedCount,1);assert.equal(report.cash,0);
  assert.deepEqual(report.open.map(t=>t.symbol),['A','B','C','D']);assert.equal(next.trades.find(t=>t.symbol==='E').skipReason,'max_positions');
});

test('future exits cannot fund an earlier entry; same-time closed-bar settlement can',()=>{
  const cfg=config(['A','B']);cfg.portfolio.maxPositions=1;
  let first=start(cfg);first=step(first,cfg,{A:feed([bar()]),B:feed([],T+BAR)},T+BAR,'recordB',[signal('B',1,T+BAR)]);
  const next=step(first,cfg,{A:feed([bar(),bar(T+BAR),bar(T+2*BAR,101,135,100,130)]),B:feed([bar(T+BAR),bar(T+2*BAR)],T+BAR)},T+3*BAR,'later');
  assert.equal(next.trades.find(t=>t.symbol==='B').status,'skipped');assert.equal(next.trades.find(t=>t.symbol==='A').status,'closed');
  const both=start(cfg,[signal('A'),signal('B')],{A:feed(),B:feed()});
  const settled=step(both,cfg,{A:feed([bar(T,100,135,95,130)]),B:feed([bar(T+BAR)])},T+2*BAR);
  assert.equal(settled.trades.find(t=>t.symbol==='B').status,'open');
});

test('pending/open symbols block overlapping directions without deleting evidence',()=>{
  const cfg=config(),first=start(cfg);
  const next=step(first,cfg,{A:feed([],T+86400000)},T+86400000,'new',[signal('A',-1,T+86400000)]);
  assert.equal(next.trades.length,2);assert.equal(next.trades[1].skipReason,'symbol_already_pending_or_open');
});

test('prelaunch/stale daily signals do not create backfilled decisions',()=>{
  const cfg=config(),old=signal('A',1,T-86400000);
  const a=start(cfg,[old]);assert.equal(a.trades.length,0);
  const b=start(cfg,[signal()],{A:feed([],T+86400000)},T+86400000);assert.equal(b.trades.length,0);
});

test('expiration differs by market; no fabricated position or P/L',()=>{
  for(const [mode,hours] of [['crypto',36],['stock',120]]) {
    const cfg=config(['A'],mode),initial=start(cfg);
    const next=step(initial,cfg,{A:feed()},T+(hours+1)*H);
    assert.equal(next.trades[0].status,'cancelled');assert.equal(next.trades[0].cancelReason,'entry_expired');
  }
});

test('max holding duration counts only newly completed bars, including entry bar',()=>{
  const cfg=config();cfg.execution.maxHoldBars=3;
  const bars=[bar(),bar(T+BAR),bar(T+2*BAR,101,104,99,102)];
  let ledger=step(start(cfg),cfg,{A:feed(bars.slice(0,1))},T+BAR);
  ledger=step(ledger,cfg,{A:feed(bars.slice(0,1))},T+BAR+H,'repeat');assert.equal(ledger.trades[0].holdingBars,1);
  ledger=step(ledger,cfg,{A:feed(bars)},T+3*BAR,'final');assert.equal(ledger.trades[0].holdingBars,3);assert.equal(ledger.trades[0].exitReason,'max_hold_close');
});

test('held data gap blocks exit and total valuation; exact missing bar permits recovery',()=>{
  const cfg=config(),first=step(start(cfg),cfg,{A:feed([bar()])},T+BAR);
  const missing=step(first,cfg,{A:feed([bar(),bar(T+2*BAR,100,140,95,130)])},T+3*BAR,'missing');
  assert.equal(missing.trades[0].status,'open');assert.equal(missing.trades[0].holdingBars,1);
  assert.equal(accountReport(missing,cfg).markedCurrentEquity,null);
  const recovered=step(missing,cfg,{A:feed([bar(),bar(T+BAR),bar(T+2*BAR,100,140,95,130)])},T+3*BAR+H,'recover');
  assert.equal(recovered.trades[0].status,'closed');assert.equal(recovered.trades[0].R,3);
});

test('pending source outage can recover; a missing entry path cannot jump ahead',()=>{
  const cfg=config(),initial=start(cfg);
  const outage=step(initial,cfg,{},T+H,'outage');
  const recovered=step(outage,cfg,{A:feed([bar()])},T+BAR,'recover');assert.equal(recovered.trades[0].status,'open');
  const gap=step(initial,cfg,{A:feed([bar(T+BAR)],T,[T+BAR])},T+2*BAR,'gap');assert.equal(gap.trades[0].status,'pending_entry');
  const more=step(gap,cfg,{A:feed([bar(T+BAR),bar(T+2*BAR)],T,[T+BAR])},T+3*BAR,'more');assert.equal(more.trades[0].status,'pending_entry');
});

test('provider revisions suspend an open position; closed outcomes remain unchanged',()=>{
  const cfg=config(),first=step(start(cfg),cfg,{A:feed([bar()])},T+BAR);
  const changed=step(first,cfg,{A:feed([bar(T,100,106,95,102),bar(T+BAR)])},T+2*BAR,'revision');
  assert.equal(changed.trades[0].holdingBars,1);assert.equal(changed.trades[0].lifecycleDataGap.type,'provider_revision_requires_review');
  const closed=step(first,cfg,{A:feed([bar(),bar(T+BAR,100,132,95,130)])},T+2*BAR,'close');
  const later=step(closed,cfg,{A:feed([bar(T,100,106,95,102)])},T+3*BAR,'later');assert.deepEqual(later.trades[0],closed.trades[0]);
});

test('same run is idempotent; reused identity with changed input is rejected',()=>{
  const cfg=config(),initial=createLedger(cfg,{cohort:'test',forwardStart:iso(T)}),args={config:cfg,observedAt:iso(T),runKey:'once',signals:[signal()],feeds:{A:feed()}};
  const first=advanceAccount(initial,args);assert.deepEqual(advanceAccount(first,args),first);
  assert.throws(()=>advanceAccount(first,{...args,feeds:{}}),/different_input/);
});

test('independent cohorts and missing marks never become fabricated zero P/L',()=>{
  const cfg=config();cfg.universes.other={mode:'crypto',symbols:['A']};
  const untouched=createLedger(cfg,{cohort:'other',forwardStart:iso(T)});
  const first=step(start(cfg),cfg,{A:feed([bar()])},T+BAR),missing=step(first,cfg,{},T+2*BAR,'missing');
  assert.equal(accountReport(missing,cfg).markedCurrentEquity,null);assert.equal(accountReport(missing,cfg).realizedCurrentEquity,1000);
  assert.equal(untouched.trades.length,0);assert.equal(untouched.revision,0);
});

test('checksum, revision lease, immutable decisions and closed-record safeguards',()=>{
  const cfg=config(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'elliott-ledger-test-')),file=path.join(dir,'test-ledger.json');
  try {
    const initial=start(cfg);writeLedger(file,initial,cfg,{expectedRevision:0});assert.deepEqual(readLedger(file,cfg),initial);
    const next=step(initial,cfg,{A:feed([bar()])},T+BAR);writeLedger(file,next,cfg,{expectedRevision:1});
    assert.throws(()=>writeLedger(file,next,cfg,{expectedRevision:1}),/revision_conflict/);
    const altered=structuredClone(next);altered.revision++;altered.trades[0].signalSnapshot.stop=80;altered.trades[0].snapshotHash=hash(altered.trades[0].signalSnapshot);
    assert.throws(()=>writeLedger(file,altered,cfg,{expectedRevision:2}),/decision_rewrite/);
    const data=JSON.parse(fs.readFileSync(file));data.ledger.trades[0].quantity=10;fs.writeFileSync(file,JSON.stringify(data));
    assert.throws(()=>readLedger(file,cfg),/checksum/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('invalid config, out-of-order runs and corrupt arithmetic fail closed',()=>{
  const cfg=config(),first=start(cfg),changed=structuredClone(cfg);changed.execution.maxHoldBars=61;
  assert.throws(()=>step(first,changed,{A:feed()},T+H),/corrupt_ledger/);
  assert.throws(()=>step(first,cfg,{A:feed()},T-H),/invalid_run/);
  const open=step(first,cfg,{A:feed([bar()])},T+BAR);open.trades[0].riskAmount=100;assert.throws(()=>verifyLedger(open,cfg),/arithmetic/);
});
