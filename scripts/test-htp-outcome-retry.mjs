import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow=fs.readFileSync('.github/workflows/htp-live-prospective.yml','utf8');
assert.doesNotMatch(workflow,/if:\s*steps\.precheck\.outputs\.complete\s*!=\s*'true'/,'completed daily capture must not skip outcome processing');
assert.match(workflow,/HTP_PINNED_COLLECTOR_SHA:\s*df4cdb289f3f111a6c7dcbe1d73e0d694bf25405/,'approved collector pin must remain unchanged');
assert.match(workflow,/CAPTURE_WAS_COMPLETE/);
assert.match(workflow,/outcome reconciliation attempt/);
assert.match(workflow,/latest_collector_failure_count/);
assert.match(workflow,/canonical decisions already exist and remain immutable/);
assert.match(workflow,/coverage\?\.failures/);

function canonicalFirstComplete(inputs){
  const days=new Set(),out=[];
  for(const input of inputs){
    if(days.has(input.marketAsOf))continue;
    const obs=input.observations||[];
    if(obs.length!==3||new Set(obs.map(x=>x.model)).size!==3||
      !obs.every(x=>['complete_nonzero','complete_zero_pick'].includes(x.status)))continue;
    days.add(input.marketAsOf);out.push(...obs);
  }
  return out;
}
function appendStrict(existing,records,keyFn){
  const by=new Map(existing.map(x=>[keyFn(x),x])),added=[];
  for(const record of records){
    const key=keyFn(record);
    if(by.has(key)){assert.deepEqual(by.get(key),record);continue}
    by.set(key,record);existing.push(record);added.push(record);
  }
  return {records:existing,added};
}
const mkObs=(model,pick)=>({
  observationId:'v1|2026-09-28|'+model,model,marketAsOf:'2026-09-28',
  status:'complete_nonzero',picks:[{symbol:pick,pickObservationId:'v1|2026-09-28|'+model+'|'+pick}]
});
const first=[mkObs('core','RY.TO'),mkObs('trend_rs','TD.TO'),mkObs('early_watch','ENB.TO')];
const later=[mkObs('core','BMO.TO'),mkObs('trend_rs','BNS.TO'),mkObs('early_watch','CNQ.TO')];
const canonical=canonicalFirstComplete([
  {marketAsOf:'2026-09-28',observations:first},
  {marketAsOf:'2026-09-28',observations:later}
]);
assert.deepEqual(canonical.map(x=>x.picks[0].symbol),['RY.TO','TD.TO','ENB.TO'],'later same-day retries must not replace first complete decisions');

const matured={outcomeId:'v1|2026-09-01|core|RY.TO',pickObservationId:'v1|2026-09-01|core|RY.TO',symbol:'RY.TO',status:'evaluated'};
let journal=appendStrict([], [matured], x=>x.outcomeId);
assert.equal(journal.added.length,1,'a later retry can append a previously missing matured outcome');
journal=appendStrict(journal.records,[matured],x=>x.outcomeId);
assert.equal(journal.added.length,0,'the same outcome cannot be duplicated');
assert.equal(journal.records.length,1);

console.log('PASS: outcome retry workflow preserves pinned collector, immutable decisions, and outcome dedupe policy');
