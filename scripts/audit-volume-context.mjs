// Read-only retrospective analysis: never fetch prices or modify canonical evidence.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {summarizeHunterQuality} from '../lib/hunter-quality.js';
export function auditVolume(episodes,outcomes,asOf){
  const decisions=new Map();
  for(const e of episodes){if(!e.episodeId||decisions.has(e.episodeId))throw new Error('duplicate_episode');decisions.set(e.episodeId,e);}
  const bucket=o=>{
    const e=decisions.get(o.episodeId);
    if(!e||e.symbol!==o.symbol||e.startDate!==o.decisionDate||e.scope!==o.scope)throw new Error('outcome_decision_mismatch');
    const p=e.decision||{};
    if(!Number.isFinite(p.maxRvol5)||!Number.isFinite(p.avgDollar20)||p.avgDollar20<3000000)return 'unknown';
    return p.maxRvol5>=1.5?'spike':'no_spike';
  };
  const classified=outcomes.map(o=>({o,bucket:bucket(o)}));
  const groups={};
  for(const key of ['all','spike','no_spike','unknown'])groups[key]=summarizeHunterQuality(classified.filter(x=>key==='all'||x.bucket===key).map(x=>x.o),asOf);
  return {version:'volume-retrospective-v1',asOf,rule:'Recorded maxRvol5 >= 1.5; avgDollar20 >= CAD 3m; no threshold search',
    limitations:['Post-hoc hypothesis, not out-of-sample validation','Recent 5-session spike is not rising volume or same-day breakout confirmation','Only recorded matured outcomes; missing outcomes are not zero','Overlapping dates and repeated symbols are not independent','Selection returns, not an executable portfolio; no transaction costs','Stage groups overlap; the existing scanner already uses volume'],groups};
}
if(process.argv[1]?.endsWith('/audit-volume-context.mjs')){
  const ref=process.argv[2]||'refs/remotes/origin/volume-evidence';
  const root='data/research/market-hunter-forward-validation/';
  const read=name=>execFileSync('git',['show',ref+':'+root+name],{encoding:'utf8',maxBuffer:30*1024*1024});
  const lines=name=>read(name).trim().split('\n').filter(Boolean).map(x=>JSON.parse(x));
  const status=JSON.parse(read('status.json'));
  const result={sourceCommit:execFileSync('git',['rev-parse',ref],{encoding:'utf8'}).trim(),...auditVolume(lines('episodes.jsonl'),lines('outcomes.jsonl'),status.latestMarketAsOf)};
  if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');
  for(const [key,q] of Object.entries(result.groups))for(const group of q.groups)for(const h of [5,10,20]){
    const x=group.horizons[h];if(x.recorded)console.log(JSON.stringify({bucket:key,stage:group.stage||'Integrated',h,n:x.observations,symbols:x.uniqueSymbols,dates:x.decisionDates,mean:x.meanExcessPct,median:x.medianExcessPct,balanced:x.symbolBalancedExcessPct}));
  }
}
