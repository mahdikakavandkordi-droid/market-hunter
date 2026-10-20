import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {hunterMarket,US_META,scanCurrencyIssue} from '../lib/hunter-markets.js';
import {UNIVERSE} from '../lib/universe.js';
import {validResearch,choosePublishedResearch} from '../lib/published-research.js';
import {sessionFromReport} from '../lib/market-hunter-forward-validation.js';
import portfolioHandler from '../api/portfolio.js';
const ca=hunterMarket(),us=hunterMarket('US');
assert.equal(ca.instruments.length,UNIVERSE.length);
assert.equal(ca.referenceSymbol,'^GSPTSE');
assert.equal(us.instruments.length,503);
assert.equal(new Set(us.instruments.map(x=>x.symbol)).size,503);
assert.ok(us.instruments.every(x=>x.currency==='USD'&&!x.symbol.endsWith('.TO')&&x.sector));
assert.equal(US_META.get('BRK-B').exchange,'NYSE');
assert.equal(US_META.has('HOLX'),false);
assert.equal(US_META.has('ESZ6'),false);
assert.throws(()=>hunterMarket('ALL'),/invalid_hunter_market/);
assert.equal(scanCurrencyIssue('CAD','USD'),'currency_mismatch');

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'us-hunter-'));
const scan=fileURLToPath(new URL('./scan-market-hunter-v2.mjs',import.meta.url));
// All fixtures are synthetic. Exercise the actual operational scanner and API.
const fixture=`
globalThis.fetch=async url=>{
  const symbol=decodeURIComponent(String(url).split('/chart/')[1].split('?')[0]);
  const wrong=!symbol.startsWith('^')&&(process.env.FIXTURE_FAIL==='all'||symbol==='NVDA');
  const timestamp=Array.from({length:220},(_,i)=>Math.floor(Date.UTC(2025,0,1+i,16)/1000));
  const close=timestamp.map((_,i)=>symbol.startsWith('^')?100+i*.02:30*Math.pow(1.005,i));
  return {ok:true,json:async()=>({chart:{result:[{meta:{currency:wrong?'CAD':'USD'},timestamp,indicators:{quote:[{close,high:close.map(x=>x*1.006),low:close.map(x=>x*.994),volume:close.map(()=>2000000)}],adjclose:[{adjclose:close}]}}]}})};
};`;
try{
  const preload=path.join(dir,'fixture.mjs');fs.writeFileSync(preload,fixture);
  fs.mkdirSync(path.join(dir,'data'));
  const canadianFile=path.join(dir,ca.file);fs.writeFileSync(canadianFile,'preserve-canada');
  const run=fail=>spawnSync(process.execPath,['--import',preload,scan],{cwd:dir,env:{...process.env,MH_HUNTER_MARKET:'US',FIXTURE_FAIL:fail},encoding:'utf8',timeout:30000,maxBuffer:5e6});
  const good=run('');assert.equal(good.status,0,good.stderr);
  const output=path.join(dir,us.file),text=fs.readFileSync(output,'utf8'),report=JSON.parse(text);
  assert.equal(report.sessionIntegrity.referenceSymbol,'^GSPC');
  assert.equal(report.sourceUsableCount,502);
  assert.equal(report.excluded.currency_mismatch,1);
  assert.ok(report.all.length>0);
  assert.ok(report.all.every(x=>x.currency==='USD'&&x.market==='US'&&x.benchmark==='^GSPC'&&x.asOf===report.marketAsOf&&Number.isFinite(x.dayChangePct)));
  assert.equal(validResearch('v2-us',report),true);
  assert.equal(validResearch('v2',report),false);
  assert.throws(()=>sessionFromReport(report),/separate_ledger/);
  assert.equal(validResearch('v2-us',{...report,all:[{...report.all[0],currency:'CAD'}]}),false);
  assert.equal(choosePublishedResearch('v2-us',{...report,marketAsOf:'2020-01-01'},report).data,report);
  const bad=run('all');assert.notEqual(bad.status,0);assert.match(bad.stderr,/insufficient_source_coverage/);
  assert.equal(fs.readFileSync(output,'utf8'),text,'failed collection must retain accepted US snapshot');
  assert.equal(fs.readFileSync(canadianFile,'utf8'),'preserve-canada');
  const originalFetch=globalThis.fetch;
  try{
    await import('file://'+preload);
    let payload,status;
    await portfolioHandler({method:'GET',query:{symbols:'AAPL,AAPL.TO'}},{setHeader(){},status(n){status=n;return this},json(x){payload=x}});
    assert.equal(status,200);
    assert.equal(payload.items.find(x=>x.symbol==='AAPL')?.benchmark,'^GSPC');
    assert.equal(payload.items.find(x=>x.symbol==='AAPL.TO')?.benchmark,'^IXIC');
  }finally{globalThis.fetch=originalFetch}
}finally{fs.rmSync(dir,{recursive:true,force:true})}
console.log('PASS: US registry, currency/session isolation, real scan, failure retention, Canadian ledger rejection and exact US/CDR API benchmarks');
