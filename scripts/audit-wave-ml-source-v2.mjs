import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {digest,buildFeatures} from '../lib/wave-ml/features.mjs';
import {normalize} from '../lib/wave-ml/source.mjs';
import {aggregateCrypto4H,aggregateExchange4H} from '../lib/wave-ml/research-bars.mjs';
import {buildSchedule} from '../lib/wave-ml/calendar.mjs';
import {coverage} from '../lib/wave-ml/coverage.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base=path.join(root,'data/research/wave-ml-v1'),dataset=path.join(base,'dataset'),outDir=path.join(base,'source-audit-v1'),DAY=86400000;
const json=n=>JSON.parse(fs.readFileSync(path.join(base,n))),compressed=n=>JSON.parse(gunzipSync(Buffer.from(fs.readFileSync(path.join(dataset,n),'utf8').trim(),'base64'))),sha=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const parent=json('contract.json'),c=json('evaluation-v2-contract.json'),sources=json('dataset/manifest.json'),featureManifest=json('dataset/feature-manifest.json'),calendar=json('official-calendar.json'),verified=json('evaluation-v2-task3-report.json'),readiness=json('evaluation-v2-task4-readiness-report.json');
const accepted=compressed('task3-calendar-accepted-labels.json.gz.b64'),v2=compressed('evaluation-v2-splits.json.gz.b64');
assert.equal(digest(v2),verified.manifestHash);assert.equal(digest(accepted.labels),verified.acceptedLabelHash);assert.equal(digest(c),verified.evaluationContractHash);assert.equal(digest(parent),sources.contractHash);assert.equal(digest(sources),featureManifest.manifestHash);assert.equal(digest(featureManifest),accepted.featureManifestHash);
assert.equal(accepted.sourceManifestHash,digest(sources));assert.equal(accepted.calendarHash,digest(calendar));assert.equal(accepted.asOf,sources.asOf);
for(const [p,h] of Object.entries(verified.protectedFileSha256))assert.equal(sha(p),h);
assert.equal(readiness.inputHashes.v2Manifest,digest(v2));assert.equal(readiness.inputHashes.task3Verification,digest(verified));
const cutoff=Date.parse(c.split.developmentDecisionEndExclusive),reserved=new Set(c.split.holdoutSymbols),byId=new Map(accepted.labels.map(r=>[r.id,r]));
assert.ok(accepted.labels.every(r=>!reserved.has(r.symbol)&&Date.parse(r.availableAt)<cutoff));
const focus=new Set(featureManifest.reports.filter(r=>r.rows===0||r.market==='crypto').map(r=>r.symbol)),diagnoses=[],sourceChecks=[],replays=[];
for(const e of sources.entries){
 assert.equal(e.status,'captured');const s=compressed(e.file),raw=compressed(e.rawFile);assert.equal(digest(s),e.checksum);assert.equal(digest(raw),e.rawChecksum);
 for(const interval of ['daily','hourly']){assert.equal(digest(raw[interval].raw),raw[interval].checksum);assert.equal(raw[interval].c.meta.symbol.toUpperCase(),e.symbol);}
 const nd=normalize(raw.daily.c,{mode:s.mode,interval:'1d',asOf:Date.parse(sources.asOf)}),nh=normalize(raw.hourly.c,{mode:s.mode,interval:'1h',asOf:Date.parse(sources.asOf)});
 assert.equal(digest(nd.rows),digest(s.daily));assert.equal(digest(nh.rows),digest(s.hourly));
 const rebuilt=s.mode==='crypto'?aggregateCrypto4H(nh.rows,{nowMs:Date.parse(sources.asOf)}):aggregateExchange4H(nh.rows,{nowMs:Date.parse(sources.asOf)});
 assert.equal(digest(rebuilt.bars),digest(s.executionBars));
 const f=featureManifest.featureFiles.find(f=>f.symbol===e.symbol),matrix=compressed(f.file);assert.equal(digest(matrix),f.checksum);
 sourceChecks.push({symbol:e.symbol,market:e.market,rawChecksumVerified:true,normalizationMatchesSnapshot:true,aggregationMatchesSnapshot:true,featureChecksumVerified:true});
 if(!focus.has(e.symbol))continue;
 const rows=buildFeatures(s,parent),columns=Object.keys(rows[0]?.features||{}),compact={columns,rows:rows.map(({features,...r})=>({...r,values:columns.map(k=>features[k])}))};assert.equal(digest(compact),f.checksum);
 const gaps=new Set(s.dailyGapBeforeTimes);let start=0,maxRun=0;const resetEvents=[],dailyRangeStart=Date.parse(reserved.has(e.symbol)?parent.split.finalTestStart:c.split.trainDecisionStart),rangeEnd=Date.parse(reserved.has(e.symbol)?parent.split.finalTestEndExclusive:c.split.developmentDecisionEndExclusive);
 for(let i=0;i<s.daily.length;i++){
  const b=s.daily[i];if(i&&gaps.has(b.t)){start=i;if(b.endT<cutoff){const prev=s.daily[i-1],causes=[];if(s.quality.priceMismatchDates.includes(b.date))causes.push('cross_frequency_boundary_mismatch');if(s.quality.splits.some(x=>x.date>prev.date&&x.date<=b.date))causes.push('split');if(s.quality.dailyInvalid.some(x=>x.date>prev.date&&x.date<=b.date))causes.push('invalid_daily_quote');if(s.mode==='crypto'&&b.t-prev.t!==DAY)causes.push('missing_utc_daily_bar');if(!causes.length)causes.push('reference_calendar_or_missing_session');resetEvents.push({date:b.date,causes});}}
  const t=b.endT+300000;if(t>=dailyRangeStart&&t<rangeEnd)maxRun=Math.max(maxRun,i-start+1);
 }
 if(f.rows===0)assert.ok(maxRun<parent.sample.dailyWarmupBars,'zero_feature_cause_not_explained');
 const examples=[];for(const d of s.quality.priceMismatchDates.filter(d=>d<'2026-04-01').slice(0,3)){
  const db=s.daily.find(x=>x.date===d),xs=rebuilt.bars.filter(x=>x.date===d);if(!db||xs.length!==(s.mode==='crypto'?6:2))continue;
  const hs=nh.rows.filter(x=>x.date===d);assert.equal(xs[0].o,hs[0].o);assert.equal(xs.at(-1).c,hs.at(-1).c);
  examples.push({date:d,dailyOpen:db.o,firstHourlyOpen:hs[0].o,dailyClose:db.c,lastHourlyClose:hs.at(-1).c,openRelativeError:Math.abs(hs[0].o-db.o)/db.o,closeRelativeError:Math.abs(hs.at(-1).c-db.c)/db.c,rawSourceDisagreement:true,commonVerifiedCorrection:null});
 }
 const prefixTimes=[...new Set(resetEvents.slice(-2).map(x=>{const b=s.daily.find(b=>b.date===x.date);return b.endT+300000;}))];
 for(const t of prefixTimes)assert.equal(digest(buildFeatures(s,parent,{asOf:t})),digest(rows.filter(r=>Date.parse(r.availableAt)<=t)));
 replays.push({symbol:e.symbol,featureHash:f.checksum,fullReplayMatches:true,prefixChecks:prefixTimes.length});
 diagnoses.push({symbol:e.symbol,market:e.market,reserved:reserved.has(e.symbol),storedFeatureRows:f.rows,maximumContinuousBarsInStoredDecisionRange:maxRun,warmupRequired:parent.sample.dailyWarmupBars,storedDecisionRange:{start:new Date(dailyRangeStart).toISOString(),endExclusive:new Date(rangeEnd).toISOString()},resetEventsBeforeApril:resetEvents,examples,diagnosis:f.rows===0?'continuity_resets_prevent_250_bar_warmup_in_stored_range':'source_flags_reset_state_then_delay_reeligibility; not_a_split_counter_error',dataRepairVerified:false});
}
const expectedDates=(market,start,end)=>market==='crypto'?Array.from({length:Math.ceil((end-start)/DAY)},(_,i)=>new Date(start+i*DAY).toISOString().slice(0,10)):[...new Set(buildSchedule(market,calendar).slots.filter(s=>s.t>=start&&s.t<end).map(s=>s.date))];
const pools=[];
for(const w of v2.split.windows)for(const market of ['us','ca','crypto'])for(const dir of [1,-1]){
 const start=Date.parse(c.split.trainDecisionStart),end=Date.parse(w.fitDecisionEndExclusive),expected=expectedDates(market,start,end),fit=v2.split.records.filter(r=>r.fold===w.name&&r.role==='fit'&&byId.get(r.id).market===market&&byId.get(r.id).dir===dir).map(r=>byId.get(r.id));
 const item={fold:w.name,market,dir,fitDecisionWindow:{start:new Date(start).toISOString(),endExclusive:new Date(end).toISOString()},coverage:coverage(fit,expected)};pools.push(item);
}
const firstCrypto=pools.find(p=>p.fold==='validation_1'&&p.market==='crypto'&&p.dir===1);assert.equal(firstCrypto.coverage.longestMissingRun.calendarDays,214);assert.deepEqual(firstCrypto.coverage.emptyMonths,['2024-12','2025-01','2025-02','2025-03','2025-04','2025-05']);
const hashes={parentContract:digest(parent),evaluationContract:digest(c),sourceManifest:digest(sources),featureManifest:digest(featureManifest),acceptedLabels:digest(accepted.labels),v2Manifest:digest(v2),originalReadinessReport:digest(readiness)};
const task1={version:'wave-ml-source-audit-task1-1',observationCutoff:sources.asOf,inputHashes:hashes,sourceChecks,diagnoses,fitCoverage:pools,findings:['Raw source prices disagree at verified UTC/session boundary examples; normalization and aggregation reproduce frozen snapshots for all 160 sources','Cross-frequency reset events restart the entire daily state; 250 continuous daily bars are required before emitting features','Crypto fitting has an interior 214-calendar-day gap, six empty months and sparse/concentrated support despite first-to-last spans exceeding one year','Seven zero-feature symbols are consequences of the frozen warmup/continuity policy in their stored decision ranges; no source price authority or common adjustment correction verified'],finalLabelsOpened:false,trainingStarted:false};
const task2={version:'wave-ml-source-audit-task2-1',inputHashes:hashes,task1Hash:digest(task1),sourceNormalizationChecks:sourceChecks.length,fullFeatureReplays:replays,newPrefixChecks:replays.reduce((n,r)=>n+r.prefixChecks,0),newSourceDatasetCreated:false,verifiedPriceOrAggregationCorrections:[],status:'NO_VERIFIED_PRICE_REPAIR; INPUTS_REPLAY_IDENTICALLY',reportingCorrection:'Separate first-to-last span from observed expected-day/month coverage; new coverage module and versioned reports retain original evidence',originalFeatureAndLabelHashesUnchanged:true,thresholdsAndHoldoutsChanged:false,finalLabelsOpened:false,trainingStarted:false};
const task3={version:'wave-ml-source-audit-task3-1',inputHashes:hashes,task1Hash:digest(task1),task2Hash:digest(task2),nominalCountsAndSpans:readiness.decision.nominalDevelopmentSupport,continuousCoverageAssessment:'not_established_for_full_requested_scope; first_to_last_span_is_not_continuity',cryptoFirstFitCoverage:{observedDays:firstCrypto.coverage.observedDecisionDays,expectedDays:firstCrypto.coverage.expectedDecisionDays,emptyMonths:firstCrypto.coverage.emptyMonths,longestMissingRun:firstCrypto.coverage.longestMissingRun},reservedFeasibility:readiness.heldoutFeasibility.map(({symbol,featureFeasibility,finalDecisionDays,expectedCalendarDecisionDays})=>({symbol,featureFeasibility,finalDecisionDays,expectedCalendarDecisionDays})),researchTrainingReady:false,productionReady:false,trainingEvidenceGate:{sourceAcceptance:'blocked',reservedFeatures:'blocked',fullUniverseContinuity:'not_established'},promotionEvidenceGate:{independentFinalConfidence:'inconclusive_39_day_window'},blockers:['raw_price_source_authority_not_verified','four_reserved_symbols_without_features_and_AVAX_partial','crypto_214_day_training_gap'],recommendation:'Verify a source/instrument price convention using authoritative evidence or review a separately frozen limited-scope research contract; do not remove flags or lower 250-bar eligibility to force passage',finalLabelsOpened:false,trainingStarted:false};
const task4={version:'wave-ml-source-audit-task4-1',readinessReportHash:digest(task3),status:'BLOCKED_BY_TASK3_READINESS; NOT_FITTED',dependencyCondition:'Fit only after the preceding training readiness assessment passes',modelsFitted:0,trialsUsed:0,performanceMetrics:null,reason:task3.blockers,trainingStarted:false,finalLabelsOpened:false,interpretation:'The absence of a fit is a data gate result, not evidence of model profitability or failure'};
fs.mkdirSync(outDir,{recursive:true});for(const [name,value] of Object.entries({task1,task2,task3,task4})){const file=path.join(outDir,name+'.json');if(fs.existsSync(file))assert.deepEqual(JSON.parse(fs.readFileSync(file)),value,'audit_report_replay_changed');else fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
for(const [p,h] of Object.entries(verified.protectedFileSha256))assert.equal(sha(p),h);
console.log(JSON.stringify({sourceChecks:sourceChecks.length,focusedFeatureReplays:replays.length,prefixChecks:task2.newPrefixChecks,firstCryptoCoverage:task3.cryptoFirstFitCoverage,diagnoses:diagnoses.filter(d=>d.storedFeatureRows===0).map(({symbol,maximumContinuousBarsInStoredDecisionRange,warmupRequired})=>({symbol,maximumContinuousBarsInStoredDecisionRange,warmupRequired})),verifiedCorrections:0,trainingStarted:false,task4Status:task4.status}));
