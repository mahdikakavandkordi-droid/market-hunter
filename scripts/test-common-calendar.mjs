import assert from 'node:assert/strict';
import {fixedCalendarSplit,validateFixedCalendar} from '../lib/validation-split.js';
import {buildResearchReport} from '../lib/backtest-report-builder.js';

const calendar={
  developmentStart:'2021-09-27',
  validationStart:'2024-09-20',
  finalStart:'2026-01-01'
};

assert.deepEqual(validateFixedCalendar(calendar),calendar);
assert.throws(()=>validateFixedCalendar({...calendar,validationStart:'bad'}),/Invalid validation calendar/);
assert.throws(()=>validateFixedCalendar({developmentStart:'2025-01-01',validationStart:'2024-01-01',finalStart:'2026-01-01'}),/must satisfy/);

const row=(id,date,outcomeDate)=>({
  id,symbol:id,date,outcomeDate,stage:'Early Watch',horizon:5,sessionIndex:Number(id.replace(/\D/g,''))||1,rankScore:70,
  features:{rs20:1,rs60:1,upDownVolumeRatio:1,higherLow:true,swingTrend:'Structure improving',atr14Pct:3,freshReclaimAge:1,sellingFading:true,downsideDecel:true,volumeShockNearLow:true,momentumShift:2,highBroken:true,freshHighBreakAge:1,dist20:1,ret20:5,ret60:15,ma20Slope5:1,ma50Slope10:1,rsi14:55},
  forwardReturn:1,benchmarkReturn:0,excessReturn:1,mae:-1,mfe:2,hitPlus7:false,hitMinus7:false
});

const full=[
  row('r1','2022-01-03','2022-01-10'),
  row('r2','2023-01-03','2023-01-10'),
  row('r3','2024-09-19','2024-09-20'), // outcome exactly at validation boundary: purge from train
  row('r4','2024-09-19','2024-09-25'), // crossing validation boundary: purge
  row('r5','2024-09-20','2024-09-27'), // validation
  row('r6','2025-03-01','2025-03-08'), // validation
  row('r7','2025-12-20','2026-01-01'), // final-boundary crossing: exclude
  {...row('badDate','bad','2024-01-01')},
  {...row('badOutcome','2024-01-01','bad')}
];

const sparse=full.filter(x=>['r1','r5'].includes(x.id));
const a=fixedCalendarSplit(full,calendar);
const b=fixedCalendarSplit(sparse,calendar);

assert.deepEqual(a.calendar,b.calendar);
assert.equal(a.calendar.validationStart,'2024-09-20');
assert.deepEqual(a.train.map(x=>x.id),['r1','r2']);
assert.deepEqual(a.test.map(x=>x.id),['r5','r6']);
assert.equal(a.counts.validationBoundaryPurgedCount,2);
assert.equal(a.counts.finalBoundaryPurgedCount,1);
assert.equal(a.counts.invalidCount,2);
assert.deepEqual(b.train.map(x=>x.id),['r1']);
assert.deepEqual(b.test.map(x=>x.id),['r5']);

const overlap=row('same','2024-09-20','2024-09-27');
assert.equal(fixedCalendarSplit([overlap,...full],calendar).test.some(x=>x.id==='same'),true);
assert.equal(fixedCalendarSplit([overlap],calendar).test.some(x=>x.id==='same'),true);

const emptyTrain=fixedCalendarSplit([row('v1','2025-01-01','2025-01-08')],calendar);
assert.equal(emptyTrain.status,'insufficient_data');
assert.equal(emptyTrain.insufficientReason,'empty_train');

const emptyValidation=fixedCalendarSplit([row('t1','2023-01-01','2023-01-08')],calendar);
assert.equal(emptyValidation.status,'insufficient_data');
assert.equal(emptyValidation.insufficientReason,'empty_validation');

function reportFor(rawEvents,batchIndex){
  return buildResearchReport({
    version:'test',generatedAt:'2026-09-27T00:00:00Z',batchIndex,batchCount:4,range:'5y',horizons:[5],assumptions:{},
    validation:{method:'fixed calendar synthetic'},dataset:{id:'same'},symbols:['SYNTH'+batchIndex],rawEvents,
    surfaceReplayCandidates:[],recoverySurfaceReplayCandidates:[],attractiveGrowthSurfaceReplayCandidates:[],establishedMoveSurfaceReplayCandidates:[],
    latestPicks:[],finalTestStart:calendar.finalStart,openFinalTest:false,validationCalendar:calendar
  });
}

const reportA=reportFor(full.filter(x=>x.date!=='bad'&&x.outcomeDate!=='bad'),0);
const reportB=reportFor([
  row('b1','2022-06-01','2022-06-08'),
  row('b2','2025-06-01','2025-06-08')
],3);

assert.deepEqual(reportA.validation.calendar,reportB.validation.calendar);
assert.deepEqual(reportA.horizons[5].byStage['Early Watch'].fold.calendar,calendar);
assert.deepEqual(reportB.horizons[5].byStage['Early Watch'].fold.calendar,calendar);

const ew=reportA.horizons[5].byStage['Early Watch'];
for(const variant of Object.values(ew.rewriteDiagnostic.inclusion)){
  assert.deepEqual(variant.fold,calendar);
}
for(const variant of Object.values(ew.rewriteDiagnostic.ranking)){
  assert.deepEqual(variant.fold,calendar);
}

console.log('Common fixed-calendar validation tests passed');
