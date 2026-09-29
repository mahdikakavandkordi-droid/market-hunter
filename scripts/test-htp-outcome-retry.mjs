import fs from 'node:fs';
import assert from 'node:assert/strict';
import {canonicalObservations} from '../lib/healthy-trend-pullback-forward-store.js';
import {appendJsonlStrict,parseJsonl} from '../lib/healthy-trend-pullback-forward.js';

const workflow=fs.readFileSync('.github/workflows/htp-live-prospective.yml','utf8');
assert.doesNotMatch(workflow,/if:\s*steps\.precheck\.outputs\.complete\s*!=\s*'true'/,'completed daily capture must not skip outcome processing');
assert.match(workflow,/CAPTURE_WAS_COMPLETE/);
assert.match(workflow,/outcome reconciliation attempt/);
assert.match(workflow,/latest_collector_failure_count/);
assert.match(workflow,/canonical decisions already exist and remain immutable/);

const mkObs=(model,pick)=>({
  observationId:'v1|2026-09-28|'+model,
  model,modelVersion:'v1',marketAsOf:'2026-09-28',capturedAt:'2026-09-28T22:45:00Z',
  status:'complete_nonzero',
  picks:[{symbol:pick,pickObservationId:'v1|2026-09-28|'+model+'|'+pick}]
});
const first=[mkObs('core','RY.TO'),mkObs('trend_rs','TD.TO'),mkObs('early_watch','ENB.TO')];
const later=[mkObs('core','BMO.TO'),mkObs('trend_rs','BNS.TO'),mkObs('early_watch','CNQ.TO')];
const inputs=[
  {schemaVersion:2,snapshot:{sha256:'a',path:'snapshots/a.json.gz'},marketAsOf:'2026-09-28',observations:first},
  {schemaVersion:2,snapshot:{sha256:'b',path:'snapshots/b.json.gz'},marketAsOf:'2026-09-28',observations:later}
];
const canonical=canonicalObservations(inputs);
assert.deepEqual(canonical.map(x=>x.picks[0].symbol),['RY.TO','TD.TO','ENB.TO'],'later retries must not replace the first complete decisions');

const matured={
  outcomeId:'v1|2026-09-01|core|RY.TO',
  pickObservationId:'v1|2026-09-01|core|RY.TO',
  observationId:'v1|2026-09-01|core',
  model:'core',modelVersion:'v1',symbol:'RY.TO',status:'evaluated'
};
let journal=appendJsonlStrict('',[matured],x=>x.outcomeId);
assert.equal(journal.added.length,1,'a later retry can append a previously missing matured outcome');
journal=appendJsonlStrict(journal.text,[matured],x=>x.outcomeId);
assert.equal(journal.added.length,0,'the same outcome cannot be duplicated');
assert.equal(parseJsonl(journal.text).length,1);

console.log('PASS: outcome retries remain independent of immutable canonical daily decisions');
