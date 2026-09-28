import fs from 'node:fs';
const cross=JSON.parse(fs.readFileSync('data/integrated-cross-stage-cap-diagnostic.json','utf8'));
const batch=JSON.parse(fs.readFileSync('data/integrated-cap6-batch-stability.json','utf8'));
const workload=JSON.parse(fs.readFileSync('data/integrated-surface-workload-audit.json','utf8'));
const checks=[];
for(const h of ['5','10','20']){
 const u=cross.horizons[h].uncapped,c=cross.horizons[h].roundRobin6;
 checks.push({name:`aggregate_mean_nonworse_${h}d`,pass:c.overall.mean>=u.overall.mean,detail:{uncapped:u.overall.mean,cap6:c.overall.mean}});
 checks.push({name:`aggregate_excess_nonworse_${h}d`,pass:c.overall.meanExcess>=u.overall.meanExcess,detail:{uncapped:u.overall.meanExcess,cap6:c.overall.meanExcess}});
 checks.push({name:`holdout_mean_nonworse_${h}d`,pass:c.recentHoldout.mean>=u.recentHoldout.mean,detail:{uncapped:u.recentHoldout.mean,cap6:c.recentHoldout.mean}});
 checks.push({name:`selected_beats_dropped_${h}d`,pass:c.overall.mean>c.dropped.mean&&c.overall.meanExcess>c.dropped.meanExcess,detail:{selected:c.overall,dropped:c.dropped}});
}
checks.push({name:'workload_max6',pass:cross.horizons['20'].roundRobin6.workload.max<=6,detail:cross.horizons['20'].roundRobin6.workload});
checks.push({name:'historical_problem_material',pass:workload.workload.averageChartsPerDay>10&&workload.workload.pctDaysOver10>60,detail:workload.workload});
for(const h of ['5','10','20']){
 const rows=batch.horizons[h];
 const maxMeanDamage=Math.min(...rows.map(x=>x.delta.holdoutMean));
 const maxExcessDamage=Math.min(...rows.map(x=>x.delta.holdoutExcess));
 checks.push({name:`batch_damage_bounded_${h}d`,pass:maxMeanDamage>=-0.2&&maxExcessDamage>=-0.2,detail:{worstHoldoutMeanDelta:maxMeanDamage,worstHoldoutExcessDelta:maxExcessDamage}});
}
const pass=checks.every(x=>x.pass);
const result={
 generatedAt:new Date().toISOString(),
 status:pass?'PASS':'FAIL',
 decision:pass?'Use an integrated backend-only max-6 shortlist. Preserve each stage validated surface, then select across stages by round-robin stage rank in stage-progression order: Early Watch, Recovery, Attractive Growth, Established Move. Never compare raw scores across stages.':'Do not activate integrated cap6 yet.',
 checks
};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/integrated-final-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(!pass)process.exitCode=2;
