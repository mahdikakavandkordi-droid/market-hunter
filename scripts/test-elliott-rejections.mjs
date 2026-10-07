import test from 'node:test';
import assert from 'node:assert/strict';
import {auditRejections,explainABC,correctionAt} from '../lib/elliott/rejection-audit.mjs';
import {cryptoFixture} from '../tests/fixtures/elliott-symbol.mjs';
const impulse=[100,120,110,145,125,155].map((price,i)=>({t:i+1,type:i%2?'high':'low',price}));
const tail=prices=>prices.map((price,i)=>({t:i+7,type:i===1?'high':'low',price}));
test('generic complex label distinguishes excluded price geometry from extra pivots',()=>{
  assert.equal(explainABC(impulse,tail([132,143,133]),1).detail,'C_does_not_exceed_A');
  assert.equal(explainABC(impulse,tail([132,156,122]),1).detail,'B_reaches_or_exceeds_wave5');
  assert.equal(explainABC(impulse,[...tail([132,143,122]),{t:10,type:'high',price:145}],1).detail,'more_than_three_confirmed_pivots');
  assert.equal(explainABC(impulse,tail([132,143,122]),1).reason,null);
});
test('shallow/deep diagnostics and short geometry use the same frozen contract',()=>{
  assert.equal(explainABC(impulse,tail([145,150,140]),1).detail,'retracement_too_shallow');
  assert.equal(explainABC(impulse,tail([125,140,110]),1).detail,'retracement_too_deep');
  const mirror=p=>({...p,price:300-p.price,type:p.type==='high'?'low':'high'});
  assert.equal(explainABC(impulse.map(mirror),tail([132,156,122]).map(mirror),-1).detail,'B_reaches_or_exceeds_wave5');
});
test('reconstructed correction ignores unconfirmed and different-segment pivots',()=>{
  const c={impulse,segment:0};
  const ps=tail([132,143,122]).map(p=>({...p,confirmedAt:20,segment:0}));
  const before=correctionAt([...ps,{t:10,type:'high',price:170,confirmedAt:40,segment:0},{t:11,type:'low',price:90,confirmedAt:20,segment:1}],c,20);
  assert.deepEqual(before,ps);assert.equal(correctionAt(ps,c,19).length,0);
});
test('a genuine causal fixture independently explains every terminal count in both directions',()=>{
  const bars=cryptoFixture();
  for(const rows of [bars,bars.map(b=>({...b,o:300-b.o,h:300-b.l,l:300-b.h,c:300-b.c}))]){
    const audit=auditRejections({symbol:'TEST',bars:rows,gapBeforeTimes:[]});
    assert.ok(audit.records.length);assert.ok(audit.records.every(r=>r.independentlyVerified&&r.sameTerminalStateWithoutFuture));
    assert.equal(audit.records.filter(r=>r.status==='signal_confirmed').length,1);
  }
});
test('adding future price extremes cannot alter an earlier terminal diagnosis',()=>{
  const bars=cryptoFixture(),base=auditRejections({symbol:'TEST',bars});
  const future=Array.from({length:10},(_,i)=>({t:bars.at(-1).endT+i*86400000,endT:bars.at(-1).endT+(i+1)*86400000,o:200+i,h:201+i,l:199+i,c:200+i,v:1000}));
  const longer=auditRejections({symbol:'TEST',bars:[...bars,...future]});
  for(const record of base.records){const next=longer.records.find(r=>r.id===record.id);assert.ok(next);assert.equal(next.detail,record.detail);assert.deepEqual(next.availableCorrection,record.availableCorrection);assert.equal(next.observedAt,record.observedAt)}
  assert.throws(()=>auditRejections({symbol:'TEST',bars:[]}),/empty/);
});
