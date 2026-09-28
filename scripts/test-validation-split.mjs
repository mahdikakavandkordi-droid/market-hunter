import assert from 'node:assert/strict';
import {purgedChronSplit} from '../lib/validation-split.js';

const rows=[
  {id:'a',date:'2026-01-01',outcomeDate:'2026-01-03'},
  {id:'b',date:'2026-01-02',outcomeDate:'2026-01-04'},
  {id:'c',date:'2026-01-03',outcomeDate:'2026-01-06'},
  {id:'d',date:'2026-01-04',outcomeDate:'2026-01-08'},
  {id:'e',date:'2026-01-05',outcomeDate:'2026-01-09'},
  {id:'f',date:'2026-01-06',outcomeDate:'2026-01-07'},
  {id:'g',date:'2026-01-07',outcomeDate:'2026-01-08'},
  {id:'h',date:'2026-01-08',outcomeDate:'2026-01-10'},
  {id:'i',date:'2026-01-09',outcomeDate:'2026-01-11'},
  {id:'j',date:'2026-01-10',outcomeDate:'2026-01-12'}
];
const s=purgedChronSplit(rows,.7);
assert.equal(s.cut,'2026-01-08');
assert.deepEqual(s.train.map(x=>x.id),['a','b','c','f']);
assert.deepEqual(s.test.map(x=>x.id),['h','i','j']);
assert.equal(s.prePurgeTrainCount,7);
assert.equal(s.purgedTrainCount,3);
assert.equal(s.missingOutcomeCount,0);
assert.ok(s.train.every(x=>x.outcomeDate<s.cut));
assert.ok(s.test.every(x=>x.date>=s.cut));

const missing=purgedChronSplit([
  {id:'x',date:'2026-01-01',outcomeDate:'2026-01-02'},
  {id:'y',date:'2026-01-02'},
  {id:'z',date:'2026-01-03',outcomeDate:'2026-01-04'}
],.67);
assert.equal(missing.cut,'2026-01-03');
assert.equal(missing.missingOutcomeCount,1);
assert.deepEqual(missing.train.map(x=>x.id),['x']);

console.log('Purged chronological split tests passed');


import {sealedChronSplit} from '../lib/validation-split.js';

const sealedRows=[
  {id:'a',date:'2025-01-01',outcomeDate:'2025-01-05'},
  {id:'b',date:'2025-02-01',outcomeDate:'2025-02-05'},
  {id:'c',date:'2025-03-01',outcomeDate:'2025-04-10'},
  {id:'d',date:'2025-04-01',outcomeDate:'2025-04-05'},
  {id:'e',date:'2025-05-01',outcomeDate:'2025-05-05'},
  {id:'f',date:'2025-06-01',outcomeDate:'2026-01-03'},
  {id:'g',date:'2025-12-20',outcomeDate:'2026-01-10'},
  {id:'h',date:'2026-01-05',outcomeDate:'2026-01-15'},
  {id:'i',date:'2026-02-05',outcomeDate:'2026-02-15'}
];
const z=sealedChronSplit(sealedRows,{trainFraction:.6,finalStart:'2026-01-01'});
assert.equal(z.finalStart,'2026-01-01');
assert.deepEqual(z.final.map(x=>x.id),['h','i']);
assert.equal(z.finalBoundaryPurgedCount,2);
assert.ok(!z.train.some(x=>['f','g','h','i'].includes(x.id)));
assert.ok(!z.test.some(x=>['f','g','h','i'].includes(x.id)));
assert.ok(z.train.every(x=>x.outcomeDate<z.cut));
assert.ok(z.test.every(x=>x.outcomeDate<'2026-01-01'));
console.log('Sealed final-period split tests passed');
