export const HTP_VERSION='healthy-trend-pullback-v1-2026-09-28';

export const HTP_PARAMS=Object.freeze({
  minPrice:2,
  minAvgDollar20:3000000,
  splitLookbackSessions:30,
  pullbackMinPct:4,
  pullbackMaxPct:12,
  pivotLookbackSessions:15,
  rs20MinPctPoints:0,
  volumeRatioMin:1.20,
  maxVisible:6,
  primaryPostEntrySessions:20,
  irregularGapDays:7
});

export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const mean=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
export const pct=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a/b-1)*100:null;
export const dayKey=t=>new Date(Number(t)*1000).toISOString().slice(0,10);
export function sma(values,n,offset=0){
  const end=values.length-offset;
  if(end<n)return null;
  return mean(values.slice(end-n,end));
}
export function weekKeyMonday(t){
  const d=new Date(Number(t)*1000);
  const shift=(d.getUTCDay()+6)%7;
  d.setUTCDate(d.getUTCDate()-shift);
  return d.toISOString().slice(0,10);
}
export function completedWeeklyCloses(rows,decisionIndex){
  const currentWeek=weekKeyMonday(rows[decisionIndex].t);
  const byWeek=new Map();
  for(let i=0;i<=decisionIndex;i++){
    const wk=weekKeyMonday(rows[i].t);
    if(wk>=currentWeek)continue;
    byWeek.set(wk,rows[i].close);
  }
  return [...byWeek.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([week,close])=>({week,close}));
}
export function trueRange(row,prevClose){
  if(!row||!Number.isFinite(prevClose))return null;
  return Math.max(row.high-row.low,Math.abs(row.high-prevClose),Math.abs(row.low-prevClose));
}
export function atr14At(rows,i){
  if(i<14)return null;
  const tr=[];
  for(let j=i-13;j<=i;j++){
    const x=trueRange(rows[j],rows[j-1]?.close);
    if(Number.isFinite(x))tr.push(x);
  }
  return tr.length===14?mean(tr):null;
}
export function avgDollar20At(rows,i){
  if(i<19)return null;
  return mean(rows.slice(i-19,i+1).map(x=>x.rawClose*x.volume));
}
export function avgPriorVolume20At(rows,i){
  if(i<20)return null;
  return mean(rows.slice(i-20,i).map(x=>x.volume));
}
export function recentSplit(pack,rows,i,lookback=HTP_PARAMS.splitLookbackSessions){
  const splitDays=pack?.splitDays instanceof Set?pack.splitDays:new Set(pack?.splitDays||[]);
  for(let j=Math.max(0,i-lookback);j<=i;j++)if(splitDays.has(dayKey(rows[j].t)))return true;
  return false;
}
export function lastAtOrBeforeIndex(rows,date){
  let lo=0,hi=rows.length-1,ans=-1;
  while(lo<=hi){
    const m=(lo+hi)>>1,d=dayKey(rows[m].t);
    if(d<=date){ans=m;lo=m+1}else hi=m-1;
  }
  return ans;
}
export function rs20At(rows,i,benchmarkRows){
  if(i<20)return null;
  const nowDate=dayKey(rows[i].t),oldDate=dayKey(rows[i-20].t);
  const bn=lastAtOrBeforeIndex(benchmarkRows,nowDate),bo=lastAtOrBeforeIndex(benchmarkRows,oldDate);
  if(bn<0||bo<0)return null;
  const sr=pct(rows[i].close,rows[i-20].close),br=pct(benchmarkRows[bn].close,benchmarkRows[bo].close);
  return Number.isFinite(sr)&&Number.isFinite(br)?sr-br:null;
}
export function latestConfirmedPivotHigh(rows,i,lookback=HTP_PARAMS.pivotLookbackSessions){
  for(let p=i-2;p>=Math.max(2,i-lookback);p--){
    if(p+2>i)continue;
    const x=rows[p];
    if(
      x.high>rows[p-1].high&&x.high>=rows[p-2].high&&
      x.high>rows[p+1].high&&x.high>=rows[p+2].high
    ){
      return {index:p,date:dayKey(x.t),high:x.high,confirmedAt:dayKey(rows[p+2].t)};
    }
  }
  return null;
}
export function weeklyTrendState(rows,i){
  const weekly=completedWeeklyCloses(rows,i);
  const c=weekly.map(x=>x.close);
  if(c.length<24)return {eligible:false,weeklyCount:c.length};
  const last=c.at(-1),sma10=sma(c,10),sma20=sma(c,20),sma10FourAgo=sma(c,10,4);
  const slope4=pct(sma10,sma10FourAgo);
  return {
    eligible:Number.isFinite(last)&&Number.isFinite(sma10)&&Number.isFinite(sma20)&&Number.isFinite(sma10FourAgo)&&last>sma10&&sma10>sma20&&sma10>sma10FourAgo,
    weeklyCount:c.length,lastCompletedWeek:weekly.at(-1)?.week||null,lastWeeklyClose:last,sma10,sma20,sma10FourAgo,slope4
  };
}
export function genericEligibility({pack,rows,i}){
  if(i<100)return {eligible:false,reason:'insufficient_history'};
  const avgDollar20=avgDollar20At(rows,i);
  const atr14=atr14At(rows,i);
  if(!Number.isFinite(rows[i]?.rawClose)||rows[i].rawClose<HTP_PARAMS.minPrice)return {eligible:false,reason:'min_price',avgDollar20,atr14};
  if(!Number.isFinite(avgDollar20)||avgDollar20<HTP_PARAMS.minAvgDollar20)return {eligible:false,reason:'liquidity',avgDollar20,atr14};
  if(recentSplit(pack,rows,i))return {eligible:false,reason:'recent_split',avgDollar20,atr14};
  if(!Number.isFinite(atr14)||atr14<=0)return {eligible:false,reason:'atr',avgDollar20,atr14};
  return {eligible:true,reason:null,avgDollar20,atr14,atr14Pct:pct(rows[i].close+atr14,rows[i].close)};
}
export function setupAt({pack,rows,i,benchmarkRows,marketRows,variant='core',genericState=null,weeklyState=null,closeSeries=null}){
  const generic=genericState||genericEligibility({pack,rows,i});
  if(!generic.eligible)return {...generic,eligible:false,reason:generic.reason};
  const weekly=weeklyState||weeklyTrendState(rows,i);
  if(!weekly.eligible)return {...generic,weekly,eligible:false,reason:'weekly_trend'};
  const closes=closeSeries||rows.map(x=>x.close);
  const ma20=i>=19?mean(closes.slice(i-19,i+1)):null,ma50=i>=49?mean(closes.slice(i-49,i+1)):null;
  const prior20High=Math.max(...rows.slice(i-20,i).map(x=>x.close));
  const drawdownPct=(1-rows[i].close/prior20High)*100;
  const controlled=drawdownPct>=HTP_PARAMS.pullbackMinPct&&drawdownPct<=HTP_PARAMS.pullbackMaxPct&&rows[i].close>=ma50&&ma20>ma50;
  if(!controlled)return {...generic,weekly,ma20,ma50,drawdownPct,eligible:false,reason:'controlled_pullback'};
  const pivot=latestConfirmedPivotHigh(rows,i);
  const recovered=!!pivot&&rows[i].close>pivot.high&&rows[i-1].close<=pivot.high;
  if(!recovered)return {...generic,weekly,ma20,ma50,drawdownPct,pivot,eligible:false,reason:'pivot_recovery'};
  const rs20=rs20At(rows,i,benchmarkRows);
  if(!Number.isFinite(rs20)||rs20<HTP_PARAMS.rs20MinPctPoints)return {...generic,weekly,ma20,ma50,drawdownPct,pivot,rs20,eligible:false,reason:'relative_strength'};
  const priorVol=avgPriorVolume20At(rows,i);
  const volumeRatio=Number.isFinite(priorVol)&&priorVol>0?rows[i].volume/priorVol:null;
  let marketAbove50=null;
  if(Array.isArray(marketRows)){
    const mi=lastAtOrBeforeIndex(marketRows,dayKey(rows[i].t));
    if(mi>=49){
      const mc=marketRows.slice(0,mi+1).map(x=>x.close);
      const m50=sma(mc,50);
      marketAbove50=Number.isFinite(m50)&&marketRows[mi].close>m50;
    }
  }
  if(variant==='core_volume'&&!(Number.isFinite(volumeRatio)&&volumeRatio>=HTP_PARAMS.volumeRatioMin)){
    return {...generic,weekly,ma20,ma50,drawdownPct,pivot,rs20,volumeRatio,marketAbove50,eligible:false,reason:'volume_confirmation'};
  }
  if(variant==='core_market'&&marketAbove50!==true){
    return {...generic,weekly,ma20,ma50,drawdownPct,pivot,rs20,volumeRatio,marketAbove50,eligible:false,reason:'market_context'};
  }
  const rsScore=clamp(rs20/10,0,1)*40;
  const weeklyScore=clamp((weekly.slope4??0)/5,0,1)*25;
  const pullbackQuality=clamp(1-Math.abs(drawdownPct-7.5)/4.5,0,1)*20;
  const reclaimAtr=(rows[i].close-pivot.high)/generic.atr14;
  const reclaimScore=clamp(reclaimAtr,0,1)*15;
  const score=rsScore+weeklyScore+pullbackQuality+reclaimScore;
  return {
    eligible:true,reason:null,score,
    ...generic,weekly,ma20,ma50,drawdownPct,pivot,rs20,volumeRatio,marketAbove50,
    rankParts:{rsScore,weeklyScore,pullbackQuality,reclaimScore}
  };
}
export function trendRsAt({pack,rows,i,benchmarkRows,genericState=null,weeklyState=null,closeSeries=null}){
  const generic=genericState||genericEligibility({pack,rows,i});
  if(!generic.eligible)return {...generic,eligible:false,reason:generic.reason};
  const weekly=weeklyState||weeklyTrendState(rows,i);
  if(!weekly.eligible)return {...generic,weekly,eligible:false,reason:'weekly_trend'};
  const closes=closeSeries||rows.map(x=>x.close),ma50=i>=49?mean(closes.slice(i-49,i+1)):null;
  if(!(rows[i].close>=ma50))return {...generic,weekly,ma50,eligible:false,reason:'ma50'};
  const rs20=rs20At(rows,i,benchmarkRows);
  if(!Number.isFinite(rs20)||rs20<0)return {...generic,weekly,ma50,rs20,eligible:false,reason:'relative_strength'};
  const score=clamp(rs20/10,0,1)*60+clamp((weekly.slope4??0)/5,0,1)*40;
  return {eligible:true,reason:null,score,...generic,weekly,ma50,rs20};
}
function calendarGapDays(a,b){
  return Math.round((Number(b.t)-Number(a.t))/86400);
}
export function evaluateEpisode({pack,decisionIndex,benchmarkRows,calendar}){
  const rows=pack.rows;
  const atr14=atr14At(rows,decisionIndex);
  const entryIndex=decisionIndex+1;
  const finalIndex=entryIndex+HTP_PARAMS.primaryPostEntrySessions;
  const decisionDate=dayKey(rows[decisionIndex].t);
  if(!Number.isFinite(atr14)||entryIndex>=rows.length)return {status:'missing_entry',decisionDate,atr14};
  const entry=rows[entryIndex],entryDate=dayKey(entry.t);
  if(finalIndex>=rows.length)return {status:'incomplete_horizon',decisionDate,entryDate,entryPrice:entry.close,atr14};
  const path=rows.slice(entryIndex+1,finalIndex+1);
  let irregular=false;
  for(let j=entryIndex+1;j<=finalIndex;j++)if(calendarGapDays(rows[j-1],rows[j])>HTP_PARAMS.irregularGapDays)irregular=true;
  const finalDate=dayKey(rows[finalIndex].t);
  let split='Outside',included=false,exclusionReason='outside_calendar';
  if(decisionDate>=calendar.developmentStart&&decisionDate<calendar.validationStart){
    split='Development';included=finalDate<calendar.validationStart;exclusionReason=included?null:'validation_boundary_outcome_purge';
  }else if(decisionDate>=calendar.validationStart&&decisionDate<calendar.finalStart){
    split='Validation';included=finalDate<calendar.finalStart;exclusionReason=included?null:'historical_final_outcome_purge';
  }else if(decisionDate>=calendar.finalStart){
    split='Historical Final';included=false;exclusionReason='historical_final_sealed';
  }
  const favourableBarrier=entry.close+2*atr14,adverseBarrier=entry.close-atr14;
  let primaryLabel='neither',timeToFavourable=null,firstHitIndex=null;
  for(let k=0;k<path.length;k++){
    const hitF=path[k].high>=favourableBarrier,hitA=path[k].low<=adverseBarrier;
    if(hitF&&hitA){primaryLabel='ambiguous_both_hit';firstHitIndex=k+1;break}
    if(hitF){primaryLabel='success';timeToFavourable=k+1;firstHitIndex=k+1;break}
    if(hitA){primaryLabel='adverse_first';firstHitIndex=k+1;break}
  }
  if(irregular)primaryLabel='suspension_or_irregular_gap';
  const returns={},benchmarkReturns={},excessReturns={};
  for(const h of [5,10,20]){
    const oi=entryIndex+h;
    if(oi>=rows.length){returns[h]=null;benchmarkReturns[h]=null;excessReturns[h]=null;continue}
    const od=dayKey(rows[oi].t),bi0=lastAtOrBeforeIndex(benchmarkRows,entryDate),bi1=lastAtOrBeforeIndex(benchmarkRows,od);
    const r=pct(rows[oi].close,entry.close);
    const br=bi0>=0&&bi1>=0?pct(benchmarkRows[bi1].close,benchmarkRows[bi0].close):null;
    returns[h]=r;benchmarkReturns[h]=br;excessReturns[h]=Number.isFinite(r)&&Number.isFinite(br)?r-br:null;
  }
  const favourableExcursionPct=path.length?Math.max(...path.map(x=>pct(x.high,entry.close)).filter(Number.isFinite)):null;
  const adverseExcursionPct=path.length?Math.min(...path.map(x=>pct(x.low,entry.close)).filter(Number.isFinite)):null;
  return {
    status:'evaluated',decisionDate,entryDate,entryPrice:entry.close,atr14,finalDate,split,included,exclusionReason,
    irregularGap:irregular,primaryLabel,timeToFavourable,firstHitIndex,favourableBarrier,adverseBarrier,
    returns,benchmarkReturns,excessReturns,favourableExcursionPct,adverseExcursionPct
  };
}
export function buildEpisodes({model,confirmedDates,selectedByDate,evaluate}){
  const out=[];let previous=new Set(),priorConfirmedDate=null;
  for(const date of confirmedDates){
    const rows=selectedByDate.get(date)||[];
    const current=new Set(rows.map(x=>x.symbol));
    for(const row of rows){
      if(previous.has(row.symbol))continue;
      out.push({
        episodeId:model+'|'+row.symbol+'|'+date,model,symbol:row.symbol,firstSurfaceDate:date,priorConfirmedDate,
        rank:row.rank,score:row.score,sector:row.sector,atr14Pct:row.atr14Pct,volQuintile:row.volQuintile,
        matchedTargetSymbol:row.matchedTargetSymbol,matchedTargetSector:row.matchedTargetSector,matchedTargetVolQuintile:row.matchedTargetVolQuintile,
        ...(evaluate?evaluate(row,date):{})
      });
    }
    previous=current;priorConfirmedDate=date;
  }
  return out;
}
