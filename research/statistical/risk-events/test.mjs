import assert from 'node:assert/strict';
import {chiSquareSurvival,riskFeatures,riskLedger,fitProbability,probability,CONFIG} from './engine.mjs';
import {summarizeRisk} from './diagnostics.mjs';

// Deterministic synthetic fixtures test causality and math, never market returns.
let seed=99,close=100;const bars=[];
for(let i=0;i<850;i++){
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 const sigma=(Math.floor(i/55)%3===0?.04:.009);close*=Math.exp((seed/2**32-.5)*sigma);
 bars.push({date:new Date(Date.UTC(2020,0,1)+i*86400000).toISOString().slice(0,10),close});
}
const changed=bars.map((b,i)=>i>680?{...b,close:b.close*(5+i/200)}:b);
const f=riskFeatures(bars),g=riskFeatures(changed);
assert.equal(f.rows[0].t,271);assert.deepEqual(f.rows.filter(r=>r.t<=680),g.rows.filter(r=>r.t<=680));
const a=riskLedger(bars),b=riskLedger(changed);
for(let i=0;i<a.records.length;i++){
 const x=a.records[i],y=b.records[i];assert(x.lastTrainingLabelEnd<=x.date);assert(x.lastTrainingOrigin<x.date);assert(x.targetEndDate>x.date);
 assert.equal(x.actual,+(x.futureVol>x.threshold));
 if(x.t<=680){assert.deepEqual(x.probabilities,y.probabilities);assert.equal(x.threshold,y.threshold);assert.equal(x.currentHigh,y.currentHigh);}
 if(x.t+x.horizonBars<=680)assert.equal(x.actual,y.actual);
}
for(const x of a.fits)if(x.date<=bars[680].date)assert.deepEqual(x,b.fits.find(y=>y.date===x.date&&y.horizonBars===x.horizonBars));
const summary=summarizeRisk(a.records,{bootstrapReps:49});
for(const s of summary){
 assert.equal(s.all.n,s.calm.n+s.high.n);assert.equal(s.all.events,s.calm.events+s.high.events);
 assert.equal(s.allOffsets.reduce((n,x)=>n+x.all.n,0),s.all.n);
 const rows=a.records.filter(r=>r.horizonBars===s.horizonBars),calm=rows.filter(r=>!r.currentHigh);
 const delta=rows.reduce((sum,r)=>sum+(!r.currentHigh?((r.probabilities.full-r.actual)**2-(r.probabilities.level-r.actual)**2):0),0)/rows.length;
 assert(Math.abs(delta-s.tests.calm.meanLossDifference)<1e-14);assert.equal(s.tests.calm.n,rows.length);assert.equal(s.tests.calm.selectedN,calm.length);
 if(calm.length)assert(Math.abs(delta-(s.calm.models.full.brier-s.calm.models.level.brier)*calm.length/rows.length)<1e-14);
}
// Training-only constant-class fallback and intercept oracle.
const constant=fitProbability(Array.from({length:252},()=>({x:[0],y:0})));
assert.equal(constant.fallback,'single-training-class');assert.equal(probability(constant,[999]),.5/253);
const mixed=fitProbability(Array.from({length:300},(_,i)=>({x:[0],y:+(i%3!==0)})));
assert(Math.abs(probability(mixed,[0])-2/3)<1e-10);
const flat=riskLedger(bars.map(r=>({...r,close:100})));assert(flat.records.every(r=>r.actual===0&&r.probabilities.ewmaGaussian<1e-10));
assert.throws(()=>riskFeatures(bars.map((r,i)=>i===500?{...r,close:-1}:r)),/Invalid risk input/);
assert.throws(()=>riskFeatures([...bars.slice(0,400),bars[399],...bars.slice(400)]),/chronology/);
// Exact exponential chi-square(2) survival and monotonic bounds.
for(const x of [.01,1,5,20,100])assert(Math.abs(chiSquareSurvival(x,2)-Math.exp(-x/2))<1e-12);
for(const df of CONFIG.horizons){let prev=1;for(const x of [.01,.1,1,5,10,20,40,100]){const p=chiSquareSurvival(x,df);assert(p<=prev&&p>=0&&p<=1);prev=p;}}
console.log('PASS risk-event math, threshold/label/fitting causality, full forecast future-invariance, single-class fallback, native-axis calm inference and probability bounds; SYNTHETIC checks only.');
