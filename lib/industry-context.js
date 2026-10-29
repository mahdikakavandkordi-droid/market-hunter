// Describes the liquid scan universe before stage classification. No selection score.
const finite=Number.isFinite;
const median=values=>{const a=values.filter(finite).sort((a,b)=>a-b);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2:null};
export function industryContext(rows,instruments,asOf){
  const seen=new Set();
  for(const r of rows){if(!r.symbol||seen.has(r.symbol)||r.date!==asOf)throw Error('invalid_industry_row');seen.add(r.symbol)}
  const actualSector=s=>typeof s==='string'&&s.trim()&&!['CDR','ETF','Unknown','Other'].includes(s);
  const sectors=[...new Set(instruments.map(r=>r.sector).filter(actualSector))].sort();
  return {version:'industry-context-v1',asOf,basis:'Liquid, current-session scan universe before stage classification; equal-stock descriptive breadth, not an industry-index return or quality rating.',unmappedSymbols:rows.filter(r=>!actualSector(r.sector)).map(r=>r.symbol),industries:sectors.map(sector=>{
    const members=rows.filter(r=>r.sector===sector),expected=instruments.filter(r=>r.sector===sector).length;
    const rs=members.map(r=>r.rs20).filter(finite),trend=members.map(r=>r.dist50).filter(finite),momentum=members.map(r=>r.momentumShift).filter(finite);
    return {sector,universeMembers:expected,usableMembers:members.length,coverage:expected?members.length/expected:null,
      status:members.length<3?'insufficient_members':members.length<expected?'partial':'available',
      medianReturn20:median(members.map(r=>r.ret20)),medianRS20:median(rs),medianMomentumShift:median(momentum),
      outperforming:{count:rs.filter(x=>x>0).length,measured:rs.length},aboveMA50:{count:trend.filter(x=>x>0).length,measured:trend.length},
      symbols:members.map(r=>r.symbol)};
  })};
}
