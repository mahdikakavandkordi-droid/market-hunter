import fs from 'node:fs';

const baseline=JSON.parse(fs.readFileSync('data/established-move-baseline-audit.json','utf8'));
const stability=JSON.parse(fs.readFileSync('data/established-move-surface-selection-stability.json','utf8'));
const scan=JSON.parse(fs.readFileSync('data/v2-latest-scan.json','utf8'));
const checks=[];
for(const h of ['5','10','20']){
  const test=baseline.horizons[h].aggregate.test;
  const review=baseline.horizons[h].aggregate.reviewFirstTest;
  checks.push({name:`stage_test_positive_${h}d`,pass:test.mean>0,detail:{mean:test.mean,meanExcess:test.meanExcess}});
  checks.push({name:`review_positive_${h}d`,pass:review.mean>0&&review.meanExcess>=0,detail:{mean:review.mean,meanExcess:review.meanExcess}});
}
for(const h of ['5','10','20']){
  const base=stability.horizons[h].baseline.perBatch;
  const s60=stability.horizons[h].score60.perBatch;
  const meanWins=s60.filter((x,i)=>(x.recentHoldout?.mean??-Infinity)>=(base[i].recentHoldout?.mean??Infinity)).length;
  const excessWins=s60.filter((x,i)=>(x.recentHoldout?.meanExcess??-Infinity)>=(base[i].recentHoldout?.meanExcess??Infinity)).length;
  const minRequired=h==='20'?4:3;
  checks.push({name:`score60_holdout_mean_stability_${h}d`,pass:meanWins>=minRequired,detail:{wins:meanWins,total:4,minRequired}});
  checks.push({name:`score60_holdout_excess_stability_${h}d`,pass:excessWins>=minRequired,detail:{wins:excessWins,total:4,minRequired}});
}
const s60_20=stability.horizons['20'].score60.perBatch;
checks.push({
  name:'score60_reduces_review_workload',
  pass:s60_20.every(x=>(x.selection?.averageVisibleAllDays??99)<=3),
  detail:s60_20.map(x=>({batch:x.batch,avgVisible:x.selection?.averageVisibleAllDays,pctDays:x.selection?.pctDaysWithPicks}))
});
checks.push({
  name:'score60_keeps_reasonable_coverage',
  pass:s60_20.every(x=>(x.selection?.pctDaysWithPicks??0)>=70),
  detail:s60_20.map(x=>({batch:x.batch,pctDays:x.selection?.pctDaysWithPicks}))
});
const clean20=stability.horizons['20'].cleanReview.perBatch;
const base20=stability.horizons['20'].baseline.perBatch;
checks.push({
  name:'clean_gate_rejected_on_20d_holdout',
  pass:clean20.filter((x,i)=>(x.recentHoldout?.mean??Infinity)<(base20[i].recentHoldout?.mean??-Infinity)).length>=3,
  detail:clean20.map((x,i)=>({batch:x.batch,baseline:base20[i].recentHoldout?.mean,clean:x.recentHoldout?.mean}))
});
const current=(scan.byStage?.['Established Move']||[]);
const eligible=current.filter(x=>x.priorityBand==='Review First'&&x.score>=60);
checks.push({
  name:'current_surface_is_small',
  pass:eligible.length<=6,
  detail:{reviewFirst:current.filter(x=>x.priorityBand==='Review First').length,score60Eligible:eligible.length,symbols:eligible.map(x=>({symbol:x.symbol,score:x.score,riskFlags:x.riskFlags}))}
});
const pass=checks.every(x=>x.pass);
const result={
  generatedAt:new Date().toISOString(),
  status:pass?'PASS':'FAIL',
  decision:pass?'Established Move is defensible with unchanged classification/ranking and a stricter backend surface: Review First + score >= 60 + max 6. Risk flags remain context only; no freshness cap.':'Do not activate Established Move surface yet.',
  checks
};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/established-move-final-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(!pass)process.exitCode=2;
