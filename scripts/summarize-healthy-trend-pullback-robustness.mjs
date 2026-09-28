import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR=process.env.HTP_OUT_DIR||'data/research/healthy-trend-pullback';
const summary=JSON.parse(fs.readFileSync(path.join(OUT_DIR,'summary.json'),'utf8'));
const episodes=JSON.parse(fs.readFileSync(path.join(OUT_DIR,'episodes.json'),'utf8'));
const MODELS=['core','core_volume','core_market'];

function round(n,d=4){return Number.isFinite(n)?Number(n.toFixed(d)):null}
function mean(a){const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null}
function percentile(target,values){
  const x=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!x.length)return null;
  const below=x.filter(v=>v<target).length,equal=x.filter(v=>v===target).length;
  return round((below+.5*equal)/x.length*100,1);
}
function included(model,split=null){
  return episodes.filter(r=>r.model===model&&r.status==='evaluated'&&r.included===true&&(!split||r.split===split)&&Number.isFinite(r.excessReturns?.[20]));
}
function concentration(model,split=null){
  const rows=included(model,split);
  const by=new Map();
  for(const r of rows)by.set(r.symbol,(by.get(r.symbol)||0)+r.excessReturns[20]);
  const ranked=[...by.entries()].map(([symbol,sumExcess20])=>({symbol,sumExcess20})).sort((a,b)=>b.sumExcess20-a.sumExcess20||a.symbol.localeCompare(b.symbol));
  const total=rows.reduce((s,r)=>s+r.excessReturns[20],0);
  const leaveTop=k=>{
    const removed=new Set(ranked.slice(0,k).map(x=>x.symbol));
    const kept=rows.filter(r=>!removed.has(r.symbol));
    return {episodes:kept.length,meanExcess20:round(mean(kept.map(r=>r.excessReturns[20])))};
  };
  return {
    episodes:rows.length,
    distinctSymbols:by.size,
    totalExcess20:round(total),
    meanExcess20:round(mean(rows.map(r=>r.excessReturns[20]))),
    top1:ranked[0]||null,
    top3ShareOfNetExcess:total!==0?round(ranked.slice(0,3).reduce((s,x)=>s+x.sumExcess20,0)/total*100,1):null,
    top5ShareOfNetExcess:total!==0?round(ranked.slice(0,5).reduce((s,x)=>s+x.sumExcess20,0)/total*100,1):null,
    leaveTop1:leaveTop(1),
    leaveTop3:leaveTop(3),
    leaveTop5:leaveTop(5)
  };
}
function controlPosition(model){
  const c=summary.controlled[model],t=c.target.CombinedIncludedPurged;
  return {
    repeatedRandom:{
      excess20Percentile:percentile(t.meanExcess20,c.repeatedRandom.seedSummaries.map(x=>x.meanExcess20)),
      successRatePercentile:percentile(t.successRate,c.repeatedRandom.seedSummaries.map(x=>x.successRate))
    },
    sectorVolMatchedRandom:{
      excess20Percentile:percentile(t.meanExcess20,c.sectorVolMatchedRandom.seedSummaries.map(x=>x.meanExcess20)),
      successRatePercentile:percentile(t.successRate,c.sectorVolMatchedRandom.seedSummaries.map(x=>x.successRate))
    }
  };
}

const models={};
for(const model of MODELS){
  const o=summary.natural[model].outcomes;
  const d=o.Development,v=o.ValidationPreviouslyObserved,c=o.CombinedIncludedPurged,t=o.topRanked;
  models[model]={
    splitStability:{
      development:{episodes:d.episodeCount,successRate:d.successRate,meanExcess20:d.meanExcess20,medianExcess20:d.medianExcess20},
      validationPreviouslyObserved:{episodes:v.episodeCount,successRate:v.successRate,meanExcess20:v.meanExcess20,medianExcess20:v.medianExcess20},
      validationMinusDevelopment:{
        successRatePctPoints:round(v.successRate-d.successRate,2),
        meanExcess20PctPoints:round(v.meanExcess20-d.meanExcess20)
      }
    },
    combined:{
      episodes:c.episodeCount,successRate:c.successRate,meanExcess20:c.meanExcess20,medianExcess20:c.medianExcess20,
      successRate95:o.uncertainty.successRate95,meanExcess20_95:o.uncertainty.meanExcess20_95
    },
    rankOneLift:{
      rankOneEpisodes:t.episodeCount,
      successRatePctPoints:round(t.successRate-c.successRate,2),
      meanExcess20PctPoints:round(t.meanExcess20-c.meanExcess20)
    },
    concentration:{
      combined:concentration(model),
      Development:concentration(model,'Development'),
      ValidationPreviouslyObserved:concentration(model,'Validation')
    },
    controlPosition:controlPosition(model),
    deterministicControlledComparisons:{
      EarlyWatch:summary.controlled[model].currentEarlyWatch.pairedEffectTargetMinusBaseline,
      TrendRs:summary.controlled[model].trendRs.pairedEffectTargetMinusBaseline
    }
  };
}

const coreContext=summary.natural.core.outcomes.byMarketContext;
const robustness={
  format:'market-hunter-healthy-trend-pullback-robustness-v1',
  generatedAt:new Date().toISOString(),
  evidenceTag:summary.evidence.tag,
  validationRunId:summary.evidence.validationRunId,
  finalTestOpened:summary.evidence.finalTestOpened,
  note:'Derived only from the audited challenger summary and exported deterministic episode rows. Validation is previously observed history and is not treated as untouched out-of-sample evidence.',
  models,
  coreMarketContextDiagnostic:{
    TSXAboveMA50:{
      episodes:coreContext.TSX_above_MA50?.episodeCount,
      successRate:coreContext.TSX_above_MA50?.successRate,
      meanExcess20:coreContext.TSX_above_MA50?.meanExcess20
    },
    TSXNotAboveMA50:{
      episodes:coreContext.TSX_not_above_MA50?.episodeCount,
      successRate:coreContext.TSX_not_above_MA50?.successRate,
      meanExcess20:coreContext.TSX_not_above_MA50?.meanExcess20
    }
  },
  interpretationConstraints:[
    'Combined results mix Development with previously observed Validation history and must not be used alone to claim generalization.',
    'Percentiles against 100 fixed random seeds describe this frozen experiment only; they are not probabilities of future outperformance.',
    'Contributor concentration is reported because a small number of large historical moves can materially change mean excess return.',
    'No Historical Final data was opened.'
  ]
};
fs.writeFileSync(path.join(OUT_DIR,'robustness.json'),JSON.stringify(robustness,null,2)+'\n');
console.log(JSON.stringify(robustness,null,2));
