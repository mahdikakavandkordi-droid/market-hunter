import assert from 'node:assert/strict';
import {INDEX_QUOTES,regularWindow,normalizeQuote,benchmarkOpen,torontoClock} from '../lib/intraday.js';
const d=s=>new Date(s),secs=s=>Date.parse(s)/1000;
assert.equal(regularWindow(d('2026-09-28T13:47:00Z')),true);
assert.equal(regularWindow(d('2026-01-05T13:47:00Z')),false);
assert.equal(regularWindow(d('2026-01-05T14:47:00Z')),true);
assert.equal(regularWindow(d('2026-09-28T20:00:00Z')),false);
assert.equal(regularWindow(d('2026-09-27T15:47:00Z')),false);
assert.equal(torontoClock(d('2026-09-29T01:00:00Z')).date,'2026-09-28');
assert.ok(INDEX_QUOTES.some(([symbol,name])=>symbol==='^NDX'&&name==='Nasdaq-100'));
assert.equal(INDEX_QUOTES.some(([symbol])=>symbol==='^IXIC'),false,'Nasdaq Composite must not be substituted for the Nasdaq-100 presentation feed');
const now=d('2026-09-28T15:47:00Z');
const meta={regularMarketPrice:101,chartPreviousClose:100,regularMarketTime:secs('2026-09-28T15:32:00Z'),regularMarketVolume:12345,currency:'CAD',currentTradingPeriod:{regular:{start:secs('2026-09-28T13:30:00Z'),end:secs('2026-09-28T20:00:00Z')}}};
const q=normalizeQuote({meta},'^GSPTSE','TSX',now);
assert.ok(Math.abs(q.changePct-1)<1e-8);assert.equal(q.volume,12345);assert.equal(benchmarkOpen(q,now),true);
assert.equal(benchmarkOpen({...q,sessionDate:'2026-09-25'},now),false);
assert.equal(benchmarkOpen({...q,stale:true},now),false);
assert.equal(benchmarkOpen({...q,sessionEnd:secs('2026-09-28T15:00:00Z')},now),false);
assert.equal(normalizeQuote({meta:{...meta,chartPreviousClose:0}},'X','X',now).changePct,null);
assert.throws(()=>normalizeQuote({meta:{...meta,regularMarketPrice:NaN}},'X','X',now),/invalid_quote/);
assert.equal(normalizeQuote({meta:{...meta,regularMarketTime:secs('2026-09-25T20:00:00Z')}},'X','X',now).stale,true);
const {default:handler,decorateIntradaySnapshot}=await import('../api/intraday.js');
const oldSnapshot={version:'intraday-v1',capturedAt:'2026-10-02T19:58:00Z',sessionDate:'2026-10-02',marketOpen:true,provisional:true,quotes:{'^GSPTSE':{symbol:'^GSPTSE',price:100,quoteAt:'2026-10-02T19:58:00Z',sessionDate:'2026-10-02',stale:false,sessionStart:secs('2026-10-02T13:30:00Z'),sessionEnd:secs('2026-10-02T20:00:00Z')}}};
const weekendView=decorateIntradaySnapshot(oldSnapshot,d('2026-10-04T15:00:00Z'));
assert.equal(weekendView.marketOpen,true,'legacy capture-time field remains backward compatible');
assert.equal(weekendView.marketOpenAtCapture,true);
assert.equal(weekendView.currentState.marketOpen,false);
assert.equal(weekendView.currentState.snapshotFresh,false);
assert.equal(weekendView.currentState.status,'stale_snapshot');
const old=globalThis.fetch;let status,body;
const response={setHeader(){},status(n){status=n;return this;},json(x){body=x;}};
try{
 globalThis.fetch=async()=>({ok:true,json:async()=>({version:'intraday-v1',quotes:{},capturedAt:now.toISOString()})});
 await handler({},response);assert.equal(status,200);
 globalThis.fetch=async()=>({ok:false});await handler({},response);assert.equal(status,503);assert.equal(body.error,'intraday_unavailable');
}finally{globalThis.fetch=old;}
console.log('PASS: DST, weekends, holiday/stale session, early close, quote units and endpoint errors');
const {runInNewContext}=await import('node:vm');
const fs=await import('node:fs');
const panel={innerHTML:'',textContent:'',insertAdjacentHTML(){}};
runInNewContext(fs.readFileSync('intraday.js','utf8'),{
 document:{hidden:false,querySelector:s=>s==='#intradayPanel'?panel:{addEventListener(){}},addEventListener(){}},
 localStorage:{getItem:()=>null},setInterval(){},setTimeout,Date,Number,String,Set,
 fetch:async()=>({ok:true,json:async()=>({capturedAt:now.toISOString(),marketOpen:false,received:1,intended:1,commentary:'<unsafe>',quoteDelayNotice:'Delayed',quotes:{'^GSPTSE':q}})})
});
await new Promise(r=>setTimeout(r,10));
assert.ok(panel.innerHTML.includes('Last available session snapshot'));
assert.ok(panel.innerHTML.includes('&lt;unsafe&gt;'));
assert.ok(panel.innerHTML.includes('Not covered in this snapshot'));
console.log('PASS: dashboard panel closed-state, missing quotes and escaped content');
