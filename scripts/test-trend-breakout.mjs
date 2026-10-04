import assert from 'node:assert/strict';
import {atr,trendSignal,advanceTrade,updateSymbol,stats,groupedStats} from '../lib/trend-breakout/engine.mjs';
import {buildGapBeforeIndex} from '../lib/smc-forward-runtime.mjs';
const rules={dailySma:200,breakoutBars:20,atrBars:14,initialStopAtr:2,trailingStopAtr:3,maxHoldBars:60};
const H=3600000,start=Date.parse('2026-10-04T00:00Z');
const bars=Array.from({length:25},(_,i)=>({t:start+i*4*H,endT:start+(i+1)*4*H,o:100,h:101,l:99,c:100}));
const daily=Array.from({length:220},(_,i)=>{const t=start-(220-i)*86400000;return {t,date:new Date(t).toISOString().slice(0,10),o:90,h:101,l:89,c:i===219?105:90}});
bars[20]={...bars[20],h:111,c:110};
const sig=trendSignal(daily,bars,20,'crypto',rules);
assert.equal(sig.dir,1);assert.equal(sig.signalSnapshot.breakoutHigh,101);
assert.equal(trendSignal(daily,bars,19,'crypto',rules),null);
// Future daily and intraday changes cannot alter the recorded signal.
assert.deepEqual(trendSignal([...daily,{date:'2099-01-01',c:1e9}],bars.map((b,i)=>i>20?{...b,c:1e9,h:1e9}:b),20,'crypto',rules),sig);
const old={...sig,symbol:'A',firstObservedAt:new Date(bars[20].endT).toISOString(),entryObservationClass:'pending'};
const moved=structuredClone(bars);moved[21]={...moved[21],o:110,h:111,l:109,c:110};
const filled=advanceTrade(old,moved.slice(0,22),new Map(),rules,'2026-10-09T00:00Z');
assert.equal(filled.status,'open');assert.equal(filled.entryObservationClass,'prospective');
assert.equal(filled.stop,110-2*sig.signalSnapshot.atr14);assert.equal(filled.holdingBars,1);
const risk=filled.risk;
// A close-derived higher stop cannot be hit retroactively within the same bar.
const open={...filled,stop:90,currentStop:90,risk:20,bestClose:110};
const next=structuredClone(moved);next[22]={...next[22],o:110,h:120,l:109,c:119};
const trailed=advanceTrade(open,next.slice(0,23),new Map(),rules,'2026-10-09T00:00Z');
assert.equal(trailed.status,'open');assert.ok(trailed.currentStop>90);
assert.equal(advanceTrade(trailed,next.slice(0,23),new Map(),rules,'2026-10-09T00:00Z').holdingBars,trailed.holdingBars,'repeat runs must not count bars twice');
// Adverse open beyond the stop incurs a larger loss, not an artificial -1R.
const gapBars=structuredClone(next);gapBars[23]={...gapBars[23],o:70,h:75,l:68,c:72};
const stop=advanceTrade(trailed,gapBars.slice(0,24),new Map(),rules,'2026-10-10T00:00Z');
assert.equal(stop.status,'closed');assert.equal(stop.R,-2);assert.equal(stop.exitReason,'stop_gap_open');
assert.deepEqual(advanceTrade(stop,[],new Map(),rules,'2027-01-01'),stop);
// Missing candles stop inference even if later prices would hit the stop.
const gapped=[...moved.slice(0,22),{...moved[23],o:1,l:1,c:1}];
const gaps=buildGapBeforeIndex(gapped,{mode:'crypto'});
const unresolved=advanceTrade(filled,gapped,gaps,rules,'2026-10-10');
assert.equal(unresolved.status,'open');assert.equal(unresolved.lifecycleDataGap.type,'holding_path_gap');
assert.equal(advanceTrade(old,gapped.slice(0,21),new Map(),rules,'2026-10-10').status,'pending_entry');
const timeoutBars=[...moved.slice(0,22)];for(let i=22;i<81;i++)timeoutBars.push({...moved[21],t:start+i*4*H,endT:start+(i+1)*4*H});
const timed=advanceTrade({...filled,currentStop:1,bestClose:110},timeoutBars,new Map(),{...rules,trailingStopAtr:100},'2027-01-01');
assert.equal(timed.status,'closed');assert.equal(timed.exitReason,'max_hold_close');assert.equal(timed.holdingBars,60);
const retrospective=advanceTrade({...old,firstObservedAt:'2099-01-01'},moved.slice(0,22),new Map(),rules,'2099-01-02');
assert.equal(retrospective.status,'pending_entry','a future decision must not fill at a past open');
const delayed=advanceTrade({...old,firstObservedAt:new Date(bars[21].t+60000).toISOString()},moved.slice(0,23),new Map(),rules,'2026-10-10');
assert.equal(delayed.entryT,new Date(bars[22].t).toISOString());
assert.equal(delayed.entryObservationClass,'prospective');
const grouped=groupedStats([{...stop,entryObservationClass:'prospective'},{...stop,entryObservationClass:'reconstructed',R:3}],.05);
assert.equal(grouped.prospective.raw.n,1);assert.equal(grouped.reconstructed.raw.n,1);
const untouched=updateSymbol([stop],moved,daily,new Map(),{symbol:'A',mode:'crypto',rules,forwardStart:'2099-01-01',observedAt:'2026-10-10',runKey:'x',configHash:'frozen'});
assert.deepEqual(untouched,[stop]);
console.log('Trend Breakout V1 causal signal, stop ordering, gap, lifecycle and provenance tests passed');
