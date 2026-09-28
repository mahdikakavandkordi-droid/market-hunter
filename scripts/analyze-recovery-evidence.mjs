import fs from 'node:fs';
const reports=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
function aggregate(rows){
  const xs=rows.filter(Boolean),n=xs.reduce((s,x)=>s+(x.n||0),0); if(!n)return null;
  const w=k=>round(xs.reduce((s,x)=>s+(Number.isFinite(x[k])?x[k]*(x.n||0):0),0)/n,2);
  return {n,mean:w('mean'),positiveRate:w('positiveRate'),benchmarkBeatRate:w('benchmarkBeatRate'),meanExcess:w('meanExcess'),avgMAE:w('avgMAE'),avgMFE:w('avgMFE')};
}
const result={generatedAt:new Date().toISOString(),note:'Exploratory full-sample evidence map only. Promising features require separate chronological holdout validation.',horizons:{}};
for(const h of ['5','10','20']){
  const names=[...new Set(reports.flatMap(r=>(r?.horizons?.[h]?.byStage?.Recovery?.evidence||[]).map(x=>x.name)))];
  result.horizons[h]={};
  for(const name of names){
    const slices=reports.map(r=>(r?.horizons?.[h]?.byStage?.Recovery?.evidence||[]).find(x=>x.name===name));
    const yes=aggregate(slices.map(x=>x?.yes)),no=aggregate(slices.map(x=>x?.no));
    result.horizons[h][name]={yes,no,lift:{
      mean:round((yes?.mean??NaN)-(no?.mean??NaN)),
      meanExcess:round((yes?.meanExcess??NaN)-(no?.meanExcess??NaN)),
      positiveRate:round((yes?.positiveRate??NaN)-(no?.positiveRate??NaN),1),
      benchmarkBeatRate:round((yes?.benchmarkBeatRate??NaN)-(no?.benchmarkBeatRate??NaN),1)
    }};
  }
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/recovery-evidence-map.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
