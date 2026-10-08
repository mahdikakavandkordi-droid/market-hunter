import fs from 'node:fs/promises';
import path from 'node:path';
import { PILOT, ISSUERS, buildSnapshot, narrative, replaceCompleteSnapshot } from '../lib/fundamental-pilot.mjs';

const input = process.argv[2] ?? 'data/fundamentals/inputs';
const output = process.argv[3] ?? 'data/research/fundamental-pilot';
const asOf = process.argv[4] ?? new Date().toISOString();
if(!Number.isFinite(Date.parse(asOf))||!asOf.includes('T'))throw new Error('An explicit ISO cutoff is required');
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
for (const spec of ISSUERS) {
  const prior = previous?.snapshots?.find(s => s.symbol === spec.symbol);
  try {
    const file=spec.source==='sec'?path.join(input,`${spec.symbol.split('.')[0]}.json`):path.join(path.dirname(input),'manual-inputs',`${spec.symbol.split('.')[0]}.json`);
    if(spec.source!=='sec'){
      let manual;try{manual=JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT'){if(prior)snapshots.push(prior);continue;}throw error;}
      if(manual.symbol!==spec.symbol||manual.issuer!==spec.name||manual.manualReview?.permission?.scope!=='republication-authorized'||!manual.manualReview.reviewer?.trim()||manual.status!=='complete'||Date.parse(manual.reviewedAt)>Date.parse(asOf))throw new Error('Invalid reviewed manual input');
      const result=replaceCompleteSnapshot(prior,{...manual,reading:{en:narrative(manual,'en'),fa:narrative(manual,'fa')}});
      if(result.current)snapshots.push(result.current);if(result.lastAttempt)attempts.push(result.lastAttempt);continue;
    }
    const data = JSON.parse(await fs.readFile(file, 'utf8'));
    const snapshot = buildSnapshot({ ...data, spec, asOf, retrievedAt: data.retrievedAt });
    const attempt = { ...snapshot, reviewedAt: data.reviewedAt??(prior?.filing.accession===snapshot.filing.accession?prior.reviewedAt:null), reconciledAt:generatedAt, sourceResponseHashes: data.responseHashes,
      reading: { en: narrative(snapshot, 'en'), fa: narrative(snapshot, 'fa') } };
    if(prior?.filing.accession===attempt.filing.accession&&JSON.stringify(prior.metrics)===JSON.stringify(attempt.metrics)){attempt.reconciledAt=prior.reconciledAt??prior.asOf;attempt.asOf=prior.asOf;}
    const result = replaceCompleteSnapshot(prior, attempt);
    if (result.current) snapshots.push(result.current);
    if (result.lastAttempt) attempts.push(result.lastAttempt);
  } catch (error) {
    if (prior?.status === 'complete') snapshots.push(prior);
    attempts.push({symbol:spec.symbol,status:'failed',attemptedAt:generatedAt,reason:error.message});
  }
}
let sourceChecks={};
try{sourceChecks=JSON.parse(await fs.readFile('data/fundamentals/source-checks.json','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
let selected=[];
try{const scan=JSON.parse(await fs.readFile('data/v2-latest-scan.json','utf8'));selected=[...new Set((scan.integratedSurfacePicks??[]).map(x=>x.symbol))];}catch(error){if(error.code!=='ENOENT')throw error;}
const describe=symbol=>{const spec=ISSUERS.find(x=>x.symbol===symbol),snapshot=snapshots.find(x=>x.symbol===symbol),check=sourceChecks[symbol];return {symbol,status:snapshot?'available':check?.status==='failed'?'temporarily-failed':spec?'unsupported':'unmapped',reason:snapshot?null:spec?.blocker??'Issuer/instrument mapping has not been verified',sourceUrl:spec?.sourceUrl??null};};
const coverage={sample:{covered:snapshots.length,total:ISSUERS.length,items:ISSUERS.map(x=>describe(x.symbol))},selected:{covered:selected.filter(x=>snapshots.some(s=>s.symbol===x)).length,total:selected.length,items:selected.map(describe)}};
const report = {
  version: 'fundamental-pilot-v1', asOf, generatedAt, retrievedAt: snapshots.map(s => s.retrievedAt).sort().at(-1), status: 'review-only',
  integratedIntoProduct: true, scannerImpact: false,
  snapshots, lastAttempts: attempts,
  sourceChecks,coverage,
  deferred: ISSUERS.filter(x=>!snapshots.some(s=>s.symbol===x.symbol)).map(x=>describe(x.symbol)),
};
await fs.mkdir(output, { recursive: true });
await atomicJson(path.join(output, 'latest.json'), report);
const publicContext={version:'fundamental-context-v1',refreshMode:'manual-source-access-pending',reviewedAt:asOf,generatedAt,coverage,
  issuers:ISSUERS.map(({symbol,cik,name,sourceHosts,source,instrument})=>({symbol,cik,name,sourceHosts,source,instrument})),
  items:snapshots.map(s=>{const check=sourceChecks[s.symbol];return {reviewedAt:s.reviewedAt??null,reconciledAt:s.reconciledAt??s.asOf,
    lastCheckedAt:check?.checkedAt??null,refreshStatus:check?.status??'not-checked',newFilingPending:Boolean(check?.accession&&check.accession!==s.filing.accession),
    symbol:s.symbol,cik:s.cik,issuer:s.issuer,status:s.status,period:s.financialPeriod,filed:s.filing.filed,acceptedAt:s.filing.acceptedAt,sourceUrl:s.filing.url,reading:s.reading};})};
await atomicJson('data/fundamental-context.json',publicContext);
let text = '# Market Hunter — Stage 3 Fundamental Pilot\n\nReview only; no score, recommendation or scanner integration.\n\n';
text += `As-of cutoff: ${asOf}. Last source response received: ${report.retrievedAt}. Generated: ${generatedAt}. Figures retain each issuer’s reporting currency.\n\n`;
for (const snapshot of snapshots) {
  text += `## ${snapshot.symbol}\n\nCore-field status: ${snapshot.status}; optional gaps remain listed below. [Original ${snapshot.filing.form}](${snapshot.filing.url}), accepted ${snapshot.filing.acceptedAt}.\n\n`;
  for (const language of ['en', 'fa']) {
    const reading = snapshot.reading[language];
    text += `### ${language === 'en' ? 'English' : 'فارسی'}\n\n`;
    text += [reading.context, reading.summary, reading.uncertainty, reading.instrumentNote].filter(Boolean).join('\n\n') + '\n\n';
    text += reading.monitoring.map(item => `- ${item}`).join('\n') + '\n\n';
  }
  text += `| Metric | Value (${snapshot.reportingCurrency}, absolute units) | Exact period | Verification |\n|---|---:|---|---|\n`;
  for (const [metric, fact] of Object.entries(snapshot.metrics)) text += `| ${metric} | ${fact.value ?? 'Unavailable'} | ${fact.periodEnd ? `${fact.periodStart ?? 'Instant'} → ${fact.periodEnd}` : 'Unavailable'} | ${fact.status} |\n`;
  text += '\n';
}
text += '## Deferred sample\n\n' + report.deferred.map(x => `- ${x.symbol}: ${x.reason}.`).join('\n') + '\n\n';
text += '## Review limits and next work\n\nThe adapter reconciles selected USD facts against entity-wide inline facts in the original SEC document. This is numeric reconciliation, not a full accounting audit. Context sentences and monitoring prompts are reviewed templates, not extracted predictions. Sector-specific cost/patent/cloud context remains a separate review obligation.\n\nSelected 10-K figures are annual, not Q4-only values. Subsequent 10-Q periods are selected from their own exact reporting dates. Cash-flow periods are explicit; no YTD-to-quarter subtraction is performed. Debt components are not added into a purported total debt, and missing values remain unavailable.\n\nStage 4 adds optional financial context to stock cards, with separate dates, source links, language selection and explicit unavailable states. SEC refresh is a separate bounded operational command; human-review dates are not generated by retrieval. Remaining work: verify Canadian source access and usage rights, richer sector-specific evidence where useful, and a separately reconciled Microsoft Q4 release if an annual view is insufficient.\n';
await fs.writeFile(path.join(output, 'review.md'), text);
console.log(JSON.stringify({ output, snapshots: snapshots.map(s => ({ symbol: s.symbol, status: s.status, gaps: s.gaps.map(g => g.metric) })) }));
