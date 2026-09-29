import crypto from 'node:crypto';

export const FORWARD_VALIDATION_VERSION='market-hunter-forward-validation-v1-2026-09-29';
export const STAGES=['Early Watch','Recovery','Attractive Growth','Established Move'];
export const HORIZONS=[5,10,20];

export function stableStringify(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';
}
export function sha256Json(value){
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}
export function parseJsonl(text){
  return String(text||'').split('\n').filter(Boolean).map(line=>JSON.parse(line));
}
export function appendJsonlStrict(existingText,records,keyFn){
  const existing=parseJsonl(existingText),seen=new Map(existing.map(x=>[keyFn(x),x])),added=[];
  for(const record of records){
    const key=keyFn(record),prior=seen.get(key);
    if(prior){
      if(stableStringify(prior)!==stableStringify(record))throw new Error('append_only_conflict:'+key);
      continue;
    }
    seen.set(key,record);existing.push(record);added.push(record);
  }
  return {text:existing.map(x=>JSON.stringify(x)).join('\n')+(existing.length?'\n':''),added};
}
export function reportMarketDate(report){
  if(typeof report?.marketAsOf==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(report.marketAsOf))return report.marketAsOf;
  const dates=new Set((report?.all||[]).map(x=>x?.date).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')));
  if(dates.size===1)return [...dates][0];
  if(dates.size>1)throw new Error('mixed_report_market_dates');
  const fallback=new Set([
    ...STAGES.flatMap(stage=>(report?.surfacePicks?.[stage]||[]).map(x=>x?.date)),
    ...(report?.integratedSurfacePicks||[]).map(x=>x?.date)
  ].filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')));
  if(fallback.size===1)return [...fallback][0];
  if(fallback.size>1)throw new Error('mixed_report_surface_dates');
  return null;
}
function numberOrNull(v){return Number.isFinite(Number(v))?Number(v):null}
export function compactPick(p,rank=null){
  return {
    symbol:String(p?.symbol||''),
    name:p?.name||null,
    sector:p?.sector||null,
    stage:p?.stage||null,
    rank:Number.isInteger(rank)?rank:(Number.isInteger(p?.stageRank)?p.stageRank:null),
    integratedRank:Number.isInteger(p?.integratedRank)?p.integratedRank:null,
    score:numberOrNull(p?.score),
    surfaceScore:numberOrNull(p?.surfaceScore),
    price:numberOrNull(p?.price),
    stageAge:numberOrNull(p?.stageAge),
    priorityBand:p?.priorityBand||null,
    reviewLane:p?.reviewLane||null,
    riskFlags:Array.isArray(p?.riskFlags)?[...p.riskFlags]:[],
    evidence:Array.isArray(p?.evidence)?[...p.evidence]:[],
    rsi14:numberOrNull(p?.rsi14),
    rs20:numberOrNull(p?.rs20),
    rs60:numberOrNull(p?.rs60),
    momentumShift:numberOrNull(p?.momentumShift),
    maxRvol5:numberOrNull(p?.maxRvol5),
    upDownVolumeRatio:numberOrNull(p?.upDownVolumeRatio),
    avgDollar20:numberOrNull(p?.avgDollar20),
    atr14Pct:numberOrNull(p?.atr14Pct),
    ret5:numberOrNull(p?.ret5),
    ret20:numberOrNull(p?.ret20),
    ret60:numberOrNull(p?.ret60),
    dist20:numberOrNull(p?.dist20),
    dist50:numberOrNull(p?.dist50),
    pullback60:numberOrNull(p?.pullback60),
    swingTrend:p?.swingTrend||null,
    higherLow:typeof p?.higherLow==='boolean'?p.higherLow:null,
    localLow:numberOrNull(p?.localLow),
    localHigh:numberOrNull(p?.localHigh),
    lowBroken:typeof p?.lowBroken==='boolean'?p.lowBroken:null,
    highBroken:typeof p?.highBroken==='boolean'?p.highBroken:null,
    freshReclaimAge:numberOrNull(p?.freshReclaimAge),
    freshHighBreakAge:numberOrNull(p?.freshHighBreakAge)
  };
}
export function sessionFromReport(report){
  const marketDate=reportMarketDate(report);
  if(!marketDate)throw new Error('report_market_date_missing');
  const stagePicks={};
  for(const stage of STAGES)stagePicks[stage]=(report?.surfacePicks?.[stage]||[]).map((p,i)=>compactPick(p,i+1));
  const integrated=(report?.integratedSurfacePicks||[]).map((p,i)=>{
    const x=compactPick(p,Number.isInteger(p?.stageRank)?p.stageRank:null);
    x.integratedRank=Number.isInteger(p?.integratedRank)?p.integratedRank:i+1;
    return x;
  });
  const classified=(report?.all||[]).map(x=>({
    symbol:String(x?.symbol||''),stage:x?.stage||null,score:numberOrNull(x?.score),
    price:numberOrNull(x?.price),sector:x?.sector||null
  })).filter(x=>x.symbol).sort((a,b)=>a.symbol.localeCompare(b.symbol));
  return {
    sessionId:'market-hunter-session|'+marketDate,
    collectorVersion:FORWARD_VALIDATION_VERSION,
    marketDate,
    sourceGeneratedAt:report?.generatedAt||null,
    modelVersion:report?.version||null,
    engineCommit:report?.engineCommit||null,
    sourceReportHash:sha256Json(report),
    stageCounts:report?.stageCounts||{},
    surfaceCounts:report?.surfaceCounts||{},
    integratedSurfaceCounts:report?.integratedSurfaceCounts||{},
    stagePicks,integrated,classifiedCount:classified.length,classified
  };
}
function stageKey(stage,symbol){return 'stage|'+stage+'|'+symbol}
function integratedKey(symbol){return 'integrated|'+symbol}
export function presenceAndEpisodes(session,previousSession,previousPresenceMap=new Map(),continuity=true){
  const presences=[],episodes=[];
  const prevStage=new Set();
  const prevIntegrated=new Set();
  if(previousSession&&continuity){
    for(const stage of STAGES)for(const p of previousSession.stagePicks?.[stage]||[])prevStage.add(stageKey(stage,p.symbol));
    for(const p of previousSession.integrated||[])prevIntegrated.add(integratedKey(p.symbol));
  }
  for(const stage of STAGES){
    for(const p of session.stagePicks?.[stage]||[]){
      const key=stageKey(stage,p.symbol),continued=continuity&&prevStage.has(key);
      const prior=continued?previousPresenceMap.get(key):null;
      const episodeId=prior?.episodeId||['episode','stage',stage,p.symbol,session.marketDate].join('|');
      const presence={
        presenceId:['presence',session.marketDate,'stage',stage,p.symbol].join('|'),
        marketDate:session.marketDate,scope:'stage',stage,symbol:p.symbol,rank:p.rank,
        episodeId,isFirstSurface:!continued,decision:p
      };
      presences.push(presence);
      if(!continued)episodes.push({
        episodeId,scope:'stage',entryStage:stage,symbol:p.symbol,startDate:session.marketDate,
        modelVersion:session.modelVersion,engineCommit:session.engineCommit,
        sourceSessionId:session.sessionId,decision:p,
        continuity:previousSession?(continuity?'new_surface':'gap_before_session'):'validation_start'
      });
    }
  }
  for(const p of session.integrated||[]){
    const key=integratedKey(p.symbol),continued=continuity&&prevIntegrated.has(key);
    const prior=continued?previousPresenceMap.get(key):null;
    const episodeId=prior?.episodeId||['episode','integrated',p.symbol,session.marketDate].join('|');
    const presence={
      presenceId:['presence',session.marketDate,'integrated',p.symbol].join('|'),
      marketDate:session.marketDate,scope:'integrated',stage:p.stage,symbol:p.symbol,
      rank:p.integratedRank,episodeId,isFirstSurface:!continued,decision:p
    };
    presences.push(presence);
    if(!continued)episodes.push({
      episodeId,scope:'integrated',entryStage:p.stage,symbol:p.symbol,startDate:session.marketDate,
      modelVersion:session.modelVersion,engineCommit:session.engineCommit,
      sourceSessionId:session.sessionId,decision:p,
      continuity:previousSession?(continuity?'new_surface':'gap_before_session'):'validation_start'
    });
  }
  return {presences,episodes};
}
export function dayKey(t){return new Date(Number(t)*1000).toISOString().slice(0,10)}
function exactRow(rows,date){return (rows||[]).find(x=>dayKey(x.t)===date)||null}
function pct(a,b){return Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a/b-1)*100:null}
export function targetDateForHorizon(benchmarkRows,decisionDate,horizon){
  const i=(benchmarkRows||[]).findIndex(x=>dayKey(x.t)===decisionDate);
  if(i<0||!Number.isInteger(horizon)||horizon<1)return null;
  const row=benchmarkRows[i+horizon];
  return row?dayKey(row.t):null;
}
export function stageAtSession(session,symbol){
  if(!session)return 'Not recorded';
  return session.classified?.find(x=>x.symbol===symbol)?.stage||'Outside active stages';
}
export function surfaceStageAtSession(session,symbol){
  if(!session)return null;
  for(const stage of STAGES)if((session.stagePicks?.[stage]||[]).some(x=>x.symbol===symbol))return stage;
  return null;
}
export function buildOutcome({episode,horizon,targetDate,symbolRows,benchmarkRows,targetSession,computedAt}){
  const decisionDate=episode.startDate,decisionPrice=Number(episode?.decision?.price);
  if(!(decisionPrice>0))return null;
  const target=exactRow(symbolRows,targetDate),bench0=exactRow(benchmarkRows,decisionDate),bench1=exactRow(benchmarkRows,targetDate);
  if(!target||!bench0||!bench1)return null;
  const path=(symbolRows||[]).filter(x=>{
    const d=dayKey(x.t);return d>decisionDate&&d<=targetDate;
  });
  const highs=path.map(x=>Number(x.high)).filter(Number.isFinite),lows=path.map(x=>Number(x.low)).filter(Number.isFinite);
  const returnPct=pct(Number(target.close),decisionPrice);
  const benchmarkReturnPct=pct(Number(bench1.close),Number(bench0.close));
  const stageAtHorizon=stageAtSession(targetSession,episode.symbol);
  const surfacedStageAtHorizon=surfaceStageAtSession(targetSession,episode.symbol);
  return {
    outcomeId:[episode.episodeId,'h'+horizon].join('|'),
    episodeId:episode.episodeId,scope:episode.scope,symbol:episode.symbol,entryStage:episode.entryStage,
    decisionDate,targetDate,horizonSessions:horizon,computedAt,
    decisionPrice,targetClose:Number(target.close),
    returnPct,benchmarkReturnPct,
    excessReturnPct:Number.isFinite(returnPct)&&Number.isFinite(benchmarkReturnPct)?returnPct-benchmarkReturnPct:null,
    maxFavourableExcursionPct:highs.length?pct(Math.max(...highs),decisionPrice):null,
    maxAdverseExcursionPct:lows.length?pct(Math.min(...lows),decisionPrice):null,
    stageAtHorizon,surfacedStageAtHorizon,
    integratedAtHorizon:Boolean(targetSession?.integrated?.some(x=>x.symbol===episode.symbol)),
    transition:episode.entryStage+' -> '+stageAtHorizon
  };
}
export function statusFromStore({sessions,presences,episodes,outcomes,runs}){
  const byStage=Object.fromEntries(STAGES.map(stage=>[stage,episodes.filter(x=>x.scope==='stage'&&x.entryStage===stage).length]));
  return {
    format:'market-hunter-forward-validation-status-v1',
    collectorVersion:FORWARD_VALIDATION_VERSION,
    generatedAt:new Date().toISOString(),
    historicalBackfillAllowed:false,
    latestMarketAsOf:sessions.at(-1)?.marketDate||null,
    completeSessions:sessions.length,
    modelVersions:[...new Set(sessions.map(x=>x.modelVersion).filter(Boolean))],
    firstSurfaceEpisodes:{byStage,integrated:episodes.filter(x=>x.scope==='integrated').length},
    presenceRecords:presences.length,
    outcomeRecords:outcomes.length,
    outcomesByHorizon:Object.fromEntries(HORIZONS.map(h=>[h,outcomes.filter(x=>x.horizonSessions===h).length])),
    lastRunStatus:runs.at(-1)?.status||null,
    reviewPlan:{
      firstOperationalReviewAfterSessions:30,
      strongerEvidenceTargetSessions:60,
      note:'Review timing is operational, not a statistical guarantee.'
    }
  };
}
