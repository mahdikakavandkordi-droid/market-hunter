import assert from 'node:assert/strict';
import '../hunter-discovery.js';
import {industryContext} from '../lib/industry-context.js';
const {build}=globalThis.MarketHunterDiscovery;
const good={symbol:'A',market:'CA',currency:'CAD',date:'2026-10-28',sector:'Technology',price:10,ret20:2,rs20:1,dist50:3,dist20:2,rsi14:55,atr14Pct:2,lowBroken:false,riskFlags:[]};
const report=rows=>({market:'CA',currency:'CAD',marketAsOf:good.date,universeRows:rows,industryContext:industryContext(rows,[...rows,{symbol:'missing',sector:'Energy'}],good.date)});
const r=report(Array.from({length:101},(_,i)=>({...good,symbol:'A'+i}))),before=JSON.stringify(r);
assert.equal(build(r).selected.length,101);assert.equal(JSON.stringify(r),before);
assert.equal(build(report([{...good,rs20:-1}])).selected.length,0);
assert.equal(build(report([{...good,momentumShift:-3}])).selected.length,1);
assert.equal(build(report([{...good,sector:'CDR'}])).industries.at(-1).sector,'Unmapped');
assert.equal(build(r).industries.find(x=>x.sector==='Energy').selected.length,0);
for(const patch of [{ret20:0},{dist50:0},{lowBroken:true},{lowBroken:null},{riskFlags:['High ATR']},{riskFlags:null},{atr14Pct:null},{rsi14:null},{price:NaN}])assert.equal(build(report([{...good,...patch}])).selected.length,0,JSON.stringify(patch));
for(const rows of [[{...good,date:'2026-10-27'}],[good,good],[{...good,currency:'USD'}]])assert.equal(build({...r,universeRows:rows}).status,'unavailable');
assert.equal(build({}).status,'unavailable');assert.equal(build(report([])).status,'no_usable_data');
console.log('Discovery: uncapped, zero, missing metrics, identity, unmapped sectors and immutability passed');
const recovery={...good,stage:'Recovery',swingTrend:'Structure improving',momentumShift:1};
const watch={...recovery,symbol:'E',stage:'Early Watch',rs20:-3,maxRvol5:1.5};
const focused=(recoveries,watches)=>globalThis.MarketHunterDiscovery.focusedReview({
 ...report([]),surfacePicks:{Recovery:recoveries,'Early Watch':watches}
});
assert.deepEqual(focused([recovery,{...recovery,symbol:'B'}],[watch]).selected,[recovery,{...recovery,symbol:'B'},watch]);
for(const patch of [{date:'old'},{market:'US'},{momentumShift:null},{rs20:0},{dist20:-0.19},{riskFlags:['Extended']},{lowBroken:true},{swingTrend:'Lower highs + lower lows'}]){
 assert.deepEqual(focused([{...recovery,...patch}],[]).selected,[]);
}
assert.deepEqual(focused([], [{...watch,maxRvol5:1.49}]).selected,[]);
assert.deepEqual(focused([recovery],[{...watch,symbol:recovery.symbol}]).selected,[recovery]);
assert.equal(globalThis.MarketHunterDiscovery.focusedReview(report([])).available,false);

const uncapped=Array.from({length:9},(_,i)=>({...recovery,symbol:'R'+i,score:60-i,stageAge:0,priorityBand:'Review First'}));
const full={...report([]),surfacePicks:{Recovery:uncapped.slice(0,6),'Early Watch':[watch]},
 byStage:{Recovery:[...uncapped,{...uncapped[0],symbol:'stale',stageAge:3}]},
 surfacePolicy:{Recovery:{requiredBand:'Review First',maxStageAge:2}}};
assert.equal(globalThis.MarketHunterDiscovery.focusedReview(full).selected.length,10);
assert.deepEqual(full.byStage.Recovery.slice(0,9),uncapped);
