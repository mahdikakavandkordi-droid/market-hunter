import fs from 'node:fs';

const reports=Array.from({length:4},(_,i)=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const horizons=['5','10','20'];
const variants=['baseline','requireMinorHighBreak','breakOrHigherLow','structuralConfirmation','breakWithSupport','currentReviewFirst','reviewFirstAndBreak','reviewFirstAndBreakWithSupport','freshBreak1','freshBreak2','freshBreak3','reviewFirstFreshBreak1','reviewFirstFreshBreak2','reviewFirstFreshBreak3'];
const rankingVariants=['current','minorHighBoost','confirmedBreakBoost'];
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;

function pooled(summaries){
  const xs=summaries.filter(Boolean).filter(x=>Number.isFinite(x.n)&&x.n>0);
  const n=xs.reduce((a,x)=>a+x.n,0);
  if(!n)return null;
  const w=k=>round(xs.reduce((a,x)=>a+(Number.isFinite(x[k])?x[k]*x.n:0),0)/n,k.includes('Rate')?1:2);
  return {
    n,
    mean:w('mean'),
    positiveRate:w('positiveRate'),
    benchmarkBeatRate:w('benchmarkBeatRate'),
    meanExcess:w('meanExcess'),
    avgMAE:w('avgMAE'),
    avgMFE:w('avgMFE')
  };
}

const out={
  generatedAt:new Date().toISOString(),
  source:'Four V2 historical backtest batches',
  note:'Diagnostic only. No Recovery production rule was changed.',
  horizons:{}
};

for(const h of horizons){
  const perBatch=[];
  for(let i=0;i<reports.length;i++){
    const r=reports[i]?.horizons?.[h]?.byStage?.Recovery;
    const d=r?.structureDiagnostic?.variants||{};
    perBatch.push({
      batch:i,
      baselineTest:d.baseline?.test||null,
      variants:Object.fromEntries(variants.map(v=>[v,d[v]||null])),
      evidence:(r?.evidence||[]).filter(x=>['minorHighBroken','higherLow','structureImproving','momentumShift>=2','rs20>=0','upDownVolume>=0.85','atr<6'].includes(x.name))
    });
  }
  const pooledVariants={};
  for(const v of variants){
    const tests=perBatch.map(b=>b.variants[v]?.test||null);
    const p=pooled(tests);
    const base=pooled(perBatch.map(b=>b.variants.baseline?.test||null));
    pooledVariants[v]={
      pooledTest:p,
      retentionVsBaseline:p&&base?round(p.n/base.n*100,1):null,
      deltaVsBaseline:p&&base?{
        mean:round(p.mean-base.mean),
        positiveRate:round(p.positiveRate-base.positiveRate,1),
        benchmarkBeatRate:round(p.benchmarkBeatRate-base.benchmarkBeatRate,1),
        meanExcess:round(p.meanExcess-base.meanExcess)
      }:null,
      positiveBatchCount:perBatch.filter(b=>{
        const x=b.variants[v]?.test, bb=b.variants.baseline?.test;
        return x&&bb&&Number.isFinite(x.meanExcess)&&Number.isFinite(bb.meanExcess)&&x.meanExcess>bb.meanExcess;
      }).length
    };
  }
  const pooledRanking={};
  for(const v of rankingVariants){
    const tests=reports.map(r=>r?.horizons?.[h]?.byStage?.Recovery?.structureDiagnostic?.ranking?.[v]?.q80?.test||null);
    const trains=reports.map(r=>r?.horizons?.[h]?.byStage?.Recovery?.structureDiagnostic?.ranking?.[v]?.q80?.train||null);
    const p=pooled(tests);
    const pt=pooled(trains);
    const base=pooled(reports.map(r=>r?.horizons?.[h]?.byStage?.Recovery?.structureDiagnostic?.ranking?.current?.q80?.test||null));
    pooledRanking[v]={
      pooledTrain:pt,
      pooledTest:p,
      retentionVsCurrent:p&&base?round(p.n/base.n*100,1):null,
      deltaVsCurrent:p&&base?{
        mean:round(p.mean-base.mean),
        positiveRate:round(p.positiveRate-base.positiveRate,1),
        benchmarkBeatRate:round(p.benchmarkBeatRate-base.benchmarkBeatRate,1),
        meanExcess:round(p.meanExcess-base.meanExcess)
      }:null,
      positiveBatchCount:reports.filter(r=>{
        const x=r?.horizons?.[h]?.byStage?.Recovery?.structureDiagnostic?.ranking?.[v]?.q80?.test;
        const b=r?.horizons?.[h]?.byStage?.Recovery?.structureDiagnostic?.ranking?.current?.q80?.test;
        return x&&b&&Number.isFinite(x.meanExcess)&&Number.isFinite(b.meanExcess)&&x.meanExcess>b.meanExcess;
      }).length
    };
  }
  out.horizons[h]={pooled:pooledVariants,ranking:pooledRanking,perBatch};
}

fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/recovery-structure-diagnostic-summary.json',JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
