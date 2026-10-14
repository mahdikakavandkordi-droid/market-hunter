import assert from 'node:assert/strict';
import {makeFeatures,train,predict,backtest,forecast,HORIZONS,FEATURES} from './engine.mjs';

// Synthetic fixture is only for validating plumbing, NEVER historical performance.
let seed=90217;
function rng(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const bars=[];
let close=100;
const base=Date.UTC(2020,0,1);
for(let i=0;i<770;i++){
  const shock=(rng()-.5)*.045,cyc=.008*Math.sin(i/19);
  close*=Math.exp(shock+cyc);
  bars.push({date:new Date(base+i*86400000).toISOString().slice(0,10),close});
}
assert.deepEqual(HORIZONS,[5,10,20]);
assert.equal(FEATURES.length,6);
const f=makeFeatures(bars);
assert.equal(f[0].t,60);
const inspect=365,h=10;
const matured=f.filter(v=>v.t+h<=inspect);
assert(matured.every(v=>v.t+h<=inspect));
assert(matured.some(v=>v.t+h===inspect));
const historic=matured.map(v=>({...v,y:Math.log(bars[v.t+h].close/bars[v.t].close)}));
const model=train(historic);
const before=predict(model,f.find(v=>v.t===inspect).x);
assert(before.probabilityUp>=0&&before.probabilityUp<=1);
assert(Number.isFinite(before.expectedLogReturn));

// Feature cutoff invariant: modifying unknown future prices must not change past features.
const changed=bars.map(x=>({...x}));
for(let i=inspect+1;i<changed.length;i++)changed[i].close*=50;
const f2=makeFeatures(changed);
assert.deepEqual(f.find(v=>v.t===inspect),f2.find(v=>v.t===inspect));

// Purged training invariant for point t: training labels in the future are prohibited.
const h20=20,t=380;
assert(f.filter(v=>v.t+h20<=t).every(v=>v.t+h20<=t));
assert(!f.filter(v=>v.t+h20<=t).some(v=>v.t>t-h20));

const stats=backtest(bars);
assert.equal(stats.length,3);
for(const item of stats){
  assert(item.count>100);
  for(const field of ['directionAccuracy','historicalPriorAccuracy','brierSkillPct','mseSkillPct','meanAbsoluteErrorPct','baselineAbsoluteErrorPct']){
    assert(Number.isFinite(item[field]),field+' finite');
  }
  assert(item.first<item.last);
  assert(item.independentCount>5);
}
const last=forecast(bars,10);
assert.equal(last.asOf,bars.at(-1).date);
assert(Number.isFinite(last.probabilityUp));
assert.throws(()=>backtest([...bars.slice(0,10),bars[4],...bars.slice(10)]),/increasing dates/);
assert.throws(()=>backtest(bars.map((v,i)=>i===110?{...v,close:0}:v)),/Invalid close/);
console.log('PASS: research engine synthetic checks, purge, no-future features, horizons, input validation');
