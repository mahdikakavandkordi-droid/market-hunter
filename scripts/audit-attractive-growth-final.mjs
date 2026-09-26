import fs from 'node:fs';

const reports=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const replay=JSON.parse(fs.readFileSync('data/attractive-growth-surface-replay.json','utf8'));
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
function agg(xs){
  xs=xs.filter(Boolean);const n=xs.reduce((s,x)=>s+(x.n||0),0);if(!n)return null;
  const w=k=>{const ys=xs.filter(x=>Number.isFinite(x?.[k])&&x.n>0);const den=ys.reduce((s,x)=>s+x.n,0);return den?round(ys.reduce((s,x)=>s+x[k]*x.n,0)/den,2):null};
  return {n,mean:w('mean'),positiveRate:w('positiveRate'),benchmarkBeatRate:w('benchmarkBeatRate'),meanExcess:w('meanExcess'),avgMAE:w('avgMAE'),avgMFE:w('avgMFE')};
}
const checks=[],horizons=['5','10','20'],summary={};
for(const h of horizons){
  const stage=reports.map(r=>r.horizons[h].byStage['Attractive Growth']);
  const test=agg(stage.map(x=>x.test));
  const review=agg(stage.map(x=>x.fixedPriority.reviewFirst.test));
  const batchReview=stage.map((x,i)=>({batch:i,...x.fixedPriority.reviewFirst.test}));
  const daily=replay.horizons[h].currentReviewFirst;
  summary[h]={test,review,batchReview,daily};
  checks.push({name:`review_improves_stage_mean_${h}d`,pass:review.mean>test.mean,detail:{stage:test.mean,review:review.mean}});
  checks.push({name:`review_excess_positive_${h}d`,pass:review.meanExcess>0,detail:{meanExcess:review.meanExcess}});
  checks.push({name:`all_batches_review_mean_positive_${h}d`,pass:batchReview.every(x=>x.mean>0),detail:batchReview.map(x=>({batch:x.batch,mean:x.mean,meanExcess:x.meanExcess}))});
  checks.push({name:`daily_holdout_positive_${h}d`,pass:daily.recentHoldout.mean>0&&daily.recentHoldout.meanExcess>=0,detail:{mean:daily.recentHoldout.mean,meanExcess:daily.recentHoldout.meanExcess}});
  checks.push({name:`top6_beats_excluded_${h}d`,pass:(daily.crowdedDays.selectedTop6?.mean??-Infinity)>(daily.crowdedDays.excludedBelow6?.mean??Infinity),detail:{top6:daily.crowdedDays.selectedTop6?.mean,excluded:daily.crowdedDays.excludedBelow6?.mean}});
}
const d20=replay.horizons['20'];
checks.push({
  name:'baseline_20d_not_dominated_by_risk_reorder',
  pass:d20.currentReviewFirst.overall.mean>=d20.riskPenalty6.overall.mean&&d20.currentReviewFirst.overall.mean>=d20.cleanFirstOrdering.overall.mean&&d20.currentReviewFirst.recentHoldout.mean>=d20.riskPenalty6.recentHoldout.mean&&d20.currentReviewFirst.recentHoldout.mean>=d20.cleanFirstOrdering.recentHoldout.mean,
  detail:{baselineOverall:d20.currentReviewFirst.overall.mean,riskPenaltyOverall:d20.riskPenalty6.overall.mean,cleanFirstOverall:d20.cleanFirstOrdering.overall.mean,baselineHoldout:d20.currentReviewFirst.recentHoldout.mean,riskPenaltyHoldout:d20.riskPenalty6.recentHoldout.mean,cleanFirstHoldout:d20.cleanFirstOrdering.recentHoldout.mean}
});
const age=d20.ageBuckets;
checks.push({
  name:'no_freshness_cap_supported',
  pass:(age.age6to10?.mean??-Infinity)>=(age.age0to2?.mean??Infinity),
  detail:{age0to2:age.age0to2?.mean,age3to5:age.age3to5?.mean,age6to10:age.age6to10?.mean,age11to20:age.age11to20?.mean}
});
const pass=checks.every(x=>x.pass);
const result={
  generatedAt:new Date().toISOString(),
  status:pass?'PASS':'FAIL',
  decision:pass?'Attractive Growth is defensible with unchanged classification/ranking and a backend surface of Review First + max 6. No clean-only gate and no stage-age cap.':'Do not activate Attractive Growth surface yet.',
  checks,summary
};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/attractive-growth-final-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(!pass) process.exitCode=2;
