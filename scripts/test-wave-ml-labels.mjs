import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {labelDecision} from '../lib/wave-ml/labels.mjs';
import {buildSplits} from '../lib/wave-ml/splits.mjs';
const contract=JSON.parse(fs.readFileSync(new URL('../data/research/wave-ml-v1/contract.json',import.meta.url)));
const HOUR=3600000,DAY=24*HOUR,T=Date.UTC(2025,0,2,4),iso=t=>new Date(t).toISOString();
function fixture(dir=1){const row={id:'TEST|'+dir,symbol:'TEST',market:'crypto',dir,availableAt:iso(T-4*HOUR+300000),decisionCompletedAt:iso(T-4*HOUR),partition:'train',decisionATR14:1};
 const executionBars=Array.from({length:60},(_,i)=>({t:T+i*4*HOUR,endT:T+(i+1)*4*HOUR,date:iso(T+i*4*HOUR).slice(0,10),o:100,h:101,l:99,c:100,sourceCount:4}));
 const start=T-4*HOUR;const all=Array.from({length:66},(_,i)=>({t:start+i*4*HOUR,endT:start+(i+1)*4*HOUR,date:iso(start+i*4*HOUR).slice(0,10),o:100,h:101,l:99,c:100,sourceCount:4}));
 executionBars.push(...all.filter(b=>!executionBars.some(x=>x.t===b.t)));
 const daily=Array.from({length:11},(_,i)=>({date:iso(start+i*DAY).slice(0,10),t:start+i*DAY,endT:start+(i+1)*DAY,o:100,h:101,l:99,c:100}));
 return {row,snapshot:{symbol:'TEST',market:'crypto',mode:'crypto',asOf:iso(T+30*DAY),daily,executionBars,executionGapBeforeTimes:[],quality:{priceMismatchDates:[],dailyInvalid:[],splits:[]}}};}
function run(f,opts){return labelDecision(f.row,f.snapshot,contract,opts);}
test('long/short entry-bar collision is stop-first; fees deducted once',()=>{
 for(const dir of [1,-1]){const f=fixture(dir);f.snapshot.executionBars[0].h=105;f.snapshot.executionBars[0].l=95;const r=run(f);assert.equal(r.class,'stop_first');assert.equal(r.grossR,-1);assert.equal(r.netR,-1.05);assert.equal(r.heldBars,1);assert.equal(r.entryAt,iso(T));}
});
test('adverse gaps fill open and favorable gaps cap at target, both directions',()=>{
 for(const dir of [1,-1])for(const favorable of [true,false]){const f=fixture(dir);const b=f.snapshot.executionBars[1];b.o=100+dir*(favorable?7:-5);b.h=b.o+1;b.l=b.o-1;b.c=b.o;const r=run(f);assert.equal(r.class,favorable?'target_first':'stop_first');assert.equal(r.grossR,favorable?2:-2.5);}
});
test('60 bars include entry; time exit uses last close and known information end',()=>{
 const f=fixture(),r=run(f);assert.equal(r.class,'time_exit');assert.equal(r.heldBars,60);assert.equal(r.exitAt,f.snapshot.executionBars[59].endT?iso(f.snapshot.executionBars[59].endT):null);assert.equal(r.netR,-.05);assert.ok(Date.parse(r.informationEnd)>=Date.parse(r.exitAt));
});
test('missing first/later bars never skip to a convenient entry or horizon',()=>{
 for(const i of [0,4,59]){const f=fixture();f.snapshot.executionBars.splice(i,1);const r=run(f);assert.equal(r.status,'unresolved');assert.ok(['missing_or_invalid_execution_bar','daily_crosscheck_unverified'].includes(r.reason));assert.equal(r.netR,null);}
});
test('daily quality, holding split and incomplete source coverage fail closed',()=>{
 for(const cause of ['mismatch','invalid','split','gap','badbar']){const f=fixture(),b=f.snapshot.executionBars[1];if(cause==='mismatch')f.snapshot.quality.priceMismatchDates.push(b.date);if(cause==='invalid')f.snapshot.quality.dailyInvalid.push({date:b.date});if(cause==='split')f.snapshot.quality.splits.push({date:b.date});if(cause==='gap')f.snapshot.executionGapBeforeTimes.push(b.t);if(cause==='badbar')b.sourceCount=3;assert.equal(run(f).status,'unresolved');}
});
test('missing later daily sources invalidate the earlier cross-check, even before an exit',()=>{const f=fixture();f.snapshot.executionBars[0].h=105;f.snapshot.executionBars.splice(3,1);assert.equal(run(f).reason,'daily_crosscheck_unverified');});
test('daily cross-check availability extends outcome information beyond intrabar exit',()=>{
 const f=fixture();f.snapshot.executionBars[0].h=105;const r=run(f);assert.equal(r.class,'target_first');assert.equal(r.informationEnd,iso(Date.UTC(2025,0,3)));assert.equal(run(f,{asOf:T+4*HOUR}).reason,'path_right_censored');
});
test('right censoring, nonpositive boundaries and wall limits stay unresolved',()=>{
 const f=fixture();assert.equal(run(f,{asOf:T}).reason,'path_right_censored');f.row.decisionATR14=100;assert.equal(run(f).reason,'nonpositive_boundary');
 const small=structuredClone(contract);small.executionLabel.maxLabelWallDaysIncludingEntry=.1;assert.equal(labelDecision(fixture().row,fixture().snapshot,small).reason,'label_wall_limit');
});
test('stock labels require verified calendar with complete coverage',()=>{
 const f=fixture();f.row.market=f.snapshot.market='us';f.snapshot.mode='stock';assert.equal(run(f).reason,'stock_calendar_unverified');
 assert.equal(run(f,{schedule:{verified:true,provenance:'synthetic',slots:[],coverageStart:T,coverageEnd:T}}).reason,'schedule_coverage_missing');
 const schedule={verified:true,provenance:'synthetic fixture, not real exchange approval',coverageStart:T-DAY,coverageEnd:T+80*DAY,slots:[...f.snapshot.executionBars].sort((a,b)=>a.t-b.t).map(({t,endT,date})=>({t,endT,date}))};assert.equal(run(f,{schedule}).class,'time_exit');
 schedule.slots=[];assert.equal(run(f,{schedule}).class,'entry_expired');
});
test('sealed final and all reserved-symbol histories are inaccessible to label API',()=>{
 for(const change of [{symbol:contract.split.holdoutSymbols[0]},{availableAt:'2026-04-01T00:05:00Z'},{partition:'sealed_final'},{partition:'development_final_time'}]){const f=fixture();Object.assign(f.row,change);assert.throws(()=>run(f),/sealed/);}
});
test('future perturbation cannot change an already resolved path; duplicate times reject',()=>{
 const f=fixture();f.snapshot.executionBars[0].h=105;const before=run(f);f.snapshot.executionBars[10].h=1e6;assert.deepEqual(run(f),before);f.snapshot.executionBars.push(f.snapshot.executionBars[0]);assert.throws(()=>run(f),/duplicate/);
});
function pair(time,end=time){return [1,-1].map(dir=>({id:time+'|'+dir,symbol:'TEST',market:'crypto',dir,availableAt:time,partition:time<'2026-01-01'?'train':'validation',status:'resolved',informationEnd:end}));}
test('75-day embargo, exact interval purge, UTC grouping and direction pairing',()=>{
 const old=pair('2025-08-01T00:05:00Z','2025-08-11T00:00:00Z'),embargo=pair('2025-11-01T00:05:00Z'),cross=pair('2025-08-02T00:05:00Z','2026-01-01T00:00:00Z'),val=pair('2026-01-01T00:05:00Z','2026-01-11T00:00:00Z');
 const sameDay=pair('2025-08-02T21:05:00Z','2025-08-10T00:00:00Z').map(r=>({...r,id:r.id+'B',symbol:'TESTB'}));
 const r=buildSplits([...old,...embargo,...cross,...sameDay,...val],contract).records.filter(r=>r.fold==='validation_1');
 for(const p of [old,embargo,cross,sameDay,val])assert.equal(new Set(r.filter(x=>p.some(y=>x.id===y.id)).map(x=>x.role)).size,1);
 assert.equal(r.find(x=>x.id===old[0].id).role,'fit');assert.equal(r.find(x=>x.id===embargo[0].id).role,'excluded');assert.equal(r.find(x=>x.id===sameDay[0].id).role,'excluded');assert.equal(r.find(x=>x.id===val[0].id).role,'evaluate');
});
test('unresolved pairs, cross-window evaluation intervals and reserved rows excluded',()=>{
 const a=pair('2025-08-01T00:05:00Z');a[1].status='unresolved';assert.ok(buildSplits(a,contract).records.every(r=>r.role==='excluded'));
 const v=pair('2026-02-01T00:05:00Z','2026-03-01T00:00:00Z');assert.equal(buildSplits(v,contract).records.find(r=>r.fold==='validation_1').role,'excluded');
 assert.throws(()=>buildSplits(pair('2026-04-01T00:05:00Z'),contract),/sealed/);assert.throws(()=>buildSplits([...a,...a],contract),/duplicate/);
});
