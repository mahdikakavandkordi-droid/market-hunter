import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSchedule,easternTime,acceptExecution} from '../lib/wave-ml/calendar.mjs';
import {labelDecision} from '../lib/wave-ml/labels.mjs';
const calendar=JSON.parse(fs.readFileSync(new URL('../data/research/wave-ml-v1/official-calendar.json',import.meta.url))),contract=JSON.parse(fs.readFileSync(new URL('../data/research/wave-ml-v1/contract.json',import.meta.url)));
const us=buildSchedule('us',calendar),ca=buildSchedule('ca',calendar),iso=t=>new Date(t).toISOString();
function fixture(market='ca',date='2024-12-24'){
 const schedule=market==='us'?us:ca,slots=schedule.slots.filter(x=>x.date>=date).slice(0,70);
 const daily=[...new Set(slots.map(x=>x.date))].map(date=>({date,t:easternTime(date,9,30),endT:easternTime(date,17),o:100,h:101,l:99,c:100}));
 const snapshot={symbol:'TEST',market,mode:'stock',asOf:'2026-10-07T23:01:09.135Z',daily,executionBars:slots.map(x=>({...x,o:100,h:101,l:99,c:100})),executionGapBeforeTimes:[slots[1].t],quality:{priceMismatchDates:[],dailyInvalid:[],splits:[]}};
 const decision=easternTime('2024-12-23',17);const row={id:'test',symbol:'TEST',market,dir:1,decisionATR14:1,decisionCompletedAt:iso(decision),availableAt:iso(decision+300000),partition:'train'};
 return {row,snapshot,schedule};
}
test('official exceptional and market-specific holidays are distinguished',()=>{
 assert.equal(us.slots.filter(x=>x.date==='2025-01-09').length,0);assert.equal(ca.slots.filter(x=>x.date==='2025-01-09').length,2);
 assert.equal(ca.slots.filter(x=>x.date==='2024-12-26').length,0);assert.equal(us.slots.filter(x=>x.date==='2024-12-26').length,2);
 assert.equal(new Set(us.slots.filter(x=>x.date.startsWith('2025')).map(x=>x.date)).size,250);assert.equal(new Set(ca.slots.filter(x=>x.date.startsWith('2025')).map(x=>x.date)).size,251);
});
test('DST changes UTC open while local opening remains 09:30',()=>{
 assert.equal(iso(easternTime('2025-03-07',9,30)),'2025-03-07T14:30:00.000Z');assert.equal(iso(easternTime('2025-03-10',9,30)),'2025-03-10T13:30:00.000Z');
});
test('verified 13:00 short session has one four-source bar and no fabricated tail',()=>{
 for(const schedule of [us,ca]){const slots=schedule.slots.filter(x=>x.date==='2024-12-24');assert.equal(slots.length,1);assert.equal(slots[0].sourceCount,4);assert.equal(iso(slots[0].regularClose),'2024-12-24T18:00:00.000Z');assert.equal(iso(slots[0].endT),'2024-12-24T18:30:00.000Z');}
 const f=fixture(),s=acceptExecution(f.snapshot,f.schedule);assert.equal(s.executionGapBeforeTimes.length,0);assert.equal(s.audit.pricesChanged,false);assert.deepEqual(s.daily,f.snapshot.daily);
 const r=labelDecision(f.row,s,contract,{schedule:f.schedule});assert.equal(r.class,'time_exit');assert.equal(r.heldBars,60);
});
test('missing short-session sources and complete regular sessions are distinguished',()=>{
 const f=fixture();f.snapshot.executionBars.splice(0,1);const s=acceptExecution(f.snapshot,f.schedule);assert.ok(s.quality.executionUnverifiedDates.includes('2024-12-24'));assert.equal(labelDecision(f.row,s,contract,{schedule:f.schedule}).status,'unresolved');
 const regular=fixture('ca','2024-12-27');regular.snapshot.executionBars.splice(1,1);const r=acceptExecution(regular.snapshot,regular.schedule);assert.ok(r.quality.executionUnverifiedDates.includes('2024-12-27'));
});
test('stock daily verification extends label information time and mismatches quarantine',()=>{
 const f=fixture();f.snapshot.executionBars[0].h=105;let s=acceptExecution(f.snapshot,f.schedule),r=labelDecision(f.row,s,contract,{schedule:f.schedule});assert.equal(r.class,'target_first');assert.equal(r.informationEnd,iso(easternTime('2024-12-24',17)));
 assert.equal(labelDecision(f.row,s,contract,{schedule:f.schedule,asOf:easternTime('2024-12-24',14)}).reason,'path_right_censored');
 f.snapshot.daily[0].o=90;s=acceptExecution(f.snapshot,f.schedule);assert.equal(labelDecision(f.row,s,contract,{schedule:f.schedule}).reason,'untrusted_price_day');
});
test('calendar provenance, missing full day and out-of-calendar data fail closed',()=>{
 const f=fixture(),s=acceptExecution(f.snapshot,f.schedule);s.quality.calendarProvenance='changed';assert.throws(()=>labelDecision(f.row,s,contract,{schedule:f.schedule}),/provenance/);
 f.snapshot.executionBars=f.snapshot.executionBars.filter(x=>x.date!=='2024-12-27');const missing=acceptExecution(f.snapshot,f.schedule);assert.ok(missing.executionGapBeforeTimes.length);assert.ok(missing.quality.executionUnverifiedDates.includes('2024-12-27'));
 const holiday={...f.snapshot.executionBars[0],t:easternTime('2024-12-25',9,30),endT:easternTime('2024-12-25',13,30),date:'2024-12-25'};f.snapshot.executionBars.push(holiday);const q=acceptExecution(f.snapshot,f.schedule);assert.ok(q.quality.outOfCalendarExecutionBars.includes(holiday.t));assert.ok(!q.executionBars.some(x=>x.t===holiday.t));
});
