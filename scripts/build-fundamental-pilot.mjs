import fs from 'node:fs/promises';
import path from 'node:path';
import { PILOT, buildSnapshot, narrative, replaceCompleteSnapshot } from '../lib/fundamental-pilot.mjs';

const input = process.argv[2] ?? 'tests/fixtures/fundamental-pilot';
const output = process.argv[3] ?? 'data/research/fundamental-pilot';
const asOf = '2026-10-08T10:17:56Z';
const generatedAt = new Date().toISOString();
async function readPrevious() {
  try { return JSON.parse(await fs.readFile(path.join(output, 'latest.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function atomicJson(file, data) {
  await fs.mkdir(path.dirname(file), {recursive:true});
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(data, null, 2) + '\n');
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, {force:true}); }
}
const previous = await readPrevious();
const snapshots = [], attempts = [];
for (const spec of PILOT) {
  const prior = previous?.snapshots?.find(s => s.symbol === spec.symbol);
  try {
    const data = JSON.parse(await fs.readFile(path.join(input, `${spec.symbol.split('.')[0]}.json`), 'utf8'));
    const snapshot = buildSnapshot({ ...data, spec, asOf, retrievedAt: data.retrievedAt });
    const attempt = { ...snapshot, reviewedAt: asOf, sourceResponseHashes: data.responseHashes,
      reading: { en: narrative(snapshot, 'en'), fa: narrative(snapshot, 'fa') } };
    const result = replaceCompleteSnapshot(prior, attempt);
    if (result.current) snapshots.push(result.current);
    if (result.lastAttempt) attempts.push(result.lastAttempt);
  } catch (error) {
    if (prior?.status === 'complete') snapshots.push(prior);
    attempts.push({symbol:spec.symbol,status:'failed',attemptedAt:generatedAt,reason:error.message});
  }
}
const report = {
  version: 'fundamental-pilot-v1', asOf, generatedAt, retrievedAt: snapshots.map(s => s.retrievedAt).sort().at(-1), status: 'review-only',
  integratedIntoProduct: true, scannerImpact: false,
  snapshots, lastAttempts: attempts,
  deferred: ['SIA.TO', 'FTT.TO', 'RUS.TO', 'DFY.TO', 'SPB.TO', 'LUG.TO'].map(symbol => ({ symbol, status: 'unavailable', reason: 'Automated source route and usage permission not verified in this pilot' })),
};
await fs.mkdir(output, { recursive: true });
await atomicJson(path.join(output, 'latest.json'), report);
const publicContext={version:'fundamental-context-v1',reviewedAt:asOf,items:snapshots.map(s=>({reviewedAt:s.reviewedAt??s.asOf,symbol:s.symbol,cik:s.cik,issuer:s.issuer,status:s.status,period:s.financialPeriod,filed:s.filing.filed,acceptedAt:s.filing.acceptedAt,sourceUrl:s.filing.url,reading:s.reading}))};
await atomicJson('data/fundamental-context.json',publicContext);
let text = '# Market Hunter — Stage 3 Fundamental Pilot\n\nReview only; no score, recommendation or scanner integration.\n\n';
text += `As-of cutoff: ${asOf}. Last source response received: ${report.retrievedAt}. Generated: ${generatedAt}. All figures retain USD reporting units.\n\n`;
for (const snapshot of snapshots) {
  text += `## ${snapshot.symbol}\n\nCore-field status: ${snapshot.status}; optional gaps remain listed below. [Original ${snapshot.filing.form}](${snapshot.filing.url}), accepted ${snapshot.filing.acceptedAt}.\n\n`;
  for (const language of ['en', 'fa']) {
    const reading = snapshot.reading[language];
    text += `### ${language === 'en' ? 'English' : 'فارسی'}\n\n`;
    text += [reading.context, reading.summary, reading.uncertainty, reading.instrumentNote].filter(Boolean).join('\n\n') + '\n\n';
    text += reading.monitoring.map(item => `- ${item}`).join('\n') + '\n\n';
  }
  text += '| Metric | Value (USD, absolute units) | Exact period | Verification |\n|---|---:|---|---|\n';
  for (const [metric, fact] of Object.entries(snapshot.metrics)) text += `| ${metric} | ${fact.value ?? 'Unavailable'} | ${fact.periodEnd ? `${fact.periodStart ?? 'Instant'} → ${fact.periodEnd}` : 'Unavailable'} | ${fact.status} |\n`;
  text += '\n';
}
text += '## Deferred sample\n\n' + report.deferred.map(x => `- ${x.symbol}: ${x.reason}.`).join('\n') + '\n\n';
text += '## Review limits and next work\n\nThe adapter reconciles selected USD facts against entity-wide inline facts in the original SEC document. This is numeric reconciliation, not a full accounting audit. Context sentences and monitoring prompts are reviewed templates, not extracted predictions. Sector-specific cost/patent/cloud context remains a separate review obligation.\n\nMicrosoft is presented on an annual FY2026 basis because the selected 10-K Company Facts entries do not supply Q4-only core values. Cash-flow periods are explicit; no YTD-to-quarter subtraction is performed. Debt components are not added into a purported total debt, and missing values remain unavailable.\n\nStage 4 adds optional financial context to stock cards, with separate dates, source links, language selection and explicit unavailable states. Snapshot refresh is still manual and this limit is shown in the UI. Remaining work: verify Canadian source access and usage rights, richer sector-specific evidence where useful, and a separately reconciled Microsoft Q4 release if an annual view is insufficient.\n';
await fs.writeFile(path.join(output, 'review.md'), text);
console.log(JSON.stringify({ output, snapshots: snapshots.map(s => ({ symbol: s.symbol, status: s.status, gaps: s.gaps.map(g => g.metric) })) }));
