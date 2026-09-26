import assert from 'node:assert/strict';
import {classify,rank,priorityBand,riskFlags,reviewLane,PRIORITY_FLOORS} from '../lib/market-hunter-v2-engine.js';

const base={
  weeklyUp:false,last:100,ma20:100,ma50:100,ma20Slope5:0,ma50Slope10:0,
  ret5:0,ret20:0,ret60:0,pullback60:-5,priorWeakness:false,advancedNearHigh:false,
  momentumShift:0,nearLow20:false,freshReclaimAge:null,sellingFading:false,
  downsideDecel:false,volumeShockNearLow:false,rs20:0,rs60:0,upDownVolumeRatio:1,
  higherLow:false,swingTrend:'Insufficient pivots',atr14Pct:2,dist20:0,rsi14:50
};
const m=x=>({...base,...x});

assert.equal(classify(m({
  weeklyUp:true,last:120,ma20:110,ma50:100,ma20Slope5:2,ma50Slope10:1,
  ret20:8,ret60:20,pullback60:-5
})),'Established Move');

assert.equal(classify(m({
  weeklyUp:true,last:112,ma20:108,ma50:100,ma20Slope5:1.5,ma50Slope10:-0.2,
  ret20:6,ret60:8,pullback60:-8
})),'Attractive Growth');

assert.equal(classify(m({
  priorWeakness:true,advancedNearHigh:false,last:99,ma20:100,ma50:104,
  ret5:2,ret20:-2,ret60:-8,momentumShift:3,pullback60:-10
})),'Recovery');

assert.equal(classify(m({
  priorWeakness:true,advancedNearHigh:false,nearLow20:true,ret5:-1,ret20:-7,
  freshReclaimAge:1,rs20:-2,pullback60:-14
})),'Early Watch');

assert.equal(classify(m({
  priorWeakness:true,advancedNearHigh:false,nearLow20:true,ret5:-1,ret20:-7,
  freshReclaimAge:1,rs20:-9,pullback60:-14
})),null);

assert.equal(classify(m({
  priorWeakness:true,advancedNearHigh:false,nearLow20:true,ret5:-1,ret20:-7,
  freshReclaimAge:null,sellingFading:true,pullback60:-14
})),null);

assert.equal(classify(m({
  priorWeakness:true,advancedNearHigh:false,nearLow20:true,ret5:-2,ret20:-8,
  freshReclaimAge:null,downsideDecel:true,volumeShockNearLow:true,pullback60:-14
})),'Early Watch');

assert.equal(classify(m({
  priorWeakness:true,advancedNearHigh:false,nearLow20:true,ret5:-2,ret20:-8,
  freshReclaimAge:null,sellingFading:false,downsideDecel:true,volumeShockNearLow:false
})),null);

for(const stage of ['Early Watch','Recovery','Attractive Growth','Established Move']){
  const score=rank(m({
    priorWeakness:true,nearLow20:true,downsideDecel:true,volumeShockNearLow:true,
    freshReclaimAge:1,sellingFading:true,momentumShift:3,rs20:4,rs60:8,
    upDownVolumeRatio:1.1,higherLow:true,swingTrend:'Structure improving',
    ma20Slope5:2,ma50Slope10:2,ret20:8,ret60:20,atr14Pct:3,dist20:2
  }),stage);
  assert.ok(Number.isFinite(score) && score>=0 && score<=100,stage+' rank must stay bounded');
}

for(const [stage,floor] of Object.entries(PRIORITY_FLOORS)){
  assert.equal(priorityBand(stage,floor.reviewFirst-0.1),'Stage Member');
  assert.equal(priorityBand(stage,floor.reviewFirst),'Review First');
}
assert.equal(priorityBand('Unknown',99),'Stage Member');

assert.equal(reviewLane('Attractive Growth',PRIORITY_FLOORS['Attractive Growth'].reviewFirst,m({dist20:8})),'High Intensity');
assert.equal(reviewLane('Established Move',PRIORITY_FLOORS['Established Move'].reviewFirst,m({rsi14:80})),'High Intensity');
assert.equal(reviewLane('Recovery',PRIORITY_FLOORS['Recovery'].reviewFirst,m({dist20:8})),'Review First');
assert.equal(reviewLane('Early Watch',PRIORITY_FLOORS['Early Watch'].reviewFirst,m({atr14Pct:7})),'Review First');

assert.deepEqual(
  riskFlags(m({dist20:11,rsi14:82,atr14Pct:6.5})),
  ['Very extended above MA20','Very high RSI','High ATR']
);
assert.deepEqual(riskFlags(m({dist20:5.9,rsi14:74.9,atr14Pct:5.9})),[]);

console.log('Market Hunter V2 contract tests passed');
