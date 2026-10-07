import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runPaperCohort,loadPaperInstrument} from '../lib/elliott/paper-runner.mjs';
import {readLedger} from '../lib/elliott/ledger-store.mjs';
import {aggregateCrypto4H,aggregateExchange4H,buildGapBeforeIndex} from '../lib/elliott/research-bars.mjs';
const T=Date.UTC(2025,0,1),H=3600000,iso=t=>new Date(t).toISOString();
const cfg=()=>({version:'elliott-v1',enabled:true,forwardStart:iso(T),execution:{maxHoldBars:60,minRewardRisk:2,stockEntryHours:120,cryptoEntryHours:36},portfolio:{startingCapital:1000,targetRiskPct:.01,maxPositionPct:.25,maxOpenRiskPct:.04,maxPositions:4,costR:.05},universes:{test:{mode:'crypto',symbols:['A']}}});
function fixture(bars=[]) {return {feed:{status:'available',bars,latestDailyCompletedAt:iso(T),gapBeforeTimes:[]},signals:[{version:'elliott-v1',status:'signal_confirmed',symbol:'A',dir:1,decisionId:'fixture-A',signalT:iso(T-86400000),signalCompletedAt:iso(T),signalClose:100,stop:90,target:130}],evidence:{provenance:'synthetic_fixture'}}}
async function temp(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'elliott-runner-'));try{await fn(dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
test('inactive runner never loads data or creates state',async()=>temp(async dir=>{
  const config=cfg();config.enabled=false;const root=path.join(dir,'absent');
  const result=await runPaperCohort({config,cohort:'test',stateRoot:root,loadInstrument:()=>{throw Error('must_not_fetch')}});
  assert.equal(result.status,'inactive');assert.equal(fs.existsSync(root),false);
}));
test('runner archives observations, persists account and replays without refetching',async()=>temp(async dir=>{
  const config=cfg(),base={config,cohort:'test',stateRoot:dir};let calls=0;
  const first=await runPaperCohort({...base,observedAt:iso(T),runKey:'r1',loadInstrument:async()=>{calls++;return fixture()}});
  assert.equal(first.portfolio.pendingCount,1);assert.equal(first.revision,1);
  const duplicate=await runPaperCohort({...base,observedAt:iso(T),runKey:'r1',loadInstrument:()=>{throw Error('no_refetch')}});
  assert.equal(duplicate.revision,1);assert.equal(calls,1);
  const next=await runPaperCohort({...base,observedAt:iso(T+4*H),runKey:'r2',loadInstrument:async()=>fixture([{t:T,endT:T+4*H,o:100,h:105,l:95,c:101}])});
  assert.equal(next.portfolio.openCount,1);assert.equal(next.portfolio.cash,900);
  const ledger=readLedger(path.join(dir,'test/ledger.json'),config);assert.equal(ledger.revision,2);
  assert.equal(fs.readdirSync(path.join(dir,'test')).filter(f=>f.endsWith('.gz')).length,2);
}));
test('provider outage preserves decisions and returns missing marked equity',async()=>temp(async dir=>{
  const config=cfg(),base={config,cohort:'test',stateRoot:dir};
  await runPaperCohort({...base,observedAt:iso(T),runKey:'a',loadInstrument:async()=>fixture()});
  await runPaperCohort({...base,observedAt:iso(T+4*H),runKey:'b',loadInstrument:async()=>fixture([{t:T,endT:T+4*H,o:100,h:105,l:95,c:101}])});
  const result=await runPaperCohort({...base,observedAt:iso(T+8*H),runKey:'c',loadInstrument:async()=>{throw Error('offline')}});
  assert.equal(result.portfolio.openCount,1);assert.equal(result.portfolio.markedCurrentEquity,null);assert.equal(result.failures[0].error,'offline');
}));
test('activation identity, concurrency, input corruption and reused timestamps fail closed',async()=>temp(async dir=>{
  const config=cfg(),base={config,cohort:'test',stateRoot:dir,observedAt:iso(T),runKey:'x',loadInstrument:async()=>fixture()};
  await assert.rejects(runPaperCohort({...base,config:{...config,forwardStart:null}}),/forward_start/);
  await runPaperCohort(base);
  await assert.rejects(runPaperCohort({...base,observedAt:iso(T+H)}),/identity_mismatch/);
  fs.writeFileSync(path.join(dir,'test/runner.lock'),'lock');await assert.rejects(runPaperCohort(base),/locked/);fs.unlinkSync(path.join(dir,'test/runner.lock'));
  const file=fs.readdirSync(path.join(dir,'test')).find(f=>f.endsWith('.gz'));fs.writeFileSync(path.join(dir,'test',file),'corrupt');
  await assert.rejects(runPaperCohort(base));
}));
const row=t=>({t,o:100,h:105,l:95,c:101,v:1});
test('UTC aggregation requires four completed hourly sources and identifies missing paths',()=>{
  const rows=Array.from({length:12},(_,i)=>row(T+i*H)).filter((_,i)=>i!==5);
  const result=aggregateCrypto4H(rows,{nowMs:T+12*H});assert.equal(result.bars.length,2);
  assert.equal(buildGapBeforeIndex(result.bars,{mode:'crypto'}).has(1),true);
  assert.equal(aggregateCrypto4H(Array.from({length:4},(_,i)=>row(T+i*H)),{nowMs:T+3*H}).bars.length,0);
});
test('exchange aggregation preserves two session segments and blocks absent daily sessions',()=>{
  const open=Date.parse('2025-01-02T14:30:00Z');
  const rows=[...Array.from({length:7},(_,i)=>row(open+i*H)),...Array.from({length:7},(_,i)=>row(open+4*86400000+i*H))];
  const result=aggregateExchange4H(rows,{nowMs:open+5*86400000});assert.equal(result.bars.length,4);
  assert.equal(result.bars[1].sourceCount,3);assert.equal(result.bars[1].endT,open+7*H);
  const gaps=buildGapBeforeIndex(result.bars,{mode:'stock',tradingDates:['2025-01-02','2025-01-03','2025-01-06']});assert.equal(gaps.has(2),true);
});
test('hourly instrument identity mismatch cannot reach account execution',async()=>{
  // Both requests resolve, but the hourly source impersonates another symbol.
  const times=Array.from({length:35},(_,i)=>(T-35*86400000+i*86400000)/1000);
  const chart={meta:{symbol:'A-USD',instrumentType:'CRYPTOCURRENCY'},timestamp:times,indicators:{quote:[{open:times.map(()=>100),high:times.map(()=>105),low:times.map(()=>95),close:times.map(()=>101),volume:times.map(()=>10)}]}};
  await assert.rejects(loadPaperInstrument('A-USD','crypto',{nowMs:T,fetcher:async url=>({ok:true,json:async()=>({chart:{result:[url.includes('interval=1h')?{...chart,meta:{symbol:'B-USD'}}:chart]}})})}),/hourly_symbol_mismatch/);
});
