import assert from 'node:assert/strict';
import {
  confirmedCoverage,selectedByConfirmedDate,firstSurfaceEpisodes,attachSplitStatus
} from '../lib/early-watch-episodes.js';

const calendar={
  developmentStart:'2024-01-01',
  validationStart:'2024-01-03',
  finalStart:'2024-01-10'
};

// 2024-01-02 is missing from one batch => partial coverage, not a genuine absence.
// 2024-01-04 is confirmed and has zero picks => genuine absence/reset.
const lists=[
  ['2024-01-01','2024-01-02','2024-01-03','2024-01-04','2024-01-05'],
  ['2024-01-01','2024-01-02','2024-01-03','2024-01-04','2024-01-05'],
  ['2024-01-01','2024-01-03','2024-01-04','2024-01-05'],
  ['2024-01-01','2024-01-02','2024-01-03','2024-01-04','2024-01-05']
];
const coverage=confirmedCoverage(lists);
assert.deepEqual(coverage.confirmedDates,['2024-01-01','2024-01-03','2024-01-04','2024-01-05']);
assert.deepEqual(coverage.partialCoverageDates,['2024-01-02']);

const candidates=[
  {symbol:'AAA.TO',date:'2024-01-01',outcomeDate:'2024-01-03',horizon:5,score:10,forwardReturn:1,benchmarkReturn:.2,excessReturn:.8,mae:-1,mfe:2},
  // Same symbol remains selected on first Validation confirmed session.
  // Because episodes are built before split assignment, this MUST NOT create a new episode.
  {symbol:'AAA.TO',date:'2024-01-03',outcomeDate:'2024-01-08',horizon:5,score:10,forwardReturn:2,benchmarkReturn:.5,excessReturn:1.5,mae:-1,mfe:3},
  // 2024-01-04 is intentionally confirmed zero-pick.
  {symbol:'AAA.TO',date:'2024-01-05',outcomeDate:'2024-01-09',horizon:5,score:10,forwardReturn:3,benchmarkReturn:.4,excessReturn:2.6,mae:-1,mfe:4}
];

const {selectedByDate}=selectedByConfirmedDate({
  candidates,confirmedDates:coverage.confirmedDates,maxVisible:6
});
const episodes=firstSurfaceEpisodes({
  confirmedDates:coverage.confirmedDates,
  selectedByDate,
  horizon:5,
  benchmarkForSymbol:()=>'^GSPTSE'
});

assert.equal(episodes.length,2,'partial coverage or split boundary incorrectly reset an episode');
assert.equal(episodes[0].firstSurfaceDate,'2024-01-01');
assert.equal(episodes[1].firstSurfaceDate,'2024-01-05','confirmed zero-pick session should reset episode continuity');
assert.ok(!episodes.some(x=>x.firstSurfaceDate==='2024-01-03'),'split boundary created a false episode');

const classified=attachSplitStatus(episodes,calendar);
const first=classified.find(x=>x.firstSurfaceDate==='2024-01-01');
const second=classified.find(x=>x.firstSurfaceDate==='2024-01-05');
assert.equal(first.split,'Development');
assert.equal(first.included,false);
assert.equal(first.exclusionReason,'validation_boundary_outcome_purge');
assert.equal(second.split,'Validation');
assert.equal(second.included,true);
assert.equal(second.exclusionReason,null);

console.log('Early Watch episode boundary/coverage regression tests passed');
