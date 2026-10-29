// Reprice endpoints from one adjusted series without editing decision snapshots.
export function discoveryOutcomes(snapshots,series,asOf,referenceSymbol){
 const day=r=>new Date(r.t*1000).toISOString().slice(0,10);
 const sessions=(series[referenceSymbol]?.rows||[]).map(day).filter(d=>d<=asOf);
 const maps=new Map(Object.entries(series).map(([symbol,x])=>[symbol,new Map((x?.rows||[]).map(r=>[day(r),r.close]))]));
 const horizons={};
 for(const h of [5,10,20]){
  const observations=[],dates=new Set();let pending=0,missing=0;
  for(const s of snapshots){
   if(s.version!=='industry-discovery-v1'||s.asOf>asOf)continue;
   const start=sessions.indexOf(s.asOf),end=start<0?null:sessions[start+h];
   for(const symbol of s.selectedSymbols||[]){
    if(start<0){missing++;continue}if(!end){pending++;continue}
    const row=s.universeRows.find(r=>r.symbol===symbol),prices=maps.get(symbol),bench=maps.get(row?.benchmark);
    const values=[prices?.get(s.asOf),prices?.get(end),bench?.get(s.asOf),bench?.get(end)];
    if(!values.every(x=>Number.isFinite(x)&&x>0)){missing++;continue}
    const [a,b,c,d]=values,ret=(b/a-1)*100,benchmarkReturn=(d/c-1)*100;
    observations.push({returnPct:ret,excessPct:ret-benchmarkReturn});dates.add(s.asOf);
   }
  }
  const mean=key=>observations.length?observations.reduce((sum,r)=>sum+r[key],0)/observations.length:null;
  horizons[h]={observations:observations.length,decisionDates:dates.size,pending,missing,positive:observations.filter(r=>r.returnPct>0).length,beatingBenchmark:observations.filter(r=>r.excessPct>0).length,meanReturnPct:mean('returnPct'),meanExcessPct:mean('excessPct')};
 }
 return {version:'industry-discovery-v1',asOf,capturedSessions:snapshots.filter(s=>s.version==='industry-discovery-v1'&&s.asOf<=asOf).length,basis:'Overlapping stock-session observations, not portfolio returns. Same-provider adjusted close returns, before costs. No statistical validation claimed.',horizons};
}
