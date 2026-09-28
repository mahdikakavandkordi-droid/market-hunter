import fs from 'node:fs';
import path from 'node:path';
import {HTP_VERSION,HTP_PARAMS} from '../lib/healthy-trend-pullback.js';
import {VERSION as EARLY_WATCH_VERSION} from '../lib/market-hunter-v2-engine.js';
import {HTP_FORWARD_COLLECTOR_VERSION,parseJsonl,observationId,pickObservationId} from '../lib/healthy-trend-pullback-forward.js';

const OUT_DIR=process.env.HTP_FORWARD_DIR||'data/research/healthy-trend-pullback-forward';
const read=name=>fs.existsSync(path.join(OUT_DIR,name))?parseJsonl(fs.readFileSync(path.join(OUT_DIR,name),'utf8')):[];
const inputs=read('inputs.jsonl'),observations=read('observations.jsonl'),outcomes=read('outcomes.jsonl'),runs=read('runs.jsonl');
const checks=[],differences=[];
function check(name,pass,detail={}){checks.push({name,pass,detail});if(!pass)differences.push({name,detail})}
function unique(rows,key){const s=new Set();let dup=0;for(const r of rows){const k=key(r);if(s.has(k))dup++;s.add(k)}return {unique:s.size,duplicates:dup}}

const allowedModels=new Map([
  ['core',HTP_VERSION],['trend_rs',HTP_VERSION],['early_watch',EARLY_WATCH_VERSION]
]);
const inputUniq=unique(inputs,x=>x.marketAsOf);
const obsUniq=unique(observations,x=>x.observationId);
const outcomeUniq=unique(outcomes,x=>x.outcomeId);
const runUniq=unique(runs,x=>x.runId);
check('input market dates are append-only unique',inputUniq.duplicates===0,inputUniq);
check('observation identities are append-only unique',obsUniq.duplicates===0,obsUniq);
check('outcome identities are append-only unique',outcomeUniq.duplicates===0,outcomeUniq);
check('collector run identities are append-only unique',runUniq.duplicates===0,runUniq);

const earliest='2026-09-28';
check('no prospective input is historical backfill',inputs.every(x=>x.marketAsOf>=earliest),{earliest,dates:inputs.map(x=>x.marketAsOf)});
check('collector version is frozen',inputs.every(x=>x.collectorVersion===HTP_FORWARD_COLLECTOR_VERSION)&&observations.every(x=>x.collectorVersion===HTP_FORWARD_COLLECTOR_VERSION),{collectorVersion:HTP_FORWARD_COLLECTOR_VERSION});
check('only frozen Core, Trend+RS and Early Watch models are collected',observations.every(x=>allowedModels.get(x.model)===x.modelVersion),{models:[...allowedModels]});
check('retired volume and market variants are absent prospectively',observations.every(x=>!['core_volume','core_market'].includes(x.model)),{});

const inputByDate=new Map(inputs.map(x=>[x.marketAsOf,x]));
let missingModelDays=0,inputLinkMismatch=0,statusMismatch=0,pickMismatch=0,oversize=0,duplicateSymbols=0;
for(const input of inputs){
  const day=observations.filter(x=>x.marketAsOf===input.marketAsOf);
  const present=new Set(day.map(x=>x.model));
  if(day.length!==3||[...allowedModels.keys()].some(m=>!present.has(m)))missingModelDays++;
}
const allowedStatus=new Set(['complete_zero_pick','complete_nonzero','partial_coverage','collector_failure','market_not_completed']);
const pickIds=new Map();
for(const o of observations){
  const input=inputByDate.get(o.marketAsOf);
  if(!input||o.inputManifestHash!==input.inputManifestHash||o.universeVersion!==input.universeVersion)inputLinkMismatch++;
  if(!allowedStatus.has(o.status))statusMismatch++;
  if(o.status==='complete_zero_pick'&&((o.picks||[]).length!==0||o.zeroPick!==true))statusMismatch++;
  if(o.status==='complete_nonzero'&&((o.picks||[]).length===0||o.zeroPick===true))statusMismatch++;
  if((o.picks||[]).length>HTP_PARAMS.maxVisible)oversize++;
  const seen=new Set();
  for(const p of o.picks||[]){
    if(seen.has(p.symbol))duplicateSymbols++;seen.add(p.symbol);
    const expected=pickObservationId(o.modelVersion,o.marketAsOf,o.model,p.symbol);
    if(p.pickObservationId!==expected||!Number.isFinite(p.decisionAtr14)||p.decisionAtr14<=0)pickMismatch++;
    pickIds.set(p.pickObservationId,{observation:o,pick:p});
  }
  if(o.observationId!==observationId(o.modelVersion,o.marketAsOf,o.model))pickMismatch++;
}
check('every collected market date has exactly three frozen model records',missingModelDays===0,{inputDays:inputs.length,missingModelDays});
check('observations link to exact immutable input manifests',inputLinkMismatch===0,{inputLinkMismatch});
check('zero-pick, nonzero and partial statuses remain distinct',statusMismatch===0,{statusMismatch});
check('surface cap is never force-filled above six',oversize===0,{oversize});
check('daily pick identities are unique and auditable',pickMismatch===0&&duplicateSymbols===0,{pickMismatch,duplicateSymbols,picks:pickIds.size});

let orphanOutcomes=0,outcomeDateErrors=0,outcomeLabelErrors=0;
for(const o of outcomes){
  const p=pickIds.get(o.pickObservationId);
  if(!p||o.observationId!==p.observation.observationId||o.symbol!==p.pick.symbol){orphanOutcomes++;continue}
  if(o.decisionDate!==p.observation.marketAsOf||!(o.finalDate>o.decisionDate)||!(o.outcomeInputMarketAsOf>=o.finalDate))outcomeDateErrors++;
  if(o.status==='corporate_action_during_horizon'&&o.primaryExcluded!==true)outcomeLabelErrors++;
  if(o.status==='evaluated'&&!['success','adverse_first','neither','ambiguous_both_hit','suspension_or_irregular_gap'].includes(o.primaryLabel))outcomeLabelErrors++;
  if(o.primaryLabel==='ambiguous_both_hit'&&o.primaryExcluded===false&&o.timeToFavourable!=null)outcomeLabelErrors++;
}
check('outcomes only attach to immutable recorded picks',orphanOutcomes===0,{orphanOutcomes});
check('outcomes mature no earlier than their final required session',outcomeDateErrors===0,{outcomeDateErrors});
check('corporate-action and ambiguous-path labels are conservatively handled',outcomeLabelErrors===0,{outcomeLabelErrors});

const allowedRuns=new Set(['market_not_completed','no_new_completed_market_session','collected','collector_failure']);
check('collector invocation states are explicit',runs.every(x=>allowedRuns.has(x.status)),{runCount:runs.length,statuses:[...new Set(runs.map(x=>x.status))]});

const audit={
  format:'market-hunter-healthy-trend-pullback-forward-audit-v1',
  generatedAt:new Date().toISOString(),
  collectorVersion:HTP_FORWARD_COLLECTOR_VERSION,
  activationState:inputs.length?'data_present':'implemented_not_yet_collected',
  inputRecords:inputs.length,observationRecords:observations.length,outcomeRecords:outcomes.length,runRecords:runs.length,
  checks,totalChecks:checks.length,passedChecks:checks.filter(x=>x.pass).length,failedChecks:checks.filter(x=>!x.pass).length,differences
};
fs.mkdirSync(OUT_DIR,{recursive:true});
fs.writeFileSync(path.join(OUT_DIR,'audit.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(audit,null,2));
if(audit.failedChecks)process.exitCode=1;
