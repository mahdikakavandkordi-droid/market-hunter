import fs from 'node:fs';
import path from 'node:path';
import {HORIZONS,STAGES,parseJsonl,sha256Json,marketCalendarDate} from '../lib/market-hunter-forward-validation.js';

const ROOT=process.env.MH_FORWARD_DIR||'data/research/market-hunter-forward-validation';
const read=name=>{
  const file=path.join(ROOT,name);
  return fs.existsSync(file)?parseJsonl(fs.readFileSync(file,'utf8')):[];
};
const sessions=read('sessions.jsonl'),presences=read('presences.jsonl'),episodes=read('episodes.jsonl'),outcomes=read('outcomes.jsonl'),runs=read('runs.jsonl');
const experimentSessions=read('selection-experiment/sessions.jsonl'),experimentOutcomes=read('selection-experiment/outcomes.jsonl');
const checks=[];
function check(name,pass,detail={}){checks.push({name,pass:Boolean(pass),detail})}
function unique(name,rows,key){
  const ids=rows.map(key),set=new Set(ids);
  check(name,set.size===ids.length,{records:ids.length,unique:set.size});
}
unique('sessionId unique',sessions,x=>x.sessionId);
unique('presenceId unique',presences,x=>x.presenceId);
unique('episodeId unique',episodes,x=>x.episodeId);
unique('outcomeId unique',outcomes,x=>x.outcomeId);
unique('runId unique',runs,x=>x.runId);
unique('experiment session IDs unique',experimentSessions,x=>x.sessionId);
unique('experiment outcome IDs unique',experimentOutcomes,x=>x.outcomeId);
check('experiment policy frozen with each capture',experimentSessions.every(s=>s.policyHash===sha256Json(s.policy)&&s.policy.prospectiveOnly===true&&s.policy.changesProductionSelection===false));
check('experiment captures are same-day and source-identified',experimentSessions.every(s=>marketCalendarDate(Date.parse(s.capturedAt))===s.marketDate&&s.sourceReportHash&&Date.parse(s.capturedAt)>=Date.parse(s.sourceGeneratedAt)));
check('experiment baseline and shadow respect caps and membership',experimentSessions.every(s=>s.baseline.length<=6&&s.shadow.length<=6&&new Set(s.candidates.map(r=>r.symbol)).size===s.candidates.length&&[...s.baseline,...s.shadow].every(symbol=>s.candidates.some(r=>r.symbol===symbol))&&s.candidates.every(r=>r.baselineSelected===s.baseline.includes(r.symbol)&&r.shadowSelected===s.shadow.includes(r.symbol)&&(!r.shadowSelected||r.stageEligible))));
check('experiment outcomes reference frozen candidates',experimentOutcomes.every(o=>{
  const s=experimentSessions.find(s=>s.sessionId===o.sessionId),r=s?.candidates.find(r=>r.symbol===o.symbol);
  return r&&o.policyHash===s.policyHash&&o.decisionDate===s.marketDate&&o.targetDate>o.decisionDate&&s.policy.horizons.includes(o.horizonSessions)&&o.baselineSelected===r.baselineSelected&&o.shadowSelected===r.shadowSelected;
}));

const sessionIds=new Set(sessions.map(x=>x.sessionId)),episodeIds=new Set(episodes.map(x=>x.episodeId));
check('session dates are unique',new Set(sessions.map(x=>x.marketDate)).size===sessions.length);
check('sessions carry model identity',sessions.every(x=>x.modelVersion&&x.sourceReportHash&&x.marketDate));
check('stage surfaces respect max six',sessions.every(s=>STAGES.every(stage=>(s.stagePicks?.[stage]||[]).length<=6)));
check('integrated surface respects max six',sessions.every(s=>(s.integrated||[]).length<=6));
check('presences reference sessions',presences.every(p=>sessionIds.has('market-hunter-session|'+p.marketDate)));
check('presences reference episodes',presences.every(p=>episodeIds.has(p.episodeId)));
check('episodes reference sessions',episodes.every(e=>sessionIds.has(e.sourceSessionId)));
check('first-surface records have episodes',presences.filter(p=>p.isFirstSurface).every(p=>episodes.some(e=>e.episodeId===p.episodeId)));
check('outcomes reference episodes',outcomes.every(o=>episodeIds.has(o.episodeId)));
check('outcome horizons are allowed',outcomes.every(o=>HORIZONS.includes(o.horizonSessions)));
check('outcome dates move forward',outcomes.every(o=>o.targetDate>o.decisionDate));
check('outcome IDs match episode+horizon',outcomes.every(o=>o.outcomeId===o.episodeId+'|h'+o.horizonSessions));
check('no historical backfill marker',sessions.every(s=>s.collectorVersion==='market-hunter-forward-validation-v1-2026-09-29'));

const byEpisode=new Map();
for(const outcome of outcomes){
  if(!byEpisode.has(outcome.episodeId))byEpisode.set(outcome.episodeId,new Set());
  byEpisode.get(outcome.episodeId).add(outcome.horizonSessions);
}
check('one outcome per episode horizon',[...byEpisode.values()].every(set=>set.size<4));

const audit={
  format:'market-hunter-forward-validation-audit-v1',
  generatedAt:new Date().toISOString(),
  counts:{sessions:sessions.length,presences:presences.length,episodes:episodes.length,outcomes:outcomes.length,runs:runs.length,experimentSessions:experimentSessions.length,experimentOutcomes:experimentOutcomes.length},
  coverage:fs.existsSync(path.join(ROOT,'monitor.json'))?JSON.parse(fs.readFileSync(path.join(ROOT,'monitor.json'),'utf8')).coverage||null:null,
  checks,
  totalChecks:checks.length,
  passedChecks:checks.filter(x=>x.pass).length,
  failedChecks:checks.filter(x=>!x.pass).length
};
fs.mkdirSync(ROOT,{recursive:true});
fs.writeFileSync(path.join(ROOT,'audit.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(audit,null,2));
if(audit.failedChecks)process.exitCode=1;
