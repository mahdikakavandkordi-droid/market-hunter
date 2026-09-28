import fs from 'node:fs';
const reports=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
function agg(xs){
  xs=xs.filter(Boolean);const n=xs.reduce((s,x)=>s+(x.n||0),0);if(!n)return null;
  const w=k=>{const ys=xs.filter(x=>Number.isFinite(x?.[k])&&x.n>0);const den=ys.reduce((s,x)=>s+x.n,0);return den?round(ys.reduce((s,x)=>s+x[k]*x.n,0)/den,2):null};
  return {n,mean:w('mean'),positiveRate:w('positiveRate'),benchmarkBeatRate:w('benchmarkBeatRate'),meanExcess:w('meanExcess'),avgMAE:w('avgMAE'),avgMFE:w('avgMFE'),hitPlus7:w('hitPlus7'),hitMinus7:w('hitMinus7')};
}
const names=['reviewFirst','reviewNoHighATR','reviewNotExtended','reviewNoHighRSI','reviewATRAndDistance','cleanReview'];
const result={generatedAt:new Date().toISOString(),note:'Focused Attractive Growth Review First risk-flag diagnostic. Production logic unchanged.',horizons:{}};
for(const h of ['5','10','20']){
  const perBatch=reports.map((r,i)=>{
    const v=r.horizons[h].byStage['Attractive Growth'].riskDiagnostic.variants;
    return {batch:i,...Object.fromEntries(names.map(n=>[n,v[n].test]))};
  });
  result.horizons[h]={
    aggregate:Object.fromEntries(names.map(n=>[n,agg(perBatch.map(x=>x[n]))])),
    perBatch
  };
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/attractive-growth-risk-diagnostic.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
