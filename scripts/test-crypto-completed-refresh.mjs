import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {refreshCompletedCryptoRows} from '../lib/crypto-completed-refresh.js';
import {verifyAssetRefresh} from './verify-asset-refresh.mjs';

const now=Date.parse('2026-10-20T12:00:00Z'),sec=s=>Date.parse(s+'T00:00:00Z')/1000;
const row=date=>({t:sec(date),close:100,rawClose:100,high:102,low:98,volume:1000});
const history=[row('2026-10-17'),row('2026-10-18')];
function payload(rows=history.concat(row('2026-10-19'),row('2026-10-20'))){
 return {chart:{result:[{meta:{symbol:'BTC-USD',currency:'USD',instrumentType:'CRYPTOCURRENCY',dataGranularity:'1d'},timestamp:rows.map(r=>r.t),indicators:{quote:[{close:rows.map(r=>r.close),high:rows.map(r=>r.high),low:rows.map(r=>r.low),volume:rows.map(r=>r.volume)}],adjclose:[{adjclose:rows.map(r=>r.close)}]}}]}};
}
const original=JSON.stringify(history);let requested;
const fetcher=async(url,options)=>{requested={url,options};return {ok:true,json:async()=>payload()};};
const recovered=await refreshCompletedCryptoRows({symbol:'BTC-USD',rows:history,nowMs:now,fetcher});
assert.deepEqual(recovered.rows.map(r=>r.t),['2026-10-17','2026-10-18','2026-10-19'].map(sec));
assert.equal(recovered.rows[0],history[0]);assert.equal(JSON.stringify(history),original);
assert.deepEqual(recovered.recovery.appendedSessions,['2026-10-19']);
const query=new URL(requested.url);assert.equal(query.searchParams.get('period2'),String(sec('2026-10-20')));assert.equal(requested.options.cache,'no-store');
await refreshCompletedCryptoRows({symbol:'BTC-USD',rows:recovered.rows,nowMs:now,fetcher:()=>{throw new Error('fresh history must not request a recovery');}});
for(const mutate of [
 z=>z.meta.symbol='ETH-USD',z=>z.meta.currency='CAD',z=>z.meta.instrumentType='EQUITY',
 z=>z.indicators.quote[0].close[1]=99,
 z=>z.indicators.quote[0].high[1]=103,
 z=>z.indicators.quote[0].close[2]=null,
 z=>z.indicators.quote[0].high[2]=90,
 z=>z.timestamp[2]=sec('2026-10-20'),
 z=>z.timestamp.splice(2,0,z.timestamp[2]),
]){
 const body=payload();mutate(body.chart.result[0]);
 await assert.rejects(refreshCompletedCryptoRows({symbol:'BTC-USD',rows:history,nowMs:now,fetcher:async()=>({ok:true,json:async()=>body})}));
}
await assert.rejects(refreshCompletedCryptoRows({symbol:'BTC-USD',rows:history,nowMs:now,fetcher:async()=>({ok:false,status:503})}),/503/);
const fresh={key:'BTC',group:'Crypto',asOf:'2026-10-19',freshness:{status:'fresh',latestCompletedSession:'2026-10-19',expectedCompletedSession:'2026-10-19'}};
assert.deepEqual(verifyAssetRefresh({markets:[fresh]},['BTC'],now),['BTC']);
assert.throws(()=>verifyAssetRefresh({markets:[fresh]},['BTC','ETH'],now),/ETH/);
assert.throws(()=>verifyAssetRefresh({markets:[{...fresh,freshness:{...fresh.freshness,status:'stale'}}]},['BTC'],now),/incomplete/);
assert.throws(()=>verifyAssetRefresh({markets:[fresh]},['BTC'],now+86400000),/2026-10-20/,'a carried fresh label cannot hide yesterday\'s missing bar');

// Exercise the actual scan entry point, including the calendar argument, append
// recovery, source metadata, and isolation of all untargeted market records.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-crypto-refresh-'));
try{
 fs.mkdirSync(path.join(temp,'data'));
 const sentinel={key:'TSX',group:'Equity Index',asOf:'2026-10-19',price:999,returns:{d20:2}};
 fs.writeFileSync(path.join(temp,'data/market-pulse-latest.json'),JSON.stringify({markets:[sentinel]}));
 const bootstrap=path.join(temp,'fetch-fixture.mjs');
 fs.writeFileSync(bootstrap,`Date.now=()=>${now};globalThis.fetch=async(url)=>{const symbol=decodeURIComponent(new URL(url).pathname.split('/').at(-1));const recent=new URL(url).searchParams.has('period1');const dates=recent?[1792281600,1792368000,1792454400]:Array.from({length:300},(_,i)=>1792281600-(299-i)*86400).concat(1792454400);const prices=dates.map((_,i)=>100+i/100);if(recent)prices.splice(0,3,102.99,103.01,99999);return {ok:true,json:async()=>({chart:{result:[{meta:{symbol,currency:'USD',instrumentType:'CRYPTOCURRENCY',dataGranularity:'1d'},timestamp:dates,indicators:{quote:[{close:prices,high:prices.map(v=>v+2),low:prices.map(v=>v-2),volume:prices.map(()=>1000)}],adjclose:[{adjclose:prices}]}}]}})}};`);
 const script=path.resolve('scripts/scan-market-pulse.mjs');
 const run=spawnSync(process.execPath,['--import',bootstrap,script],{cwd:temp,encoding:'utf8',env:{...process.env,MARKET_PULSE_KEYS:'BTC,ETH',MARKET_PULSE_MERGE_EXISTING:'1'}});
 assert.equal(run.status,0,run.stderr);
 const output=JSON.parse(fs.readFileSync(path.join(temp,'data/market-pulse-latest.json')));
 assert.deepEqual(output.markets.find(m=>m.key==='TSX'),sentinel);
 for(const key of ['BTC','ETH']){
  const m=output.markets.find(m=>m.key===key);assert.equal(m.asOf,'2026-10-19');assert.equal(m.price,103.01);assert.equal(m.freshness.status,'fresh');assert.equal(m.sourceRefresh.method,'yahoo-completed-crypto-window-v1');
 }
 verifyAssetRefresh(output,['BTC','ETH'],now);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('Crypto refresh: delayed history recovery, identity/overlap/gap guards, UTC exclusion, scanner integration and unsuccessful-refresh detection passed');
