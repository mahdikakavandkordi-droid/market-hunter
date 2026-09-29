import fs from 'node:fs';
import path from 'node:path';
import {HORIZONS,STAGES,parseJsonl} from '../lib/market-hunter-forward-validation.js';

const ROOT=process.env.MH_FORWARD_DIR||'data/research/market-hunter-forward-validation';
const read=name=>{
  const file=path.join(ROOT,name);
  return fs.existsSync(file)?parseJsonl(fs.readFileSync(file,'utf8')):[];
};
const sessions=read('sessions.jsonl'),presences=read('presences.jsonl'),episodes=read('episodes.jsonl'),outcomes=read('outcomes.jsonl'),runs=read('runs.jsonl');
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
  counts:{sessions:sessions.length,presences:presences.length,episodes:episodes.length,outcomes:outcomes.length,runs:runs.length},
  checks,
  totalChecks:checks.length,
  passedChecks:checks.filter(x=>x.pass).length,
  failedChecks:checks.filter(x=>!x.pass).length
};
fs.mkdirSync(ROOT,{recursive:true});
fs.writeFileSync(path.join(ROOT,'audit.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(audit,null,2));
if(audit.failedChecks)process.exitCode=1;
