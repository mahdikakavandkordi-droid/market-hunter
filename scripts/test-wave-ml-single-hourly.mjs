import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSingleHourly} from '../lib/wave-ml/single-hourly.mjs';
import {buildSchedule} from '../lib/wave-ml/calendar.mjs';
import {buildFeatures,digest} from '../lib/wave-ml/features.mjs';
const H=3600000,D=24*H,T=Date.parse('2024-10-08T00:00Z');
const calendar=JSON.parse(fs.readFileSync(new URL('../data/research/wave-ml-v1/official-calendar.json',import.meta.url)));
const contract=JSON.parse(fs.readFileSync(new URL('../data/research/wave-ml-v1/contract.json',import.meta.url)));
const hour=(t,i=0)=>({t,o:100+i*.01,h:102+i*.01,l:99+i*.01,c:101+i*.01,v:10});
const crypto=(n=24)=>Array.from({length:n},(_,i)=>hour(T+i*H,i));
const build=(hourly,asOf=T+D,extra={})=>buildSingleHourly({symbol:'TEST',market:'crypto',hourly,calendar,startDate:'2024-10-08',asOf,...extra});
test('daily and six 4H candles use the exact same 24 hourly sources',()=>{const r=build(crypto());assert.equal(r.daily.length,1);assert.equal(r.executionBars.length,6);assert.equal(r.daily[0].o,r.executionBars[0].o);assert.equal(r.daily[0].c,r.executionBars.at(-1).c);assert.equal(r.daily[0].h,Math.max(...r.executionBars.map(x=>x.h)));assert.equal(r.daily[0].v,240);});
test('one missing hour excludes daily but preserves earlier causal 4H bars',()=>{const rs=crypto().filter((_,i)=>i!==23),r=build(rs);assert.equal(r.daily.length,0);assert.equal(r.executionBars.length,5);assert.equal(r.quality.incompleteDays.length,1);});
test('genuinely missing daily path resets feature warmup on next complete day',()=>{const r=build(crypto(72).filter((_,i)=>i!==30),T+3*D);assert.equal(r.daily.length,2);assert.deepEqual(r.dailyGapBeforeTimes,[T+2*D]);});
test('invalid OHLC quarantines hour and full daily candle',()=>{const rs=crypto();rs[4].h=1;const r=build(rs);assert.equal(r.daily.length,0);assert.equal(r.quality.invalidTimes.length,1);});
test('duplicate timestamps reject and off-grid crypto rows never fill a missing hour',()=>{assert.throws(()=>build([...crypto(),hour(T)]),/duplicate/);const rs=crypto().filter((_,i)=>i!==2);rs.push(hour(T+2.5*H));const r=build(rs);assert.equal(r.daily.length,0);assert.equal(r.quality.offScheduleTimes.length,1);});
test('unknown volume remains null rather than a fabricated sum',()=>{const rs=crypto();rs[3].v=null;const r=build(rs);assert.equal(r.daily[0].v,null);assert.equal(r.executionBars[0].v,null);});
test('approved early close has four sources; next session has seven without a holiday gap',()=>{const startDate='2024-12-24',end=Date.parse('2024-12-27T00:00Z'),slots=buildSchedule('us',calendar).slots.filter(s=>s.date>=startDate&&s.date<'2024-12-27'),hours=slots.flatMap(s=>Array.from({length:s.sourceCount},(_,i)=>hour(s.t+i*H)));
 const r=buildSingleHourly({symbol:'AAPL',market:'us',hourly:hours,calendar,startDate,asOf:end});assert.deepEqual(r.daily.map(d=>d.sourceCount),[4,7]);assert.equal(r.executionBars.length,3);assert.equal(r.dailyGapBeforeTimes.length,0);assert.equal(r.daily[0].endT,Date.parse('2024-12-24T22:00Z'));
});
test('incomplete/live source candles cannot enter daily or 4H output',()=>{const r=build(crypto(),T+23.5*H);assert.equal(r.daily.length,0);assert.equal(r.executionBars.length,5);});
test('split event resets daily state without inventing prices',()=>{const r=build(crypto(72),T+3*D,{splits:[{date:'2024-10-09'}]});assert.deepEqual(r.dailyGapBeforeTimes,[T+D]);});
test('end-to-end prefixes and future price perturbation preserve past features',()=>{
 const hours=crypto(270*24),all=build(hours,T+270*D+300000),rows=buildFeatures(all,contract);
 for(const n of [250,255,265]){const at=T+n*D+300000,part=build(hours,at);assert.equal(digest(part.daily),digest(all.daily.filter(b=>b.endT<=at)));assert.equal(digest(buildFeatures(part,contract)),digest(rows.filter(r=>Date.parse(r.availableAt)<=at)));}
 const at=T+255*D+300000,modified=hours.map(r=>r.t>at?{...r,o:1e6,h:2e6,l:1e5,c:1e6}:r);assert.equal(digest(buildFeatures(build(modified,at),contract)),digest(buildFeatures(build(hours,at),contract)));assert.ok(rows.length>0);
});
