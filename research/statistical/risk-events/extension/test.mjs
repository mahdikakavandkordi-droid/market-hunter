import assert from 'node:assert/strict';
import {extensionLedger} from './engine.mjs';
import {riskLedger} from '../engine.mjs';
// Synthetic deterministic prices are ONLY a code fixture, never market evidence.
let price=100;
const bars=Array.from({length:650},(_,t)=>{price*=Math.exp(.015*Math.sin(t*.137)+.003*Math.cos(t*.51));return {date:new Date(Date.UTC(2000,0,1+t)).toISOString().slice(0,10),close:price};});
const a=extensionLedger(bars),original=riskLedger(bars).records.filter(r=>r.horizonBars===10);
assert.equal(a.records.length,original.length);
for(let i=0;i<a.records.length;i++){
 for(const k of ['full','level'])assert.equal(a.records[i].probabilities[k],original[i].probabilities[k]);
 assert.equal(a.records[i].actual,original[i].actual);
}
const cut=580,changed=bars.map((b,i)=>i>cut?{...b,close:b.close*Math.exp(.02*(i-cut))}:b),b=extensionLedger(changed);
assert.deepEqual(a.fits.filter(f=>f.date<=bars[cut].date),b.fits.filter(f=>f.date<=bars[cut].date));
const predictions=x=>x.records.filter(r=>r.t<=cut).map(({actual,targetEnd,...v})=>v);
assert.deepEqual(predictions(a),predictions(b));
for(const fit of a.fits){assert.ok(fit.lastTrainingLabelEnd<=fit.date);for(const model of Object.values(fit.models))assert.ok(model.maxAbsGradient<=1e-4);}
console.log('PASS: legacy equivalence, future-mutation causality for all candidates, label maturity and convergence');
