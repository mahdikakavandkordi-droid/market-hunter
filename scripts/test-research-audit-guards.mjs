import assert from 'node:assert/strict';
import {assertHistoricalFinalSealedReport} from '../lib/research-audit-guards.js';

assert.equal(assertHistoricalFinalSealedReport({validation:{finalTestOpened:false}}),true);
for(const [label,value] of [
  ['missing',undefined],['null',null],['string','false'],['true',true]
]){
  const report=value===undefined?{validation:{}}:{validation:{finalTestOpened:value}};
  assert.throws(()=>assertHistoricalFinalSealedReport(report,label),/finalTestOpened === false/);
}
assert.throws(
  ()=>assertHistoricalFinalSealedReport({validation:{finalTestOpened:false},finalEvaluation:{opened:true}},'payload'),
  /Historical Final evaluation/
);
console.log('Strict Historical Final metadata guard regression tests passed');
