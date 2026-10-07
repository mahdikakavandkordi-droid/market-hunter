import test from 'node:test';
import assert from 'node:assert/strict';
import {MODEL,analyzeElliott,validateImpulse,validateCorrection,indicators} from '../lib/elliott/engine.mjs';

const DAY=86400000,START=Date.UTC(2025,0,1);
function fixture() {
  const anchors=[[0,119],[8,100],[14,120],[20,110],[26,145],[32,125],[38,155],[44,132],[50,143],[56,122],[64,150]];
  const rows=[];
  for(let i=0;i<=64;i++) {
    let n=anchors.findIndex(p=>p[0]>=i);if(n===0)n=1;
    const [a,x]=anchors[n-1],[b,y]=anchors[n],c=x+(y-x)*(i-a)/(b-a);
    rows.push({t:START+i*DAY,endT:START+(i+1)*DAY,o:c,h:c+.4,l:c-.4,c,v:i===63?2000:1000});
  }
  return rows;
}
const mirror=rows=>rows.map(b=>({...b,o:300-b.o,h:300-b.l,l:300-b.h,c:300-b.c}));
const run=(rows,opts={})=>analyzeElliott(rows,{symbol:'FIXTURE',asOf:rows.at(-1)?.endT??START,...opts});
function points(prices,dir=1) {return prices.map((price,i)=>({t:i+1,price,type:i%2?(dir===1?'high':'low'):(dir===1?'low':'high')}))}

test('valid five-wave impulse and simple ABC in both directions',()=>{
  const p=points([100,120,110,145,125,155]);
  assert.equal(validateImpulse(p,1).valid,true);
  const abc=[{t:7,type:'low',price:132},{t:8,type:'high',price:143},{t:9,type:'low',price:122}];
  const c=validateCorrection(p,abc,1);assert.equal(c.valid,true);assert.equal(c.retracement,.6);
  const reverse=p.map(x=>({...x,price:300-x.price,type:x.type==='high'?'low':'high'}));
  const rabc=abc.map(x=>({...x,price:300-x.price,type:x.type==='high'?'low':'high'}));
  assert.equal(validateImpulse(reverse,-1).valid,true);
  assert.deepEqual(validateCorrection(reverse,rabc,-1),{...c,trigger:157});
});

test('reject violations of standard impulse rules',()=>{
  for(const [p,reason] of [
    [[100,120,99,145,125,155],'wave2_breaks_origin'],
    [[100,120,110,145,119,155],'wave4_overlap'],
    [[100,120,110,145,125,144],'truncated_wave5_unsupported'],
    [[100,130,125,140,135,160],'wave3_shortest']
  ])assert.equal(validateImpulse(points(p),1).reason,reason);
  assert.equal(validateImpulse(points([100,120,110,145,125,155]).reverse(),1).valid,false);
});

test('ABC requires lower C, bounded B, intact origin and chosen retracement',()=>{
  const p=points([100,120,110,145,125,155]);
  const correction=(a,b,c)=>[{t:7,type:'low',price:a},{t:8,type:'high',price:b},{t:9,type:'low',price:c}];
  assert.equal(validateCorrection(p,correction(132,143,133),1).reason,'complex_correction_unsupported');
  assert.equal(validateCorrection(p,correction(132,156,122),1).valid,false);
  assert.equal(validateCorrection(p,correction(132,143,99),1).reason,'correction_breaks_origin');
  assert.equal(validateCorrection(p,correction(140,148,138),1).reason,'retracement_out_of_range');
});

test('daily fixture emits exactly one long setup with confirmed anchors',()=>{
  const d=run(fixture());assert.equal(d.signals.length,1);
  const s=d.signals[0];assert.equal(s.dir,1);assert.equal(s.status,'signal_confirmed');
  assert.equal(s.impulse.length,6);assert.equal(s.correction.length,3);
  assert.ok(s.rewardRisk>=2);assert.ok(s.stop<s.signalClose&&s.target>s.signalClose);
  assert.ok(s.impulse.concat(s.correction).every(p=>p.confirmedAt<=Date.parse(s.signalCompletedAt)));
  const large=d.pivots.large.filter(p=>p.t===s.impulse[0].t||p.t===s.impulse[5].t);
  assert.equal(large.length,2);assert.ok(large.every(p=>p.confirmedAt<=Date.parse(s.identifiedAt)));
  assert.ok(s.indicators.rsi14!==null&&s.indicators.rvol20!==null);
});

test('short is a symmetric structural mirror, including stop and target',()=>{
  const long=run(fixture()).signals[0],short=run(mirror(fixture())).signals[0];
  assert.ok(short);assert.equal(short.dir,-1);assert.equal(short.signalCompletedAt,long.signalCompletedAt);
  assert.ok(Math.abs(short.stop-(300-long.stop))<1e-10);
  assert.ok(Math.abs(short.target-(300-long.target))<1e-10);
  assert.ok(Math.abs(short.rewardRisk-long.rewardRisk)<1e-10);
});

test('every prefix matches full replay evidence available at that time',()=>{
  const rows=fixture(),full=run(rows);
  for(let n=1;n<=rows.length;n++) {
    const asOf=rows[n-1].endT,prefix=run(rows.slice(0,n));
    assert.deepEqual(prefix.signals,full.signals.filter(s=>Date.parse(s.signalCompletedAt)<=asOf));
    for(const scale of ['small','large'])assert.deepEqual(prefix.pivots[scale],full.pivots[scale].filter(p=>p.confirmedAt<=asOf));
    assert.deepEqual(run(rows,{asOf}),prefix);
  }
});

test('uncompleted candle cannot confirm pivot or signal',()=>{
  const rows=fixture(),signal=run(rows).signals[0],at=Date.parse(signal.signalCompletedAt);
  assert.equal(run(rows,{asOf:at-1}).signals.length,0);
  const c=signal.correction[2];
  const before=run(rows,{asOf:c.confirmedAt-1});
  assert.equal(before.pivots.small.some(p=>p.t===c.t),false);
  assert.equal(run(rows,{asOf:c.confirmedAt}).pivots.small.some(p=>p.t===c.t),true);
});

test('extreme future prices do not change previously emitted decisions',()=>{
  const rows=fixture(),past=run(rows),base=rows.at(-1).endT;
  const future=Array.from({length:25},(_,i)=>({t:base+i*DAY,endT:base+(i+1)*DAY,o:40+i,h:41+i,l:39+i,c:40+i,v:999999}));
  const next=run([...rows,...future]);
  assert.deepEqual(next.signals.filter(s=>Date.parse(s.signalCompletedAt)<=base),past.signals);
  assert.deepEqual(next.decisions.filter(s=>Date.parse(s.signalCompletedAt)<=base),past.decisions);
  assert.deepEqual(run([...rows,...future],{asOf:base}),past);
});

test('breakout occurring before C confirmation is not retroactively entered',()=>{
  const rows=fixture();
  for(let i=57;i<rows.length;i++) {
    const c=148+(i-57);Object.assign(rows[i],{o:c,h:c+.4,l:c-.4,c});
  }
  const d=run(rows);assert.equal(d.signals.length,0);
  assert.ok(d.candidates.some(c=>c.status==='waiting_breakout'));
});

test('origin breach invalidates an observed setup',()=>{
  const rows=fixture().slice(0,60),last=rows.at(-1).endT;
  rows.push({t:last,endT:last+DAY,o:99,h:100,l:98,c:99,v:1000});
  const d=run(rows);assert.equal(d.signals.length,0);
  assert.ok(d.candidates.some(c=>c.reason==='origin_breached'));
});

test('origin breach before outer endpoint confirmation is never resurrected',()=>{
  const rows=fixture().slice(0,44);
  Object.assign(rows[39],{o:98,h:99,l:97,c:98});
  const d=run(rows);
  assert.equal(d.signals.length,0);
  assert.ok(d.candidates.some(c=>c.reason==='origin_breached'));
});

test('an overextended confirmation is recorded as rejected, not a trade',()=>{
  const rows=fixture();
  Object.assign(rows[63],{o:185,h:186,l:184,c:185});
  // The normal crossover is on day 63; make that first known crossover too late.
  const d=run(rows);
  assert.equal(d.signals.length,0);
  assert.equal(d.decisions.length,1);
  assert.equal(d.decisions[0].status,'rejected_reward_risk');
});

test('known daily gap prevents an ABC spanning missing data',()=>{
  const rows=fixture().filter((_,i)=>i!==53),gap=START+54*DAY;
  const d=run(rows,{gapBeforeTimes:[gap]});assert.equal(d.signals.length,0);
  assert.equal(d.coverage.knownGaps,1);
  assert.ok(d.candidates.some(c=>c.reason==='daily_path_gap'));
  for(const scale of ['small','large'])assert.ok(d.pivots[scale].every(p=>{
    const at=rows.findIndex(b=>b.t===p.t),end=p.confirmedIndex;
    return !rows.slice(at-p.radius+1,end+1).some(b=>b.t===gap);
  }));
});

test('equal/flat extrema have no forced wave count',()=>{
  const rows=Array.from({length:50},(_,i)=>({t:START+i*DAY,endT:START+(i+1)*DAY,o:100,h:101,l:99,c:100,v:1000}));
  const d=run(rows);assert.equal(d.signals.length,0);assert.equal(d.pivots.small.length,0);
  assert.equal(d.status,'no_supported_structure');
});

test('ambiguous outside bar is not arbitrarily high-first or low-first',()=>{
  const rows=Array.from({length:20},(_,i)=>({t:START+i*DAY,endT:START+(i+1)*DAY,o:100,h:101,l:99,c:100,v:1000}));
  Object.assign(rows[8],{h:110,l:90});
  const d=run(rows);assert.equal(d.pivots.small.length,0);assert.equal(d.pivots.large.length,0);
});

test('ATR, Wilder RSI and prior-only volume ratio are calculated explicitly',()=>{
  const rows=Array.from({length:25},(_,i)=>({t:i,endT:i+1,o:100+i,h:101+i,l:99+i,c:100+i,v:i===24?2000:1000}));
  assert.deepEqual(indicators(rows),{atr14:2,rsi14:100,rvol20:2});
  assert.equal(indicators(rows.slice(0,14)).atr14,null);
  rows[10].v=null;assert.equal(indicators(rows).rvol20,null);
  const flat=rows.map(b=>({...b,o:100,h:101,l:99,c:100}));assert.equal(indicators(flat).rsi14,50);
});

test('missing optional volume cannot invent a value or suppress base signals',()=>{
  const rows=fixture().map(b=>({...b,v:null}));
  const s=run(rows).signals;assert.equal(s.length,1);assert.equal(s[0].indicators.rvol20,null);
});

test('input validation fails closed on duplicate timestamps and invalid prices',()=>{
  assert.throws(()=>analyzeElliott(fixture()),/asOf/);
  const rows=fixture();assert.throws(()=>run([...rows,rows.at(-1)]),/duplicate/);
  rows[20].c=NaN;assert.throws(()=>run(rows),/ohlc/);
  assert.equal(run([]).status,'no_supported_structure');
  assert.ok(Object.isFrozen(MODEL));
});
