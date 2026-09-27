import fs from 'node:fs';

const stages=['Early Watch','Recovery','Attractive Growth','Established Move'];
const horizons=['5','10','20'];
const round=(n,d=3)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const oldFiles=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync(`data/v2-backtest-batch-${i}.json`,'utf8')));
const newFiles=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync(`tmp-purged/v2-backtest-batch-${i}.json`,'utf8')));

function s(v){return v&&typeof v==='object'?v:null}
function delta(a,b){return Number.isFinite(a)&&Number.isFinite(b)?round(b-a):null}
const rows=[];
for(let batch=0;batch<4;batch++){
  for(const h of horizons){
    for(const stage of stages){
      const o=oldFiles[batch]?.horizons?.[h]?.byStage?.[stage];
      const n=newFiles[batch]?.horizons?.[h]?.byStage?.[stage];
      if(!o||!n)continue;
      const op=o.ranking?.trainThresholds||{},np=n.ranking?.trainThresholds||{};
      const purge=n.ranking?.purge||{};
      rows.push({
        batch,horizon:Number(h),stage,
        cutDate:n.ranking?.cutDate||null,
        prePurgeTrainCount:purge.prePurgeTrainCount??null,
        purgedTrainCount:purge.purgedTrainCount??null,
        trainCount:purge.trainCount??null,
        testCount:purge.testCount??null,
        q80Before:op.q80??null,q80After:np.q80??null,q80Delta:delta(op.q80,np.q80),
        q90Before:op.q90??null,q90After:np.q90??null,q90Delta:delta(op.q90,np.q90),
        testMeanBefore:o.test?.mean??null,testMeanAfter:n.test?.mean??null,testMeanDelta:delta(o.test?.mean,n.test?.mean),
        testExcessBefore:o.test?.meanExcess??null,testExcessAfter:n.test?.meanExcess??null,testExcessDelta:delta(o.test?.meanExcess,n.test?.meanExcess),
        q80TestMeanBefore:o.ranking?.highPriority?.q80?.test?.mean??null,
        q80TestMeanAfter:n.ranking?.highPriority?.q80?.test?.mean??null,
        q80TestMeanDelta:delta(o.ranking?.highPriority?.q80?.test?.mean,n.ranking?.highPriority?.q80?.test?.mean),
        q80TestExcessBefore:o.ranking?.highPriority?.q80?.test?.meanExcess??null,
        q80TestExcessAfter:n.ranking?.highPriority?.q80?.test?.meanExcess??null,
        q80TestExcessDelta:delta(o.ranking?.highPriority?.q80?.test?.meanExcess,n.ranking?.highPriority?.q80?.test?.meanExcess)
      });
    }
  }
}
const purged=rows.map(x=>x.purgedTrainCount).filter(Number.isFinite);
const q80Changed=rows.filter(x=>Number.isFinite(x.q80Delta)&&x.q80Delta!==0);
const testChanged=rows.filter(x=>Number.isFinite(x.testMeanDelta)&&x.testMeanDelta!==0);
const q80TestChanged=rows.filter(x=>Number.isFinite(x.q80TestMeanDelta)&&x.q80TestMeanDelta!==0);
const report={
  generatedAt:new Date().toISOString(),
  purpose:'Measure impact of purging training observations whose forward outcome crosses the chronological train/test cut. No scanner rule or threshold is changed by this report.',
  batches:4,
  horizons:[5,10,20],
  summary:{
    comparisons:rows.length,
    totalPurgedAcrossStageHorizonReports:purged.reduce((a,b)=>a+b,0),
    maxPurgedInOneReport:purged.length?Math.max(...purged):0,
    q80ThresholdComparisonsChanged:q80Changed.length,
    rawTestMeanComparisonsChanged:testChanged.length,
    q80SelectedTestMeanComparisonsChanged:q80TestChanged.length
  },
  rows
};
fs.writeFileSync('data/purged-split-impact.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report.summary,null,2));
