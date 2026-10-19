// Descriptive audit plus a fixed forward hypothesis. Never used by the scanner.
export const GROWTH_EXPERIMENT=Object.freeze({id:'ag-volume-v1',startDate:'2026-10-19',stage:'Attractive Growth',relativeVolume:1.5,minDollarVolume:3000000});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{const b=[...a].sort((a,b)=>a-b);return b.length?(b[Math.floor((b.length-1)/2)]+b[Math.floor(b.length/2)])/2:null;};
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function growthVolumeGroup(p={}){
  if(!finite(p.maxRvol5)||!finite(p.avgDollar20)||p.avgDollar20<GROWTH_EXPERIMENT.minDollarVolume)return 'unknown';
  return p.maxRvol5>=GROWTH_EXPERIMENT.relativeVolume?'spike':'no_spike';
}
export function refreshGrowthProjection(monitor,store,updatedAt){
  const latest=store.sessions?.map(x=>x.marketDate).sort().at(-1);
  if(monitor?.version!=='hunter-monitor-v1'||monitor.marketAsOf!==latest)return null;
  return {...monitor,growthReview:summarizeGrowthReview({...store,asOf:latest}),researchSummaryUpdatedAt:updatedAt};
}
function suspicious(o){return finite(o.maxAdverseExcursionPct)&&o.maxAdverseExcursionPct< -50||finite(o.maxFavourableExcursionPct)&&o.maxFavourableExcursionPct>100;}
function stats(records){
  const usable=records.filter(x=>finite(x.o.returnPct)&&finite(x.o.benchmarkReturnPct));
  const excess=usable.map(x=>x.o.returnPct-x.o.benchmarkReturnPct);
  const bySymbol=new Map();
  usable.forEach((x,i)=>{const a=bySymbol.get(x.o.symbol)||[];a.push(excess[i]);bySymbol.set(x.o.symbol,a);});
  const flags=usable.filter(x=>suspicious(x.o));
  const reviewed=usable.filter(x=>!suspicious(x.o));
  const leaveOneSymbol=[...bySymbol.keys()].map(s=>mean(usable.filter(x=>x.o.symbol!==s).map(x=>x.o.returnPct-x.o.benchmarkReturnPct))).filter(finite);
  return {recorded:records.length,observations:usable.length,excludedMissing:records.length-usable.length,
    symbols:bySymbol.size,dates:new Set(usable.map(x=>x.o.decisionDate)).size,
    meanReturnPct:mean(usable.map(x=>x.o.returnPct)),meanExcessPct:mean(excess),medianExcessPct:median(excess),
    symbolBalancedExcessPct:mean([...bySymbol.values()].map(mean)),
    beatBenchmarkPct:excess.length?100*excess.filter(x=>x>0).length/excess.length:null,
    positiveReturns:usable.filter(x=>x.o.returnPct>0).length,benchmarkBeaters:excess.filter(x=>x>0).length,
    outsideActiveStages:usable.filter(x=>x.o.stageAtHorizon==='Outside active stages').length,
    sourceReviewCount:flags.length,sourceReviewSymbols:[...new Set(flags.map(x=>x.o.symbol))],
    sensitivityWithoutFlagged:{observations:reviewed.length,meanExcessPct:mean(reviewed.map(x=>x.o.returnPct-x.o.benchmarkReturnPct))},
    leaveOneSymbolMeanRange:leaveOneSymbol.length?[Math.min(...leaveOneSymbol),Math.max(...leaveOneSymbol)]:null};
}
export function summarizeGrowthReview({episodes=[],outcomes=[],asOf}){
  if(!validDate(asOf))throw new Error('invalid_growth_cutoff');
  const decisions=new Map();
  for(const e of episodes.filter(e=>e.entryStage==='Attractive Growth')){
    if(!e.episodeId||decisions.has(e.episodeId))throw new Error('duplicate_or_missing_growth_episode');
    decisions.set(e.episodeId,e);
  }
  const seen=new Set(),records=[];
  for(const o of outcomes.filter(o=>o.entryStage==='Attractive Growth')){
    if(!o.outcomeId||seen.has(o.outcomeId))throw new Error('duplicate_or_missing_growth_outcome');seen.add(o.outcomeId);
    const e=decisions.get(o.episodeId);
    if(!e||e.symbol!==o.symbol||e.scope!==o.scope||e.startDate!==o.decisionDate)throw new Error('growth_decision_mismatch');
    if(!validDate(o.targetDate)||!validDate(o.decisionDate)||o.decisionDate>=o.targetDate||o.targetDate>asOf)continue;
    records.push({o,e,p:e.decision||{}});
  }
  const summarize=(scope,prospective)=>Object.fromEntries([5,10,20].map(h=>{
    const rows=records.filter(x=>x.o.scope===scope&&x.o.horizonSessions===h&&(prospective?x.o.decisionDate>=GROWTH_EXPERIMENT.startDate:x.o.decisionDate<GROWTH_EXPERIMENT.startDate));
    const group=(keys,fn)=>Object.fromEntries(keys.map(k=>[k,stats(rows.filter(x=>fn(x)===k))]));
    return [h,{baseline:stats(rows),volume:group(['spike','no_spike','unknown'],x=>growthVolumeGroup(x.p)),
      extension:group(['below6','6to10','10plus','unknown'],x=>!finite(x.p.dist20)?'unknown':x.p.dist20<6?'below6':x.p.dist20<10?'6to10':'10plus'),
      breakout:group(['recent','older','none'],x=>Number.isInteger(x.p.freshHighBreakAge)&&x.p.freshHighBreakAge>=0?(x.p.freshHighBreakAge<=3?'recent':'older'):'none'),
      sectors:group([...new Set(rows.map(x=>x.p.sector||'Unknown'))],x=>x.p.sector||'Unknown'),
      decisionDates:group([...new Set(rows.map(x=>x.o.decisionDate))].sort(),x=>x.o.decisionDate)}];
  }));
  const prospectiveEpisodes=[...decisions.values()].filter(e=>e.startDate>=GROWTH_EXPERIMENT.startDate&&e.startDate<=asOf);
  return {version:'hunter-growth-review-v1',asOf,experiment:GROWTH_EXPERIMENT,
    prospectiveDecisions:Object.fromEntries(['stage','integrated'].map(scope=>{const a=prospectiveEpisodes.filter(e=>e.scope===scope);return [scope,{total:a.length,...Object.fromEntries(['spike','no_spike','unknown'].map(g=>[g,a.filter(e=>growthVolumeGroup(e.decision)===g).length]))}];})),
    retrospective:Object.fromEntries(['stage','integrated'].map(scope=>[scope,summarize(scope,false)])),
    prospective:Object.fromEntries(['stage','integrated'].map(scope=>[scope,summarize(scope,true)]))};
}
