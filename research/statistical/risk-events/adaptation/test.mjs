import assert from 'node:assert/strict';
import {adaptationLedger,fitOffset} from './engine.mjs';
import {riskLedger} from '../engine.mjs';
// Synthetic code fixture ONLY, not financial forecasting evidence.
let price=100;const bars=Array.from({length:900},(_,t)=>{price*=Math.exp(.02*Math.sin(t*.137)+.006*Math.cos(t*.317));return {date:new Date(Date.UTC(2000,0,1+t)).toISOString().slice(0,10),close:price};});
const a=adaptationLedger(bars),original=riskLedger(bars).records.filter(r=>r.horizonBars===10);
for(const row of a.history){const v=original.find(r=>r.t===row.t);assert.equal(row.actual,v.actual);assert.equal(row.probabilities.expandingFull,v.probabilities.full);assert.equal(row.probabilities.expandingLevel,v.probabilities.level);}
assert.ok(a.records.length>0);const cut=830,b=adaptationLedger(bars.map((r,i)=>i>cut?{...r,close:r.close*Math.exp(.03*(i-cut))}:r));
assert.deepEqual(a.fits.filter(f=>f.date<=bars[cut].date),b.fits.filter(f=>f.date<=bars[cut].date));
const earlier=x=>x.records.filter(r=>r.t<=cut).map(({actual,targetEnd,...r})=>r);
assert.deepEqual(earlier(a),earlier(b));
for(const f of a.fits){
 if(f.kind==='training'){assert.ok(f.lastLabelEnd<=f.date);for(const [k,m] of Object.entries(f.models))if(k.startsWith('rolling'))assert.ok(m.n<=504);}
 else for(const v of Object.values(f.offsets)){assert.ok(v.lastLabelEnd<=f.date);assert.ok(v.n>=252&&v.n<=504);assert.ok(Math.abs(v.gradient)<1e-6);}
}
const fixture=Array.from({length:504},(_,i)=>({date:String(i),targetEnd:String(i),actual:1,probabilities:{p:.1}}));assert.ok(fitOffset(fixture,'p').offset>0);
assert.equal(a.records[0].t,a.history[0].t+261);
console.log('PASS: legacy parity; causal matured calibration; rolling limits; future invariance; numerical offset direction');
