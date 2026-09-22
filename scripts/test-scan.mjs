import assert from 'node:assert/strict';
import handler,{metrics,validateData,dailyStructure} from '../api/scan.js';

const dates=[];
for(let t=Date.UTC(2025,0,1)/1000;dates.length<126;t+=86400){
  if(![0,6].includes(new Date(t*1000).getUTCDay())) dates.push(t);
}
const make=(prices=dates.map(()=>100))=>({currency:'CAD',rows:prices.map((close,i)=>({t:dates[i],close,rawClose:close,volume:100000}))});
const flat=make();
assert.equal(metrics(flat,flat,null).rsi14,50);
flat.rows.at(-21).volume=300000;
assert.equal(metrics(flat,flat,null).rvol,0.91);
const reference=dates.slice(-61).map(t=>new Date(t*1000).toISOString().slice(0,10));
assert.equal(validateData(flat,reference),null);
const missing=make();missing.rows.splice(-10,1);
assert.equal(validateData(missing,reference),'missing_sessions');
assert.equal(metrics(missing,flat,null).rs20,null);
const stale=make();stale.rows.pop();
assert.equal(validateData(stale,reference),'stale_data');
const zero=make();zero.rows.at(-1).volume=0;
assert.equal(validateData(zero,reference),'missing_or_zero_volume');
const missingVolume=make();missingVolume.rows.at(-3).volume=null;
assert.equal(validateData(missingVolume,reference),'missing_or_zero_volume');
const reboundPrices=dates.map(()=>100);
reboundPrices.splice(-11,11,99,98,97,96,95,94,95,96,97,98,99);
const rebound=make(reboundPrices);rebound.rows.at(-6).close=96;rebound.rows.at(-5).volume=300000;
const rm=metrics(rebound,make(),null);
assert.equal(rm.unusual5dDirection,'negative');
assert.equal(rm.stage,'Recovery','negative volume alone must not veto recovery');
for(let ago=0;ago<5;ago++){
 const d=make();d.rows.at(-1-ago).volume=300000;
 const m=metrics(d,make(),null);
 assert.equal(m.max5RvolAgo,ago);assert.equal(m.max5Rvol,3);
}
let status,payload;
await handler({query:{minDollar:'bad'}},{setHeader(){},status(n){status=n;return this},json(x){payload=x}});
assert.equal(status,400);assert.equal(payload.error,'invalid_liquidity');
console.log('PASS: RSI, 20-session RVOL, missing/stale/zero data, aligned RS, recovery after negative volume, all five spike ages, invalid liquidity');

// Daily structure is informational only: wick-through is not a close breakout,
// and a prior close breakout that falls back under the pivot is a failed break.
const structureRows=Array.from({length:15},(_,i)=>({t:dates[i],close:100,rawClose:100,high:104,low:96,volume:100000}));
structureRows[8]={...structureRows[8],high:110,low:95};
structureRows[9]={...structureRows[9],high:106,low:97};
structureRows[10]={...structureRows[10],high:105,low:98};
structureRows[14]={...structureRows[14],high:111,low:96,close:109,rawClose:109};
let ds=dailyStructure(structureRows);
assert.equal(ds.localHigh,110);
assert.equal(ds.localLow,95);
assert.equal(ds.highState,'failed_high_break','wick above a local high must not count as a close breakout');
assert.equal(ds.lowState,'local_low_held');
structureRows[14]={...structureRows[14],close:111,rawClose:111};
assert.equal(dailyStructure(structureRows).highState,'local_high_broken');
structureRows[13]={...structureRows[13],close:111,rawClose:111};
structureRows[14]={...structureRows[14],close:109,rawClose:109,high:109};
assert.equal(dailyStructure(structureRows).highState,'failed_high_break','re-entry below a prior close breakout must be marked failed');
structureRows[14]={...structureRows[14],low:94,close:96,rawClose:96};
assert.equal(dailyStructure(structureRows).lowState,'failed_low_break','wick below a local low that closes back above must be a failed break');
structureRows[14]={...structureRows[14],close:94,rawClose:94};
assert.equal(dailyStructure(structureRows).lowState,'local_low_broken');
console.log('PASS: daily local high/low, close-vs-wick breakout and failed-break detection');


// End-to-end fetch fixtures: recover a real missing bar, retain unresolved gaps,
// never admit a USD CDR, and apply dollar-volume boundaries without rounding.
const {UNIVERSE}=await import('../lib/universe.js');
assert.equal(new Set(UNIVERSE.map(x=>x[0])).size,UNIVERSE.length);
assert(UNIVERSE.some(x=>x[0]==='TOI.V'));
assert(UNIVERSE.some(x=>x[0]==='LMN.V'));
assert(!UNIVERSE.some(x=>/^\d/.test(x[0])));
const liveDates=[];
for(let t=Math.floor(Date.now()/86400000)*86400-86400;liveDates.length<126;t-=86400){
  if(![0,6].includes(new Date(t*1000).getUTCDay())) liveDates.unshift(t);
}
const originalFetch=globalThis.fetch;
const requests=[];
globalThis.fetch=async input=>{
  const url=new URL(input),symbol=decodeURIComponent(url.pathname.split('/').at(-1));
  requests.push([symbol,url.hostname]);
  const close=liveDates.map(()=>100),volume=liveDates.map(()=>100000);
  if(symbol==='AEM.TO'||(symbol==='ABX.TO'&&url.hostname.startsWith('query1'))) close[116]=null;
  if(symbol==='RY.TO') volume.fill(99999.999);
  return {ok:true,json:async()=>({chart:{result:[{meta:{currency:symbol==='AAPL.TO'?'USD':'CAD'},timestamp:liveDates,indicators:{quote:[{close,volume}],adjclose:[{adjclose:close}]}}]}})};
};
try{
  const scans=[];
  for(const minDollar of [2000000,5000000,10000000,25000000]){
    let output,code;
    await handler({query:{minDollar}},{setHeader(){},status(n){code=n;return this},json(x){output=x}});
    assert.equal(code,200);
    assert.equal(output.diagnostics.recovered,1);
    assert.equal(output.diagnostics.recoveryAttempted,2);
    assert.equal(output.diagnostics.unavailable,2);
    assert(output.failureDetails.some(x=>x.symbol==='AEM.TO'&&x.reason==='missing_sessions'));
    assert(output.failureDetails.some(x=>x.symbol==='AAPL.TO'&&x.reason==='non_cad_instrument'));
    assert.equal(output.diagnostics.liquid, minDollar===25000000?0:UNIVERSE.length-2-(minDollar===10000000?1:0));
    scans.push(output);
  }
  assert(scans.every(x=>JSON.stringify(x.breadth)===JSON.stringify(scans[0].breadth)));
  // Valid names remain retrievable for a saved watchlist even when the active
  // liquidity threshold excludes them; unavailable data keeps its failure reason.
  assert(scans.at(-1).availableItems.some(x=>x.symbol==='RY.TO'));
  assert(!scans.at(-1).items.some(x=>x.symbol==='RY.TO'));
  assert(scans.at(-1).failureDetails.some(x=>x.symbol==='AEM.TO'&&x.reason==='missing_sessions'));
  assert(!requests.some(([s,h])=>s==='AAPL.TO'&&h.startsWith('query2')));
}finally{globalThis.fetch=originalFetch}
console.log('PASS: expanded universe, alternate fetch recovery, unresolved gap isolation, CAD enforcement, all liquidity boundaries and fixed breadth');

const {isEarlyWatch}=await import('../api/scan.js');
const early={stage:null,ret20:-8,ret5:-1,momentumImproving:true,meaningfulWeakness:true,advancedNearHigh:false,nearRecentLow:true,volumeShockNearLow:true,spikeReturn:0,positiveUnusual5d:true,sellingPressureFading:false,downsideSlowing:true};
assert.equal(isEarlyWatch(early),true,'slowing decline with positive volume may be watched');
assert.equal(isEarlyWatch({...early,ret5:2}),true);
assert.equal(isEarlyWatch({...early,positiveUnusual5d:false,sellingPressureFading:true}),true);
for(const change of [{stage:'Recovery'},{ret20:3},{nearRecentLow:false},{volumeShockNearLow:false,downsideSlowing:false,spikeReturn:-4},{ret20:null},{meaningfulWeakness:false},{advancedNearHigh:true}]){
 assert.equal(isEarlyWatch({...early,...change}),false,JSON.stringify(change));
}
// A mature advance with a brief dip must never become an early recovery.
const mature=make(dates.map((_,i)=>100+i*0.5));
const peak=mature.rows.at(-11).close;
[.99,.98,.97,.96,.95,.96,.98,1,1.01,1.02].forEach((v,i)=>{mature.rows.at(-10+i).close=peak*v});
const matureMetrics=metrics(mature,make(),null);
assert.equal(matureMetrics.advancedNearHigh,true);
assert.notEqual(matureMetrics.stage,'Recovery');
assert.equal(isEarlyWatch(matureMetrics),false);
// Detect a positive spike even if the biggest spike was on a negative day.
const mixed=make();mixed.rows.at(-4).volume=400000;mixed.rows.at(-4).close=99;
mixed.rows.at(-2).volume=300000;mixed.rows.at(-2).close=101;
assert.equal(metrics(mixed,make(),null).unusual5dDirection,'negative');
assert.equal(metrics(mixed,make(),null).positiveUnusual5d,true);
console.log('PASS: mature advance exclusion, slowing-decline watch, volume confirmation, all-session positive spike detection');
