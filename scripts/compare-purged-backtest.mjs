import fs from 'node:fs';
import {assertComparableValidationReports} from '../lib/validation-identity.js';

const stages=['Early Watch','Recovery','Attractive Growth','Established Move'];
const horizons=['5','10','20'];
const round=(n,d=3)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const baselineDir=process.env.V2_BASELINE_DIR||'data';
const candidateDir=process.env.V2_CANDIDATE_DIR||'tmp-purged';
const oldFiles=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync(`${baselineDir}/v2-backtest-batch-${i}.json`,'utf8')));
const newFiles=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync(`${candidateDir}/v2-backtest-batch-${i}.json`,'utf8')));

const identities=[];
for(let i=0;i<4;i++){
  identities.push(assertComparableValidationReports(oldFiles[i],newFiles[i]));
}
function delta(a,b){return Number.isFinite(a)&&Number.isFinite(b)?round(b-a):null}
const rows=[];
for(let batch=0;batch<4;batch++){
  for(const h of horizons){
    for(const stage of stages){
      const o=oldFiles[batch]?.horizons?.[h]?.byStage?.[stage];
      const n=newFiles[batch]?.horizons?.[h]?.byStage?.[stage];
      if(!o||!n)throw new Error('Missing stage/horizon comparison cell: batch '+batch+' '+stage+' '+h);
      const op=o.ranking?.trainThresholds||{},np=n.ranking?.trainThresholds||{};
      const counts=n.ranking?.fold?.counts;
      if(!counts||!['trainCount','validationCount','validationBoundaryPurgedCount'].every(k=>Number.isInteger(counts[k])&&counts[k]>=0)){
        throw new Error('Missing fixed-calendar fold counts: batch '+batch+' '+stage+' '+h);
      }
      rows.push({
        batch,horizon:Number(h),stage,
        validationStart:newFiles[batch]?.validation?.calendar?.validationStart||null,
        finalStart:newFiles[batch]?.validation?.calendar?.finalStart||null,
        snapshotId:newFiles[batch]?.dataset?.snapshotId||null,
        dataSha256:newFiles[batch]?.dataset?.dataSha256||null,
        prePurgeTrainCount:counts.trainCount+counts.validationBoundaryPurgedCount,
        purgedTrainCount:counts.validationBoundaryPurgedCount,
        trainCount:counts.trainCount,
        testCount:counts.validationCount,
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
const report={
  generatedAt:new Date().toISOString(),
  purpose:'Controlled comparison on identical locked numerical inputs, symbol membership, horizons and fixed calendar. Final historical period remains closed.',
  identityGuard:'PASS',
  batches:4,horizons:[5,10,20],
  identities:identities.map(x=>x.candidate),
  summary:{
    comparisons:rows.length,
    totalPurgedAcrossStageHorizonReports:purged.reduce((a,b)=>a+b,0),
    maxPurgedInOneReport:purged.length?Math.max(...purged):0,
    q80ThresholdComparisonsChanged:rows.filter(x=>Number.isFinite(x.q80Delta)&&x.q80Delta!==0).length,
    rawTestMeanComparisonsChanged:rows.filter(x=>Number.isFinite(x.testMeanDelta)&&x.testMeanDelta!==0).length,
    q80SelectedTestMeanComparisonsChanged:rows.filter(x=>Number.isFinite(x.q80TestMeanDelta)&&x.q80TestMeanDelta!==0).length
  },
  rows
};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/purged-split-impact.json',JSON.stringify(report,null,2));
console.log('Controlled comparison identity guard PASS');
console.log(JSON.stringify(report.summary,null,2));

