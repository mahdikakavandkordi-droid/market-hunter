import assert from 'node:assert/strict';
import {
  completedWeeklyCloses,latestConfirmedPivotHigh,evaluateEpisode,buildEpisodes,dayKey,setupAt,trendRsAt
} from '../lib/healthy-trend-pullback.js';

const ts=d=>Math.floor(new Date(d+'T20:00:00Z').getTime()/1000);
const row=(d,c,h=c+1,l=c-1,v=1000000)=>({t:ts(d),close:c,rawClose:c,high:h,low:l,rawHigh:h,rawLow:l,volume:v});

// Weekly-bar availability: current calendar week is excluded.
const weeklyRows=[
  row('2026-01-05',10),row('2026-01-09',11),
  row('2026-01-12',12),row('2026-01-16',13),
  row('2026-01-19',14),row('2026-01-20',15)
];
const wc=completedWeeklyCloses(weeklyRows,5);
assert.deepEqual(wc.map(x=>x.close),[11,13]);
assert.ok(!wc.some(x=>x.week==='2026-01-19'),'partial current week leaked into weekly input');

// Pivot availability: a 2-right-bar pivot is unavailable until both right bars exist.
const pRows=[
  row('2026-02-02',10,11,9),row('2026-02-03',11,12,10),row('2026-02-04',12,15,11),
  row('2026-02-05',11,13,10),row('2026-02-06',10,12,9),row('2026-02-09',14,14,12)
];
assert.equal(latestConfirmedPivotHigh(pRows,3),null);
const p=latestConfirmedPivotHigh(pRows,4);
assert.equal(p.index,2);
assert.equal(p.confirmedAt,'2026-02-06');

// Failed gates must remain ineligible even when reusable generic state is eligible.
const gateRows=Array.from({length:110},(_,i)=>row(
  new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),100,101,99,1000000
));
const genericPass={eligible:true,reason:null,avgDollar20:10000000,atr14:2,atr14Pct:2};
const weeklyFail={eligible:false,weeklyCount:30,lastCompletedWeek:'2025-03-03',slope4:-1};
const setupWeeklyFail=setupAt({
  pack:{splitDays:new Set()},rows:gateRows,i:100,benchmarkRows:gateRows,marketRows:gateRows,
  genericState:genericPass,weeklyState:weeklyFail,closeSeries:gateRows.map(x=>x.close)
});
assert.equal(setupWeeklyFail.eligible,false);
assert.equal(setupWeeklyFail.reason,'weekly_trend');
const trendWeeklyFail=trendRsAt({
  pack:{splitDays:new Set()},rows:gateRows,i:100,benchmarkRows:gateRows,
  genericState:genericPass,weeklyState:weeklyFail,closeSeries:gateRows.map(x=>x.close)
});
assert.equal(trendWeeklyFail.eligible,false);
assert.equal(trendWeeklyFail.reason,'weekly_trend');

const weeklyPass={eligible:true,weeklyCount:30,lastCompletedWeek:'2025-03-03',slope4:1,sma10:100,sma20:95};
const controlledFail=setupAt({
  pack:{splitDays:new Set()},rows:gateRows,i:100,benchmarkRows:gateRows,marketRows:gateRows,
  genericState:genericPass,weeklyState:weeklyPass,closeSeries:gateRows.map(x=>x.close)
});
assert.equal(controlledFail.eligible,false);
assert.equal(controlledFail.reason,'controlled_pullback');

// Outcome alignment and barrier ordering.
const dates=[];
let d=new Date('2026-03-02T20:00:00Z');
for(let i=0;i<45;i++){dates.push(d.toISOString().slice(0,10));d=new Date(d.getTime()+86400000)}
const rows=dates.map((x,i)=>row(x,100+i*.1,101+i*.1,99+i*.1));
const decisionIndex=14;
rows[15]={...rows[15],close:102,rawClose:102,high:102.2,low:101.8}; // entry is next-session close
// Keep first post-entry bar inside barriers, then hit favourable first.
rows[16]={...rows[16],high:102.5,low:101.5,close:102};
rows[17]={...rows[17],high:106,low:101.5,close:105};
const bench=dates.map((x,i)=>row(x,200+i*.1,201+i*.1,199+i*.1));
const pack={rows,splitDays:new Set()};
const cal={developmentStart:'2026-01-01',validationStart:'2026-06-01',finalStart:'2027-01-01'};
const ev=evaluateEpisode({pack,decisionIndex,benchmarkRows:bench,calendar:cal});
assert.equal(ev.entryDate,dayKey(rows[15].t));
assert.equal(ev.entryPrice,102);
assert.ok(['success','adverse_first','neither','ambiguous_both_hit'].includes(ev.primaryLabel));
assert.equal(ev.split,'Development');
assert.equal(ev.included,true);

// Ambiguous same-bar crossing is never inferred favourable.
const ambRows=dates.map((x,i)=>row(x,100,101,99));
const ambPack={rows:ambRows,splitDays:new Set()};
const base=evaluateEpisode({pack:ambPack,decisionIndex,benchmarkRows:bench,calendar:cal});
const target=base.favourableBarrier,stop=base.adverseBarrier;
ambRows[16]={...ambRows[16],high:target+.5,low:stop-.5};
const amb=evaluateEpisode({pack:ambPack,decisionIndex,benchmarkRows:bench,calendar:cal});
assert.equal(amb.primaryLabel,'ambiguous_both_hit');

// Irregular/suspension gap is explicit and excluded from primary path label.
const gapRows=dates.map((x,i)=>row(x,100,101,99));
gapRows[17]={...gapRows[17],t:ts('2026-04-20')};
for(let i=18;i<gapRows.length;i++)gapRows[i]={...gapRows[i],t:gapRows[17].t+(i-17)*86400};
const gap=evaluateEpisode({pack:{rows:gapRows,splitDays:new Set()},decisionIndex,benchmarkRows:bench,calendar:cal});
assert.equal(gap.irregularGap,true);
assert.equal(gap.primaryLabel,'suspension_or_irregular_gap');

// Boundary purge requires the full primary window before the split boundary.
const boundaryCal={developmentStart:'2026-01-01',validationStart:dayKey(rows[25].t),finalStart:'2027-01-01'};
const purged=evaluateEpisode({pack,decisionIndex,benchmarkRows:bench,calendar:boundaryCal});
assert.equal(purged.split,'Development');
assert.equal(purged.included,false);
assert.equal(purged.exclusionReason,'validation_boundary_outcome_purge');

// Episode continuity: omitted/missing dates are not confirmed dates; a confirmed zero-pick resets.
const confirmed=['2026-05-01','2026-05-04','2026-05-05','2026-05-06'];
const selected=new Map([
  ['2026-05-01',[{symbol:'AAA.TO',rank:1,score:90}]],
  ['2026-05-04',[{symbol:'AAA.TO',rank:1,score:91}]],
  ['2026-05-05',[]],
  ['2026-05-06',[{symbol:'AAA.TO',rank:1,score:92}]]
]);
const eps=buildEpisodes({model:'test',confirmedDates:confirmed,selectedByDate:selected,evaluate:()=>({status:'ok'})});
assert.equal(eps.length,2);
assert.equal(eps[0].firstSurfaceDate,'2026-05-01');
assert.equal(eps[1].firstSurfaceDate,'2026-05-06');

// Identical evaluation convention regardless of model label.
const e1=buildEpisodes({model:'a',confirmedDates:['2026-05-01'],selectedByDate:new Map([['2026-05-01',[{symbol:'AAA.TO',rank:1}]]]),evaluate:()=>ev})[0];
const e2=buildEpisodes({model:'b',confirmedDates:['2026-05-01'],selectedByDate:new Map([['2026-05-01',[{symbol:'AAA.TO',rank:1}]]]),evaluate:()=>ev})[0];
for(const k of ['entryDate','entryPrice','atr14','finalDate','primaryLabel'])assert.deepEqual(e1[k],e2[k]);

console.log('Healthy-trend pullback timing/episode/barrier regression tests passed');
