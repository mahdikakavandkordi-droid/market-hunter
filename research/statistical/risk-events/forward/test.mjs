import assert from 'node:assert/strict';
import {hash} from '../../v3/data.mjs';
import {riskLedger} from '../engine.mjs';
import {forecastAt,advance,verifyState} from './engine.mjs';
// Synthetic prices/time are code fixtures ONLY; never historical performance.
let price=100;const bars=Array.from({length:700},(_,t)=>{price*=Math.exp(.013*Math.sin(t*.131)+.002*Math.cos(t*.41));const date=new Date(Date.UTC(2000,0,1+t)).toISOString().slice(0,10);return {date,close:price,availableAt:date+'T20:30:00Z'};});
const recorded=riskLedger(bars).records.filter(r=>r.horizonBars===10);
for(const row of recorded.filter((_,i)=>i%21===0)){
 const f=forecastAt(bars,row.t);assert.deepEqual(f.probabilities,{full:row.probabilities.full,level:row.probabilities.level});assert.equal(f.threshold,row.threshold);assert.ok(f.lastTrainingLabelEnd<=f.date);
}
const seed=bars.slice(0,650),genesis={startOrigin:bars[650].date,seedBars:{sp500:structuredClone(seed)},sourceHashes:{fixture:'synthetic'}};
const make=()=>({schema:'risk-forward-v1',genesis,genesisHash:hash(JSON.stringify(genesis)),events:[],markets:{sp500:{bars:structuredClone(seed)}}});
const s=make();
advance(s,'sp500',bars.slice(0,651),{recordedAt:bars[650].date+'T21:00:00Z',rawSha256:'fixture'});
assert.equal(s.events.filter(e=>e.kind==='forecast').length,1);assert.equal(s.events.filter(e=>e.kind==='outcome').length,0);
const first=JSON.stringify(s.events.find(e=>e.kind==='forecast'));
advance(s,'sp500',bars.slice(0,651),{recordedAt:bars[650].date+'T22:00:00Z',rawSha256:'fixture'});assert.equal(s.events.length,2);
const scale=make();advance(scale,'sp500',bars.slice(0,651).map(b=>({...b,close:b.close*.5})),{recordedAt:bars[650].date+'T21:00:00Z',rawSha256:'rescaled'});
assert.equal(s.markets.sp500.bars.at(-1).close,scale.markets.sp500.bars.at(-1).close);
advance(s,'sp500',bars.slice(0,661),{recordedAt:bars[660].date+'T21:00:00Z',rawSha256:'future'});
assert.equal(s.events.filter(e=>e.kind==='outcome').length,1);assert.equal(first,JSON.stringify(s.events.find(e=>e.kind==='forecast')));
assert.equal(s.events.filter(e=>e.kind==='missed').length,9);verifyState(s);
const broken=structuredClone(s);broken.events[0].bars[0].close+=1;assert.throws(()=>verifyState(broken),/chain/);
const late=make();advance(late,'sp500',bars.slice(0,651),{recordedAt:bars[651].date+'T12:00:00Z',rawSha256:'late'});assert.equal(late.events.filter(e=>e.kind==='forecast').length,0);
assert.throws(()=>advance(make(),'sp500',bars.slice(0,651),{recordedAt:bars[650].date+'T19:00:00Z',rawSha256:'partial'}),/Incomplete/);
console.log('PASS: causal legacy parity; no pre-maturity outcomes; duplicate idempotency; adjustment-rescale bridge; immutable forecasts; catchup without backfill; hash tamper; late/partial rejection');
