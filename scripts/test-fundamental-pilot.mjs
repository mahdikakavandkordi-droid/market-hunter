import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PILOT, buildSnapshot, chooseFiling, narrative, replaceCompleteSnapshot } from '../lib/fundamental-pilot.mjs';

const asOf = '2026-10-08T10:17:56Z';
const retrievedAt = '2026-10-08T10:30:00Z';
const inputs = PILOT.map(spec => ({ ...JSON.parse(fs.readFileSync(`tests/fixtures/fundamental-pilot/${spec.symbol.split('.')[0]}.json`)), spec, asOf, retrievedAt }));
const clone = value => structuredClone(value);
let count = 0;
function test(name, run) { run(); count++; console.log(`PASS ${name}`); }
const original = buildSnapshot(inputs[0]);

test('Four real fixtures reconcile core USD values against original filings', () => {
  for (const input of inputs) {
    const snapshot = buildSnapshot(input);
    assert.equal(snapshot.status, 'complete');
    for (const key of ['revenue', 'operatingIncome', 'operatingCash', 'cash']) {
      const fact = snapshot.metrics[key];
      assert.equal(fact.status, 'verified');
      assert.equal(fact.unit, 'USD');
      assert.ok(fact.reconciliation.inlineFactId);
      assert.equal(fact.accession, snapshot.filing.accession);
    }
  }
});
test('Wrong company CIK and look-alike name are rejected', () => {
  const input = clone(inputs[0]); input.facts.cik = 1326801;
  assert.throws(() => buildSnapshot(input), /identity/);
  input.facts.cik = inputs[0].facts.cik; input.submissions.name = 'Bausch + Lomb';
  assert.throws(() => buildSnapshot(input), /identity/);
});
test('No CAD fact is substituted for missing USD revenue', () => {
  const input = clone(inputs[0]); const units = input.facts.facts['us-gaap'].RevenueFromContractWithCustomerExcludingAssessedTax.units;
  units.CAD = units.USD; delete units.USD;
  assert.equal(buildSnapshot(input).metrics.revenue.status, 'missing');
  assert.equal(buildSnapshot(input).status, 'partial');
});
test('Quarter revenue cannot be replaced by YTD revenue', () => {
  const input = clone(inputs[0]); const entry = input.facts.facts['us-gaap'].RevenueFromContractWithCustomerExcludingAssessedTax;
  entry.units.USD = entry.units.USD.filter(fact => fact.start !== '2026-04-01');
  assert.equal(buildSnapshot(input).metrics.revenue.status, 'missing');
});
test('Cash-flow YTD stays six-month and Microsoft remains annual', () => {
  assert.equal(original.metrics.operatingCash.periodStart, '2026-01-01');
  assert.equal(original.metrics.revenue.periodStart, '2026-04-01');
  const microsoft = buildSnapshot(inputs[3]);
  assert.equal(microsoft.financialPeriod.basis, 'fiscal-year');
  assert.equal(microsoft.metrics.revenue.periodStart, '2025-07-01');
  assert.match(narrative(microsoft).uncertainty, /not Q4-only/);
});
test('SSRM total and continuing-operation results retain separate evidence', () => {
  const snapshot = buildSnapshot(inputs[1]);
  assert.equal(snapshot.metrics.netIncome.value, 97286000);
  assert.equal(snapshot.metrics.continuingNetIncome.value, 137014000);
  assert.notEqual(snapshot.metrics.operatingCash.value, snapshot.metrics.continuingOperatingCash.value);
});
test('Conflicting duplicate values block a metric; exact duplicates do not', () => {
  const input = clone(inputs[0]); const rows = input.facts.facts['us-gaap'].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD;
  const fact = rows.find(f => f.start === '2026-04-01' && f.end === '2026-06-30');
  rows.push(clone(fact)); assert.equal(buildSnapshot(input).status, 'complete');
  rows.push({ ...fact, val: fact.val + 1 });
  assert.equal(buildSnapshot(input).metrics.revenue.status, 'conflict');
});
test('Non-finite, null and numeric-string facts are rejected', () => {
  for (const invalid of [null, '', '2852000000', NaN, Infinity]) {
    const input = clone(inputs[0]); const rows = input.facts.facts['us-gaap'].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD;
    rows.find(f => f.start === '2026-04-01' && f.end === '2026-06-30').val = invalid;
    assert.equal(buildSnapshot(input).status, 'partial');
  }
});
test('Actual zero remains a verified number', () => {
  const input = clone(inputs[0]); const fact = input.facts.facts['us-gaap'].CashAndCashEquivalentsAtCarryingValue.units.USD.find(f => f.end === '2026-06-30');
  fact.val = 0;
  input.proofs.facts.filter(p => p.tag === 'us-gaap:CashAndCashEquivalentsAtCarryingValue' && p.end === fact.end).forEach(p => p.value = 0);
  assert.equal(buildSnapshot(input).metrics.cash.value, 0);
  assert.equal(buildSnapshot(input).metrics.cash.status, 'verified');
});
test('Missing, altered or wrong-accession original proof cannot verify', () => {
  for (const change of [i => { delete i.proofs; }, i => { i.proofs.accession = '0000885590-26-000999'; }, i => { i.proofs.sha256 = ''; }, i => { i.proofs.facts.forEach(p => p.value += 1); }]) {
    const input = clone(inputs[0]); change(input);
    assert.equal(buildSnapshot(input).status, 'partial');
  }
});
test('Conflicting original-document values are blocked', () => {
  const input = clone(inputs[0]); const proof = input.proofs.facts.find(p => p.tag.endsWith(':RevenueFromContractWithCustomerExcludingAssessedTax') && p.start === '2026-04-01' && p.end === '2026-06-30');
  input.proofs.facts.push({ ...proof, value: proof.value + 1 });
  assert.equal(buildSnapshot(input).metrics.revenue.status, 'conflict');
});
test('Intraday as-of cutoff uses acceptance time, not only filing date', () => {
  const input = inputs[0]; const before = '2026-07-30T20:11:32Z';
  const filing = chooseFiling(input.submissions, input.spec, before);
  assert.notEqual(filing.reportDate, '2026-06-30');
  assert.equal(chooseFiling(input.submissions, input.spec, '2026-07-30T20:11:33Z').reportDate, '2026-06-30');
});
test('Future acceptance and report date never become eligible', () => {
  const input = clone(inputs[0]); const r = input.submissions.filings.recent;
  r.acceptanceDateTime[0] = '2027-01-01T00:00:00Z';
  assert.notEqual(chooseFiling(input.submissions, input.spec, asOf).reportDate, '2026-06-30');
  r.acceptanceDateTime[0] = '2026-07-30T20:11:33Z'; r.reportDate[0] = '2027-06-30';
  assert.notEqual(chooseFiling(input.submissions, input.spec, asOf).reportDate, '2027-06-30');
});
test('Amended selected filings require review', () => {
  const input = clone(inputs[0]); input.submissions.filings.recent.form[0] = '10-Q/A';
  assert.throws(() => chooseFiling(input.submissions, input.spec, asOf), /Amended/);
});
test('Invalid timestamps and unexpected reporting periods fail closed', () => {
  assert.throws(() => buildSnapshot({ ...inputs[0], asOf: '2026-10-08' }), /timestamp/);
  assert.throws(() => buildSnapshot({ ...inputs[0], retrievedAt: '2026-01-01T00:00:00Z' }), /retrieval/);
  const input = clone(inputs[0]); input.submissions.filings.recent.reportDate[0] = '2026-09-30';
  assert.throws(() => buildSnapshot(input), /reporting period/);
});
test('Partial and older attempts preserve last complete snapshot', () => {
  const partial = { ...original, status: 'partial' };
  assert.equal(replaceCompleteSnapshot(original, partial).current, original);
  assert.equal(replaceCompleteSnapshot(null, partial).current, null);
  const older = { ...original, filing: { ...original.filing, reportDate: '2026-03-31' } };
  assert.equal(replaceCompleteSnapshot(original, older).current, original);
  assert.throws(() => replaceCompleteSnapshot(original, { ...original, symbol: 'META.TO' }), /issuer/);
});
test('Bilingual output uses two monitors, shared metric evidence and CDR context', () => {
  for (const input of inputs) {
    const snapshot = buildSnapshot(input); const en = narrative(snapshot, 'en'); const fa = narrative(snapshot, 'fa');
    assert.deepEqual(en.evidence, fa.evidence);
    assert.equal(en.monitoring.length, 2); assert.equal(fa.monitoring.length, 2);
    assert.ok(/[\u0600-\u06ff]/.test(fa.summary));
    assert.equal(Boolean(en.instrumentNote), Boolean(input.spec.instrument));
    assert.ok(!JSON.stringify(en).includes('score'));
  }
  assert.equal(narrative({ ...original, status: 'partial' }).status, 'unavailable');
});
test('Year-over-year explanation is calculated from verified like-period facts', () => {
  const snapshot = buildSnapshot(inputs[2]); const reading = narrative(snapshot);
  const metrics = snapshot.metrics;
  assert.equal(reading.comparison.revenueGrowthPercent, (metrics.revenue.value / metrics.priorRevenue.value - 1) * 100);
  assert.equal(reading.comparison.operatingMarginPercent, metrics.operatingIncome.value / metrics.revenue.value * 100);
  assert.ok(reading.comparison.operatingMarginPercent < reading.comparison.priorOperatingMarginPercent);
  assert.match(reading.summary, /margin decreased/);
  const noComparison = clone(snapshot); noComparison.metrics.priorRevenue.status = 'missing';
  assert.equal(narrative(noComparison).comparison, null);
  assert.ok(!narrative(noComparison).summary.includes('prior-year'));
});
console.log(`${count} fundamental pilot checks passed`);
