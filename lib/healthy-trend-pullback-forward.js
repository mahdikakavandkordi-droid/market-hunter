import crypto from 'node:crypto';
import {HTP_PARAMS,dayKey,pct,lastAtOrBeforeIndex} from './healthy-trend-pullback.js';

export const HTP_FORWARD_COLLECTOR_VERSION='healthy-trend-pullback-forward-v1-2026-09-28';

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
  const existing=parseJsonl(existingText),byKey=new Map(existing.map(x=>[keyFn(x),x])),added=[];
  for(const r of records){
    const k=keyFn(r),prior=byKey.get(k);
    if(prior){
      if(stableStringify(prior)!==stableStringify(r))throw new Error('append_only_conflict:'+k);
      continue;
    }
    byKey.set(k,r);existing.push(r);added.push(r);
  }
  return {text:existing.map(x=>JSON.stringify(x)).join('\n')+(existing.length?'\n':''),added};
}
export function completedSessionRows(result,nowMs=Date.now()){
  const q=result?.indicators?.quote?.[0]||{};
  const adj=result?.indicators?.adjclose?.[0]?.adjclose||q.close||[];
  const sessionEnd=result?.meta?.currentTradingPeriod?.regular?.end;
  const currentSession=sessionEnd?dayKey(sessionEnd):null;
  const rows=(result?.timestamp||[]).map((t,i)=>{
    const rawClose=q.close?.[i],factor=Number.isFinite(adj[i])&&Number.isFinite(rawClose)&&rawClose!==0?adj[i]/rawClose:1;
    return {
      t,
      close:adj[i],
      rawClose,
      high:Number.isFinite(q.high?.[i])?q.high[i]*factor:null,
      low:Number.isFinite(q.low?.[i])?q.low[i]*factor:null,
      rawHigh:q.high?.[i]??null,
      rawLow:q.low?.[i]??null,
      volume:q.volume?.[i]
    };
  }).filter(x=>[x.close,x.rawClose,x.high,x.low,x.volume].every(Number.isFinite)&&x.close>0&&x.rawClose>0&&x.volume>0)
    .filter(x=>dayKey(x.t)!==currentSession||!Number.isFinite(sessionEnd)||nowMs>=sessionEnd*1000);
  return rows;
}
export function normalizeYahooChart(payload,symbol,nowMs=Date.now()){
  const result=payload?.chart?.result?.[0];
  if(!result)throw new Error('chart_result_missing:'+symbol);
  const rows=completedSessionRows(result,nowMs);
  const splitDays=[...new Set(Object.values(result?.events?.splits||{}).map(x=>dayKey(Number(x.date))).filter(Boolean))].sort();
  return {
    symbol,
    currency:result?.meta?.currency||null,
    exchangeName:result?.meta?.exchangeName||null,
    rows,
    splitDays,
    sourceHash:sha256Json({symbol,currency:result?.meta?.currency||null,rows,splitDays})
  };
}
export function observationId(modelVersion,marketAsOf,model){
  return [modelVersion,marketAsOf,model].join('|');
}
export function pickObservationId(modelVersion,marketAsOf,model,symbol){
  return [modelVersion,marketAsOf,model,symbol].join('|');
}
export function coverageStatus({intended,evaluated,pickCount,collectorFailure=false,marketCompleted=true}){
  if(!marketCompleted)return 'market_not_completed';
  if(collectorFailure)return 'collector_failure';
  if(evaluated<intended)return 'partial_coverage';
  return pickCount>0?'complete_nonzero':'complete_zero_pick';
}
function exactIndex(rows,date){return rows.findIndex(x=>dayKey(x.t)===date)}
function gapDays(a,b){return Math.round((Number(b.t)-Number(a.t))/86400)}
export function matureForwardPick({pack,decisionDate,decisionAtr14,benchmarkRows,maturedAt}){
  const rows=pack?.rows||[],di=exactIndex(rows,decisionDate);
  if(di<0||!Number.isFinite(decisionAtr14)||decisionAtr14<=0)return null;
  const ei=di+1,fi=ei+HTP_PARAMS.primaryPostEntrySessions;
  if(fi>=rows.length)return null;
  const entry=rows[ei],entryDate=dayKey(entry.t),finalDate=dayKey(rows[fi].t);
  const splitDays=new Set(pack?.splitDays||[]);
  const corporateActionDuringHorizon=rows.slice(di+1,fi+1).some(r=>splitDays.has(dayKey(r.t)));
  if(corporateActionDuringHorizon){
    return {
      status:'corporate_action_during_horizon',
      primaryExcluded:true,
      maturedAt,decisionDate,entryDate,entryPrice:entry.close,finalDate,decisionAtr14
    };
  }
  const path=rows.slice(ei+1,fi+1);
  let irregular=false;
  for(let j=ei+1;j<=fi;j++)if(gapDays(rows[j-1],rows[j])>HTP_PARAMS.irregularGapDays)irregular=true;
  const favourableBarrier=entry.close+2*decisionAtr14,adverseBarrier=entry.close-decisionAtr14;
  let primaryLabel='neither',timeToFavourable=null,firstHitSession=null;
  for(let k=0;k<path.length;k++){
    const hitF=path[k].high>=favourableBarrier,hitA=path[k].low<=adverseBarrier;
    if(hitF&&hitA){primaryLabel='ambiguous_both_hit';firstHitSession=k+1;break}
    if(hitF){primaryLabel='success';timeToFavourable=k+1;firstHitSession=k+1;break}
    if(hitA){primaryLabel='adverse_first';firstHitSession=k+1;break}
  }
  if(irregular)primaryLabel='suspension_or_irregular_gap';
  const returns={},benchmarkReturns={},excessReturns={};
  for(const h of [5,10,20]){
    const oi=ei+h;
    if(oi>=rows.length){returns[h]=benchmarkReturns[h]=excessReturns[h]=null;continue}
    const outDate=dayKey(rows[oi].t);
    const b0=lastAtOrBeforeIndex(benchmarkRows,entryDate),b1=lastAtOrBeforeIndex(benchmarkRows,outDate);
    const rr=pct(rows[oi].close,entry.close),br=b0>=0&&b1>=0?pct(benchmarkRows[b1].close,benchmarkRows[b0].close):null;
    returns[h]=rr;benchmarkReturns[h]=br;excessReturns[h]=Number.isFinite(rr)&&Number.isFinite(br)?rr-br:null;
  }
  const favourableExcursionPct=path.length?Math.max(...path.map(x=>pct(x.high,entry.close)).filter(Number.isFinite)):null;
  const adverseExcursionPct=path.length?Math.min(...path.map(x=>pct(x.low,entry.close)).filter(Number.isFinite)):null;
  return {
    status:'evaluated',primaryExcluded:irregular,
    maturedAt,decisionDate,entryDate,entryPrice:entry.close,finalDate,decisionAtr14,
    favourableBarrier,adverseBarrier,primaryLabel,timeToFavourable,firstHitSession,
    returns,benchmarkReturns,excessReturns,favourableExcursionPct,adverseExcursionPct
  };
}
