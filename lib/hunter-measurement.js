const finite=x=>typeof x==='number'&&Number.isFinite(x);
const day=x=>new Date(x.t*1000).toISOString().slice(0,10);
const pct=(a,b)=>finite(a)&&finite(b)&&b>0?(a/b-1)*100:null;

// Revalue both endpoints from one adjusted history. The saved selection is evidence,
// not a price on the vendor's current adjustment scale. Never alter the saved record.
export function selectionBasis(rows,decisionDate,recordedPrice){
  const entry=rows?.find(r=>day(r)===decisionDate);
  if(!entry||!finite(entry.close)||entry.close<=0||!finite(recordedPrice)||recordedPrice<=0)return {status:'entry_basis_unavailable'};
  const scale=entry.close/recordedPrice;
  const actions=(rows||[]).filter(r=>day(r)>decisionDate).flatMap(r=>(r.corporateActions||[]).map(a=>({...a,date:day(r)})));
  // Large unexplained changes may be bad vendor history or an identity error.
  // Do not turn them into a confident return merely because both numbers exist.
  const splitScale=actions.filter(a=>a.type==='split').reduce((s,a)=>s*a.denominator/a.numerator,1);
  if(Math.abs(scale-1)>.01&&(!finite(splitScale)||splitScale<=0||Math.abs(scale/splitScale-1)>.01))return {status:'unexplained_price_basis_change',scale,actions};
  return {status:'available',method:'same-source-adjusted-endpoints-v1',entryPrice:entry.close,recordedPrice,scale,actions};
}

export function measureSelection({rows=[],benchmarkRows=[],decisionDate,targetDate,recordedPrice}){
  const basis=selectionBasis(rows,decisionDate,recordedPrice);
  const target=rows.find(r=>day(r)===targetDate);
  const b0=benchmarkRows.find(r=>day(r)===decisionDate),b1=benchmarkRows.find(r=>day(r)===targetDate);
  if(basis.status!=='available'||!target||!finite(target.close)||target.close<=0||!b0||!b1)return {status:basis.status==='available'?'endpoint_unavailable':basis.status,basis,returnPct:null,benchmarkReturnPct:null,excessReturnPct:null,maxFavourableExcursionPct:null,maxAdverseExcursionPct:null};
  const path=rows.filter(r=>day(r)>decisionDate&&day(r)<=targetDate);
  const highs=path.map(r=>r.high).filter(finite),lows=path.map(r=>r.low).filter(finite);
  const returnPct=pct(target.close,basis.entryPrice),benchmarkReturnPct=pct(b1.close,b0.close);
  return {status:finite(benchmarkReturnPct)?'available':'benchmark_basis_unavailable',basis,targetClose:target.close,returnPct,benchmarkReturnPct,
    excessReturnPct:finite(benchmarkReturnPct)?returnPct-benchmarkReturnPct:null,
    maxFavourableExcursionPct:highs.length?pct(Math.max(...highs),basis.entryPrice):null,
    maxAdverseExcursionPct:lows.length?pct(Math.min(...lows),basis.entryPrice):null};
}

export function measuredOutcomes(outcomes,symbolRows,benchmarkRows,asOf){
  return outcomes.map(o=>{
    if(o.targetDate>asOf)return o;
    const m=measureSelection({rows:symbolRows.get(o.symbol)||[],benchmarkRows,decisionDate:o.decisionDate,targetDate:o.targetDate,recordedPrice:o.decisionPrice});
    return {...o,...m,measurementBasis:m.basis,recordedReturnPct:o.returnPct};
  });
}

export function coverageForSessions(sessions,benchmarkRows,asOf){
  const dates=[...new Set(sessions.map(s=>s.marketDate))].sort();
  const recorded=new Set(dates);
  const expected=[...new Set(benchmarkRows.map(day).filter(d=>d>=dates[0]&&d<=asOf))].sort();
  return {firstDate:dates[0]||null,asOf,expectedSessions:expected.length,recordedSessions:dates.filter(d=>d<=asOf).length,
    missingDates:expected.filter(d=>!recorded.has(d)),historicalBackfill:false};
}
