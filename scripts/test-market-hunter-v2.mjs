import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {referenceSession,quoteSessionIssue} from '../lib/scan-session-integrity.js';
import {classify,rank,surfaceRank,priorityBand,riskFlags,reviewLane,surfaceEligible,surfaceSelect,integratedSurfaceSelect,PRIORITY_FLOORS,SURFACE_POLICY,INTEGRATED_SURFACE_POLICY} from '../lib/market-hunter-v2-engine.js';

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

const recoveryBaseNoChase=rank(m({momentumShift:3,rs20:2,upDownVolumeRatio:1,higherLow:true,swingTrend:'Structure improving',atr14Pct:3,ret20:3}), 'Recovery');
assert.equal(surfaceRank(m({ret20:3}),'Recovery',recoveryBaseNoChase),recoveryBaseNoChase);
const recoveryBaseChase=rank(m({momentumShift:3,rs20:2,upDownVolumeRatio:1,higherLow:true,swingTrend:'Structure improving',atr14Pct:3,ret20:9}), 'Recovery');
assert.equal(surfaceRank(m({ret20:9}),'Recovery',recoveryBaseChase),Math.max(0,recoveryBaseChase-9));
assert.equal(surfaceRank(m({ret20:9}),'Early Watch',55),55);

for(const [stage,floor] of Object.entries(PRIORITY_FLOORS)){
  assert.equal(priorityBand(stage,floor.reviewFirst-0.1),'Stage Member');
  assert.equal(priorityBand(stage,floor.reviewFirst),'Review First');
}
assert.equal(priorityBand('Unknown',99),'Stage Member');

assert.equal(SURFACE_POLICY['Early Watch'].maxVisible,6);
assert.equal(SURFACE_POLICY['Recovery'].maxStageAge,2);
assert.equal(SURFACE_POLICY['Attractive Growth'].maxVisible,6);
assert.equal(SURFACE_POLICY['Established Move'].minScore,60);
assert.equal(surfaceEligible('Early Watch',PRIORITY_FLOORS['Early Watch'].reviewFirst-0.1),false);
assert.equal(surfaceEligible('Early Watch',PRIORITY_FLOORS['Early Watch'].reviewFirst),true);
assert.equal(surfaceEligible('Recovery',PRIORITY_FLOORS['Recovery'].reviewFirst,{stageAge:0}),true);
assert.equal(surfaceEligible('Recovery',PRIORITY_FLOORS['Recovery'].reviewFirst,{stageAge:2}),true);
assert.equal(surfaceEligible('Recovery',PRIORITY_FLOORS['Recovery'].reviewFirst,{stageAge:3}),false);
assert.equal(surfaceEligible('Recovery',PRIORITY_FLOORS['Recovery'].reviewFirst),false);
const surfaced=surfaceSelect('Early Watch',Array.from({length:9},(_,i)=>({symbol:'S'+i,score:70-i})));
assert.equal(surfaced.length,6);
assert.deepEqual(surfaced.map(x=>x.symbol),['S0','S1','S2','S3','S4','S5']);
const recoverySurfaced=surfaceSelect('Recovery',[
  {symbol:'A',score:60,surfaceScore:45,stageAge:0},
  {symbol:'B',score:55,surfaceScore:54,stageAge:1},
  {symbol:'C',score:58,surfaceScore:57,stageAge:2},
  {symbol:'D',score:80,surfaceScore:79,stageAge:3}
]);
assert.deepEqual(recoverySurfaced.map(x=>x.symbol),['C','B','A']);
const attractiveSurfaced=surfaceSelect('Attractive Growth',[
  {symbol:'A',score:70},
  {symbol:'B',score:60},
  {symbol:'C',score:52.2},
  {symbol:'D',score:80},
  {symbol:'E',score:75},
  {symbol:'F',score:65},
  {symbol:'G',score:64},
  {symbol:'H',score:63}
]);
assert.deepEqual(attractiveSurfaced.map(x=>x.symbol),['D','E','A','F','G','H']);
assert.equal(surfaceEligible('Established Move',59.9,{stageAge:0}),false);
assert.equal(surfaceEligible('Established Move',60,{stageAge:0}),true);
const establishedSurfaced=surfaceSelect('Established Move',[
  {symbol:'A',score:68},{symbol:'B',score:61.6},{symbol:'C',score:59.9},{symbol:'D',score:70},
  {symbol:'E',score:65},{symbol:'F',score:64},{symbol:'G',score:63},{symbol:'H',score:62}
]);
assert.deepEqual(establishedSurfaced.map(x=>x.symbol),['D','A','E','F','G','H']);
assert.equal(INTEGRATED_SURFACE_POLICY.maxVisible,6);
assert.deepEqual(INTEGRATED_SURFACE_POLICY.stageOrder,['Early Watch','Recovery','Attractive Growth','Established Move']);
const integrated=integratedSurfaceSelect({
  'Early Watch':[{symbol:'E1',score:1},{symbol:'E2',score:999},{symbol:'E3',score:500}],
  'Recovery':[{symbol:'R1',score:1},{symbol:'R2',score:1}],
  'Attractive Growth':[{symbol:'A1',score:99},{symbol:'A2',score:98}],
  'Established Move':[{symbol:'M1',score:100},{symbol:'M2',score:99}]
});
assert.deepEqual(integrated.map(x=>x.symbol),['E1','R1','A1','M1','E2','R2']);
assert.deepEqual(integrated.map(x=>x.integratedRank),[1,2,3,4,5,6]);
assert.equal(integrated.length,6);

assert.equal(reviewLane('Attractive Growth',PRIORITY_FLOORS['Attractive Growth'].reviewFirst,m({dist20:8})),'High Intensity');
assert.equal(reviewLane('Established Move',PRIORITY_FLOORS['Established Move'].reviewFirst,m({rsi14:80})),'High Intensity');
assert.equal(reviewLane('Recovery',PRIORITY_FLOORS['Recovery'].reviewFirst,m({dist20:8})),'Review First');
assert.equal(reviewLane('Early Watch',PRIORITY_FLOORS['Early Watch'].reviewFirst,m({atr14Pct:7})),'Review First');

assert.deepEqual(
  riskFlags(m({dist20:11,rsi14:82,atr14Pct:6.5})),
  ['Very extended above MA20','Very high RSI','High ATR']
);
assert.deepEqual(riskFlags(m({dist20:5.9,rsi14:74.9,atr14Pct:5.9})),[]);

assert.throws(()=>referenceSession([]),/completed_reference_session_unavailable/);
const sessionRows=date=>[{t:Date.parse(date+'T20:00:00Z')/1000}];
assert.equal(quoteSessionIssue(sessionRows('2026-10-06'),'2026-10-06'),null);
assert.equal(quoteSessionIssue(sessionRows('2026-08-11'),'2026-10-06').sourceDate,'2026-08-11');
assert.equal(quoteSessionIssue(sessionRows('2026-10-07'),'2026-10-06').reason,'session_mismatch');

// Exercise the real scanner with isolated provider fixtures, never production files.
const fixtureDir=fs.mkdtempSync(path.join(os.tmpdir(),'hunter-session-'));
try{
  fs.mkdirSync(path.join(fixtureDir,'data'));
  const preload=path.join(fixtureDir,'provider.mjs');
  fs.writeFileSync(preload,`globalThis.fetch=async url=>{
    const symbol=decodeURIComponent(new URL(url).pathname.split('/').at(-1));
    if(process.env.FIXTURE_NO_BENCH==='1'&&symbol==='^GSPTSE')return {ok:false,status:503};
    const end=Date.parse((symbol==='ARX.TO'?'2026-08-11':'2026-10-06')+'T20:00:00Z')/1000;
    const timestamp=Array.from({length:200},(_,i)=>end-(199-i)*86400);
    const close=timestamp.map((_,i)=>50+i);
    return {ok:true,json:async()=>({chart:{result:[{timestamp,meta:{},indicators:{quote:[{
      close,high:close.map(x=>x+1),low:close.map(x=>x-1),volume:close.map(()=>3000000)
    }]}}]}})};
  };`);
  const run=env=>spawnSync(process.execPath,['--import',preload,fileURLToPath(new URL('./scan-market-hunter-v2.mjs',import.meta.url))],{cwd:fixtureDir,env:{...process.env,...env},encoding:'utf8',timeout:60000});
  const good=run({});
  assert.equal(good.status,0,good.stderr);
  const output=path.join(fixtureDir,'data/v2-latest-scan.json');
  const saved=fs.readFileSync(output,'utf8'),report=JSON.parse(saved);
  assert.equal(report.marketAsOf,'2026-10-06');
  assert.ok(report.all.length>0);
  assert.ok(report.all.every(x=>x.date==='2026-10-06'&&x.symbol!=='ARX.TO'));
  assert.deepEqual(report.sessionIntegrity.exclusions,[{symbol:'ARX.TO',reason:'session_mismatch',sourceDate:'2026-08-11',expectedSession:'2026-10-06'}]);
  const missing=run({FIXTURE_NO_BENCH:'1'});
  assert.notEqual(missing.status,0);
  assert.match(missing.stderr,/completed_reference_session_unavailable/);
  assert.equal(fs.readFileSync(output,'utf8'),saved,'failed reference fetch must preserve the published snapshot');
}finally{fs.rmSync(fixtureDir,{recursive:true,force:true});}

console.log('Market Hunter V2 contract and session-integrity tests passed');
