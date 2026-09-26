import fs from 'node:fs';

const files=[0,1,2,3].map(i=>'data/v2-backtest-batch-'+i+'.json');
const reports=files.map(f=>JSON.parse(fs.readFileSync(f,'utf8')));
const variants=[
  'baseline','ma20Reclaimed','requireMinorHighBreak','freshBreak1','freshBreak2','freshBreak3',
  'breakOrHigherLow','structuralConfirmation','breakWithSupport',
  'currentReviewFirst','reviewFirstAndMa20Reclaimed','reviewFirstAndBreak',
  'reviewFirstFreshBreak1','reviewFirstFreshBreak2','reviewFirstFreshBreak3'
];
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;

function packSummary(s){
  if(!s)return null;
  return {n:s.n,mean:s.mean,positiveRate:s.positiveRate,benchmarkBeatRate:s.benchmarkBeatRate,meanExcess:s.meanExcess,avgMAE:s.avgMAE,avgMFE:s.avgMFE,hitPlus7:s.hitPlus7,hitMinus7:s.hitMinus7};
}
function weighted(rows,key){
  const xs=rows.filter(x=>x&&Number.isFinite(x.n)&&x.n>0&&Number.isFinite(x[key]));
  const n=xs.reduce((a,x)=>a+x.n,0);
  return n?round(xs.reduce((a,x)=>a+x[key]*x.n,0)/n,2):null;
}
function aggregate(rows){
  const xs=rows.filter(Boolean),n=xs.reduce((a,x)=>a+(x.n||0),0);
  if(!n)return null;
  const out={n};
  for(const k of ['mean','positiveRate','benchmarkBeatRate','meanExcess','avgMAE','avgMFE','hitPlus7','hitMinus7'])out[k]=weighted(xs,k);
  return out;
}

const result={generatedAt:new Date().toISOString(),note:'Diagnostic only. No Recovery production logic changed.',horizons:{}};
for(const h of ['5','10','20']){
  const perBatch=[];
  for(let i=0;i<reports.length;i++){
    const d=reports[i]?.horizons?.[h]?.byStage?.Recovery?.structureDiagnostic;
    perBatch.push({
      batch:i,
      variants:Object.fromEntries(variants.map(v=>[v,{
        overall:packSummary(d?.variants?.[v]?.overall),
        test:packSummary(d?.variants?.[v]?.test)
      }]))
    });
  }
  const aggregated={};
  for(const v of variants){
    aggregated[v]={
      overall:aggregate(perBatch.map(b=>b.variants[v].overall)),
      test:aggregate(perBatch.map(b=>b.variants[v].test))
    };
  }
  result.horizons[h]={perBatch,aggregated};
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/recovery-minor-high-diagnostic.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
