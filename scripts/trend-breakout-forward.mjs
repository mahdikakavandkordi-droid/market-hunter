import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {aggregateExchange4H,aggregateCrypto4H,dailyStock,dailyCrypto,buildGapBeforeIndex} from '../lib/smc-forward-runtime.mjs';
import {latestCompletedMark,simulatePortfolioMarked} from '../lib/smc-forward-portfolio.mjs';
import {updateSymbol,stats,groupedStats,identity} from '../lib/trend-breakout/engine.mjs';
const root='data/research/trend-breakout-v1',config=JSON.parse(fs.readFileSync(root+'/config.json'));
const configHash=createHash('sha256').update(JSON.stringify(config)).digest('hex');
const observedAt=new Date().toISOString(),runKey=['trend-breakout-v1',process.env.GITHUB_RUN_ID||observedAt,process.env.GITHUB_RUN_ATTEMPT||'1'].join('|');
const offline=process.argv.includes('--offline');
const historical=process.argv.includes('--historical');
const output=historical?root+'/historical':root;
fs.mkdirSync(output+'/inputs',{recursive:true});
const chosen=process.argv.find(x=>x.startsWith('--cohort='))?.split('=')[1];
if(chosen&&!config.universes[chosen])throw Error('Unknown cohort');
const smcFiles={'tsx-core':'paper','tsx-extra':'tsx-extra','us-75':'us-75','crypto-15':'crypto-15','metals-5':'metals-5'};
async function yahoo(symbol,range,interval){
 let err;for(let attempt=0;attempt<3;attempt++)for(const host of ['query1','query2']){
  try{const r=await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplits`,{headers:{'User-Agent':'TrendBreakoutResearch/1.0'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('http_'+r.status);
   const p=await r.json(),x=p?.chart?.result?.[0],q=x?.indicators?.quote?.[0];if(!x?.timestamp?.length||!q)throw Error('no_quotes');
   return {bars:x.timestamp.map((t,i)=>({t:t*1000,o:q.open[i],h:q.high[i],l:q.low[i],c:q.close[i],v:q.volume[i]})).filter(b=>[b.o,b.h,b.l,b.c].every(Number.isFinite)),events:x.events||{}};
  }catch(e){err=e}
 }throw err;
}
async function pool(items,fn){let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<items.length){const i=next++;await fn(items[i])}}))}
function loadLedger(p){if(!fs.existsSync(p))return {trades:[],markedEquitySeries:[],runLog:[]};const d=JSON.parse(fs.readFileSync(p));if(!Array.isArray(d.trades))throw Error('corrupt ledger');if(d.configHash!==configHash)throw Error('frozen config changed; create a new model version');const ids=d.trades.map(identity);if(new Set(ids).size!==ids.length)throw Error('duplicate decisions');return d}
function atomic(p,obj){const tmp=p+'.tmp';fs.writeFileSync(tmp,JSON.stringify(obj,null,2)+'\n');fs.renameSync(tmp,p)}
function money(x){return Number.isFinite(x)?'$'+x.toFixed(2):'n/a'}
const summaries={};
for(const [cohort,u] of Object.entries(config.universes)){
 if(chosen&&chosen!==cohort)continue;
 const ledgerPath=`${output}/${cohort}-ledger.json`,prior=historical?{trades:[],runLog:[]}:loadLedger(ledgerPath);
 const by=new Map(prior.trades.map(t=>[identity(t),t])),failures=[],diagnostics=[],inputs=[],marks=new Map();
 await pool(u.symbols,async symbol=>{
  try{
   const cached=offline?JSON.parse((await import('node:zlib')).gunzipSync(fs.readFileSync(`${root}/inputs/${symbol.replace(/[^a-zA-Z0-9.-]/g,'_')}.json.gz`))):null;
   const [d,h]=cached?[cached.daily,cached.hourly]:await Promise.all([yahoo(symbol,'2y','1d'),yahoo(symbol,'60d','1h')]);
   const raw=JSON.stringify({symbol,daily:d,hourly:h,observedAt}),hash=createHash('sha256').update(raw).digest('hex');
   fs.writeFileSync(`${output}/inputs/${symbol.replace(/[^a-zA-Z0-9.-]/g,'_')}.json.gz`,gzipSync(raw));inputs.push({symbol,sha256:hash});
   const agg=u.mode==='crypto'?aggregateCrypto4H(h.bars,{nowMs:Date.parse(observedAt)}):aggregateExchange4H(h.bars,{nowMs:Date.parse(observedAt)});
   const daily=u.mode==='crypto'?dailyCrypto(d.bars):dailyStock(d.bars);
   const gaps=buildGapBeforeIndex(agg.bars,{mode:u.mode,diagnostics:agg.diagnostics,tradingDates:daily.map(b=>b.date)});
   diagnostics.push(...agg.diagnostics.map(x=>({symbol,...x})));
   const mark=latestCompletedMark(agg.bars,observedAt,{freshnessMs:(u.mode==='crypto'?12:120)*3600000});if(mark)marks.set(symbol,mark);
   // Corporate actions inside this intraday window require review. Current
   // raw quotes cannot safely reconcile a held position across a split.
   const splits=Object.values(h.events.splits||{});
   if(splits.length){failures.push({symbol,error:'split_event_requires_review'});return}
   const forwardStart=historical?'1900-01-01T00:00:00Z':config.forwardStart;
   const ts=updateSymbol(prior.trades,agg.bars,daily,gaps,{symbol,mode:u.mode,rules:config.rules,forwardStart,observedAt,runKey,configHash,historicalDiagnostic:historical});
   for(const t of ts)by.set(identity(t),t);
  }catch(e){failures.push({symbol,error:String(e.message)})}
 });
 const trades=[...by.values()].sort((a,b)=>(a.entryT||a.signalT).localeCompare(b.entryT||b.signalT)||a.symbol.localeCompare(b.symbol));
 const portfolio=simulatePortfolioMarked(trades,config.portfolio,{marksBySymbol:marks,observedAt,runKey,priorMarkedSeries:prior.markedEquitySeries||[]});
 const forward=Date.parse(config.forwardStart),smcPath=`${process.env.SMC_BASELINE_ROOT||'.'}/data/research/smc-wd4h-forward-${smcFiles[cohort]}-ledger.json`;
 const smc=fs.existsSync(smcPath)?JSON.parse(fs.readFileSync(smcPath)):null;
 const commonSmc=(smc?.trades||[]).filter(t=>Date.parse(t.entryT)>=forward);
 const commonChallenger=trades.filter(t=>Date.parse(t.entryT)>=forward);
 const baseline=simulatePortfolioMarked(commonSmc,config.portfolio,{marksBySymbol:marks,observedAt,runKey,priorMarkedSeries:[]});
 const comparison={commonStart:config.forwardStart,smcLedgerAsOf:smc?.updatedAt||null,smcStale:!smc?.updatedAt||Date.parse(observedAt)-Date.parse(smc.updatedAt)> (u.mode==='crypto'?12:120)*3600000,
   description:'New entries in the common forward window only; existing SMC positions before launch are excluded. SMC source prices are independently observed, not a shared historical price replay. Costs: same 0.05R assumption, different disclosed gap-fill rules.',
   smc:{raw:stats(commonSmc),afterCost:stats(commonSmc,config.portfolio.costR),provenance:groupedStats(commonSmc,config.portfolio.costR),commonWindowPaperAccount:baseline},
   challenger:{raw:stats(commonChallenger),afterCost:stats(commonChallenger,config.portfolio.costR),provenance:groupedStats(commonChallenger,config.portfolio.costR)}};
 const runLog=[...(prior.runLog||[])];if(!runLog.some(x=>x.runKey===runKey))runLog.push({runKey,observedAt,failures,diagnosticCount:diagnostics.length});
 const report={version:config.version,mode:historical?'historical_diagnostic':'forward_shadow',configHash,generatedAt:observedAt,forwardStart:config.forwardStart,cohort,universe:u.symbols.length,failures,diagnostics,inputs,trades,
  summary:{raw:stats(trades),afterCost:stats(trades,config.portfolio.costR),byProvenance:groupedStats(trades,config.portfolio.costR),pending:trades.filter(t=>t.status==='pending_entry').length,open:trades.filter(t=>t.status==='open').length,needsReview:trades.filter(t=>t.lifecycleDataGap).length},portfolio,comparison};
 if(!historical)atomic(ledgerPath,{version:config.version,configHash,updatedAt:observedAt,forwardStart:config.forwardStart,trades,runLog,markedEquitySeries:portfolio.markedEquitySeries});
 atomic(`${output}/${cohort}-latest.json`,report);
 const md=[`# Trend Breakout V1 — ${cohort}`,`Generated: ${observedAt}; mode: ${report.mode}.`,
  `Forward start: ${config.forwardStart}; universe ${u.symbols.length}; failed fetch/review symbols ${failures.length}.`,
  `Open ${report.summary.open}; pending ${report.summary.pending}; closed ${report.summary.raw.n}; lifecycle reviews ${report.summary.needsReview}.`,
  `Realized equity ${money(portfolio.realizedCurrentEquity)}; marked equity ${money(portfolio.markedCurrentEquity)}; mark quality ${portfolio.markedObservation.quality}.`,
  '## Evidence provenance','', '| Group | Closed | Avg R after cost | PF after cost |','|---|---:|---:|---:|',
  ...Object.entries(report.summary.byProvenance).map(([k,v])=>`| ${k} | ${v.raw.n} | ${v.afterCost.avgR??'n/a'} | ${v.afterCost.pf??'n/a'} |`),
  '', '## Positions','',...trades.filter(t=>t.status!=='closed').map(t=>`- ${t.symbol}: ${t.dir===1?'Long':'Short'} ${t.status}; entry ${t.entry??'pending'}; current stop ${t.currentStop??'pending'}; provenance ${t.entryObservationClass}; gap ${t.lifecycleDataGap?.type||'none'}`),
  '', '## Common-window comparison','',`SMC ledger as of ${comparison.smcLedgerAsOf}; stale ${comparison.smcStale}.`,comparison.description,
  `SMC closed ${comparison.smc.raw.n}; challenger closed ${comparison.challenger.raw.n}. No winner is claimed from a small sample.`,
  '', 'Limitations: current-universe selection, short intraday history, hypothetical shorts/fractional shares, fixed-R costs excluding borrow/funding/FX/dividends, completed-bar marks and approximate exchange closes. Archived raw snapshots accompany workflow artifacts.'].join('\n');
 fs.writeFileSync(`${output}/${cohort}-latest.md`,md+'\n');
 summaries[cohort]={generatedAt:observedAt,summary:report.summary,comparison:{commonStart:comparison.commonStart,smcLedgerAsOf:comparison.smcLedgerAsOf,smcStale:comparison.smcStale,smc:comparison.smc.raw,challenger:comparison.challenger.raw},failures:failures.length,configHash};
 console.log(cohort,JSON.stringify({closed:report.summary.raw.n,open:report.summary.open,pending:report.summary.pending,failures:failures.length}));
}
atomic(output+'/summary.json',{version:config.version,generatedAt:observedAt,historical,configHash,cohorts:summaries});
