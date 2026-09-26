import fs from 'node:fs';

const age=JSON.parse(fs.readFileSync('data/recovery-stage-age-diagnostic.json','utf8'));
const batch=JSON.parse(fs.readFileSync('data/recovery-freshness-batch-stability.json','utf8'));
const replay=JSON.parse(fs.readFileSync('data/recovery-surface-replay-diagnostic.json','utf8'));
const scan=JSON.parse(fs.readFileSync('data/v2-latest-scan.json','utf8'));

const horizons=['5','10','20'];
const checks=[];

for(const h of horizons){
  const base=age.horizons[h].surfacePolicies.noAgeLimit;
  const fresh=age.horizons[h].surfacePolicies.maxAge2;
  checks.push({
    name:`global_${h}d_quality_nonworse`,
    pass:(fresh.overall.mean>=base.overall.mean)&&(fresh.overall.meanExcess>=base.overall.meanExcess),
    detail:{baseMean:base.overall.mean,freshMean:fresh.overall.mean,baseExcess:base.overall.meanExcess,freshExcess:fresh.overall.meanExcess}
  });
  checks.push({
    name:`holdout_${h}d_mean_improves`,
    pass:fresh.recentHoldout.mean>=base.recentHoldout.mean,
    detail:{base:base.recentHoldout.mean,fresh:fresh.recentHoldout.mean}
  });
}

const stability={};
for(const h of horizons){
  const rows=batch.horizons[h];
  const improvedMean=rows.filter(x=>x.deltaAge2.holdoutMean>=0).length;
  const improvedExcess=rows.filter(x=>x.deltaAge2.holdoutExcess>=0).length;
  stability[h]={improvedMean,improvedExcess,total:rows.length};
}
checks.push({name:'batch_5d_holdout_mean_all_nonworse',pass:stability['5'].improvedMean===4,detail:stability['5']});
checks.push({name:'batch_10d_holdout_mean_majority_nonworse',pass:stability['10'].improvedMean>=3,detail:stability['10']});
checks.push({name:'batch_20d_holdout_mean_all_nonworse',pass:stability['20'].improvedMean===4,detail:stability['20']});
checks.push({name:'batch_20d_holdout_excess_all_nonworse',pass:stability['20'].improvedExcess===4,detail:stability['20']});

const live=(scan.surfacePicks?.Recovery||[]);
checks.push({
  name:'current_scan_surface_cap',
  pass:live.length<=6,
  detail:{visible:live.length}
});
checks.push({
  name:'current_scan_all_fresh',
  pass:live.every(x=>Number.isFinite(x.stageAge)&&x.stageAge<=2),
  detail:{rows:live.map(x=>({symbol:x.symbol,stageAge:x.stageAge,score:x.score,surfaceScore:x.surfaceScore}))}
});
checks.push({
  name:'current_engine_version_h2p7',
  pass:String(scan.version||'').includes('h2p7'),
  detail:{version:scan.version}
});

for(const h of horizons){
  const cur=replay.horizons[h].currentReviewFirst;
  const expected=age.horizons[h].surfacePolicies.maxAge2;
  const close=(a,b)=>Math.abs((a??0)-(b??0))<=0.05;
  checks.push({
    name:`implemented_replay_matches_diagnostic_${h}d`,
    pass:close(cur.overall.mean,expected.overall.mean)&&close(cur.recentHoldout.mean,expected.recentHoldout.mean),
    detail:{implementedOverall:cur.overall.mean,diagnosticOverall:expected.overall.mean,implementedHoldout:cur.recentHoldout.mean,diagnosticHoldout:expected.recentHoldout.mean}
  });
}

const pass=checks.every(x=>x.pass);
const result={
  generatedAt:new Date().toISOString(),
  status:pass?'PASS':'FAIL',
  decision:pass?'Recovery is defensible for research frontend surfacing. Detection remains unchanged; surface uses Review First + anti-chase ordering + stageAge <= 2 + max 6.':'Do not surface Recovery in frontend yet.',
  checks,
  currentSurface:(scan.surfacePicks?.Recovery||[]).map(x=>({symbol:x.symbol,score:x.score,surfaceScore:x.surfaceScore,stageAge:x.stageAge,ret5:x.ret5,ret20:x.ret20,rs20:x.rs20}))
};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/recovery-final-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(!pass) process.exitCode=2;
