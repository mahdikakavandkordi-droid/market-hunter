// Descriptive forward evidence only. Never changes selections or stored outcomes.
const STAGES=['Early Watch','Recovery','Attractive Growth','Established Move'];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{const s=[...a].sort((a,b)=>a-b),n=s.length;return n?(s[Math.floor((n-1)/2)]+s[Math.floor(n/2)])/2:null;};
export function summarizeHunterQuality(outcomes,asOf){
  const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
  if(!validDate(asOf))throw new Error('invalid_quality_cutoff');
  const ids=new Set();
  const eligible=outcomes.filter(r=>{
    if(!r.outcomeId||ids.has(r.outcomeId))throw new Error('duplicate_or_missing_outcome_id');
    ids.add(r.outcomeId);
    return validDate(r.targetDate)&&validDate(r.decisionDate)&&typeof r.symbol==='string'&&r.symbol.length>0&&r.targetDate<=asOf&&r.decisionDate<r.targetDate;
  });
  const groups=[{scope:'integrated',stage:null},...STAGES.map(stage=>({scope:'stage',stage}))];
  return {version:'hunter-quality-v1',asOf,descriptiveOnly:true,groups:groups.map(group=>({...group,
    horizons:Object.fromEntries([5,10,20].map(h=>{
      const records=eligible.filter(r=>r.scope===group.scope&&(!group.stage||r.entryStage===group.stage)&&r.horizonSessions===h);
      const usable=records.filter(r=>finite(r.returnPct)&&finite(r.benchmarkReturnPct));
      const excess=usable.map(r=>r.returnPct-r.benchmarkReturnPct);
      const bySymbol=new Map();
      usable.forEach((r,i)=>{const a=bySymbol.get(r.symbol)||[];a.push(excess[i]);bySymbol.set(r.symbol,a);});
      return [h,{recorded:records.length,observations:usable.length,excludedMissing:records.length-usable.length,
        uniqueSymbols:bySymbol.size,decisionDates:new Set(usable.map(r=>r.decisionDate)).size,
        meanReturnPct:mean(usable.map(r=>r.returnPct)),meanExcessPct:mean(excess),medianExcessPct:median(excess),
        symbolBalancedExcessPct:mean([...bySymbol.values()].map(mean)),
        beatBenchmarkPct:usable.length?100*excess.filter(x=>x>0).length/usable.length:null}];
    }))
  }))};
}
