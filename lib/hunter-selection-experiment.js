import {STAGES,compactPick,sha256Json,targetDateForHorizon} from './market-hunter-forward-validation.js';
import {surfaceEligible,surfaceSelect,integratedSurfaceSelect} from './market-hunter-v2-engine.js';
import {measureSelection} from './hunter-measurement.js';

export const EXPERIMENT_POLICY=Object.freeze({
  version:'hunter-momentum-peer-order-v1-20261022',
  hypothesis:'Within unchanged stage eligibility, prefer improving momentum, then higher median RS20 of same-sector classified peers, then the original surface rank.',
  sectorMeasure:'Median RS20 of classified peers in this snapshot; not a sector-index return. Missing sectors and fewer than three peers are unranked.',
  momentumRule:'momentumShift > 0; missing values rank after nonpositive values',
  maxVisible:6,horizons:[5,10,20],prospectiveOnly:true,changesProductionSelection:false,
  reviewAfterSessions:30,minimumMaturedDecisionDates:10,
  promotion:'No automatic promotion. Review paired same-date excess returns, adverse excursions, missing outcomes and symbol/sector concentration after the review gate.',
  limitations:'Descriptive discovery selections, not trades. Repeated symbols, overlapping dates and sector effects are not independent observations.'
});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{const s=[...a].sort((a,b)=>a-b);return s.length?(s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2:null;};
const key=s=>s||null;
export function experimentSession(report,capturedAt){
  if(report.market&&report.market!=='CA')throw Error('experiment_requires_canadian_ledger');
  const peers=new Map();
  for(const r of report.all||[])if(r.sector&&finite(r.rs20)){const p=peers.get(r.sector)||[];p.push(r.rs20);peers.set(r.sector,p);}
  const candidates=(report.all||[]).map(r=>{
    const peer=peers.get(key(r.sector))||[];
    return {...compactPick(r),sectorPeerCount:peer.length,sectorPeerRS20:peer.length>=3?median(peer):null,
      baselineStageSelected:Object.values(report.surfacePicks||{}).flat().some(p=>p.symbol===r.symbol),
      baselineSelected:(report.integratedSurfacePicks||[]).some(p=>p.symbol===r.symbol),
      stageEligible:surfaceEligible(r.stage,r.score,r)};
  });
  if(new Set(candidates.map(r=>r.symbol)).size!==candidates.length)throw Error('duplicate_experiment_candidate');
  const momentum=r=>finite(r.momentumShift)?(r.momentumShift>0?2:1):0;
  const baselineScore=r=>r.stage==='Recovery'?(r.surfaceScore??r.score):r.score;
  const compare=(a,b)=>momentum(b)-momentum(a)||(b.sectorPeerRS20??-Infinity)-(a.sectorPeerRS20??-Infinity)||(baselineScore(b)??-Infinity)-(baselineScore(a)??-Infinity)||a.symbol.localeCompare(b.symbol);
  const stagePicks=Object.fromEntries(STAGES.map(stage=>[stage,candidates.filter(r=>r.stage===stage&&r.stageEligible).sort(compare).slice(0,6)]));
  const shadow=integratedSurfaceSelect(stagePicks);
  const shadowSymbols=new Set(shadow.map(r=>r.symbol));
  for(const r of candidates){
    r.shadowSelected=shadowSymbols.has(r.symbol);
    r.omissionReason=r.baselineSelected?'home_selected':r.baselineStageSelected?'home_cap':!r.stageEligible?'stage_eligibility':'stage_rank_cap';
  }
  // Verify the input is an actual production surface, not an ad hoc backtest set.
  const expected=Object.fromEntries(STAGES.map(stage=>[stage,surfaceSelect(stage,(report.all||[]).filter(r=>r.stage===stage))]));
  if(sha256Json(Object.fromEntries(STAGES.map(s=>[s,(report.surfacePicks?.[s]||[]).map(r=>r.symbol)])))!==sha256Json(Object.fromEntries(STAGES.map(s=>[s,expected[s].map(r=>r.symbol)]))))throw Error('baseline_surface_mismatch');
  if(sha256Json((report.integratedSurfacePicks||[]).map(r=>r.symbol))!==sha256Json(integratedSurfaceSelect(expected).map(r=>r.symbol)))throw Error('baseline_integrated_mismatch');
  return {sessionId:EXPERIMENT_POLICY.version+'|'+report.marketAsOf,policy:EXPERIMENT_POLICY,policyHash:sha256Json(EXPERIMENT_POLICY),marketDate:report.marketAsOf,capturedAt,
    sourceGeneratedAt:report.generatedAt,sourceReportHash:sha256Json(report),modelVersion:report.version,
    candidates,baseline:(report.integratedSurfacePicks||[]).map(r=>r.symbol),shadow:shadow.map(r=>r.symbol),
    excludedBeforeClassification:report.excluded||{},screening:report.screening||null};
}

export function experimentPending(sessions,outcomes,benchmarkRows,asOf){
  const seen=new Set(outcomes.map(o=>o.outcomeId)),pending=[];
  for(const s of sessions)for(const r of s.candidates)for(const horizon of s.policy.horizons){
    const targetDate=targetDateForHorizon(benchmarkRows,s.marketDate,horizon),outcomeId=s.sessionId+'|'+r.symbol+'|h'+horizon;
    if(targetDate&&targetDate<=asOf&&!seen.has(outcomeId))pending.push({session:s,candidate:r,horizon,targetDate,outcomeId});
  }
  return pending;
}
export function experimentOutcome(item,symbolRows,benchmarkRows,computedAt){
  const m=measureSelection({rows:symbolRows,benchmarkRows,decisionDate:item.session.marketDate,targetDate:item.targetDate,recordedPrice:item.candidate.price});
  if(m.status!=='available')return null;
  return {outcomeId:item.outcomeId,sessionId:item.session.sessionId,policyHash:item.session.policyHash,symbol:item.candidate.symbol,sector:item.candidate.sector,
    decisionDate:item.session.marketDate,targetDate:item.targetDate,horizonSessions:item.horizon,computedAt,
    baselineSelected:item.candidate.baselineSelected,shadowSelected:item.candidate.shadowSelected,
    decisionPrice:item.candidate.price,...m};
}
export function experimentReport(sessions,outcomes,benchmarkRows,asOf){
  const active=sessions.filter(s=>s.policyHash===sha256Json(EXPERIMENT_POLICY)&&s.marketDate<=asOf).sort((a,b)=>a.marketDate.localeCompare(b.marketDate));
  const ids=new Set(active.map(s=>s.sessionId));
  const eligible=outcomes.filter(o=>ids.has(o.sessionId)&&o.targetDate<=asOf&&finite(o.returnPct)&&finite(o.excessReturnPct));
  function stats(rows){
    const symbols=new Map();for(const r of rows){const a=symbols.get(r.symbol)||[];a.push(r.excessReturnPct);symbols.set(r.symbol,a);}
    const sectors={};for(const r of rows)sectors[r.sector||'Unknown']=(sectors[r.sector||'Unknown']||0)+1;
    return {observations:rows.length,uniqueSymbols:symbols.size,decisionDates:new Set(rows.map(r=>r.decisionDate)).size,
      meanReturnPct:mean(rows.map(r=>r.returnPct)),meanExcessPct:mean(rows.map(r=>r.excessReturnPct)),medianExcessPct:median(rows.map(r=>r.excessReturnPct)),
      symbolBalancedExcessPct:mean([...symbols.values()].map(mean)),meanAdverseExcursionPct:mean(rows.map(r=>r.maxAdverseExcursionPct).filter(finite)),sectors};
  }
  const latest=active.at(-1);
  return {version:'hunter-selection-experiment-v1',policy:EXPERIMENT_POLICY,asOf,startedOn:active[0]?.marketDate||null,sessions:active.length,
    latest:latest?{marketDate:latest.marketDate,baseline:latest.baseline,shadow:latest.shadow,candidates:latest.candidates}:null,
    horizons:Object.fromEntries(EXPERIMENT_POLICY.horizons.map(h=>{
      const rows=eligible.filter(o=>o.horizonSessions===h),pending=experimentPending(active,outcomes,benchmarkRows,asOf).filter(o=>o.horizon===h);
      const paired=active.flatMap(s=>{
        const a=rows.filter(r=>r.sessionId===s.sessionId),base=a.filter(r=>r.baselineSelected),shadow=a.filter(r=>r.shadowSelected);
        return base.length===s.baseline.length&&shadow.length===s.shadow.length&&base.length&&shadow.length?[{date:s.marketDate,excessDifferencePct:mean(shadow.map(r=>r.excessReturnPct))-mean(base.map(r=>r.excessReturnPct))}]:[];
      });
      const groups={baseline:stats(rows.filter(o=>o.baselineSelected)),shadow:stats(rows.filter(o=>o.shadowSelected)),added:stats(rows.filter(o=>o.shadowSelected&&!o.baselineSelected)),removed:stats(rows.filter(o=>o.baselineSelected&&!o.shadowSelected)),neither:stats(rows.filter(o=>!o.baselineSelected&&!o.shadowSelected))};
      return [h,{...groups,expectedMatured:rows.length+pending.length,missingMatured:pending.length,pairedDates:paired.length,pairedMeanExcessDifferencePct:mean(paired.map(r=>r.excessDifferencePct)),reviewReady:active.length>=EXPERIMENT_POLICY.reviewAfterSessions&&paired.length>=EXPERIMENT_POLICY.minimumMaturedDecisionDates&&pending.length===0}];
    }))};
}
