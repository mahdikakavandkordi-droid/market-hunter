import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runInNewContext} from 'node:vm';

const ctx={globalThis:null,Intl,Date,Number,String,Boolean,Math};
ctx.globalThis=ctx;
runInNewContext(fs.readFileSync('quote-policy.js','utf8'),ctx);
const {selectQuote}=ctx.MarketHunterQuotePolicy;

const sec=s=>Date.parse(s)/1000;
const completed=(price=46.90,date='2026-10-02',currency='CAD')=>({
  symbol:'AAPL.TO',price,dayChangePct:2.5,currency,asOf:date
});
const snapshot=(overrides={})=>({
  capturedAt:'2026-10-02T19:58:00Z',
  currentState:{marketOpen:true,snapshotFresh:true,sessionDate:'2026-10-02'},
  quotes:{
    'AAPL.TO':{
      symbol:'AAPL.TO',price:46.83,changePct:2.1,currency:'CAD',
      quoteAt:'2026-10-02T19:58:00Z',sessionDate:'2026-10-02',stale:false,
      sessionStart:sec('2026-10-02T13:30:00Z'),sessionEnd:sec('2026-10-02T20:00:00Z')
    }
  },
  ...overrides
});

let q=selectQuote({symbol:'AAPL.TO',intradaySnapshot:snapshot(),completed:completed(),now:new Date('2026-10-02T19:59:00Z')});
assert.equal(q.source,'intraday');assert.equal(q.price,46.83);assert.equal(q.changePct,2.1);

q=selectQuote({symbol:'AAPL.TO',intradaySnapshot:snapshot({currentState:{marketOpen:false,snapshotFresh:true,sessionDate:'2026-10-02'}}),completed:completed(),now:new Date('2026-10-02T20:10:00Z')});
assert.equal(q.source,'completed');assert.equal(q.price,46.90);assert.equal(q.changePct,2.5);

q=selectQuote({symbol:'AAPL.TO',intradaySnapshot:snapshot({currentState:{marketOpen:false,snapshotFresh:false,sessionDate:'2026-10-03'}}),completed:completed(47.1,'2026-10-03'),now:new Date('2026-10-04T15:00:00Z')});
assert.equal(q.source,'completed');assert.equal(q.sessionDate,'2026-10-03');

q=selectQuote({symbol:'AAPL.TO',intradaySnapshot:snapshot({currentState:{marketOpen:false,snapshotFresh:false,sessionDate:'2026-10-04'}}),completed:completed(),now:new Date('2026-10-04T15:00:00Z')});
assert.equal(q.source,'completed','Friday close must remain canonical on weekend');

q=selectQuote({symbol:'AAPL.TO',intradaySnapshot:snapshot({quotes:{'AAPL.TO':{symbol:'WRONG.TO',price:99,quoteAt:'2026-10-02T19:58:00Z',sessionDate:'2026-10-02',currency:'CAD'}}}),completed:completed(),now:new Date('2026-10-02T19:59:00Z')});
assert.equal(q.source,'completed');

q=selectQuote({symbol:'AAPL.TO',intradaySnapshot:snapshot({quotes:{'AAPL.TO':{symbol:'AAPL.TO',price:NaN,quoteAt:'bad',sessionDate:'2026-10-02',currency:'CAD'}}}),completed:completed(),now:new Date('2026-10-02T19:59:00Z')});
assert.equal(q.source,'completed');

q=selectQuote({symbol:'AAPL.TO',intradaySnapshot:snapshot(),completed:completed(46.9,'2026-10-02','USD'),now:new Date('2026-10-02T19:59:00Z')});
assert.equal(q.source,'completed');assert.equal(q.warning,'currency_mismatch');assert.equal(q.currency,'USD');

q=selectQuote({symbol:'AAPL.TO',intradaySnapshot:snapshot({currentState:{marketOpen:false,snapshotFresh:false,sessionDate:'2026-10-03'}}),completed:null,now:new Date('2026-10-03T15:00:00Z')});
assert.equal(q.source,'intraday');assert.equal(q.state,'stale');assert.equal(q.fresh,false);

q=selectQuote({symbol:'AAPL.TO',intradaySnapshot:null,completed:completed(),now:new Date('2026-10-04T15:00:00Z')});
assert.equal(q.source,'completed');

q=selectQuote({symbol:'AAPL.TO',intradaySnapshot:snapshot({currentState:{marketOpen:false,snapshotFresh:false,sessionDate:'2026-10-03'}}),completed:completed(45,'2026-10-01'),now:new Date('2026-10-03T15:00:00Z')});
assert.equal(q.source,'intraday');assert.match(q.label,/stale/);

console.log('PASS: explicit quote policy covers live, close, weekend, invalid data, currency mismatch and stale-only cases');
