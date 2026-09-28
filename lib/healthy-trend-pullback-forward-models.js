import {
  HTP_VERSION,HTP_PARAMS,setupAt,trendRsAt,genericEligibility,weeklyTrendState,atr14At,recentSplit,dayKey
} from './healthy-trend-pullback.js';
import {
  VERSION as EARLY_WATCH_VERSION,ASSUMPTIONS as V2_ASSUMPTIONS,benchmarkHist as v2BenchmarkHist,
  metrics as v2Metrics,classify as v2Classify,rank as v2Rank,surfaceSelect,surfaceEligible
} from './market-hunter-v2-engine.js';
function exactIndex(rows,date){return rows.findIndex(x=>dayKey(x.t)===date)}
function selectionSort(a,b){return (b.score??-Infinity)-(a.score??-Infinity)||a.symbol.localeCompare(b.symbol)}
function decisionFields(base){
  return {
    symbol:base.symbol,sector:base.sector,rank:base.rank,score:base.score,
    decisionAtr14:base.decisionAtr14,atr14Pct:base.atr14Pct,
    rs20:base.rs20??null,drawdownPct:base.drawdownPct??null,
    pivotDate:base.pivotDate??null,pivotConfirmedAt:base.pivotConfirmedAt??null,
    weeklyLastCompleted:base.weeklyLastCompleted??null,
    weeklySlope4:base.weeklySlope4??null,ma20:base.ma20??null,ma50:base.ma50??null,
    avgDollar20:base.avgDollar20??null,rawClose:base.rawClose??null,
    earlyWatchEvidence:base.earlyWatchEvidence??null,sourceHash:base.sourceHash
  };
}

export function evaluateForwardModels({data,marketAsOf,universeDefinition}){
  const HEADLINE_UNIVERSE=universeDefinition.symbols.map(x=>[x.symbol,x.name,x.sector]);
  const META=new Map(universeDefinition.symbols.map(x=>[x.symbol,x]));
  const benchmark=data['^GSPTSE'];
  const failures=[],evaluated=new Map();
  for(const [symbol] of HEADLINE_UNIVERSE){
    const pack=data[symbol];
    if(!pack){continue}
    if(pack.currency!=='CAD'){failures.push({symbol,reason:'non_cad_currency:'+String(pack.currency)});continue}
    const i=exactIndex(pack.rows,marketAsOf);
    if(i<0){failures.push({symbol,reason:'missing_market_session'});continue}
    evaluated.set(symbol,{pack,i});
  }

  const coreCandidates=[],trendCandidates=[],earlyStageRows=[];
  for(const [symbol,{pack,i}] of evaluated){
    const sector=META.get(symbol)?.sector||'Unknown',closeSeries=pack.rows.map(x=>x.close);
    const generic=genericEligibility({pack:{...pack,splitDays:new Set(pack.splitDays)},rows:pack.rows,i});
    const weekly=generic.eligible?weeklyTrendState(pack.rows,i):null;
    const core=setupAt({
      pack:{...pack,splitDays:new Set(pack.splitDays)},rows:pack.rows,i,benchmarkRows:benchmark.rows,
      variant:'core',genericState:generic,weeklyState:weekly,closeSeries
    });
    if(core.eligible)coreCandidates.push({
      symbol,sector,score:core.score,decisionAtr14:core.atr14,atr14Pct:core.atr14Pct,rs20:core.rs20,
      drawdownPct:core.drawdownPct,pivotDate:core.pivot?.date,pivotConfirmedAt:core.pivot?.confirmedAt,
      weeklyLastCompleted:core.weekly?.lastCompletedWeek,weeklySlope4:core.weekly?.slope4,
      ma20:core.ma20,ma50:core.ma50,avgDollar20:core.avgDollar20,rawClose:pack.rows[i].rawClose,sourceHash:pack.sourceHash
    });
    const tr=trendRsAt({
      pack:{...pack,splitDays:new Set(pack.splitDays)},rows:pack.rows,i,benchmarkRows:benchmark.rows,
      genericState:generic,weeklyState:weekly,closeSeries
    });
    if(tr.eligible)trendCandidates.push({
      symbol,sector,score:tr.score,decisionAtr14:tr.atr14,atr14Pct:tr.atr14Pct,rs20:tr.rs20,
      weeklyLastCompleted:tr.weekly?.lastCompletedWeek,weeklySlope4:tr.weekly?.slope4,
      ma50:tr.ma50,avgDollar20:tr.avgDollar20,rawClose:pack.rows[i].rawClose,sourceHash:pack.sourceHash
    });

    if(pack.rows.length>=120&&!recentSplit({...pack,splitDays:new Set(pack.splitDays)},pack.rows,i,30)){
      const bh=v2BenchmarkHist(benchmark.rows,marketAsOf);
      const m=bh?v2Metrics(pack.rows.slice(0,i+1),bh):null;
      if(m&&pack.rows[i].rawClose>=V2_ASSUMPTIONS.liquidity.minPrice&&m.avgDollar20>=V2_ASSUMPTIONS.liquidity.minAvgDollar20){
        const stage=v2Classify(m);
        if(stage==='Early Watch'){
          const score=v2Rank(m,stage);
          earlyStageRows.push({
            symbol,sector,stage,score,decisionAtr14:atr14At(pack.rows,i),atr14Pct:m.atr14Pct,rs20:m.rs20,
            avgDollar20:m.avgDollar20,rawClose:pack.rows[i].rawClose,sourceHash:pack.sourceHash,
            earlyWatchEvidence:{
              downsideDecel:m.downsideDecel,volumeShockNearLow:m.volumeShockNearLow,
              freshReclaimAge:m.freshReclaimAge,sellingFading:m.sellingFading,
              nearLow20:m.nearLow20,priorWeakness:m.priorWeakness
            }
          });
        }
      }
    }
  }

  coreCandidates.sort(selectionSort);trendCandidates.sort(selectionSort);earlyStageRows.sort(selectionSort);
  const corePicks=coreCandidates.slice(0,HTP_PARAMS.maxVisible).map((x,i)=>({...x,rank:i+1}));
  const trendPicks=trendCandidates.slice(0,HTP_PARAMS.maxVisible).map((x,i)=>({...x,rank:i+1}));
  const earlyEligible=earlyStageRows.filter(x=>surfaceEligible('Early Watch',x.score,x));
  const earlyPicks=surfaceSelect('Early Watch',earlyStageRows).map((x,i)=>({...x,rank:i+1}));

  const modelSpecs=[
    {model:'core',modelVersion:HTP_VERSION,naturalEligibleCount:coreCandidates.length,picks:corePicks},
    {model:'trend_rs',modelVersion:HTP_VERSION,naturalEligibleCount:trendCandidates.length,picks:trendPicks},
    {model:'early_watch',modelVersion:EARLY_WATCH_VERSION,naturalEligibleCount:earlyEligible.length,picks:earlyPicks}
  ];
  for(const spec of modelSpecs)spec.picks=spec.picks.map(x=>{
    const {pack,i}=evaluated.get(x.symbol);
    return {...decisionFields(x),decisionPriceAnchor:{close:pack.rows[i].close,rawClose:pack.rows[i].rawClose},
      decisionHistory:pack.rows.slice(Math.max(0,i-14),i+1)};
  });
  return {evaluated,failures,modelSpecs};
}
