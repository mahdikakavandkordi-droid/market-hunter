const dateOf=row=>Number.isFinite(row?.t)?new Date(row.t*1000).toISOString().slice(0,10):null;
export function referenceSession(benchmarkRows){
  const date=dateOf(benchmarkRows?.at(-1));
  if(!date)throw new Error('completed_reference_session_unavailable');
  return date;
}
export function quoteSessionIssue(rows,expectedSession){
  const actual=dateOf(rows?.at(-1));
  return actual===expectedSession?null:{reason:'session_mismatch',sourceDate:actual,expectedSession};
}
