// Run against the prospective branch's original episode/outcome ledgers.
import fs from 'node:fs';
import '../hunter-discovery.js';

const [episodePath,outcomePath,asOf]=process.argv.slice(2);
if(!episodePath||!outcomePath||!/^\d{4}-\d{2}-\d{2}$/.test(asOf))throw Error('Expected episodes.jsonl, outcomes.jsonl and YYYY-MM-DD');
const read=path=>fs.readFileSync(path,'utf8').trim().split('\n').map(line=>JSON.parse(line));
const episodes=new Map(read(episodePath).map(row=>[row.episodeId,row.decision]));
const outcomes=read(outcomePath).filter(row=>row.scope==='stage' && row.targetDate<=asOf);
function summarize(rows){
 const excess=rows.map(row=>row.excessReturnPct);
 return {observations:rows.length,symbols:new Set(rows.map(row=>row.symbol)).size,
  decisionDates:new Set(rows.map(row=>row.decisionDate)).size,
  beat:excess.filter(value=>value>0).length,
  meanExcess:excess.length?Number((excess.reduce((a,b)=>a+b,0)/excess.length).toFixed(2)):null,
  lostTenPercent:rows.filter(row=>row.returnPct<=-10).length};
}
const groups={};
for(const [stage,horizon] of [['Recovery',5],['Early Watch',20]]){
 const matching=[],others=[];
 for(const row of outcomes.filter(row=>row.entryStage===stage&&row.horizonSessions===horizon)){
  const decision=episodes.get(row.episodeId);
  if(!decision || !Number.isFinite(row.excessReturnPct) || !Number.isFinite(row.returnPct))throw Error('Incomplete episode '+row.episodeId);
  (globalThis.MarketHunterDiscovery.passesFocusFactors(decision)?matching:others).push(row);
 }
 groups[stage]={horizon,matching:summarize(matching),others:summarize(others)};
}
console.log(JSON.stringify({version:globalThis.MarketHunterDiscovery.focusVersion,market:'CA',asOf,groups},null,2));
