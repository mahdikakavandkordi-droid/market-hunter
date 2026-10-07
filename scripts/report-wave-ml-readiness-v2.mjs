import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {digest} from '../lib/wave-ml/features.mjs';
import {buildSchedule} from '../lib/wave-ml/calendar.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base='data/research/wave-ml-v1/',DAY=86400000;
const read=p=>fs.readFileSync(path.join(root,p));
const json=p=>JSON.parse(read(p));
const compressed=p=>JSON.parse(gunzipSync(Buffer.from(read(p).toString().trim(),'base64')));
const sha=p=>createHash('sha256').update(read(p)).digest('hex');
const c=json(base+'evaluation-v2-contract.json'),parent=json(base+'contract.json'),source=json(base+'dataset/manifest.json'),features=json(base+'dataset/feature-manifest.json'),calendar=json(base+'official-calendar.json'),accepted=json(base+'task3-calendar-report.json'),previous=json(base+'evaluation-v2-task2-report.json'),verification=json(base+'evaluation-v2-task3-report.json');
const input=compressed(base+'dataset/task3-calendar-accepted-labels.json.gz.b64'),manifest=compressed(base+'dataset/evaluation-v2-splits.json.gz.b64');
assert.equal(c.evaluationV2Tasks.task4,'research_readiness_report_and_review; no_training');
assert.equal(c.parent.contractHash,digest(parent));assert.equal(source.contractHash,digest(parent));assert.equal(features.manifestHash,digest(source));assert.equal(features.contractHash,digest(parent));
assert.equal(digest(manifest),verification.manifestHash);assert.equal(verification.manifestHash,previous.manifestHash);assert.equal(digest(manifest.split),verification.splitHash);assert.equal(digest(manifest.featureTags),verification.featureTagsHash);assert.equal(digest(c),verification.evaluationContractHash);
assert.equal(input.contractHash,digest(parent));assert.equal(input.sourceManifestHash,digest(source));assert.equal(input.featureManifestHash,digest(features));assert.equal(input.calendarHash,digest(calendar));assert.equal(digest(input.labels),verification.acceptedLabelHash);assert.equal(accepted.labelHash,verification.acceptedLabelHash);assert.equal(accepted.calendarApproved,true);
for(const x of [accepted,manifest,manifest.split,verification]){assert.equal(x.finalLabelsOpened,false);assert.equal(x.trainingStarted,false);}
assert.equal(input.asOf,source.asOf);assert.equal(accepted.asOf,input.asOf);assert.equal(verification.observationCutoff,input.asOf);assert.equal(manifest.observationCutoff,input.asOf);
assert.equal(verification.tests.failed,0);assert.equal(verification.tests.passed,46);assert.ok(Object.values(verification.checks).every(x=>x===true));
for(const [p,hash] of Object.entries(verification.protectedFileSha256))assert.equal(sha(p),hash,'protected_input_changed: '+p);
// Outcome classes, barrier values and realized returns are deliberately not
// aggregated. No reserved/final outcome file is read or created.
const labels=input.labels.map(({id,symbol,market,dir,availableAt,informationEnd,status,reason})=>({id,symbol,market,dir,availableAt,informationEnd,status,reason}));
const byId=new Map(labels.map(r=>[r.id,r]));assert.equal(byId.size,labels.length);
const split=manifest.split,tags=manifest.featureTags,developmentEnd=Date.parse(c.split.developmentDecisionEndExclusive),reserved=new Set(c.split.holdoutSymbols);
assert.ok(labels.every(r=>!reserved.has(r.symbol)&&Date.parse(r.availableAt)<developmentEnd));
const ratio=(n,d)=>d?Number((n/d).toFixed(6)):null;
const span=rows=>{const times=rows.map(r=>Date.parse(r.availableAt)),first=times.length?Math.min(...times):null,last=times.length?Math.max(...times):null;
 const anniversary=first===null?null:new Date(first);if(anniversary)anniversary.setUTCFullYear(anniversary.getUTCFullYear()+1);
 return {firstDecision:first===null?null:new Date(first).toISOString(),lastDecision:last===null?null:new Date(last).toISOString(),calendarSpanDays:first===null?0:Number(((last-first)/DAY).toFixed(6)),atLeast12CalendarMonths:first!==null&&last>=anniversary.getTime(),distinctUtcDecisionDays:new Set(times.map(t=>Math.floor(t/DAY))).size};};
function pool(rows){const symbolCounts={};for(const r of rows)symbolCounts[r.symbol]=(symbolCounts[r.symbol]||0)+1;
 const ranked=Object.entries(symbolCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 return {rows:rows.length,symbols:ranked.length,...span(rows),largestSymbolShare:ratio(ranked[0]?.[1]||0,rows.length),topFiveSymbolShare:ratio(ranked.slice(0,5).reduce((n,r)=>n+r[1],0),rows.length),symbolCounts:Object.fromEntries(ranked)};}
const support=[],minimumFailures=[],spanFailures=[];
for(const w of split.windows)for(const market of ['us','ca','crypto'])for(const dir of [1,-1]){
 const rs=split.records.filter(r=>r.fold===w.name&&byId.get(r.id).market===market&&byId.get(r.id).dir===dir);
 const fit=pool(rs.filter(r=>r.role==='fit').map(r=>byId.get(r.id)));
 const cohort=rs.filter(r=>r.cohortRole==='evaluate'),evaluated=cohort.filter(r=>r.role==='evaluate'),reasonCounts={};
 for(const r of cohort.filter(r=>r.role!=='evaluate'))reasonCounts[r.reason]=(reasonCounts[r.reason]||0)+1;
 const item={fold:w.name,market,dir,fit,validation:w.kind==='development_validation'?{cohortRows:cohort.length,admitted:pool(evaluated.map(r=>byId.get(r.id))),excludedRows:cohort.length-evaluated.length,excludedFraction:ratio(cohort.length-evaluated.length,cohort.length),exclusionReasons:reasonCounts}:null};support.push(item);
 if(fit.rows<500)minimumFailures.push({fold:w.name,market,dir,role:'fit',rows:fit.rows,minimum:500});
 if(!fit.atLeast12CalendarMonths)spanFailures.push({fold:w.name,market,dir,...span(rs.filter(r=>r.role==='fit').map(r=>byId.get(r.id)))});
 if(item.validation&&evaluated.length<100)minimumFailures.push({fold:w.name,market,dir,role:'evaluate',rows:evaluated.length,minimum:100});
 assert.equal(previous.counts[[w.name,'fit',market,dir].join('|')]||0,fit.rows);
 if(item.validation)assert.equal(previous.counts[[w.name,'evaluate',market,dir].join('|')]||0,evaluated.length);
}
const developmentQuality=['us','ca','crypto'].map(market=>{
 const rows=labels.filter(r=>r.market===market),unknown=rows.filter(r=>r.status==='unresolved'),reasons={};for(const r of unknown)reasons[r.reason]=(reasons[r.reason]||0)+1;
 return {market,rows:rows.length,resolvedRows:rows.length-unknown.length,unresolvedRows:unknown.length,unresolvedFraction:ratio(unknown.length,rows.length),unresolvedReasons:reasons};
});
const finalStart=Date.parse(c.split.finalTestStart),finalEnd=Date.parse(c.split.finalTestEndExclusive),finalDays=(finalEnd-finalStart)/DAY;
const expectedFinalDates={};for(const market of ['us','ca'])expectedFinalDates[market]=[...new Set(buildSchedule(market,calendar).slots.filter(s=>s.t>=finalStart&&s.t<finalEnd).map(s=>s.date))];
expectedFinalDates.crypto=Array.from({length:finalDays},(_,i)=>new Date(finalStart+i*DAY).toISOString().slice(0,10));
const sourceBySymbol=new Map(source.entries.map(r=>[r.symbol,r])),featureBySymbol=new Map(features.reports.map(r=>[r.symbol,r]));
const heldoutFeasibility=c.split.holdoutSymbols.map(symbol=>{
 const s=sourceBySymbol.get(symbol),f=featureBySymbol.get(symbol);assert.ok(s&&f);
 const ts=tags.filter(r=>r.symbol===symbol&&r.partition==='sealed_final'),days=[...new Set(ts.map(r=>r.availableAt.slice(0,10)))].sort();
 const expected=expectedFinalDates[f.market],missing=expected.filter(d=>!days.includes(d)),perDirection={long:ts.filter(r=>r.dir===1).length,short:ts.filter(r=>r.dir===-1).length};
 assert.ok(ts.every(r=>Date.parse(r.availableAt)>=finalStart&&Date.parse(r.availableAt)<finalEnd));
 assert.equal(perDirection.long,perDirection.short);assert.ok(days.every(d=>expected.includes(d)));
 return {symbol,market:f.market,sourceCaptureStatus:s.status,storedFeatureRowsAllV1Periods:f.rows,finalFeatureRows:ts.length,finalDecisionDays:days.length,expectedCalendarDecisionDays:expected.length,missingCalendarDecisionDays:missing,finalFeatureCoverage:ratio(days.length,expected.length),perDirection,firstFinalFeature:ts.map(r=>r.availableAt).sort()[0]??null,lastFinalFeature:ts.map(r=>r.availableAt).sort().at(-1)??null,zeroEligibleFeatures:f.rows===0,featureFeasibility:days.length===0?'unavailable':missing.length?'partial':'available',finalExecutionPathAcceptance:'not_assessed; no_final_outcomes_opened'};
});
const zeroFeatureSymbols=features.reports.filter(r=>r.rows===0).map(r=>({symbol:r.symbol,market:r.market,reserved:reserved.has(r.symbol)}));
const missingReserved=heldoutFeasibility.filter(r=>r.finalDecisionDays===0).map(r=>r.symbol),partialReserved=heldoutFeasibility.filter(r=>r.finalDecisionDays>0&&r.finalDecisionDays<r.expectedCalendarDecisionDays).map(r=>r.symbol);
const temporalSupport=[...c.split.validationWindows.map(w=>({name:w.name,start:w.decisionStart,endExclusive:w.decisionEndExclusive})),{name:'primary_final',start:c.split.finalTestStart,endExclusive:c.split.finalTestEndExclusive}].map(w=>{
 const days=(Date.parse(w.endExclusive)-Date.parse(w.start))/DAY,h=c.executionLabel.maxLabelWallDaysIncludingEntry;
 return {...w,calendarDays:days,conservativeLabelHorizonDays:h,completeNonoverlapping75DayDecisionBins:Math.floor(days/h),remainingDecisionDays:days%h,interpretation:'calendar-bin availability only, not an effective independent sample size; shared market shocks and overlapping label intervals remain'};
});
const mismatchSummary={scope:'pre-April nonreserved development metadata only',symbolsReviewed:accepted.quality.length,symbolsWithMismatchDays:accepted.quality.filter(r=>r.developmentMismatchDays>0).length,developmentMismatchSymbolDays:accepted.quality.reduce((n,r)=>n+r.developmentMismatchDays,0),bySymbol:accepted.quality.filter(r=>r.developmentMismatchDays>0).map(({symbol,market,developmentMismatchDays})=>({symbol,market,developmentMismatchDays})),thresholdPolicy:accepted.priceQuarantinePolicy,sourceRootCauseVerifiedFullUniverse:false};
const gates=[
 {name:'split_causality_and_replay',status:'pass',evidence:'Task 3: 46 passing tests; all checks true and protected inputs/hash identities match'},
 {name:'development_nominal_sample_minima',status:minimumFailures.length?'fail':'pass',fitMinimumPerMarketDirection:500,validationMinimumPerMarketDirection:100,failures:minimumFailures},
 {name:'training_12_calendar_month_span',status:spanFailures.length?'fail':'pass',failures:spanFailures,interpretation:'pooled admitted first-to-last decision span; not a continuous per-symbol 12-month path'},
 {name:'accepted_path_quarantine',status:'pass_with_limitations',evidence:'Unknown/mismatched/split paths are excluded and retained in coverage; quarantine does not prove their missingness is unbiased'},
 {name:'full_universe_source_acceptance',status:'blocked',evidence:'Unverified cross-frequency mismatch mechanisms, seven zero-feature instruments and nonrandom path exclusions remain'},
 {name:'reserved_symbol_feature_feasibility',status:missingReserved.length?'blocked':partialReserved.length?'partial':'pass',unavailableSymbols:missingReserved,partialSymbols:partialReserved,evidence:'Feature metadata only; no guarantee of accepted final execution paths'},
 {name:'independent_temporal_evidence',status:'inconclusive',evidence:'59/31-day validation and 39-day final windows each contain zero complete conservative 75-day decision bins; raw symbol/day/direction rows are dependent'},
 {name:'final_outcome_seal',status:'pass',evidence:'No reserved/gap/final label rows in development input; final labels have not been generated/opened by this report'}
];
const report={version:'wave-ml-evaluation-v2-task4-readiness-1',reviewedResearchCommit:'0b97274c33dce431160481345f354a7343f3dee2',observationCutoff:input.asOf,inputHashes:{parentContract:digest(parent),evaluationContract:digest(c),sourceManifest:digest(source),featureManifest:digest(features),calendar:digest(calendar),acceptedReport:digest(accepted),task2Report:digest(previous),task3Verification:digest(verification),acceptedLabels:digest(input.labels),v2Manifest:digest(manifest)},decision:{engineeringVerification:'pass',nominalDevelopmentSupport:minimumFailures.length||spanFailures.length?'fail':'pass',researchTrainingReady:false,productionReady:false,trainingStarted:false,finalLabelsOpened:false,overall:'BLOCKED_FOR_TRAINING; READY_FOR_ASTRA_REVIEW',blockingReasons:['full_universe_source_acceptance_pending','reserved_symbol_feature_feasibility_incomplete','independent_temporal_evidence_inconclusive'],interpretation:'V2 fixes decision/exit selection and nominal support starvation. It does not resolve source quality, recover missing heldout features, or establish profitable independent evidence.'},gates,support,developmentQuality,sourceQuality:mismatchSummary,zeroFeatureSymbols,heldoutFeasibility,temporalSupport,limitations:['Frozen current survivor universe; no historical constituent performance claim','Yahoo capture contains revised historical observations, not point-in-time provider-arrival history','Warmup/strict continuity resets and V1 storage determine feature coverage; V2 retagging does not recover omitted histories','Long/short rows and repeated daily opportunities share price paths; no effective sample size or confidence interval inferred from row counts','ATR labels are a distinct challenger and cannot be substituted for Elliott engine returns','Hypothetical short outcomes omit borrow, funding, dividends and FX; 0.05R nominal costs are not execution evidence','No class/return/performance model metrics or reserved/final outcomes inspected in Task 4','No model family/dependencies or trial settings selected; any later fitting needs a separate reviewed training task'],reviewOptions:[{option:'Repair source acceptance under a separately versioned dataset',conditions:'Verify instrument/adjustment identity and daily/hourly discrepancies from price metadata without outcomes; retain original quarantine and history exclusion; rerun eligibility and integrity before any fitting',notAuthorizedByThisReport:'Provider substitution, price rescaling, threshold relaxation or changing holdout symbols'}, {option:'Design a longer prospective sealed evidence period',conditions:'Review explicit decision span, full 75-day maturity and independent-block adequacy before collecting/scoring new evidence; preserve current frozen historical evidence',notAuthorizedByThisReport:'Changing final dates/holdout set or starting jobs automatically'}, {option:'Limited exploratory fitting after separate review',conditions:'Only if source limitations and restricted scope are explicitly accepted in a new task; mark historical final confidence inconclusive and retain no-promotion restriction',notAuthorizedByThisReport:'Training now or presenting restricted results as full-universe profitability evidence'}],recommendedNextStep:'Astra reviews this report and chooses a focused source-integrity repair plan before fitting; preserve final outcome seal and frozen evaluation contract'};
for(const [p,hash] of Object.entries(verification.protectedFileSha256))assert.equal(sha(p),hash);
const output=base+'evaluation-v2-task4-readiness-report.json';
if(fs.existsSync(path.join(root,output)))assert.deepEqual(json(output),report,'task4_report_replay_changed');else fs.writeFileSync(path.join(root,output),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({decision:report.decision,nominalFailures:minimumFailures.length,spanFailures:spanFailures.length,unavailableReservedSymbols:missingReserved,partialReservedSymbols:partialReserved,heldoutFeasibility:heldoutFeasibility.map(({symbol,finalDecisionDays,expectedCalendarDecisionDays,featureFeasibility})=>({symbol,finalDecisionDays,expectedCalendarDecisionDays,featureFeasibility})),developmentQuality,temporalSupport}));
