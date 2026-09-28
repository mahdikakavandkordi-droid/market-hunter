export function stableValue(v){
  return Array.isArray(v)?v.map(stableValue):v&&typeof v==='object'
    ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stableValue(v[k])]))
    :v;
}

export function sameValue(a,b){
  return JSON.stringify(stableValue(a))===JSON.stringify(stableValue(b));
}

export function confirmedCoverage(dateLists){
  const sets=dateLists.map(x=>new Set(Array.isArray(x)?x:[]));
  const union=[...new Set(sets.flatMap(s=>[...s]))].sort();
  return {
    confirmedDates:union.filter(d=>sets.every(s=>s.has(d))),
    partialCoverageDates:union.filter(d=>!sets.every(s=>s.has(d))),
    reportCoverageCounts:sets.map((s,batchIndex)=>({batchIndex,scanDays:s.size}))
  };
}

export function selectedByConfirmedDate({candidates,confirmedDates,maxVisible=6}){
  const confirmed=new Set(confirmedDates);
  const byDate=new Map();
  for(const row of Array.isArray(candidates)?candidates:[]){
    if(!confirmed.has(row.date))continue;
    if(!byDate.has(row.date))byDate.set(row.date,[]);
    byDate.get(row.date).push(row);
  }
  const selected=new Map();
  const eligibleCounts=[];
  for(const date of confirmedDates){
    const eligible=[...(byDate.get(date)||[])]
      .sort((a,b)=>(b.score??-Infinity)-(a.score??-Infinity)||String(a.symbol).localeCompare(String(b.symbol)));
    eligibleCounts.push({date,count:eligible.length});
    selected.set(date,eligible.slice(0,maxVisible).map((x,i)=>({...x,rank:i+1})));
  }
  return {selectedByDate:selected,eligibleCounts};
}

// Existing episode definition: a first-surface episode starts when a symbol is selected
// on the current confirmed combined-market scan but was not selected on the immediately
// previous confirmed scan. A confirmed zero-pick scan clears the previous-symbol set and
// therefore ends every active episode. Missing/partial-coverage sessions are not in the
// confirmed timeline, so they neither create an absence nor reset an episode.
export function firstSurfaceEpisodes({confirmedDates,selectedByDate,horizon,benchmarkForSymbol}){
  const out=[];
  let previousSymbols=new Set();
  let priorConfirmedDate=null;
  for(const date of confirmedDates){
    const rows=selectedByDate.get(date)||[];
    const currentSymbols=new Set(rows.map(x=>x.symbol));
    for(const row of rows){
      if(previousSymbols.has(row.symbol))continue;
      out.push({
        episodeId:[horizon,row.symbol,date].join('|'),
        horizon,
        symbol:row.symbol,
        firstSurfaceDate:date,
        priorConfirmedDate,
        outcomeDate:row.outcomeDate,
        benchmarkSymbol:benchmarkForSymbol(row.symbol),
        rank:row.rank,
        score:row.score,
        forwardReturn:row.forwardReturn,
        benchmarkReturn:row.benchmarkReturn,
        excessReturn:row.excessReturn,
        mae:row.mae,
        mfe:row.mfe
      });
    }
    previousSymbols=currentSymbols;
    priorConfirmedDate=date;
  }
  return out;
}

function isIsoDay(v){
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
  const d=new Date(v+'T00:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;
}

export function classifyEpisodeForFixedCalendar(row,calendar){
  const date=row?.firstSurfaceDate;
  const outcomeDate=row?.outcomeDate;
  if(!isIsoDay(date))return {split:'Invalid',included:false,exclusionReason:'invalid_first_surface_date'};
  if(!isIsoDay(outcomeDate))return {split:'Invalid',included:false,exclusionReason:'invalid_outcome_date'};
  if(outcomeDate<date)return {split:'Invalid',included:false,exclusionReason:'outcome_before_first_surface'};
  if(date<calendar.developmentStart)return {split:'Outside',included:false,exclusionReason:'before_development_start'};
  if(date>=calendar.finalStart)return {split:'Historical Final',included:false,exclusionReason:'historical_final_sealed'};
  if(date<calendar.validationStart){
    if(outcomeDate>=calendar.validationStart){
      return {split:'Development',included:false,exclusionReason:'validation_boundary_outcome_purge'};
    }
    return {split:'Development',included:true,exclusionReason:null};
  }
  if(outcomeDate>=calendar.finalStart){
    return {split:'Validation',included:false,exclusionReason:'historical_final_outcome_purge'};
  }
  return {split:'Validation',included:true,exclusionReason:null};
}

export function attachSplitStatus(episodes,calendar){
  return episodes.map(row=>({...row,...classifyEpisodeForFixedCalendar(row,calendar)}));
}
