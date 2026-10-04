import assert from 'node:assert/strict';
import {assessFreshness,expectedCompletedSession,mergeAssetRefresh,torontoDateFromSeconds} from '../lib/market-freshness.js';

const sec=s=>Date.parse(s)/1000;
const row=s=>({t:sec(s),close:100,high:101,low:99});

const fridayEquity=[row('2026-10-02T13:30:00Z')];
const fridayMeta={currentTradingPeriod:{regular:{start:sec('2026-10-02T13:30:00Z'),end:sec('2026-10-02T20:00:00Z')}}};
let f=assessFreshness({kind:'equity',nowMs:Date.parse('2026-10-04T15:00:00Z'),meta:fridayMeta,rawRows:fridayEquity,completedRows:fridayEquity});
assert.equal(f.expectedCompletedSession,'2026-10-02');
assert.equal(f.status,'fresh','Friday equity close remains valid on weekend');

const earlyMeta={currentTradingPeriod:{regular:{start:sec('2026-11-27T14:30:00Z'),end:sec('2026-11-27T18:00:00Z')}}};
assert.equal(expectedCompletedSession({kind:'equity',nowMs:Date.parse('2026-11-27T18:10:00Z'),meta:earlyMeta,completedRows:[row('2026-11-27T14:30:00Z')]}),'2026-11-27','early close must use provider session end');

assert.equal(torontoDateFromSeconds(sec('2026-07-02T13:30:00Z')),'2026-07-02');
assert.equal(torontoDateFromSeconds(sec('2026-12-02T14:30:00Z')),'2026-12-02','DST must not be hardcoded');

let crypto=assessFreshness({kind:'crypto',nowMs:Date.parse('2026-10-04T00:15:00Z'),completedRows:[row('2026-10-03T00:00:00Z')],rawRows:[row('2026-10-03T00:00:00Z'),row('2026-10-04T00:00:00Z')]});
assert.equal(crypto.expectedCompletedSession,'2026-10-03');
assert.equal(crypto.status,'fresh');
assert.equal(crypto.partialBarExcluded,true);

crypto=assessFreshness({kind:'crypto',nowMs:Date.parse('2026-10-04T00:15:00Z'),completedRows:[row('2026-10-02T00:00:00Z')],rawRows:[row('2026-10-02T00:00:00Z'),row('2026-10-04T00:00:00Z')]});
assert.equal(crypto.status,'stale','crypto must advance completed daily analysis on weekends');

const metalsMeta={currentTradingPeriod:{regular:{start:sec('2026-10-02T04:00:00Z'),end:sec('2026-10-03T03:59:00Z')}}};
let metals=assessFreshness({kind:'metals',nowMs:Date.parse('2026-10-02T20:30:00Z'),meta:metalsMeta,rawRows:[row('2026-10-01T04:00:00Z'),row('2026-10-02T04:00:00Z')],completedRows:[row('2026-10-01T04:00:00Z')]});
assert.equal(metals.expectedCompletedSession,'2026-10-01');
assert.equal(metals.status,'fresh','active metals bar must not be treated as completed');

metals=assessFreshness({kind:'metals',nowMs:Date.parse('2026-10-03T04:10:00Z'),meta:metalsMeta,rawRows:[row('2026-10-01T04:00:00Z'),row('2026-10-02T04:00:00Z')],completedRows:[row('2026-10-02T04:00:00Z')]});
assert.equal(metals.expectedCompletedSession,'2026-10-02');
assert.equal(metals.status,'fresh');

const delayed=assessFreshness({kind:'equity',nowMs:Date.parse('2026-10-02T20:10:00Z'),meta:fridayMeta,rawRows:[row('2026-10-01T13:30:00Z')],completedRows:[row('2026-10-01T13:30:00Z')]});
assert.equal(delayed.expectedCompletedSession,'2026-10-02');
assert.equal(delayed.status,'stale','delayed provider must be explicit');

const existing=[{key:'BTC',asOf:'2026-10-03',price:100,freshness:{status:'fresh'}},{key:'TSX',asOf:'2026-10-02',price:200}];
let merged=mergeAssetRefresh(existing,[],[{key:'BTC',reason:'HTTP 503'}],['BTC'],'2026-10-04T00:15:00Z');
assert.equal(merged.find(x=>x.key==='BTC').price,100);
assert.equal(merged.find(x=>x.key==='BTC').freshness.status,'provider_failure');
assert.equal(merged.find(x=>x.key==='TSX').price,200,'targeted crypto refresh must not alter equity state');

merged=mergeAssetRefresh(existing,[{key:'BTC',asOf:'2026-10-02',price:90}],[],['BTC'],'2026-10-04T00:15:00Z');
assert.equal(merged.find(x=>x.key==='BTC').price,100,'older provider session must not replace newer valid report');

console.log('PASS: asset calendars, DST/early-close fixtures, partial bars and failure-safe merges');
