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
  selected.sort((a,b)=>a.symbol.localeCompare(b.symbol));
  const mapped=new Set(context.industries.map(x=>x.sector));
  const industries=context.industries.map(x=>({...x,selected:selected.filter(r=>r.sector===x.sector)}));
  const unmapped=rows.filter(r=>!mapped.has(r.sector));
  if(unmapped.length)industries.push({sector:'Unmapped',status:'unmapped',usableMembers:unmapped.length,universeMembers:null,selected:selected.filter(r=>!mapped.has(r.sector))});
  return {version,status:rows.length?'available':'no_usable_data',asOf:scan.marketAsOf,selected,excluded,industries};
 }
 root.MarketHunterDiscovery={version,build};
})(globalThis);
