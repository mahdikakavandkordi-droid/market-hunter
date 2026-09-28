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

const features=()=>({
  rs20:1,rs60:1,upDownVolumeRatio:1,higherLow:true,swingTrend:'Structure improving',atr14Pct:3,
  freshReclaimAge:1,sellingFading:true,downsideDecel:true,volumeShockNearLow:true,momentumShift:2,
  highBroken:true,freshHighBreakAge:1,dist20:1,ret20:5,ret60:15,ma20Slope5:1,ma50Slope10:1,rsi14:55
});

const row=(id,date,outcomeDate,{stage='Early Watch',horizon=5,index}={})=>({
  id,symbol:id,date,outcomeDate,stage,horizon,
  sessionIndex:index??(Number(id.replace(/\D/g,''))||1),
  rankScore:70,features:features(),
  forwardReturn:1,benchmarkReturn:0,excessReturn:1,mae:-1,mfe:2,hitPlus7:false,hitMinus7:false
});

const splitFixture=[
  row('r1','2022-01-03','2022-01-10'),
  row('r2','2023-01-03','2023-01-10'),
  row('r3','2024-09-19','2024-09-20'), // equality at validation boundary => purge from train
  row('r4','2024-09-19','2024-09-25'), // crosses validation boundary => purge from train
  row('r5','2024-09-20','2024-09-27'), // validation
  row('r6','2025-03-01','2025-03-08'), // validation
  row('r7','2025-12-20','2026-01-01'), // equality at final boundary => purge from validation
  {...row('badDate','2024-01-01','2024-01-08'),date:'bad'},
  {...row('badOutcome','2024-01-01','2024-01-08'),outcomeDate:'bad'}
];

const sparse=splitFixture.filter(x=>['r1','r5'].includes(x.id));
const a=fixedCalendarSplit(splitFixture,calendar);
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
assert.equal(fixedCalendarSplit([overlap,...splitFixture],calendar).test.some(x=>x.id==='same'),true);
assert.equal(fixedCalendarSplit([overlap],calendar).test.some(x=>x.id==='same'),true);

const emptyTrain=fixedCalendarSplit([row('v1','2025-01-01','2025-01-08')],calendar);
assert.equal(emptyTrain.status,'insufficient_data');
assert.equal(emptyTrain.insufficientReason,'empty_train');

const emptyValidation=fixedCalendarSplit([row('t1','2023-01-01','2023-01-08')],calendar);
assert.equal(emptyValidation.status,'insufficient_data');
assert.equal(emptyValidation.insufficientReason,'empty_validation');

const emptyBoth=fixedCalendarSplit([],calendar);
assert.equal(emptyBoth.status,'insufficient_data');
assert.equal(emptyBoth.insufficientReason,'empty_train_and_validation');

function stageRows(stage,prefix,horizon=5){
  return [
    row(prefix+'1','2022-06-01','2022-06-08',{stage,horizon,index:10}),
    row(prefix+'2','2023-06-01','2023-06-08',{stage,horizon,index:20}),
    row(prefix+'3','2024-09-19','2024-09-25',{stage,horizon,index:30}), // purged
    row(prefix+'4','2024-10-01','2024-10-08',{stage,horizon,index:40}),
    row(prefix+'5','2025-06-01','2025-06-08',{stage,horizon,index:50})
  ];
}

const allStages=['Early Watch','Recovery','Attractive Growth','Established Move'];
const fullRaw=[];
for(const h of [5,20]){
  for(const stage of allStages){
    fullRaw.push(...stageRows(stage,stage.replace(/\s+/g,'_')+'_'+h+'_',h));
  }
}

function reportFor(rawEvents,batchIndex,horizons=[5,20]){
  return buildResearchReport({
    version:'test',generatedAt:'2026-09-27T00:00:00Z',batchIndex,batchCount:4,range:'5y',horizons,assumptions:{},
    validation:{method:'fixed calendar synthetic'},dataset:{id:'same'},symbols:['SYNTH'+batchIndex],rawEvents,
    surfaceReplayCandidates:[],recoverySurfaceReplayCandidates:[],attractiveGrowthSurfaceReplayCandidates:[],establishedMoveSurfaceReplayCandidates:[],
    latestPicks:[],finalTestStart:calendar.finalStart,openFinalTest:false,validationCalendar:calendar
  });
}

// Four symbol partitions with intentionally different coverage must retain identical dates.
const batchInputs=[
  fullRaw,
  fullRaw.filter((_,i)=>i%2===0),
  fullRaw.filter(x=>x.date>='2023-01-01'),
  fullRaw.filter(x=>x.date<'2025-01-01'||x.stage==='Recovery')
];
const reports=batchInputs.map((rows,i)=>reportFor(rows,i));

for(const report of reports){
  assert.deepEqual(
    {
      developmentStart:report.validation.calendar.developmentStart,
      validationStart:report.validation.calendar.validationStart,
      finalStart:report.validation.calendar.finalStart
    },
    calendar
  );
  for(const h of [5,20]){
    for(const stage of allStages){
      assert.deepEqual(report.horizons[h].byStage[stage].fold.calendar,calendar);
    }
  }
}

// Changing horizon must never move the experiment boundary.
for(const stage of allStages){
  assert.deepEqual(reports[0].horizons[5].byStage[stage].fold.calendar,reports[0].horizons[20].byStage[stage].fold.calendar);
}

// Variant filtering inside every diagnostic must retain the common calendar.
const ew=reports[0].horizons[5].byStage['Early Watch'];
for(const variant of Object.values(ew.rewriteDiagnostic.inclusion))assert.deepEqual(variant.fold,calendar);
for(const variant of Object.values(ew.rewriteDiagnostic.ranking))assert.deepEqual(variant.fold,calendar);

const recovery=reports[0].horizons[5].byStage['Recovery'];
for(const variant of Object.values(recovery.structureDiagnostic.variants))assert.deepEqual(variant.fold,calendar);
for(const variant of Object.values(recovery.structureDiagnostic.ranking))assert.deepEqual(variant.fold,calendar);

const growth=reports[0].horizons[5].byStage['Attractive Growth'];
for(const variant of Object.values(growth.riskDiagnostic.variants))assert.deepEqual(variant.fold,calendar);

// A heavily filtered variant cannot cause an overlapping date to switch partitions.
const commonObservation=row('common','2024-10-15','2024-10-22');
const dense=fixedCalendarSplit([row('old1','2022-01-01','2022-01-08'),commonObservation,row('late1','2025-01-01','2025-01-08')],calendar);
const filtered=fixedCalendarSplit([commonObservation],calendar);
assert.equal(dense.test.some(x=>x.id==='common'),true);
assert.equal(filtered.test.some(x=>x.id==='common'),true);
assert.deepEqual(dense.calendar,filtered.calendar);

console.log('Common fixed-calendar validation tests passed');


// Empty training data must never manufacture Top buckets from null thresholds.
const validationOnly=reportFor([row('vOnly','2025-01-01','2025-01-08')],0,[5]);
const ranking=validationOnly.horizons[5].byStage['Early Watch'].ranking;
assert.equal(ranking.fold.status,'insufficient_data');
assert.deepEqual(ranking.test,{Top:null,Middle:null,Lower:null});
assert.equal(ranking.highPriority.q80.test,null);

// Preserve a completed empty scan between appearances, plus horizon-specific maturity.
const scanCalendar=[
  ...['2025-06-02','2025-06-03','2025-06-04'].flatMap(date=>[5,20].map(horizon=>({date,horizon,outcomeDate:'2025-07-02'}))),
  {date:'2025-12-20',horizon:5,outcomeDate:'2025-12-29'},
  {date:'2025-12-20',horizon:20,outcomeDate:'2026-01-20'},
  {date:'2026-02-02',horizon:5,outcomeDate:'2026-02-09'},
  {date:'2020-01-02',horizon:5,outcomeDate:'2020-01-09'}
];
const candidates=['2025-06-02','2025-06-04'].map(date=>row('same',date,'2025-06-12'));
const replayReport=buildResearchReport({
 version:'test',batchIndex:0,batchCount:4,symbols:['same'],horizons:[5,20],validation:{},dataset:{},rawEvents:[],
 validationCalendar:calendar,finalTestStart:calendar.finalStart,openFinalTest:false,scanCalendar,
 surfaceReplayCandidates:candidates,recoverySurfaceReplayCandidates:candidates,
 attractiveGrowthSurfaceReplayCandidates:candidates,establishedMoveSurfaceReplayCandidates:candidates
});
for(const key of ['surfaceReplay','recoverySurfaceReplay','attractiveGrowthSurfaceReplay','establishedMoveSurfaceReplay']){
 const section=replayReport[key];
 assert.deepEqual(section.datesByHorizon[5],['2025-06-02','2025-06-03','2025-06-04','2025-12-20']);
 assert.deepEqual(section.datesByHorizon[20],['2025-06-02','2025-06-03','2025-06-04']);
 let previous=new Set(),episodes=0,zeroDays=0;
 for(const date of section.datesByHorizon[5]){
   const current=new Set(section.candidates.filter(x=>x.date===date).map(x=>x.symbol));
   if(!current.size)zeroDays++;
   for(const symbol of current)if(!previous.has(symbol))episodes++;
   previous=current;
 }
 assert.equal(episodes,2);
 assert.equal(zeroDays,2);
}
console.log('Empty-training and complete replay-calendar regressions passed');
