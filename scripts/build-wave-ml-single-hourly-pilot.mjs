import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {buildFeatures,digest} from '../lib/wave-ml/features.mjs';
import {buildSingleHourly} from '../lib/wave-ml/single-hourly.mjs';
import {buildSchedule} from '../lib/wave-ml/calendar.mjs';
import {coverage} from '../lib/wave-ml/coverage.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base=path.join(root,'data/research/wave-ml-v1'),dir=path.join(base,'single-hourly-pilot-v1'),DAY=86400000;
const json=n=>JSON.parse(fs.readFileSync(path.join(base,n))),compressed=n=>JSON.parse(gunzipSync(Buffer.from(fs.readFileSync(path.join(base,'dataset',n),'utf8').trim(),'base64'))),sha=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const pilot=json('single-hourly-pilot-v1/contract.json'),parent=json('contract.json'),evaluation=json('evaluation-v2-contract.json'),sources=json('dataset/manifest.json'),features=json('dataset/feature-manifest.json'),calendar=json('official-calendar.json'),proof=json('evaluation-v2-task3-report.json');
assert.equal(digest(parent),pilot.parentContractHash);assert.equal(digest(evaluation),pilot.evaluationContractHash);assert.equal(digest(sources),pilot.sourceManifestHash);assert.equal(features.manifestHash,digest(sources));assert.equal(sources.asOf,pilot.observationCutoff);
assert.ok(pilot.symbols.every(s=>!evaluation.split.holdoutSymbols.includes(s)));assert.deepEqual(pilot.symbols,['AAPL','RY.TO','BTC-USD','ETH-USD']);
assert.equal(parent.sample.dailyWarmupBars,250);for(const [p,h] of Object.entries(proof.protectedFileSha256))assert.equal(sha(p),h);
const start=Date.parse(pilot.earliestSourceCalendarDate+'T00:00:00Z'),end=Date.parse(pilot.decisionEndExclusive),asOf=Math.min(Date.parse(sources.asOf),end-1);
const expectedDays=market=>market==='crypto'?Array.from({length:Math.ceil((end-start)/DAY)},(_,i)=>({date:new Date(start+i*DAY).toISOString().slice(0,10),availableAt:new Date(start+(i+1)*DAY+300000).toISOString()})).filter(r=>Date.parse(r.availableAt)<end):[...new Map(buildSchedule(market,calendar).slots.filter(s=>s.t>=start&&s.qualityAvailableAt+300000<end).map(s=>[s.date,{date:s.date,availableAt:new Date(s.qualityAvailableAt+300000).toISOString()}])).values()];
const records=[],builtRows=new Map(),allCandidate=[];
for(const symbol of pilot.symbols){
 const source=sources.entries.find(e=>e.symbol===symbol),original=compressed(source.file);assert.equal(digest(original),source.checksum);
 const meta=features.featureFiles.find(f=>f.symbol===symbol),old=compressed(meta.file);assert.equal(digest(old),meta.checksum);
 const hourly=original.hourly.filter(r=>r.t<end);
 const snapshot=buildSingleHourly({symbol,market:source.market,hourly,splits:original.quality.splits,calendar,startDate:pilot.earliestSourceCalendarDate,asOf});
 const rows=buildFeatures(snapshot,parent).filter(r=>Date.parse(r.availableAt)<end),long=rows.filter(r=>r.dir===1),oldRows=old.rows.filter(r=>r.dir===1&&Date.parse(r.availableAt)>=start&&Date.parse(r.availableAt)<end);
 builtRows.set(symbol,rows);allCandidate.push(...rows);
 const dates=expectedDays(source.market).map(d=>d.availableAt.slice(0,10));if(source.market==='crypto')dates.unshift(new Date(start).toISOString().slice(0,10));
 const optimistic=expectedDays(source.market).slice(parent.sample.dailyWarmupBars-1).map(d=>({availableAt:d.availableAt}));
 const resetDates=snapshot.dailyGapBeforeTimes.map(t=>snapshot.daily.find(b=>b.t===t).date);
 // Equality below is expected by construction, not independent price validation.
 for(const d of snapshot.daily){const xs=snapshot.executionBars.filter(x=>x.date===d.date);assert.equal(xs.reduce((n,b)=>n+b.sourceCount,0),d.sourceCount);assert.equal(d.o,xs[0].o);assert.equal(d.c,xs.at(-1).c);assert.equal(d.h,Math.max(...xs.map(x=>x.h)));assert.equal(d.l,Math.min(...xs.map(x=>x.l)));}
 let prefixChecks=0;const checks=[...new Set([.25,.5,.75,1].map(f=>Math.floor((asOf-start)*f+start)))];
 for(const at of checks){if(at<=start)continue;const partial=buildSingleHourly({symbol,market:source.market,hourly,splits:original.quality.splits,calendar,startDate:pilot.earliestSourceCalendarDate,asOf:at});
  assert.equal(digest(partial.daily),digest(snapshot.daily.filter(b=>b.endT<=at)));assert.equal(digest(partial.executionBars),digest(snapshot.executionBars.filter(b=>b.endT<=at)));assert.equal(digest(buildFeatures(partial,parent)),digest(rows.filter(r=>Date.parse(r.availableAt)<=at)));prefixChecks++;
 }
 const columns=Object.keys(rows[0]?.features||{}),compact={columns,rows:rows.map(({features,...r})=>({...r,values:columns.map(k=>features[k])}))};
 records.push({symbol,market:source.market,sourceSnapshotHash:source.checksum,firstHourlySource:new Date(hourly[0].t).toISOString(),inputHourlyRows:hourly.length,dailyHash:digest(snapshot.daily),executionHash:digest(snapshot.executionBars),snapshotHash:digest(snapshot),featureMatrixHash:digest(compact),featureRows:rows.length,perDirectionFeatureRows:long.length,completeDailyBars:snapshot.daily.length,executionBars:snapshot.executionBars.length,expectedCompletedDailyBars:snapshot.quality.expectedCompletedDays,incompleteDays:snapshot.quality.incompleteDays,resetDates,offScheduleHourlyRows:snapshot.quality.offScheduleTimes.length,originalVsPilot:{original:coverage(oldRows,dates),pilot:coverage(long,dates),optimisticNoMissingHourly:coverage(optimistic,dates)},firstPossibleFeatureWithPerfectHourlyData:optimistic[0]?.availableAt??null,prefixChecks,priceAuthorityVerified:false,volumeSemanticsVerified:false});
}
const firstLast=rows=>{const t=rows.map(r=>Date.parse(r.availableAt)).sort((a,b)=>a-b),first=t[0],last=t.at(-1);let anniversary=null;if(t.length){anniversary=new Date(first);anniversary.setUTCFullYear(anniversary.getUTCFullYear()+1);}return {rows:rows.length,first:first===undefined?null:new Date(first).toISOString(),last:last===undefined?null:new Date(last).toISOString(),calendarSpanDays:t.length?(last-first)/DAY:0,atLeast12CalendarMonths:t.length>0&&last>=anniversary.getTime()};};
const fittingFeasibility=[];
for(const w of evaluation.split.validationWindows){const cutoff=Date.parse(w.decisionStart)-evaluation.split.embargoDays*DAY;
 for(const market of ['us','ca','crypto']){
  const rows=allCandidate.filter(r=>r.market===market&&r.dir===1&&Math.floor(Date.parse(r.availableAt)/DAY)*DAY+DAY<=cutoff);
  const perfect=expectedDays(market).slice(249).filter(r=>Math.floor(Date.parse(r.availableAt)/DAY)*DAY+DAY<=cutoff);
  fittingFeasibility.push({fold:w.name,market,fitDecisionEndExclusive:new Date(cutoff).toISOString(),actualFeaturesPerDirection:firstLast(rows),optimisticPerfectSourceTimeSpan:firstLast(perfect),interpretation:'feature eligibility only; no labels, interval purge, class support or fit-quality acceptance. Counts are an upper bound on supervised fitting; optimistic rows count calendar opportunities per symbol.'});
 }
}
assert.ok(fittingFeasibility.every(r=>!r.optimisticPerfectSourceTimeSpan.atLeast12CalendarMonths));
const report={version:'wave-ml-single-hourly-pilot-report-1',pilotContractHash:digest(pilot),sourceManifestHash:digest(sources),parentContractHash:digest(parent),evaluationContractHash:digest(evaluation),calendarHash:digest(calendar),sourceObservationCutoff:sources.asOf,pilotAsOf:new Date(asOf).toISOString(),symbols:records,fittingFeasibility,engineering:{sameSourceCrossTimeframeAggregation:'pass_by_construction_not_independent_validation',causalPrefixChecks:records.reduce((n,r)=>n+r.prefixChecks,0),dailyAndExecutionMissingPathsPreserved:true,originalProtectedEvidenceByteUnchanged:true},decision:{status:'PILOT_BUILT; CURRENT_HISTORY_INSUFFICIENT_FOR_FROZEN_TRAINING_DESIGN',researchTrainingReady:false,fullUniverseRebuildStarted:false,trainingStarted:false,outcomesBuilt:false,finalLabelsOpened:false,reason:'Even a perfect uninterrupted hourly stream from Oct 8, 2024 cannot provide 250-bar warmup plus 12 months fitting history before either frozen validation embargo boundary',sourcePriceAuthorityVerified:false,volumeSemanticsVerified:false},limitations:['Four preselected development representatives are a feasibility pilot, not a replacement universe','Original pipeline has five-year daily warmup; this pilot has only the captured hourly history. Feature count comparisons are confounded by history length and source methodology; no signal quality comparison is claimed','Constructed daily/4H equality cannot validate provider price accuracy, adjustment conventions, volume semantics or tradability','Incomplete expected sessions/days still reset the complete 250-bar feature state','No labels, metrics, model trial, independent block confidence or final outcome was produced','Full derived bars/features are rebuilt deterministically in memory; their hashes and coverage are recorded here. Original frozen archives are required for reproduction'],nextStep:'Obtain and verify hourly history covering warmup before the frozen training start, with authoritative exchange calendars and adjustment/volume conventions, or preregister later prospective validation boundaries with adequate history and maturity. Do not lower the frozen 250-bar/12-month rules to force this pilot to train.'};
for(const [p,h] of Object.entries(proof.protectedFileSha256))assert.equal(sha(p),h);
const file=path.join(dir,'report.json');if(fs.existsSync(file))assert.deepEqual(JSON.parse(fs.readFileSync(file)),report,'pilot_replay_changed');else fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({decision:report.decision,symbols:records.map(r=>({symbol:r.symbol,daily:r.completeDailyBars,incompleteDays:r.incompleteDays.length,resets:r.resetDates,featureRows:r.featureRows,originalDirectionRows:r.originalVsPilot.original.rows,pilotDirectionRows:r.perDirectionFeatureRows,firstPilotFeature:r.originalVsPilot.pilot.firstObserved,firstPossibleFeature:r.firstPossibleFeatureWithPerfectHourlyData})),fittingFeasibility,prefixChecks:report.engineering.causalPrefixChecks}));
