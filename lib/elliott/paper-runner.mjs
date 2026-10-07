import fs from 'node:fs';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {fetchChart,loadSymbolAnalysis} from './symbol-analysis.mjs';
import {aggregateCrypto4H,aggregateExchange4H,buildGapBeforeIndex} from './research-bars.mjs';
import {createLedger,advanceAccount,accountReport,hash,configHash} from './paper-account.mjs';
import {readLedger,writeLedger} from './ledger-store.mjs';

export async function loadPaperInstrument(symbol,mode,{nowMs,fetcher=fetch}={}) {
  const market=mode==='crypto'?'crypto':symbol.endsWith('.TO')?'ca':'us';
  const [daily,hourly]=await Promise.all([loadSymbolAnalysis(symbol,market,{nowMs,fetcher}),
    fetchChart(symbol,{fetcher,range:'60d',interval:'1h'})]);
  if(hourly.meta?.symbol?.toUpperCase()!==symbol)throw Error('hourly_symbol_mismatch');
  if(mode==='stock'&&!['America/New_York','America/Toronto'].includes(hourly.meta?.exchangeTimezoneName))throw Error('hourly_market_mismatch');
  if(mode==='crypto'&&hourly.meta?.instrumentType!=='CRYPTOCURRENCY')throw Error('hourly_market_mismatch');
  const q=hourly.indicators.quote[0],seen=new Set(),rows=[];
  for(const [i,time] of hourly.timestamp.entries()) {
    const t=time*1000;
    if(!Number.isFinite(t)||seen.has(t))throw Error('invalid_hourly_timestamp');seen.add(t);
    if(t+3600000>nowMs)continue;
    const b={t,o:q.open?.[i],h:q.high?.[i],l:q.low?.[i],c:q.close?.[i],v:q.volume?.[i]||0};
    // Missing/invalid rows are omitted, so aggregation detects incomplete paths.
    if(![b.o,b.h,b.l,b.c].every(x=>Number.isFinite(x)&&x>0)||b.h<Math.max(b.o,b.l,b.c)||b.l>Math.min(b.o,b.h,b.c))continue;
    rows.push(b);
  }
  const result=mode==='crypto'?aggregateCrypto4H(rows,{nowMs}):aggregateExchange4H(rows,{nowMs});
  const gaps=buildGapBeforeIndex(result.bars,{mode,diagnostics:result.diagnostics,tradingDates:daily.bars.map(b=>b.date)});
  const review=daily.quality.reasons.includes('split_event_requires_review')?'split_event_requires_review':
    result.diagnostics.some(d=>d.type.startsWith('duplicate')||d.type.startsWith('off_'))?'hourly_grid_requires_review':null;
  return {feed:{status:'available',bars:result.bars,gapBeforeTimes:[...gaps.keys()].map(i=>result.bars[i].t),
    latestDailyCompletedAt:daily.dataAsOf,...(review?{review}:{})},
    signals:daily.quality.usable?(daily.analysis?.signals||[]).filter(s=>s.signalCompletedAt===daily.dataAsOf):[],
    evidence:{daily,hourly,diagnostics:result.diagnostics}};
}

function atomicJson(file,value) {
  const tmp=file+'.tmp-'+process.pid;
  fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  fs.renameSync(tmp,file);
}

export async function runPaperCohort({config,cohort,stateRoot,observedAt,runKey,loadInstrument=loadPaperInstrument}={}) {
  // Inactive runs do not fetch, create accounts, or write state.
  if(config.enabled!==true)return {version:config.version,status:'inactive',cohort};
  const start=Date.parse(config.forwardStart),nowMs=observedAt===undefined?Date.now():Date.parse(observedAt),u=config.universes?.[cohort];
  if(!Number.isFinite(start)||!Number.isFinite(nowMs)||nowMs<start)throw Error('explicit_valid_forward_start_required');
  if(!u||!/^[-a-z0-9]+$/.test(cohort)||typeof runKey!=='string'||!runKey)throw Error('invalid_cohort_or_run_key');
  const dir=path.join(stateRoot,cohort);fs.mkdirSync(dir,{recursive:true});
  const lock=path.join(dir,'runner.lock');let fd;
  try{fd=fs.openSync(lock,'wx')}catch(e){if(e.code==='EEXIST')throw Error('cohort_run_locked');throw e}
  try {
    const ledgerFile=path.join(dir,'ledger.json');
    const prior=readLedger(ledgerFile,config)||createLedger(config,{cohort,forwardStart:config.forwardStart});
    if(Date.parse(prior.forwardStart)!==start)throw Error('forward_start_changed');
    const inputFile=path.join(dir,'input-'+hash(runKey)+'.json.gz');let input;
    if(fs.existsSync(inputFile)) {
      const envelope=JSON.parse(gunzipSync(fs.readFileSync(inputFile)));
      if(envelope.checksum!==hash(envelope.input))throw Error('input_checksum_mismatch');
      input=envelope.input;
      if((observedAt!==undefined&&input.observedAt!==observedAt)||input.configHash!==configHash(config)||input.forwardStart!==prior.forwardStart)throw Error('archived_run_identity_mismatch');
    } else {
      const feeds={},signals=[],evidence={},failures=[];
      // Small sequential batches avoid flooding the provider. Only observations
      // made after forwardStart can create pending decisions.
      for(const symbol of u.symbols) {
        try {
          const loaded=await loadInstrument(symbol,u.mode,{nowMs});
          feeds[symbol]=loaded.feed;signals.push(...loaded.signals);evidence[symbol]=loaded.evidence??null;
        }catch(e){feeds[symbol]={status:'unavailable',bars:[]};failures.push({symbol,error:e.message})}
      }
      input={observedAt:observedAt??new Date().toISOString(),configHash:configHash(config),forwardStart:prior.forwardStart,feeds,signals,evidence,failures};
      const out=fs.openSync(inputFile,'wx');
      try{fs.writeFileSync(out,gzipSync(JSON.stringify({checksum:hash(input),input})));fs.fsyncSync(out)}finally{fs.closeSync(out)}
    }
    const next=advanceAccount(prior,{config,observedAt:input.observedAt,runKey,signals:input.signals,feeds:input.feeds});
    if(next.revision!==prior.revision)writeLedger(ledgerFile,next,config,{expectedRevision:prior.revision});
    const portfolio=accountReport(next,config);
    const report={version:config.version,mode:'forward_shadow',cohort,generatedAt:next.updatedAt,
      configHash:next.configHash,forwardStart:next.forwardStart,revision:next.revision,
      sourceInput:{file:path.basename(inputFile),checksum:hash(input)},failures:input.failures,
      trades:next.trades,portfolio,summary:{entered:portfolio.enteredCount,open:portfolio.openCount,closed:portfolio.closedCount}};
    atomicJson(path.join(dir,'report.json'),report);return report;
  }finally{fs.closeSync(fd);fs.unlinkSync(lock)}
}
