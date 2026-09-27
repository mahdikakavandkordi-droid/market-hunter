import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const root=process.cwd();
const tmp=path.join(root,'.purged-run');
fs.rmSync(tmp,{recursive:true,force:true});
fs.mkdirSync(tmp,{recursive:true});

function runBatch(i){
  const cwd=path.join(tmp,'batch-'+i);
  fs.mkdirSync(path.join(cwd,'data'),{recursive:true});
  return new Promise((resolve,reject)=>{
    const p=spawn(process.execPath,[path.join(root,'scripts/backtest-market-hunter-v2.mjs')],{
      cwd,
      env:{...process.env,V2_BATCH_INDEX:String(i),V2_BATCH_COUNT:'4',V2_RANGE:'5y',V2_HORIZONS:'5,10,20'},
      stdio:['ignore','pipe','pipe']
    });
    let tail='';
    p.stdout.on('data',d=>{tail=(tail+d.toString()).slice(-4000)});
    p.stderr.on('data',d=>{tail=(tail+d.toString()).slice(-4000)});
    p.on('exit',code=>code===0?resolve({i,cwd,tail}):reject(new Error('batch '+i+' failed code '+code+'\n'+tail)));
  });
}

const results=await Promise.all([0,1,2,3].map(runBatch));
const stages=['Early Watch','Recovery','Attractive Growth','Established Move'];
const horizons=['5','10','20'];
const round=(n,d=3)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const delta=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?round(b-a):null;
const oldFiles=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync(path.join(root,'data/v2-backtest-batch-'+i+'.json'),'utf8')));
const newFiles=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync(path.join(tmp,'batch-'+i,'data/v2-backtest-batch-'+i+'.json'),'utf8')));
const rows=[];
for(let batch=0;batch<4;batch++){
  for(const h of horizons){
    for(const stage of stages){
      const o=oldFiles[batch]?.horizons?.[h]?.byStage?.[stage];
      const n=newFiles[batch]?.horizons?.[h]?.byStage?.[stage];
      if(!o||!n)continue;
      const op=o.ranking?.trainThresholds||{},np=n.ranking?.trainThresholds||{},purge=n.ranking?.purge||{};
      rows.push({
        batch,horizon:Number(h),stage,cutDate:n.ranking?.cutDate||null,
        prePurgeTrainCount:purge.prePurgeTrainCount??null,
        purgedTrainCount:purge.purgedTrainCount??null,
        trainCount:purge.trainCount??null,testCount:purge.testCount??null,
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
const abs=x=>Number.isFinite(x)?Math.abs(x):0;
const report={
  generatedAt:new Date().toISOString(),
  purpose:'Purged chronological split impact only. Scanner rules, weights, stage classification and frozen priority floors are unchanged.',
  summary:{
    comparisons:rows.length,
    totalPurgedAcrossStageHorizonReports:purged.reduce((a,b)=>a+b,0),
    maxPurgedInOneReport:purged.length?Math.max(...purged):0,
    q80ThresholdComparisonsChanged:rows.filter(x=>abs(x.q80Delta)>0).length,
    maxAbsQ80ThresholdDelta:round(Math.max(0,...rows.map(x=>abs(x.q80Delta))),2),
    rawTestMeanComparisonsChanged:rows.filter(x=>abs(x.testMeanDelta)>0).length,
    maxAbsRawTestMeanDelta:round(Math.max(0,...rows.map(x=>abs(x.testMeanDelta))),3),
    q80SelectedTestMeanComparisonsChanged:rows.filter(x=>abs(x.q80TestMeanDelta)>0).length,
    maxAbsQ80SelectedTestMeanDelta:round(Math.max(0,...rows.map(x=>abs(x.q80TestMeanDelta))),3),
    maxAbsQ80SelectedTestExcessDelta:round(Math.max(0,...rows.map(x=>abs(x.q80TestExcessDelta))),3)
  },
  rows
};
fs.writeFileSync(path.join(root,'data/purged-split-impact.json'),JSON.stringify(report,null,2));
for(let i=0;i<4;i++){
  fs.copyFileSync(path.join(tmp,'batch-'+i,'data/v2-backtest-batch-'+i+'.json'),path.join(root,'data/purged-v2-backtest-batch-'+i+'.json'));
}
console.log('PURGED_VALIDATION_SUMMARY '+JSON.stringify(report.summary));
