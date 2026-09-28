import fs from 'node:fs';

const reports=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
function aggregate(rows){
  const xs=rows.filter(Boolean),n=xs.reduce((s,x)=>s+(x.n||0),0);
  if(!n)return null;
  const w=k=>{const ys=xs.filter(x=>Number.isFinite(x?.[k])&&x.n>0);const den=ys.reduce((s,x)=>s+x.n,0);return den?round(ys.reduce((s,x)=>s+x[k]*x.n,0)/den,2):null};
  return {n,mean:w('mean'),positiveRate:w('positiveRate'),benchmarkBeatRate:w('benchmarkBeatRate'),meanExcess:w('meanExcess'),avgMAE:w('avgMAE'),avgMFE:w('avgMFE'),hitPlus7:w('hitPlus7'),hitMinus7:w('hitMinus7')};
}
const result={generatedAt:new Date().toISOString(),note:'Baseline audit only. Established Move engine logic unchanged.',horizons:{}};
for(const h of ['5','10','20']){
  const perBatch=reports.map((r,i)=>{
    const s=r?.horizons?.[h]?.byStage?.['Established Move'];
    return {
      batch:i,
      overall:s?.overall||null,
      test:s?.test||null,
      reviewFirstTest:s?.fixedPriority?.reviewFirst?.test||null,
      cleanReviewTest:s?.fixedPriority?.cleanReview?.test||null,
      heatedReviewTest:s?.fixedPriority?.heatedReview?.test||null,
      ranking:s?.ranking||null,
      evidence:s?.evidence||[]
    };
  });
  const evidenceNames=[...new Set(perBatch.flatMap(x=>(x.evidence||[]).map(e=>e.name)))];
  const evidence={};
  for(const name of evidenceNames){
    const yes=aggregate(perBatch.map(x=>(x.evidence||[]).find(e=>e.name===name)?.yes));
    const no=aggregate(perBatch.map(x=>(x.evidence||[]).find(e=>e.name===name)?.no));
    evidence[name]={yes,no,lift:{
      mean:round((yes?.mean??NaN)-(no?.mean??NaN)),
      meanExcess:round((yes?.meanExcess??NaN)-(no?.meanExcess??NaN)),
      positiveRate:round((yes?.positiveRate??NaN)-(no?.positiveRate??NaN),1),
      benchmarkBeatRate:round((yes?.benchmarkBeatRate??NaN)-(no?.benchmarkBeatRate??NaN),1)
    }};
  }
  result.horizons[h]={
    perBatch,
    aggregate:{
      overall:aggregate(perBatch.map(x=>x.overall)),
      test:aggregate(perBatch.map(x=>x.test)),
      reviewFirstTest:aggregate(perBatch.map(x=>x.reviewFirstTest)),
      cleanReviewTest:aggregate(perBatch.map(x=>x.cleanReviewTest)),
      heatedReviewTest:aggregate(perBatch.map(x=>x.heatedReviewTest))
    },
    evidence
  };
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/established-move-baseline-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
