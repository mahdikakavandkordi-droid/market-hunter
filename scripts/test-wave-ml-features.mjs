import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildFeatures,partition,digest} from '../lib/wave-ml/features.mjs';
import {normalize} from '../lib/wave-ml/source.mjs';
const contract=JSON.parse(fs.readFileSync(new URL('../data/research/wave-ml-v1/contract.json',import.meta.url),'utf8'));
const DAY=86400000,T=Date.UTC(2023,9,1);
function data(n=450) {const daily=Array.from({length:n},(_,i)=>{const c=100+i*.025+Math.sin(i/4)*4;return {t:T+i*DAY,endT:T+(i+1)*DAY,date:new Date(T+i*DAY).toISOString().slice(0,10),o:c,h:c+1,l:c-1,c,v:1000}});return {symbol:'TEST',market:'crypto',asOf:new Date(T+(n+1)*DAY).toISOString(),daily,dailyGapBeforeTimes:[]}}
const testContract=structuredClone(contract);testContract.split.trainDecisionStart='2023-01-01T00:00:00Z';
test('every synthetic prefix matches full rows available at that instant',()=>{
  const s=data(300),all=buildFeatures(s,testContract);assert.ok(all.length);
  for(let i=249;i<s.daily.length;i++){const time=s.daily[i].endT+300000;assert.equal(digest(buildFeatures(s,testContract,{asOf:time})),digest(all.filter(r=>Date.parse(r.availableAt)<=time)))}
});
test('unseen future extremes cannot change frozen feature rows',()=>{
  const s=data(),time=s.daily[300].endT+300000,before=buildFeatures(s,testContract,{asOf:time});
  const changed=structuredClone(s);changed.daily=changed.daily.map((b,i)=>i>300?{...b,o:1000,h:1100,l:900,c:1000,v:1e12}:b);
  assert.equal(digest(before),digest(buildFeatures(changed,testContract,{asOf:time})));
});
test('paired directions share partitions and availability; directional legs mirror',()=>{
  const rows=buildFeatures(data(),testContract);const [a,b]=rows;
  assert.equal(a.partition,b.partition);assert.equal(a.availableAt,b.availableAt);assert.equal(a.features.return20,-b.features.return20);
  assert.equal(a.features.leg0_size,-b.features.leg0_size);assert.equal(a.features.leg0_duration,b.features.leg0_duration);
  assert.ok(Date.parse(a.audit.weeklyInputEnd)<Date.parse(a.decisionCompletedAt));
  assert.ok(Date.parse(a.audit.lastSmallConfirmation)<=Date.parse(a.decisionCompletedAt));
});
test('RVOL uses previous volume only and never imputes missing source volume',()=>{
  const s=data();s.daily[300].v=2000;const row=buildFeatures(s,testContract).find(r=>r.decisionCompletedAt===new Date(s.daily[300].endT).toISOString());assert.equal(row.features.rvol20,2);
  s.daily[300].v=null;const missing=buildFeatures(s,testContract).find(r=>r.id===row.id);assert.equal(missing.features.rvol20,null);assert.equal(missing.features.rvol20_missing,1);
});
test('path gap resets 250-bar warmup and weekly/pivot state',()=>{
  const s=data(550);s.dailyGapBeforeTimes=[s.daily[300].t];const rows=buildFeatures(s,testContract);
  assert.equal(rows.filter(r=>Date.parse(r.decisionCompletedAt)>s.daily[299].endT&&Date.parse(r.decisionCompletedAt)<s.daily[549].endT).length,0);
});
test('reserved symbols never enter training or validation; paired final features remain sealed',()=>{
  const symbol=contract.split.holdoutSymbols[0];assert.equal(partition(symbol,'2025-01-01T00:00:00Z',contract),'reserved_symbol');assert.equal(partition(symbol,'2026-06-01T00:00:00Z',contract),'sealed_final');
  assert.equal(partition('AAPL','2026-01-01T00:00:00Z',contract),'validation');
});
test('duplicate price times, foreign instruments and live hourly tails fail closed',()=>{
  const s=data();s.daily.push(s.daily.at(-1));assert.throws(()=>buildFeatures(s,testContract),/invalid_daily_path/);
  const c={meta:{instrumentType:'CRYPTOCURRENCY'},timestamp:[T/1000,(T+1800000)/1000],indicators:{quote:[{open:[100,100],high:[101,101],low:[99,99],close:[100,100]}]}};
  const normalized=normalize(c,{mode:'crypto',interval:'1h',asOf:T+3600000});assert.equal(normalized.rows.length,1);assert.equal(normalized.dropped[0].reason,'off_hour_grid');
  assert.throws(()=>normalize({...c,meta:{instrumentType:'EQUITY'}},{mode:'crypto',interval:'1h',asOf:T+3600000}),/foreign/);
});
