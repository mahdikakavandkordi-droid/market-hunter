/* Shared research screen. No stage quota, ranking or calibrated profit claim. */
(function(root){
 const version='industry-discovery-v1';
 function build(scan){
  const rows=scan?.universeRows,context=scan?.industryContext;
  const unavailable={version,status:'unavailable',selected:[],excluded:[],industries:[]};
  if(!Array.isArray(rows)||context?.version!=='industry-context-v1'||context.asOf!==scan.marketAsOf||!Array.isArray(context.industries))return unavailable;
  const seen=new Set();
  for(const row of rows){if(!row?.symbol||seen.has(row.symbol)||row.date!==scan.marketAsOf||row.market!==scan.market||row.currency!==scan.currency)return unavailable;seen.add(row.symbol)}
  const selected=[],excluded=[];
  for(const row of rows){
   const reasons=[];
   for(const key of ['price','ret20','rs20','dist20','dist50','rsi14','atr14Pct'])if(!Number.isFinite(row[key]))reasons.push('missing_'+key);
   if(!(row.price>0))reasons.push('invalid_price');
   if(!(row.ret20>0))reasons.push('nonpositive_return');
   if(!(row.rs20>0))reasons.push('not_outperforming');
   if(!(row.dist50>0))reasons.push('below_trend');
   if(row.lowBroken!==false)reasons.push('low_not_confirmed_intact');
   if(!Array.isArray(row.riskFlags))reasons.push('missing_risk_checks');else if(row.riskFlags.length)reasons.push('risk_flags');
   if(reasons.length)excluded.push({symbol:row.symbol,reasons});else selected.push(row);
  }
  const incompleteCount=excluded.filter(x=>x.reasons.some(r=>r.startsWith('missing_')||r==='low_not_confirmed_intact'&&rows.find(y=>y.symbol===x.symbol)?.lowBroken==null)).length;
  selected.sort((a,b)=>a.symbol.localeCompare(b.symbol));
  const mapped=new Set(context.industries.map(x=>x.sector));
  const industries=context.industries.map(x=>({...x,selected:selected.filter(r=>r.sector===x.sector)}));
  const unmapped=rows.filter(r=>!mapped.has(r.sector));
  if(unmapped.length)industries.push({sector:'Unmapped',status:'unmapped',usableMembers:unmapped.length,universeMembers:null,selected:selected.filter(r=>!mapped.has(r.sector))});
  return {version,status:!rows.length?'no_usable_data':incompleteCount===rows.length?'incomplete':'available',incompleteCount,asOf:scan.marketAsOf,selected,excluded,industries};
 }
 const focusVersion='focused-review-v1';
 function focusedReview(scan){
  const stages=['Recovery','Early Watch'];
  const available=Boolean(scan?.marketAsOf && scan.market && scan.currency &&
   stages.every(stage=>Array.isArray(scan.surfacePicks?.[stage])));
  const selected=[];
  if(available){
   for(const stage of stages){
    // Preserve canonical within-stage rank. Each horizon has at most one slot.
    const row=scan.surfacePicks[stage].find(row=>{
     if(!row?.symbol || row.stage!==stage || row.date!==scan.marketAsOf ||
      row.market!==scan.market || row.currency!==scan.currency ||
      !Number.isFinite(row.price) || row.price<=0 || row.lowBroken!==false ||
      !Array.isArray(row.riskFlags) || row.riskFlags.length || row.reviewLane==='High Intensity' ||
      !['Higher highs + higher lows','Structure improving'].includes(row.swingTrend) ||
      selected.some(prior=>prior.symbol===row.symbol))return false;
     return stage==='Recovery'
      ? [row.rs20,row.dist20,row.momentumShift].every(x=>Number.isFinite(x)&&x>0)
      : Number.isFinite(row.maxRvol5)&&row.maxRvol5>=1.5;
    });
    if(row)selected.push(row);
   }
  }
  return {version:focusVersion,available,selected};
 }
 root.MarketHunterDiscovery={version,build,focusVersion,focusedReview};
})(globalThis);
