import fs from 'node:fs';
import { momentumShadow, momentumBucketSummary } from '../lib/smc-momentum-shadow.mjs';
import { createRunContext, loadLedgerStrict, reconcileLedger, appendRunLog } from '../lib/smc-forward-evidence.mjs';
import { aggregateExchange4H, evaluateExit } from '../lib/smc-forward-runtime.mjs';

const COHORTS={
  'tsx-extra':[
  "RCI-B.TO",
  "T.TO",
  "QSR.TO",
  "CCL-B.TO",
  "GIB-A.TO",
  "DOL.TO",
  "TRI.TO",
  "IFC.TO",
  "GWO.TO",
  "BAM.TO",
  "BN.TO",
  "BIP-UN.TO",
  "BEP-UN.TO",
  "PPL.TO",
  "KEY.TO",
  "ARX.TO",
  "CVE.TO",
  "GIL.TO",
  "WCP.TO",
  "CCO.TO",
  "TECK-B.TO",
  "FM.TO",
  "PAAS.TO",
  "AGI.TO",
  "EDV.TO",
  "MG.TO",
  "TFII.TO",
  "STN.TO",
  "CAE.TO",
  "CTC-A.TO",
  "GSY.TO",
  "SAP.TO",
  "WSP.TO",
  "TIH.TO",
  "OTEX.TO",
  "H.TO",
  "CU.TO"
],
  'us-75':[
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "GOOGL",
  "META",
  "AVGO",
  "TSLA",
  "JPM",
  "BAC",
  "WFC",
  "GS",
  "MS",
  "V",
  "MA",
  "AXP",
  "C",
  "SCHW",
  "BLK",
  "XOM",
  "CVX",
  "COP",
  "SLB",
  "EOG",
  "OXY",
  "JNJ",
  "LLY",
  "UNH",
  "MRK",
  "ABBV",
  "TMO",
  "ABT",
  "MDT",
  "HD",
  "LOW",
  "COST",
  "WMT",
  "TGT",
  "MCD",
  "SBUX",
  "NKE",
  "CAT",
  "DE",
  "GE",
  "HON",
  "UPS",
  "UNP",
  "RTX",
  "LMT",
  "BA",
  "CRM",
  "ORCL",
  "ADBE",
  "AMD",
  "INTC",
  "QCOM",
  "TXN",
  "AMAT",
  "MU",
  "NFLX",
  "DIS",
  "CMCSA",
  "T",
  "VZ",
  "NEE",
  "SO",
  "DUK",
  "LIN",
  "APD",
  "FCX",
  "NEM",
  "PG",
  "KO",
  "PEP",
  "PM"
]
};
const FORWARD_START='2026-10-01';
const MOMENTUM_BENCHMARKS={'tsx-extra':'^GSPTSE','us-75':'^GSPC'};
const PORTFOLIO={
  startingCapital:1000,
  targetRiskPct:.01,
  maxPositionPct:.25,
  maxOpenRiskPct:.04,
  maxPositions:4,
  costR:.05,
  fractionalShares:true
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function yahoo(symbol,range,interval){
  let last;
  for(let attempt=0;attempt<5;attempt++){
    for(const host of ['query1','query2']){
      try{
        const u=`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
        const r=await fetch(u,{headers:{'User-Agent':'MarketHunter-SMC-Forward/1.0'},signal:AbortSignal.timeout(20000)});
        if(!r.ok)throw Error('http_'+r.status);
        const p=await r.json(),x=p?.chart?.result?.[0],q=x?.indicators?.quote?.[0]||{};
        if(!x?.timestamp?.length)throw Error(p?.chart?.error?.description||'empty');
        return x.timestamp.map((t,i)=>({t:t*1000,o:q.open?.[i],h:q.high?.[i],l:q.low?.[i],c:q.close?.[i],v:q.volume?.[i]}))
          .filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite));
      }catch(e){last=e}
    }
    await sleep(900*(attempt+1));
  }
  throw last;
}

const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function tor(ms){const z=Object.fromEntries(fmt.formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return{date:`${z.year}-${z.month}-${z.day}`,hour:+z.hour}}
function weekKey(ms){const z=tor(ms),d=new Date(z.date+'T12:00:00Z'),dw=d.getUTCDay();return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-((dw+6)%7))).toISOString().slice(0,10)}
function dailyDate(d){return d.map(x=>({...x,date:tor(x.t).date}))}
function fourHour(h){const by=new Map();for(const r of h){const z=tor(r.t);if(z.hour<9||z.hour>16)continue;if(!by.has(z.date))by.set(z.date,[]);by.get(z.date).push(r)}const o=[];for(const [date,a0] of [...by.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){const a=a0.sort((x,y)=>x.t-y.t);for(let i=0;i<a.length;i+=4){const g=a.slice(i,i+4);if(g.length<2)continue;o.push({t:g[0].t,o:g[0].o,h:Math.max(...g.map(x=>x.h)),l:Math.min(...g.map(x=>x.l)),c:g.at(-1).c,v:g.reduce((s,x)=>s+(x.v||0),0),date})}}return o}
function weekly(d0){const d=dailyDate(d0),o=[];let key='',x=null;for(const r of d){const k=weekKey(r.t);if(k!==key){if(x)o.push(x);key=k;x={t:r.t,o:r.o,h:r.h,l:r.l,c:r.c,v:r.v,key:k}}else{x.h=Math.max(x.h,r.h);x.l=Math.min(x.l,r.l);x.c=r.c;x.v=(x.v||0)+(r.v||0)}}if(x)o.push(x);return o}
function prevD(d,signalT){const sd=tor(signalT).date;let z=-1;for(let i=0;i<d.length;i++){if(d[i].date<sd)z=i;else break}return z}
function prevW(w,signalT){const sw=weekKey(signalT);let z=-1;for(let i=0;i<w.length;i++){if(w[i].key<sw)z=i;else break}return z}
function structure(a,L){let leg=0,ph=null,pl=null,hx=false,lx=false,bias=0;const ev=[],b=Array(a.length).fill(0);for(let i=1;i<a.length;i++){if(i>=L){const j=i-L;let mx=-Infinity,mn=Infinity;for(let k=j+1;k<=i;k++){mx=Math.max(mx,a[k].h);mn=Math.min(mn,a[k].l)}const nh=a[j].h>mx,nl=a[j].l<mn,old=leg;if(nh)leg=0;else if(nl)leg=1;if(leg!==old){if(leg===1){pl={level:a[j].l};lx=false}else{ph={level:a[j].h};hx=false}}}if(ph&&!hx&&a[i].c>ph.level&&a[i-1].c<=ph.level){ev.push({i,dir:1,tag:bias===-1?'CHOCH':'BOS',opp:pl?.level??null});hx=true;bias=1}if(pl&&!lx&&a[i].c<pl.level&&a[i-1].c>=pl.level){ev.push({i,dir:-1,tag:bias===1?'CHOCH':'BOS',opp:ph?.level??null});lx=true;bias=-1}b[i]=bias}return{ev,b}}
function atr(a,n=14){const o=Array(a.length).fill(null),tr=[];for(let i=0;i<a.length;i++){tr[i]=i?Math.max(a[i].h-a[i].l,Math.abs(a[i].h-a[i-1].c),Math.abs(a[i].l-a[i-1].c)):a[i].h-a[i].l;if(i>=n-1){let s=0;for(let k=i-n+1;k<=i;k++)s+=tr[k];o[i]=s/n}}return o}
function stats(T,cost=0){const rs=T.map(x=>x.R-cost),n=rs.length,w=rs.filter(x=>x>0).length,g=rs.filter(x=>x>0).reduce((s,x)=>s+x,0),l=-rs.filter(x=>x<0).reduce((s,x)=>s+x,0),sum=rs.reduce((s,x)=>s+x,0);let eq=0,pk=0,dd=0;for(const r of rs){eq+=r;pk=Math.max(pk,eq);dd=Math.min(dd,eq-pk)}return{n,wr:n?w/n:null,pf:l?g/l:null,avgR:n?sum/n:null,sumR:sum,maxDD:dd}}

const tradeKey=x=>`${x.symbol}|${x.entryT}|${x.dir}`;

function simulatePortfolio(trades){
  let cash=PORTFOLIO.startingCapital,peak=PORTFOLIO.startingCapital,maxDD=0;
  const open=[],entered=[],skipped=[],equityCurve=[{t:FORWARD_START,equity:PORTFOLIO.startingCapital}];

  const equity=()=>cash+open.reduce((s,p)=>s+p.notional,0);
  const updateCurve=t=>{
    const e=equity();peak=Math.max(peak,e);maxDD=Math.min(maxDD,(e/peak)-1);
    equityCurve.push({t,equity:e});
  };
  const settleUntil=t=>{
    const due=open.filter(p=>p.exitT&&Date.parse(p.exitT)<=t).sort((a,b)=>a.exitT.localeCompare(b.exitT));
    for(const p of due){
      const i=open.indexOf(p);if(i>=0)open.splice(i,1);
      const pnl=p.riskAmount*(p.R-PORTFOLIO.costR);
      cash+=p.notional+pnl;
      p.pnl=pnl;p.accountEquityAfter=equity();p.portfolioStatus='closed';
      updateCurve(p.exitT);
    }
  };

  for(const tr of [...trades].sort((a,b)=>a.entryT.localeCompare(b.entryT)||a.symbol.localeCompare(b.symbol))){
    const t=Date.parse(tr.entryT);settleUntil(t);
    const eq=equity(),openRisk=open.reduce((s,p)=>s+p.riskAmount,0);
    const stopPct=tr.risk/tr.entry;
    const riskCapacity=Math.max(0,PORTFOLIO.maxOpenRiskPct*eq-openRisk);
    const targetRisk=Math.min(PORTFOLIO.targetRiskPct*eq,riskCapacity);
    if(open.length>=PORTFOLIO.maxPositions){skipped.push({...tr,reason:'max_positions'});continue}
    if(!(targetRisk>0)&&Number.isFinite(targetRisk)){skipped.push({...tr,reason:'max_open_risk'});continue}
    if(!(stopPct>0)){skipped.push({...tr,reason:'invalid_stop_distance'});continue}
    const notional=Math.min(targetRisk/stopPct,PORTFOLIO.maxPositionPct*eq,cash);
    if(!(notional>0)){skipped.push({...tr,reason:'no_cash'});continue}
    const riskAmount=notional*stopPct,qty=notional/tr.entry;
    const p={...tr,accountEquityBefore:eq,notional,allocationPct:notional/eq,quantity:qty,stopPct,riskAmount,riskPctEquity:riskAmount/eq,pnl:null,portfolioStatus:tr.status};
    cash-=notional;open.push(p);entered.push(p);
    updateCurve(tr.entryT);
  }
  settleUntil(Infinity);
  const currentEquity=equity();
  return {
    rules:PORTFOLIO,
    startingCapital:PORTFOLIO.startingCapital,
    currentEquity,
    realizedReturnPct:currentEquity/PORTFOLIO.startingCapital-1,
    cash,
    reservedNotional:open.reduce((s,p)=>s+p.notional,0),
    openRiskAmount:open.reduce((s,p)=>s+p.riskAmount,0),
    maxDrawdownPct:maxDD,
    enteredCount:entered.length,
    closedCount:entered.filter(x=>x.portfolioStatus==='closed').length,
    openCount:open.length,
    skippedCount:skipped.length,
    entered,open,skipped,equityCurve
  };
}

function forwardTrades(d0,h,symbol,benchmarkDaily=[],benchmarkSymbol=null,observedAt=new Date().toISOString(),dataQuality=[]){
  const d=dailyDate(d0),agg=aggregateExchange4H(h,{nowMs:Date.parse(observedAt)}),f=agg.bars,w=weekly(d0),A=atr(f),W=structure(w,3),D=structure(d,5),F=structure(f,3),T=[];let blocked=-1;
  dataQuality.push(...agg.diagnostics.map(x=>({symbol,...x})));
  for(const e of F.ev){
    if(e.tag!=='CHOCH'||e.i<=blocked||e.opp==null)continue;
    const di=prevD(d,f[e.i].t),wi=prevW(w,f[e.i].t);if(di<0||wi<0||D.b[di]!==e.dir||W.b[wi]!==e.dir)continue;
    const dir=e.dir,m=momentumShadow(d,di,dir,benchmarkDaily,benchmarkSymbol);
    const signalSnapshot={opposingSwing:e.opp,atr14:A[e.i]??null,signalCompletedAt:new Date(f[e.i].endT).toISOString(),candleConvention:f[e.i].completionConvention};
    const signalT=new Date(f[e.i].t).toISOString();
    if(e.i+1>=f.length){
      T.push({symbol,signalT,dir,status:'pending_entry',R:null,exitT:null,momentumShadow:m,signalSnapshot});
      continue;
    }
    const en=f[e.i+1].o,entryT=f[e.i+1].t;
    if(tor(entryT).date<FORWARD_START)continue;
    let stop=e.opp;stop=dir===1?stop-.1*(A[e.i]||0):stop+.1*(A[e.i]||0);const risk=dir===1?en-stop:stop-en;if(!(risk>0))continue;
    const tp=en+dir*2*risk;
    const outcome=evaluateExit(f,e.i,dir,en,stop,tp,16),{exitIndex,...life}=outcome;
    T.push({symbol,signalT,entryT:new Date(entryT).toISOString(),dir,entry:en,stop,target:tp,risk,...life,momentumShadow:m,signalSnapshot});
    if(Number.isInteger(exitIndex))blocked=exitIndex;
  }
  return T;
}

async function runCohort(name,symbols){
  const safe=name.replace(/[^a-z0-9-]/gi,'-').toLowerCase();
  const ledgerPath=`data/research/smc-wd4h-forward-${safe}-ledger.json`;
  const latestJson=`data/research/smc-wd4h-forward-${safe}-latest.json`;
  const latestMd=`data/research/smc-wd4h-forward-${safe}-latest.md`;

  const failures=[],all=[],dataQuality=[];
  const run=createRunContext('smc-forward-expanded',name);
  const benchmarkSymbol=MOMENTUM_BENCHMARKS[name]||null;
  let benchmarkDaily=[];
  if(benchmarkSymbol){
    try{benchmarkDaily=dailyDate(await yahoo(benchmarkSymbol,'2y','1d'))}
    catch(e){failures.push({symbol:benchmarkSymbol,error:'momentum_benchmark_'+String(e?.message||e)})}
  }
  for(const s of symbols){
    try{
      const [d,h]=await Promise.all([yahoo(s,'2y','1d'),yahoo(s,'60d','1h')]);
      all.push(...forwardTrades(d,h,s,benchmarkDaily,benchmarkSymbol,run.observedAt,dataQuality));await sleep(175);
    }catch(e){failures.push({symbol:s,error:String(e?.message||e)})}
  }
  all.sort((a,b)=>a.entryT.localeCompare(b.entryT));
  const prior=loadLedgerStrict(ledgerPath,{version:'smc-wd4h-forward-expanded-ledger-v2',cohort:name,forwardStart:FORWARD_START,symbols,trades:[]});
  const reconciliation=reconcileLedger(prior,all,run);
  const ledgerTrades=reconciliation.trades;
  const runLog=appendRunLog(prior.runLog,run,{fetchFailures:failures,dataQuality, ...reconciliation.summary, discrepancyCount:reconciliation.runDiscrepancies.length});
  const closed=ledgerTrades.filter(x=>x.status==='closed'&&Number.isFinite(x.R));
  const open=ledgerTrades.filter(x=>x.status==='open');
  const portfolio=simulatePortfolio(ledgerTrades);
  const out={
    version:'smc-wd4h-forward-expanded-v1',
    cohort:name,
    generatedAt:new Date().toISOString(),
    forwardStart:FORWARD_START,
    frozenRules:{universe:symbols.length,weekly:3,daily:5,fourHour:3,trigger:'CHOCH',dailyWeekly:'previous completed only',entry:'next 4H open',stop:'opposing swing + 0.1 ATR14',target:'2R',maxHold:16,regimeFilter:'none',vp:'none',sweep:'none',momentumShadow:'observational only; never gates, ranks, sizes, enters or exits trades'},
    failures,
    dataQuality,
    evidenceAudit:{run,reconciliation:reconciliation.summary,discrepancies:reconciliation.runDiscrepancies,legacyProvenanceUnknown:reconciliation.summary.legacyUnprovenancedCount},
    summary:{closed:stats(closed),cost05R:stats(closed,.05),long:stats(closed.filter(x=>x.dir===1)),short:stats(closed.filter(x=>x.dir===-1)),openCount:open.length,momentumShadow:momentumBucketSummary(closed,stats,PORTFOLIO.costR)},
    portfolio,
    trades:ledgerTrades
  };
  fs.mkdirSync('data/research',{recursive:true});
  fs.writeFileSync(ledgerPath,JSON.stringify({version:'smc-wd4h-forward-expanded-ledger-v2',cohort:name,updatedAt:reconciliation.changed?run.observedAt:(prior.updatedAt||run.observedAt),forwardStart:FORWARD_START,symbols,runLog,discrepancyLog:reconciliation.discrepancyLog,trades:ledgerTrades},null,2)+'\n');
  fs.writeFileSync(latestJson,JSON.stringify(out,null,2)+'\n');

  const n=x=>Number.isFinite(x)?x.toFixed(3):'n/a',p=x=>Number.isFinite(x)?(100*x).toFixed(1)+'%':'n/a';
  const md=[
    `# SMC W-D-4H Forward — ${name}`,'',
    `Generated: ${out.generatedAt}`,'',
    `Forward start: ${FORWARD_START}; universe: ${symbols.length}; no regime/VP/sweep filter.`,'',
    '| Metric | Raw | +0.05R cost |','|---|---:|---:|',
    `| Closed trades | ${out.summary.closed.n} | ${out.summary.cost05R.n} |`,
    `| Win rate | ${p(out.summary.closed.wr)} | ${p(out.summary.cost05R.wr)} |`,
    `| PF | ${n(out.summary.closed.pf)} | ${n(out.summary.cost05R.pf)} |`,
    `| Avg R | ${n(out.summary.closed.avgR)} | ${n(out.summary.cost05R.avgR)} |`,
    `| Sum R | ${n(out.summary.closed.sumR)} | ${n(out.summary.cost05R.sumR)} |`,'',
    '## $1,000 paper portfolio','',
    `Current equity: $${portfolio.currentEquity.toFixed(2)}; return ${p(portfolio.realizedReturnPct)}; max DD ${p(portfolio.maxDrawdownPct)}.`,
    `Entered / skipped / open: ${portfolio.enteredCount} / ${portfolio.skippedCount} / ${portfolio.openCount}.`,'',
    '## Evidence integrity','',
    `Provenance known ${ledgerTrades.length-reconciliation.summary.legacyUnprovenancedCount}; legacy unknown ${reconciliation.summary.legacyUnprovenancedCount}; prospective ${reconciliation.summary.prospectiveCount}; reconstructed ${reconciliation.summary.reconstructedCount}.`,
    `This run: new ${reconciliation.summary.newRecords}; lifecycle updates ${reconciliation.summary.lifecycleUpdates}; discrepancies ${reconciliation.runDiscrepancies.length}; prior not re-observed ${reconciliation.summary.missingPreviouslyRecorded}.`,'',
    '## Momentum shadow (observational only)','',
    '| Bucket | Closed | Win rate | Avg R after cost | PF after cost |','|---|---:|---:|---:|---:|',
    ...['high','medium','low','unavailable'].map(b=>{const x=out.summary.momentumShadow[b];return `| ${b} | ${x.raw.n} | ${p(x.raw.wr)} | ${n(x.afterCost.avgR)} | ${n(x.afterCost.pf)} |`}),
    '',
    '## Open positions','',
    ...(portfolio.open.length?portfolio.open.map(x=>`- ${x.symbol} ${x.dir===1?'Long':'Short'}; allocation $${x.notional.toFixed(2)}; risk $${x.riskAmount.toFixed(2)}; entry ${n(x.entry)}; stop ${n(x.stop)}; target ${n(x.target)}`):['- None']),
    '', failures.length?'## Fetch failures':'## Fetch failures','',
    ...(failures.length?failures.map(x=>`- ${x.symbol}: ${x.error}`):['- None']),
    '', 'This cohort is tracked independently. No signal may be removed after its outcome is known.'
  ].join('\n');
  fs.writeFileSync(latestMd,md+'\n');
  return out;
}

const results={};
for(const [name,symbols] of Object.entries(COHORTS)){
  console.log('running cohort',name,symbols.length);
  results[name]=await runCohort(name,symbols);
}
const summary={
  version:'smc-wd4h-forward-expanded-summary-v1',
  generatedAt:new Date().toISOString(),
  forwardStart:FORWARD_START,
  cohorts:Object.fromEntries(Object.entries(results).map(([name,x])=>[name,{
    universe:x.frozenRules.universe,
    failures:x.failures.length,
    closed:x.summary.closed,
    cost05R:x.summary.cost05R,
    openCount:x.summary.openCount,
    portfolio:{currentEquity:x.portfolio.currentEquity,returnPct:x.portfolio.realizedReturnPct,maxDrawdownPct:x.portfolio.maxDrawdownPct,enteredCount:x.portfolio.enteredCount,skippedCount:x.portfolio.skippedCount,openCount:x.portfolio.openCount}
  }]))
};
fs.writeFileSync('data/research/smc-wd4h-forward-expanded-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
