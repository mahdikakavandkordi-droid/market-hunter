import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveSymbol,normalizeChart,loadSymbolAnalysis} from '../lib/elliott/symbol-analysis.mjs';
import {createElliottHandler} from '../api/elliott.js';
import {chartSVG,renderAnalysis} from '../elliott.js';
import {cryptoFixture,chartFrom,fakeFetcher,stockRows} from '../tests/fixtures/elliott-symbol.mjs';
const DAY=86400000;
const rows=cryptoFixture(),now=rows.at(-1).endT+3600000;
const crypto=chartFrom(rows);
const loadCrypto=(chart=crypto,nowMs=now)=>loadSymbolAnalysis('BTC','crypto',{fetcher:fakeFetcher({'BTC-USD':chart}),nowMs});
function response() {return {code:null,headers:{},body:null,setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(x){this.body=x;return this}}}

test('symbol resolution is explicit and cannot inject a URL or foreign market',()=>{
  assert.equal(resolveSymbol(' ry ','ca').symbol,'RY.TO');
  assert.equal(resolveSymbol('btc','crypto').symbol,'BTC-USD');
  assert.throws(()=>resolveSymbol('https://private/','us'),/invalid_symbol/);
  assert.throws(()=>resolveSymbol('RY.TO','us'),/mismatch/);
  assert.throws(()=>resolveSymbol('BTC-USD','ca'),/mismatch/);
  assert.throws(()=>resolveSymbol('AAPL','other'),/invalid_market/);
});

test('requested crypto symbol returns shared-core count, levels and freshness',async()=>{
  const d=await loadCrypto();assert.equal(d.symbol,'BTC-USD');assert.equal(d.quality.usable,true);
  assert.equal(d.analysis.signals.length,1);assert.equal(d.timeframe,'1D');
  assert.equal(d.quality.knownGaps,0);assert.ok(d.indicators.atr14>0);
  assert.equal(d.dataAsOf,new Date(rows.at(-1).endT).toISOString());
});

test('live crypto candle is excluded independently of provider trading metadata',async()=>{
  const next={...rows.at(-1),t:rows.at(-1).endT,endT:rows.at(-1).endT+DAY,c:999,h:1000,o:999,l:998};
  const d=await loadCrypto(chartFrom([...rows,next]));assert.equal(d.bars.length,rows.length);
  assert.equal(d.quality.usable,true);
});

test('stock open session excluded, with DST-aware historical completion',()=>{
  const bars=[{t:Date.UTC(2026,9,6,13,30),o:100,h:101,l:99,c:100,v:1000},{t:Date.UTC(2026,9,7,13,30),o:100,h:101,l:99,c:100,v:1000}];
  const chart=chartFrom(bars,{symbol:'AAPL',mode:'stock',meta:{currentTradingPeriod:{regular:{start:bars[1].t/1000,end:Date.UTC(2026,9,7,20)/1000}}}});
  const before=normalizeChart(chart,{mode:'stock',asOf:Date.UTC(2026,9,7,19)});
  assert.equal(before.rows.length,1);assert.equal(before.rows[0].endT,Date.UTC(2026,9,6,21));
  assert.equal(normalizeChart(chart,{mode:'stock',asOf:Date.UTC(2026,9,7,20,5)}).rows.length,2);
  const winter=chartFrom([{...bars[0],t:Date.UTC(2026,0,7,14,30)}],{symbol:'AAPL',mode:'stock'});
  assert.equal(normalizeChart(winter,{mode:'stock',asOf:Date.UTC(2026,0,8)}).rows[0].endT,Date.UTC(2026,0,7,22));
});

test('Canadian reference sessions preserve weekends and reveal a missing day',async()=>{
  const all=stockRows(),own=all.filter((_,i)=>i!==20),nowMs=all.at(-1).t+2*DAY;
  const d=await loadSymbolAnalysis('RY','ca',{nowMs,fetcher:fakeFetcher({
    'RY.TO':chartFrom(own,{symbol:'RY.TO',mode:'stock'}),'XIU.TO':chartFrom(all,{symbol:'XIU.TO',mode:'stock'})})});
  assert.equal(d.quality.usable,true);assert.equal(d.quality.knownGaps,1);assert.equal(d.analysis.coverage.knownGaps,1);
  assert.equal(d.quality.reference,'XIU.TO');
  const full=await loadSymbolAnalysis('RY','ca',{nowMs,fetcher:fakeFetcher({
    'RY.TO':chartFrom(all,{symbol:'RY.TO',mode:'stock'}),'XIU.TO':chartFrom(all,{symbol:'XIU.TO',mode:'stock'})})});
  assert.equal(full.quality.knownGaps,0);
});

test('missing continuous crypto day resets count rather than bridging it',async()=>{
  const d=await loadCrypto(chartFrom(rows.filter((_,i)=>i!==53)));
  assert.equal(d.quality.knownGaps,1);assert.equal(d.analysis.signals.length,0);
});

test('stale quotes, malformed source rows and splits suppress current analysis',async()=>{
  const stale=await loadCrypto(crypto,now+2*DAY);assert.equal(stale.quality.status,'stale_data');assert.equal(stale.analysis,null);
  const bad=structuredClone(crypto);bad.indicators.quote[0].close[30]=null;
  const malformed=await loadCrypto(bad);assert.equal(malformed.quality.usable,false);assert.equal(malformed.analysis,null);
  const split=structuredClone(crypto);split.events={splits:{event:{date:rows[20].t/1000}}};
  const changed=await loadCrypto(split);assert.equal(changed.quality.status,'split_event_requires_review');assert.equal(changed.analysis,null);
});

test('completed provider session missing from the reference cannot be called fresh',async()=>{
  const all=stockRows(),last=all.at(-1),meta={currentTradingPeriod:{regular:{start:last.t/1000,end:(last.t+6.5*3600000)/1000}}};
  await assert.rejects(()=>loadSymbolAnalysis('AAPL','us',{nowMs:last.t+8*3600000,fetcher:fakeFetcher({
    AAPL:chartFrom(all.slice(0,-1),{symbol:'AAPL',mode:'stock',meta}),SPY:chartFrom(all.slice(0,-1),{symbol:'SPY',mode:'stock',meta})})}),/reference_calendar_unavailable/);
});

test('reference failure or mismatched provider instrument never gives a count',async()=>{
  await assert.rejects(()=>loadSymbolAnalysis('AAPL','us',{fetcher:fakeFetcher({AAPL:chartFrom(stockRows(),{symbol:'AAPL',mode:'stock'})})}),/provider_unavailable/);
  const wrong=structuredClone(crypto);wrong.meta.symbol='ETH-USD';await assert.rejects(()=>loadCrypto(wrong),/symbol_mismatch/);
  const foreign=chartFrom(stockRows(),{symbol:'AAPL',mode:'stock',meta:{exchangeTimezoneName:'Asia/Tokyo'}});
  await assert.rejects(()=>loadSymbolAnalysis('AAPL','us',{fetcher:fakeFetcher({AAPL:foreign,SPY:chartFrom(stockRows(),{symbol:'SPY',mode:'stock'})})}),/market_mismatch/);
});

test('API validates GET, returns usable data and contains errors without stack details',async()=>{
  const handler=createElliottHandler({loader:(s,m)=>loadSymbolAnalysis(s,m,{fetcher:fakeFetcher({'BTC-USD':crypto}),nowMs:now})});
  let res=response();await handler({method:'GET',query:{symbol:'BTC',market:'crypto'}},res);assert.equal(res.code,200);assert.equal(res.body.analysis.signals.length,1);
  res=response();await handler({method:'POST',query:{}},res);assert.equal(res.code,405);assert.equal(res.headers.Allow,'GET');
  res=response();await handler({method:'GET',query:{symbol:'../secret',market:'us'}},res);assert.equal(res.code,400);
  res=response();await handler({method:'GET',query:{symbol:'ETH',market:'crypto'}},res);assert.equal(res.code,503);assert.deepEqual(res.body,{error:'analysis_source_unavailable'});
  assert.equal(res.headers['Cache-Control'],'no-store');
});

test('chart renders candles, wave labels and levels; provider text is escaped',async()=>{
  const d=await loadCrypto();d.name='<img src=x onerror=alert(1)>';
  const out=renderAnalysis(d,{lang:'fa'});
  assert.match(out.html,/&lt;img/);assert.doesNotMatch(out.html,/<img/);
  assert.match(out.html,/wave-line/);assert.match(out.html,/حد ضرر فرضی/);assert.match(out.html,/تأیید متعلق به گذشته/);
  assert.match(out.html,/RSI\(14\)/);assert.ok(out.scenarios.length);
  const svg=chartSVG(d.bars,out.scenarios[0],{signal:d.analysis.signals[0]});assert.match(svg,/>C<\/text>/);assert.doesNotMatch(svg,/NaN|Infinity/);
});

test('waiting-breakout levels come from the shared core and are explicitly provisional',async()=>{
  const pendingRows=rows.slice(0,62),nowMs=pendingRows.at(-1).endT+3600000;
  const d=await loadCrypto(chartFrom(pendingRows),nowMs);
  const c=d.analysis.current.find(c=>c.status==='waiting_breakout');
  assert.ok(c);assert.equal(c.preview.provisional,true);assert.ok(c.preview.stop<c.trigger);
  assert.ok(c.preview.target>c.trigger);assert.equal(d.analysis.signals.length,0);
  const rendered=renderAnalysis(d);
  assert.match(rendered.html,/Levels are provisional/);assert.match(rendered.html,/Hypothetical target/);
  assert.doesNotMatch(rendered.html,/historical confirmation, not an open position/);
});

test('no supported structure and unavailable data are distinct visible states',async()=>{
  const flat=rows.map(b=>({...b,o:100,h:101,l:99,c:100}));const d=await loadCrypto(chartFrom(flat));
  const out=renderAnalysis(d);assert.match(out.html,/No supported structure/);assert.equal(out.scenarios.length,0);
  const stale=await loadCrypto(crypto,now+DAY);assert.match(renderAnalysis(stale).html,/source is not usable/);
});

test('local and Vercel routes expose the feature without modifying scanner navigation',()=>{
  const server=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
  assert.match(server,/\/api\/elliott/);assert.match(server,/\['\/elliott\.html','elliott\.html'\]/);
  const config=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url)));
  assert.equal(config.functions['api/elliott.js'].maxDuration,20);
});
