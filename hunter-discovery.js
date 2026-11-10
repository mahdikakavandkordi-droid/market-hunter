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
 const focusVersion='focused-review-v2';
 const focusStages=['Recovery','Early Watch'];

 function focusPool(scan,stage){
  const rows=scan.byStage?.[stage],policy=scan.surfacePolicy?.[stage];
  if(!Array.isArray(rows)||!policy)return scan.surfacePicks?.[stage];
  // Use published admission criteria before the old display limit.
  const score=row=>stage==='Recovery'?(row.surfaceScore??row.score):row.score;
  return rows.filter(row=>row?.priorityBand===policy.requiredBand &&
   (!Number.isFinite(policy.minScore)||row.score>=policy.minScore) &&
   (!Number.isFinite(policy.maxStageAge)||(Number.isFinite(row.stageAge)&&row.stageAge<=policy.maxStageAge)))
   .sort((a,b)=>score(b)-score(a)||a.symbol.localeCompare(b.symbol));
 }
 function passesFocusFactors(row){
  if(row.lowBroken!==false || !Array.isArray(row.riskFlags) || row.riskFlags.length ||
   row.reviewLane==='High Intensity' ||
   !['Higher highs + higher lows','Structure improving'].includes(row.swingTrend))return false;
  if(row.stage==='Recovery')return [row.rs20,row.dist20,row.momentumShift].every(x=>Number.isFinite(x)&&x>0);
  return row.stage==='Early Watch' && Number.isFinite(row.maxRvol5) && row.maxRvol5>=1.5;
 }
 function focusedReview(scan){
  const selected=[],seen=new Set();
  const valid=Boolean(scan?.marketAsOf && scan.market && scan.currency);
  const pools=valid?focusStages.map(stage=>focusPool(scan,stage)):[];
  const available=valid&&pools.every(Array.isArray);
  if(available){
   pools.forEach((pool,index)=>{
    for(const row of pool){
     if(!row?.symbol || row.stage!==focusStages[index] || row.date!==scan.marketAsOf ||
      row.market!==scan.market || row.currency!==scan.currency || !Number.isFinite(row.price) ||
      row.price<=0 || seen.has(row.symbol) || !passesFocusFactors(row))continue;
     seen.add(row.symbol);
     selected.push(row);
    }
   });
  }
  return {version:focusVersion,available,selected};
 }
 root.MarketHunterDiscovery={version,build,focusVersion,focusedReview,passesFocusFactors};
})(globalThis);
