// Read-only presentation adapter. Never runs a strategy or mutates its evidence.
export const COHORTS=Object.freeze(['tsx-core','tsx-extra','us-75','crypto-15','metals-5']);
export const ENGINES=Object.freeze([
  {id:'smc',name:'SMC',branch:'research/smc-wd4h-tsx-validation-20261001',version:/^smc-wd4h-forward-.*evidence-v2$/},
  {id:'trend',name:'Trend Breakout',branch:'research/trend-breakout-v1-20261004',version:/^trend-breakout-v1$/},
  {id:'mean',name:'Mean Reversion',branch:'research/mean-reversion-v1-20261004',version:/^mean-reversion-v1$/}
]);
export function evidencePath(engine,cohort){
  if(!COHORTS.includes(cohort)||!ENGINES.some(e=>e.id===engine.id))throw new Error('invalid_source');
  return engine.id==='smc'
    ?`data/research/smc-wd4h-forward-${cohort==='tsx-core'?'paper':cohort}-evidence-v2-latest.json`
    :`data/research/${engine.id==='trend'?'trend-breakout-v1':'mean-reversion-v1'}/${cohort}-latest.json`;
}
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?v:null;
function position(t){
  return {symbol:String(t.symbol||''),dir:t.dir===-1?-1:t.dir===1?1:0,status:String(t.portfolioStatus||t.status||'unknown'),
    entryT:stamp(t.entryT),exitT:stamp(t.exitT),entry:number(t.entry),stop:number(t.stop),target:number(t.target),
    markPrice:number(t.markPrice),markT:stamp(t.markT),markStatus:String(t.markStatus||'unavailable'),
    notional:number(t.notional),quantity:number(t.quantity),riskAmount:number(t.riskAmount),
    pnl:number(t.pnl),unrealizedPnl:number(t.unrealizedPnl),R:number(t.R)};
}
export function account(p){
  if(!p||!Array.isArray(p.open)||!Array.isArray(p.entered)||number(p.startingCapital)===null)throw new Error('invalid_account');
  return {startingCapital:number(p.startingCapital),cash:number(p.cash),openRiskAmount:number(p.openRiskAmount),
    realizedEquity:number(p.realizedCurrentEquity),realizedReturn:number(p.realizedReturnPct),
    markedEquity:number(p.markedCurrentEquity),markedReturn:number(p.markedReturnPct),
    realizedDrawdown:number(p.realizedMaxDrawdownPct),markedDrawdown:number(p.markedObservedMaxDrawdownPct),
    markQuality:String(p.markedObservation?.quality||'unavailable'),
    openCount:p.open.length,closedCount:p.entered.filter(t=>t.portfolioStatus==='closed'||t.status==='closed').length,
    skippedCount:number(p.skippedCount),open:p.open.map(position),
    closed:p.entered.filter(t=>t.portfolioStatus==='closed'||t.status==='closed').map(position),
    costR:number(p.rules?.costR)};
}
export function normalizeEvidence(engine,cohort,d,now=Date.now()){
  if(!engine.version.test(d?.version||'')||!stamp(d.generatedAt)||!stamp(d.forwardStart)||!Array.isArray(d.trades)
    ||(engine.id!=='smc'&&d.mode!=='forward_shadow')||(d.cohort&&d.cohort!==cohort))throw new Error('invalid_forward_evidence');
  const provenance=engine.id==='smc'?d.summary?.performanceByProvenance:d.summary?.byProvenance;
  const p=account(d.portfolio);
  return {engine:engine.id,cohort,status:'available',generatedAt:d.generatedAt,forwardStart:d.forwardStart,
    reportAgeHours:Math.max(0,(now-Date.parse(d.generatedAt))/3600000),reportOverdue:now-Date.parse(d.generatedAt)>6*3600000,
    account:p,pendingCount:number(d.summary?.pendingCount??d.summary?.pending),
    failures:Array.isArray(d.failures)?d.failures.map(f=>({symbol:String(f.symbol||''),error:String(f.error||f.type||'source_unavailable')})):[],
    diagnosticCount:(d.dataQuality||d.diagnostics||[]).length,
    legacyCount:number(d.evidenceAudit?.legacyProvenanceUnknown),
    provenance:provenance?Object.fromEntries(Object.entries(provenance).map(([key,v])=>[key,{closed:number(v.raw?.n),open:number(v.open),sumRAfterCost:number((v.cost05R||v.afterCost)?.sumR)}])):null};
}
export function commonComparison(d,now=Date.now()){
  const c=d?.comparison;
  if(d?.mode!=='forward_shadow'||!stamp(c?.commonStart))return null;
  function baseline(key){
    const a=c[key]?.commonWindowPaperAccount;
    const asOf=stamp(c[key+'LedgerAsOf']);
    return {engine:key,sourceAsOf:asOf,stale:Boolean(c[key+'Stale'])||!asOf||now-Date.parse(asOf)>6*3600000,
      account:a?account(a):null};
  }
  return {start:c.commonStart,generatedAt:d.generatedAt,description:String(c.description||''),
    rows:[baseline('smc'),baseline('trend'),{engine:'mean',sourceAsOf:d.generatedAt,stale:now-Date.parse(d.generatedAt)>6*3600000,account:account(d.portfolio)}]};
}
export async function loadDashboard({fetcher=fetch,now=Date.now()}={}){
  const reports=await Promise.all(ENGINES.flatMap(engine=>COHORTS.map(async cohort=>{
    const path=evidencePath(engine,cohort);
    const source={branch:engine.branch,path,url:`https://github.com/mahdikakavandkordi-droid/market-hunter/blob/${engine.branch}/${path}`};
    try{
      const url=`https://raw.githubusercontent.com/mahdikakavandkordi-droid/market-hunter/${engine.branch}/${path}?v=${Math.floor(now/60000)}`;
      const res=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(!res.ok)throw new Error('source_unavailable');
      const d=await res.json();
      return {...normalizeEvidence(engine,cohort,d,now),source,comparison:engine.id==='mean'?commonComparison(d,now):null};
    }catch{return {engine:engine.id,cohort,status:'unavailable',source};}
  })));
  return {version:'engine-dashboard-v1',fetchedAt:new Date(now).toISOString(),reports};
}
