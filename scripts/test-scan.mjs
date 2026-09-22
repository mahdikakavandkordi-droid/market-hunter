import assert from 'node:assert/strict';
import handler,{metrics,validateData} from '../api/scan.js';

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
