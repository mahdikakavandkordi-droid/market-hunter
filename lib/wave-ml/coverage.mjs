const DAY=86400000;
const date=t=>new Date(t).toISOString().slice(0,10);
export function coverage(rows,expectedDates){
 const expected=[...new Set(expectedDates)].sort(),allowed=new Set(expected),counts={};
 for(const r of rows){const t=Date.parse(r.availableAt);if(!Number.isFinite(t))throw Error('invalid_coverage_timestamp');const d=date(t);if(!allowed.has(d))throw Error('coverage_date_outside_calendar');counts[d]=(counts[d]||0)+1;}
 const months={};let longest=null,run=[];
 const endRun=()=>{if(run.length&&(!longest||run.length>longest.expectedDecisionDays))longest={start:run[0],endInclusive:run.at(-1),expectedDecisionDays:run.length,calendarDays:(Date.parse(run.at(-1))-Date.parse(run[0]))/DAY+1};run=[];};
 for(const d of expected){const m=d.slice(0,7);months[m]??={expectedDecisionDays:0,observedDecisionDays:0,rows:0};months[m].expectedDecisionDays++;
  if(counts[d]){months[m].observedDecisionDays++;months[m].rows+=counts[d];endRun();}else run.push(d);
 }endRun();
 const observed=Object.keys(counts).sort();return {rows:rows.length,expectedDecisionDays:expected.length,observedDecisionDays:observed.length,decisionDayCoverage:expected.length?observed.length/expected.length:null,firstObserved:observed[0]??null,lastObserved:observed.at(-1)??null,months,emptyMonths:Object.entries(months).filter(([,v])=>v.observedDecisionDays===0).map(([m])=>m),longestMissingRun:longest,interpretation:'calendar coverage and gaps, not independent sample size; paired directions do not create additional observed days'};
}
