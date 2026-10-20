import assert from 'node:assert/strict';
import {recoverUSSessionSummary} from '../lib/us-session-summary.js';
const sec=s=>Date.parse(s)/1000;
const end=sec('2026-10-19T20:00:00Z'),now=(end+1800)*1000;
const payload={meta:{symbol:'TEST',currency:'USD',instrumentType:'EQUITY',dataGranularity:'1d',regularMarketTime:end,
  regularMarketPrice:102,regularMarketDayHigh:104,regularMarketDayLow:99,regularMarketVolume:2000000,
  currentTradingPeriod:{regular:{start:sec('2026-10-19T13:30:00Z'),end}}},
  timestamp:[sec('2026-10-16T13:30:00Z'),sec('2026-10-19T13:30:00Z')],
  indicators:{quote:[{close:[100,null],high:[101,103],low:[99,100],volume:[1000000,1800000]}],adjclose:[{adjclose:[100,null]}]}};
const before=JSON.stringify(payload),r=recoverUSSessionSummary(payload,'TEST',now);
assert.equal(r.row.close,102);assert.equal(r.row.high,104);assert.equal(r.row.low,99);assert.equal(r.row.volume,2000000);
assert.equal(r.evidence.method,'yahoo-completed-session-summary-v1');
assert.equal(JSON.stringify(payload),before,'provider payload and all historical arrays remain unchanged');
assert.equal(recoverUSSessionSummary(payload,'OTHER',now),null);
assert.equal(recoverUSSessionSummary(payload,'TEST',(end+899)*1000),null,'never use a live/just-closing session');
for(const mutate of [
  p=>p.meta.currency='CAD',p=>p.meta.instrumentType='ETF',p=>p.meta.dataGranularity='1m',
  p=>p.meta.regularMarketTime=end-61,p=>p.meta.regularMarketTime=end+61,
  p=>p.meta.currentTradingPeriod.regular.end=end+86400,
  p=>p.meta.regularMarketPrice=105,p=>p.meta.regularMarketDayLow=106,
  p=>p.meta.regularMarketVolume=0,p=>delete p.meta.regularMarketDayHigh,
  p=>p.indicators.quote[0].close[1]=101,p=>p.indicators.adjclose[0].adjclose[1]=101,
  p=>p.indicators.adjclose[0].adjclose[0]=99,p=>p.indicators.quote[0].close[0]=null,
  p=>p.events={dividends:{d:{date:sec('2026-10-19T13:30:00Z')}}},
  p=>p.events={splits:{s:{date:sec('2026-10-19T13:30:00Z')}}},
  p=>p.events={dividends:{d:{date:'invalid'}}}
]){const p=structuredClone(payload);mutate(p);assert.equal(recoverUSSessionSummary(p,'TEST',now),null)}
console.log('PASS: completed-session summary recovery rejects live, mixed identity/date, incoherent OHLCV and unverified adjustment bases without mutation');
