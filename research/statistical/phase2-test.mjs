import assert from 'node:assert/strict';
import {volRows,volatilityBacktest,regimeRows,macroFeatures,macroBacktest} from './phase2.mjs';
// Synthetic prices are used ONLY to test causality and execution integrity.
let seed=81;
const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const date=i=>new Date(Date.UTC(2020,0,1)+i*86400000).toISOString().slice(0,10);
let price=100;
const bars=[];
for(let i=0;i<850;i++){price*=Math.exp((random()-.5)*.045+Math.sin(i/20)*.002);bars.push({date:date(i),close:price});}
const contexts={vix:bars,us10y:bars,dxy:bars,oil:bars,spx:bars};
const day=bars[600].date;
const macro=macroFeatures(day,contexts);
assert.equal(macro.length,8);
assert(macro.every(Number.isFinite));
// Strictly prior day constraint: injecting a 1000x shock on current/future bars
// cannot change observed macro features at the decision close.
const tampered=Object.fromEntries(Object.entries(contexts).map(([key,v])=>[
 key,v.map(q=>q.date>=day?{...q,close:q.close*1000}:q)]));
assert.deepEqual(macro,macroFeatures(day,tampered));
const vols=volRows(bars);
assert.equal(vols[0].t,60);
const futureBars=bars.map((v,i)=>i>600?{...v,close:v.close*4}:v);
assert.deepEqual(vols.find(v=>v.t===600),volRows(futureBars).find(v=>v.t===600));
const r=regimeRows(bars);
assert(r.length>=2);
assert(r.every(v=>v.count>0&&Number.isFinite(v.positiveRatePct)));
const evalVol=volatilityBacktest(bars);
assert.equal(evalVol.length,3);
for(const x of evalVol)for(const k of ['harMSE','persistenceMSE','historicalMeanMSE','skillVsPersistencePct','skillVsMeanPct']){
 assert(Number.isFinite(x[k]),k);
}
const evalMacro=macroBacktest(bars,contexts);
assert.equal(evalMacro.length,3);
assert(evalMacro.every(m=>Number.isFinite(m.macroBrierSkillVsPriorPct)));
assert(evalMacro.every(m=>m.n>100));
console.log('PASS: volatility HAR-style, strictly lagged macro joins, exploratory regimes, matched OOS macro comparisons');
