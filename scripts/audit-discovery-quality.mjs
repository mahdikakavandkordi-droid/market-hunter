// Read-only audit: no threshold optimization or historical ledger mutations.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const ctx={window:{}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('fundamental-context.js','utf8'),ctx);
const fundamentals=JSON.parse(fs.readFileSync('data/fundamental-context.json','utf8'));
const auditAt=process.argv[2]||new Date().toISOString();
assert(Number.isFinite(Date.parse(auditAt)),'Invalid audit date');
const markets=[];
const inputs={};
for(const file of ['data/v2-latest-scan.json','data/v2-us-latest-scan.json']){
 const raw=fs.readFileSync(file,'utf8'),scan=JSON.parse(raw);
 inputs[file]=crypto.createHash('sha256').update(raw).digest('hex');
 assert(scan.discovery?.status==='available');
 const rows=scan.discovery.selected;
 assert.equal(new Set(rows.map(r=>r.symbol)).size,rows.length);
 const audited=rows.map(row=>{
  const industry=scan.industryContext.industries.find(g=>g.sector===row.sector);
  const reading=ctx.window.MHFundamentals.reading(fundamentals,row.symbol,'en',new Date(auditAt));
  const item=fundamentals.items.find(x=>x.symbol===row.symbol);
  return {symbol:row.symbol,sector:row.sector,benchmark:row.benchmark,
   ret20:row.ret20,rs20:row.rs20,rs60:row.rs60,
   sectorCoverage:industry?.coverage??null,
   sectorMedianReturn20:industry?.medianReturn20??null,
   // Comparison to tracked peers, not a sector-index return or validated signal.
   belowPeerMedian:industry?.usableMembers>=3?row.ret20<industry.medianReturn20:null,
   recentMomentumSlowing:Number.isFinite(row.momentumShift)?row.momentumShift<0:null,
   fundamentalStatus:reading.status,fundamentalReason:reading.reason??null,
   sourceRefreshStatus:item?.refreshStatus??'not-covered',
   lastSourceCheck:item?.lastCheckedAt??null,
   missingDecisionEvidence:['valuation','dated_company_catalyst','economic_scenario_link'],
   assessment:'technical_watchlist_only'};
 });
 markets.push({market:scan.market,asOf:scan.marketAsOf,usable:scan.universeRows.length,
  selected:rows.length,selectedPct:100*rows.length/scan.universeRows.length,
  unmatchedSector:audited.filter(r=>r.sectorCoverage===null).length,
  belowPeerMedian:audited.filter(r=>r.belowPeerMedian===true).length,
  slowingMomentum:audited.filter(r=>r.recentMomentumSlowing===true).length,
  nonpositiveRS60:audited.filter(r=>Number.isFinite(r.rs60)&&r.rs60<=0).length,
  fundamentalReadable:audited.filter(r=>r.fundamentalStatus==='available').length,
  fundamentalReadableAndSourceCheckSuccessful:audited.filter(r=>r.fundamentalStatus==='available'&&['unchanged','collected'].includes(r.sourceRefreshStatus)).length,
  evidence:scan.discoveryEvidence,rows:audited});
}
const report={version:'discovery-quality-audit-v1',auditAt,inputs,
 fundamentalGeneratedAt:fundamentals.generatedAt,fundamentalRefreshMode:fundamentals.refreshMode,
 limitations:['Current snapshot coverage audit, not point-in-time fundamental backtest.',
 'Missing evidence is unknown, not a negative financial assessment.',
 'Diagnostic counts overlap; neither momentum nor peer comparison is an approved exclusion.',
 'CDRs and underlying US listings are not remapped without issuer identity verification.',
 'No demonstrated return improvement; no new recommendation score.'],markets};
fs.mkdirSync('data/research/discovery-quality',{recursive:true});
fs.writeFileSync('data/research/discovery-quality/audit.json',JSON.stringify(report,null,2)+'\n');
const md=['# Discovery quality audit','',
 'Snapshot coverage and decision design; no production selection changes.','',
 '| Market | Session | Liquid stocks | Pass screen | Pass % | Readable fundamentals | Readable + successful source check |',
 '|---|---|---:|---:|---:|---:|---:|',
 ...markets.map(m=>'| '+[m.market,m.asOf,m.usable,m.selected,m.selectedPct.toFixed(1),m.fundamentalReadable,m.fundamentalReadableAndSourceCheckSuccessful].join(' | ')+' |'),
 '', '## Findings',
 'The current screen admits roughly one third of the scanned universe. Industry context is descriptive and does not influence selection. Selection is alphabetical. Company valuation, dated catalysts and links to economic scenarios are absent from the selection contract.',
 'The existing fundamental projection is a small pilot with failed refresh checks; its old coverage denominator refers to the legacy integrated shortlist. Do not treat it as coverage of discovery candidates.',
 'All candidates remain technical watchlist entries. Missing evidence must not be counted as failed fundamentals, nor silently remapped between CDRs and US listings.',
 '', '## Delivery decision',
 'Keep industries for exploration. The primary opportunity list should require dated company evidence and a stated risk/invalidation case; show the broad technical watchlist separately. Do not impose a fixed count or return to legacy stages as a substitute for evidence.',
 'Do not deploy a fundamental exclusion now: it would mostly select by data availability. First establish a refreshable, auditable company data source with coverage reported separately for CA, US and CDRs.',
 'Use sector-appropriate financial measures. Store source, publication date, financial period, instrument/issuer mapping and missingness. Economic scenarios should explain conditional industry effects; do not use an unvalidated market on/off switch.',
 '', '## Validation before activation',
 'Freeze each proposed rule before evaluation. Compare the unchanged baseline, industry context alone, company evidence alone and their combination. Record exclusions and missed winners as well as retained stocks. Evaluate equal-weight cohorts over common 20/60-session horizons, benchmark excess returns, adverse excursions and costs; keep paper engines and actual portfolios separate.',
 'Use publication-time data only. Where historical fundamentals are unavailable, collect prospective evidence instead of backfilling with current filings. Current discovery outcomes have not matured; a smaller list is not proof of better picks.',
 '', '## Diagnostic counts (overlapping; not exclusion rules)',
 ...markets.map(m=>'- '+m.market+': '+m.belowPeerMedian+' below tracked-sector median return; '+m.slowingMomentum+' with slowing recent momentum; '+m.nonpositiveRS60+' with nonpositive 60-session relative return; '+m.unmatchedSector+' without mapped sector context.'),
 '',...report.limitations.map(x=>'- '+x),
 '', '## Candidate-by-candidate evidence coverage',
 '| Market | Symbol | Sector | Below peer median | Fundamental status | Source refresh |',
 '|---|---|---|---|---|---|',
 ...markets.flatMap(m=>m.rows.map(r=>'| '+[m.market,r.symbol,r.sector,r.belowPeerMedian===null?'unknown':String(r.belowPeerMedian),r.fundamentalStatus,r.sourceRefreshStatus].join(' | ')+' |'))];
fs.writeFileSync('docs/discovery-quality-audit.md',md.join('\n')+'\n');
console.log(JSON.stringify(markets.map(({rows,evidence,...summary})=>summary),null,2));
