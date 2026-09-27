import assert from 'node:assert/strict';
import {buildResearchReport,partitionResearchRows} from '../lib/backtest-report-builder.js';

const finalStart='2026-01-01';
const stages=['Early Watch','Recovery','Attractive Growth','Established Move'];

function features(stage){
  return {
    rs20:1,rs60:2,upDownVolumeRatio:1,higherLow:true,swingTrend:'Structure improving',atr14Pct:3,
    freshReclaimAge:1,sellingFading:true,downsideDecel:true,volumeShockNearLow:true,momentumShift:2,
    highBroken:true,freshHighBreakAge:1,dist20:1,ret20:5,ret60:15,ma20Slope5:1,ma50Slope10:1,rsi14:55
  };
}
function event({symbol,date,outcomeDate,stage,horizon=5,value=1,index=1}){
  return {
    symbol,date,outcomeDate,stage,horizon,sessionIndex:index,rankScore:100,features:features(stage),
    forwardReturn:value,benchmarkReturn:0,excessReturn:value,mae:-1,mfe:value,hitPlus7:value>=7,hitMinus7:value<=-7
  };
}

const raw=[];
let idx=1;
for(const stage of stages){
  for(let m=1;m<=10;m++){
    const mm=String(m).padStart(2,'0');
    raw.push(event({symbol:'DEV_'+stage+'_'+m,date:'2025-'+mm+'-01',outcomeDate:'2025-'+mm+'-05',stage,value:1,index:idx++}));
  }
  raw.push(event({symbol:'CROSS_'+stage,date:'2025-12-20',outcomeDate:'2026-01-05',stage,value:777,index:idx++}));
  raw.push(event({symbol:'FINAL_'+stage,date:'2026-02-01',outcomeDate:'2026-02-05',stage,value:999,index:idx++}));
}
raw.push({...event({symbol:'INVALID_DATE',date:'2025-01-01',outcomeDate:'2025-01-05',stage:'Early Watch',value:555,index:idx++}),date:'bad'});
raw.push({...event({symbol:'INVALID_OUTCOME',date:'2025-01-01',outcomeDate:'2025-01-05',stage:'Early Watch',value:556,index:idx++}),outcomeDate:null});

const replayBase=stage=>[
  event({symbol:'REPLAY_DEV_'+stage,date:'2025-06-01',outcomeDate:'2025-06-06',stage,value:1,index:1}),
  event({symbol:'REPLAY_CROSS_'+stage,date:'2025-12-28',outcomeDate:'2026-01-02',stage,value:777,index:2}),
  event({symbol:'REPLAY_FINAL_'+stage,date:'2026-03-01',outcomeDate:'2026-03-06',stage,value:999,index:3}),
  {...event({symbol:'REPLAY_INVALID_'+stage,date:'2025-06-01',outcomeDate:'2025-06-06',stage,value:555,index:4}),outcomeDate:'bad'}
];

const baseArgs={
  version:'test',generatedAt:'2026-09-27T00:00:00Z',batchIndex:0,batchCount:4,range:'5y',horizons:[5],assumptions:{},
  validation:{method:'test'},dataset:{id:'same'},symbols:['SYNTH'],rawEvents:raw,
  surfaceReplayCandidates:replayBase('Early Watch'),
  recoverySurfaceReplayCandidates:replayBase('Recovery'),
  attractiveGrowthSurfaceReplayCandidates:replayBase('Attractive Growth'),
  establishedMoveSurfaceReplayCandidates:replayBase('Established Move'),
  latestPicks:[{symbol:'FINAL_LATEST_SENTINEL',date:'2026-09-25',score:1,ret5:999,ret20:777}],finalTestStart:finalStart,
  validationCalendar:{developmentStart:'2021-09-27',validationStart:'2024-09-20',finalStart}
};

const closed=buildResearchReport({...baseArgs,openFinalTest:false});
assert.equal(closed.validation.finalTestOpened,false);
assert.deepEqual(closed.latestPicks,[]);
assert.equal('finalEvaluation' in closed,false);
assert.equal(closed.validation.outputBoundary.rawEvents.finalCount,4);
assert.equal(closed.validation.outputBoundary.rawEvents.crossingCount,4);
assert.equal(closed.validation.outputBoundary.rawEvents.invalidCount,2);
assert.equal(closed.horizons[5].overall.mean,1);
for(const stage of stages){
  assert.equal(closed.horizons[5].byStage[stage].overall.mean,1);
  assert.equal(closed.horizons[5].byStage[stage].scope,'development');
}
for(const key of ['surfaceReplay','recoverySurfaceReplay','attractiveGrowthSurfaceReplay','establishedMoveSurfaceReplay']){
  assert.equal(closed[key].scope,'development');
  assert.deepEqual(closed[key].candidates.map(x=>x.symbol),['REPLAY_DEV_'+(
    key==='surfaceReplay'?'Early Watch':
    key==='recoverySurfaceReplay'?'Recovery':
    key==='attractiveGrowthSurfaceReplay'?'Attractive Growth':'Established Move'
  )]);
  assert.equal(closed[key].exclusions.finalCount,1);
  assert.equal(closed[key].exclusions.crossingCount,1);
  assert.equal(closed[key].exclusions.invalidCount,1);
}

const serialized=JSON.stringify(closed);
for(const forbidden of ['FINAL_','CROSS_','REPLAY_FINAL_','REPLAY_CROSS_','999','777','555','556']){
  assert.equal(serialized.includes(forbidden),false,'closed report leaked sentinel '+forbidden);
}

const mutated=raw.map(x=>x.symbol.startsWith('FINAL_')?{...x,forwardReturn:-999,excessReturn:-999,mfe:-999}:x);
const closedMutated=buildResearchReport({...baseArgs,rawEvents:mutated,openFinalTest:false});
assert.deepEqual(closedMutated.horizons,closed.horizons);
assert.deepEqual(closedMutated.validation.outputBoundary,closed.validation.outputBoundary);

const open=buildResearchReport({...baseArgs,openFinalTest:true});
assert.equal(open.validation.finalTestOpened,true);
assert.ok(open.finalEvaluation);
assert.equal(open.finalEvaluation.horizons[5].overall.mean,999);
assert.equal(JSON.stringify(open.surfaceReplay).includes('999'),false);

const p=partitionResearchRows([
  event({symbol:'OK',date:'2025-01-01',outcomeDate:'2025-01-02',stage:'Early Watch'}),
  event({symbol:'BAD_ORDER',date:'2025-01-03',outcomeDate:'2025-01-02',stage:'Early Watch'})
],finalStart);
assert.equal(p.counts.invalidOrderCount,1);

console.log('Final-period output isolation integration tests passed');

