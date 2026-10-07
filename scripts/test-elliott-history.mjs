import test from 'node:test';
import assert from 'node:assert/strict';
import {auditStructure,regimeAt} from '../lib/elliott/historical-structure.mjs';
import {cryptoFixture} from '../tests/fixtures/elliott-symbol.mjs';
const snapshot=bars=>({symbol:'FIXTURE',market:'crypto',bars,gapBeforeTimes:[]});
test('historical audit verifies every prefix and reports only available confirmed signals',()=>{
  const bars=cryptoFixture(),r=auditStructure(snapshot(bars));
  assert.equal(r.prefixChecks,bars.length);assert.equal(r.signals.length,1);
  assert.equal(r.causality,'passed_all_prefixes');assert.equal(r.signals[0].dir,1);
  assert.equal(r.signals[0].correctionConfirmationDelayBars,2);
  assert.ok(r.signals[0].outerEndpointRecognitionDelayBars>=5);
  assert.equal(r.signals[0].regime,'insufficient_history');
});
test('mirrored data tests short independently and preserves causal confirmation time',()=>{
  const bars=cryptoFixture(),mirrored=bars.map(b=>({...b,o:300-b.o,h:300-b.l,l:300-b.h,c:300-b.c}));
  const a=auditStructure(snapshot(bars)),b=auditStructure(snapshot(mirrored));
  assert.equal(b.signals[0].dir,-1);assert.equal(a.signals[0].signalCompletedAt,b.signals[0].signalCompletedAt);
});
test('regime classification cannot read later prices and requires full warm-up',()=>{
  const bars=Array.from({length:240},(_,i)=>({c:100+i}));
  assert.equal(regimeAt(bars,198),'insufficient_history');assert.equal(regimeAt(bars,199),'up');
  const changed=bars.map((b,i)=>i>199?{c:.1}:b);assert.equal(regimeAt(changed,199),'up');
  assert.equal(regimeAt(bars.map(b=>({c:500-b.c})),199),'down');
  assert.equal(regimeAt(bars.map(()=>({c:100})),199),'mixed');
});
test('a known daily gap resets the count and malformed snapshots fail closed',()=>{
  const bars=cryptoFixture();
  assert.equal(auditStructure({...snapshot(bars),gapBeforeTimes:[bars[47].t]}).signals.length,0);
  assert.throws(()=>auditStructure(snapshot([])),/empty/);
  assert.throws(()=>auditStructure(snapshot([...bars,bars.at(-1)])),/unordered/);
});
