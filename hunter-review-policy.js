// Presentation-only triage. Never rewrites the scanner or its prospective ledger.
(function(root){
  const version='cautious-review-v1-20261026';
  const finite=Number.isFinite;
  function assess(row,session){
    const r=row||{},reasons=[];
    if(!session||r.date!==session)reasons.push('session');
    if(!finite(r.momentumShift)||!finite(r.rs20)||typeof r.lowBroken!=='boolean'||!r.swingTrend||!Array.isArray(r.riskFlags))reasons.push('missing');
    if(r.lowBroken===true||r.lowState==='local_low_broken')reasons.push('broken');
    if(r.swingTrend==='Lower highs + lower lows')reasons.push('structure');
    if(finite(r.momentumShift)&&r.momentumShift<=0)reasons.push('momentum');
    if(finite(r.rs20)&&r.rs20<=0)reasons.push('relative');
    if(r.riskFlags?.length||r.reviewLane==='High Intensity')reasons.push('risk');
    return {version,eligible:reasons.length===0,reasons};
  }
  function select(scan){
    const selected=[],deferred=[];
    // Explicitly empty canonical selections remain empty. Never fill from stage leaders.
    for(const row of scan?.integratedSurfacePicks||[]){
      const assessment=assess(row,scan.marketAsOf);
      (assessment.eligible?selected:deferred).push({row,assessment});
    }
    return {version,selected,deferred};
  }
  root.MarketHunterReviewPolicy={version,assess,select};
})(typeof window==='undefined'?globalThis:window);
