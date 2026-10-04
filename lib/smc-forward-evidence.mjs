import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const CORE_DECISION_FIELDS=['symbol','signalT','dir','entryT','entry','stop','target','risk','signalSnapshot'];
const SNAPSHOT_FIELDS=['momentumShadow'];
const ENTRY_FIELDS=['entryT','entry','stop','target','risk'];

export function tradeIdentity(x){
  if(x?.decisionId)return x.decisionId;
  return [x?.symbol,x?.signalT,x?.dir].join('|');
}

export function createRunContext(tracker,cohort,observedAt=new Date().toISOString()){
  const github={};
  if(process.env.GITHUB_RUN_ID)github.runId=process.env.GITHUB_RUN_ID;
  if(process.env.GITHUB_RUN_ATTEMPT)github.runAttempt=process.env.GITHUB_RUN_ATTEMPT;
  if(process.env.GITHUB_SHA)github.sha=process.env.GITHUB_SHA;
  if(process.env.GITHUB_WORKFLOW)github.workflow=process.env.GITHUB_WORKFLOW;
  if(process.env.GITHUB_REF)github.ref=process.env.GITHUB_REF;
  const provenance={
    tracker,cohort,observedAt,
    marketDataSource:'Yahoo Finance chart API',
    ...(Object.keys(github).length?{github}: {})
  };
  const runKey=github.runId
    ? [tracker,cohort,github.runId,github.runAttempt||'1'].join('|')
    : [tracker,cohort,observedAt].join('|');
  return {...provenance,runKey};
}

export function loadLedgerStrict(path,defaults={}){
  if(!fs.existsSync(path))return structuredClone(defaults);
  let parsed;
  try{parsed=JSON.parse(fs.readFileSync(path,'utf8'))}
  catch(e){throw new Error(path+': corrupt ledger JSON; refusing reconstruction overwrite: '+e.message)}
  if(!parsed||typeof parsed!=='object'||!Array.isArray(parsed.trades)){
    throw new Error(path+': invalid ledger schema; trades[] is required');
  }
  assertUnique(parsed.trades,path);
  return parsed;
}

function assertUnique(trades,label){
  const seen=new Set();
  for(const tr of trades){
    const id=tradeIdentity(tr);
    if(!tr?.symbol||!tr?.signalT||!Number.isFinite(tr?.dir))throw new Error(label+': invalid trade identity');
    if(seen.has(id))throw new Error(label+': duplicate trade identity '+id);
    seen.add(id);
  }
}

function discrepancy(id,field,recorded,recomputed,type='source_revision_conflict'){
  return {type,identity:id,field,recorded,recomputed};
}
function classifyEntry(firstObservedAt,entryT){
  if(!firstObservedAt||!entryT)return null;
  return Date.parse(firstObservedAt)<=Date.parse(entryT)?'prospective':'reconstructed';
}
function clone(x){return structuredClone(x)}

export function reconcileLedger(priorLedger,observedTrades,run){
  const prior=Array.isArray(priorLedger?.trades)?priorLedger.trades:[];
  assertUnique(prior,'prior ledger');
  assertUnique(observedTrades,'observed trades');
  const observedBy=new Map(observedTrades.map(x=>[tradeIdentity(x),x]));
  const priorBy=new Map(prior.map(x=>[tradeIdentity(x),x]));
  const trades=[],runDiscrepancies=[];
  let lifecycleUpdates=0,newRecords=0,missingPreviouslyRecorded=0;

  for(const old of prior){
    const id=tradeIdentity(old),cand=observedBy.get(id);
    if(!cand){
      trades.push(clone(old));
      missingPreviouslyRecorded++;
      continue;
    }

    let coreConflict=false;
    for(const field of CORE_DECISION_FIELDS){
      const a=old?.[field],b=cand?.[field];
      if(a!==undefined&&a!==null&&b!==undefined&&b!==null&&!isDeepStrictEqual(a,b)){
        runDiscrepancies.push(discrepancy(id,field,a,b));
        coreConflict=true;
      }
    }
    for(const field of SNAPSHOT_FIELDS){
      const a=old?.[field],b=cand?.[field];
      if(a!==undefined&&a!==null&&b!==undefined&&b!==null&&!isDeepStrictEqual(a,b)){
        runDiscrepancies.push(discrepancy(id,field,a,b,'immutable_snapshot_revision'));
      }
    }

    const next=clone(old);
    if(old.status==='pending_entry'&&!coreConflict&&cand.entryT){
      for(const field of ENTRY_FIELDS){
        if((next[field]===undefined||next[field]===null)&&cand[field]!==undefined)next[field]=clone(cand[field]);
      }
      if(!next.entryObservationClass&&next.firstObservedAt){
        next.entryObservationClass=classifyEntry(next.firstObservedAt,next.entryT);
      }
      next.status=cand.status;
      for(const f of ['R','exitT','exitReason','exitPriceAssumed','exitTimeConvention','executionAudit']){
        if(cand[f]!==undefined)next[f]=clone(cand[f]);
      }
      lifecycleUpdates++;
    }else if(old.status==='open'&&!coreConflict&&cand.status==='closed'){
      next.status='closed';
      for(const f of ['R','exitT','exitReason','exitPriceAssumed','exitTimeConvention','executionAudit']){
        if(cand[f]!==undefined)next[f]=clone(cand[f]);
      }
      lifecycleUpdates++;
    }else if(old.status==='closed'){
      for(const f of ['status','R','exitT']){
        if(cand[f]!==undefined&&!isDeepStrictEqual(old?.[f],cand?.[f])){
          runDiscrepancies.push(discrepancy(id,f,old?.[f],cand?.[f],'closed_outcome_revision'));
        }
      }
    }
    trades.push(next);
  }

  for(const cand of observedTrades){
    const id=tradeIdentity(cand);
    if(priorBy.has(id))continue;
    const next=clone(cand);
    next.decisionId=id;
    next.firstObservedAt=run.observedAt;
    next.firstObservedProvenance={
      tracker:run.tracker,cohort:run.cohort,marketDataSource:run.marketDataSource,
      ...(run.github?{github:clone(run.github)}:{})
    };
    next.entryObservationClass=next.entryT?classifyEntry(run.observedAt,next.entryT):'pending';
    trades.push(next);
    newRecords++;
  }

  trades.sort((a,b)=>(a.entryT||a.signalT).localeCompare(b.entryT||b.signalT)||a.symbol.localeCompare(b.symbol));
  const priorLog=Array.isArray(priorLedger?.discrepancyLog)?priorLedger.discrepancyLog:[];
  const log=[...priorLog.map(clone)];
  const known=new Set(log.map(x=>JSON.stringify([x.type,x.identity,x.field,x.recorded,x.recomputed])));
  for(const d of runDiscrepancies){
    const k=JSON.stringify([d.type,d.identity,d.field,d.recorded,d.recomputed]);
    if(known.has(k))continue;
    log.push({...clone(d),firstDetectedAt:run.observedAt,runKey:run.runKey});
    known.add(k);
  }

  const legacyUnprovenancedCount=trades.filter(x=>!x.firstObservedAt).length;
  const reconstructedCount=trades.filter(x=>x.entryObservationClass==='reconstructed').length;
  const prospectiveCount=trades.filter(x=>x.entryObservationClass==='prospective').length;
  const pendingCount=trades.filter(x=>x.status==='pending_entry').length;
  const changed=!isDeepStrictEqual(prior,trades)||!isDeepStrictEqual(priorLog,log);

  return {
    trades,discrepancyLog:log,runDiscrepancies,changed,
    summary:{newRecords,lifecycleUpdates,missingPreviouslyRecorded,legacyUnprovenancedCount,reconstructedCount,prospectiveCount,pendingCount}
  };
}

export function appendRunLog(priorLog,run,details={}){
  const log=Array.isArray(priorLog)?priorLog.map(clone):[];
  if(log.some(x=>x.runKey===run.runKey))return log;
  log.push({
    runKey:run.runKey,observedAt:run.observedAt,tracker:run.tracker,cohort:run.cohort,
    ...(run.github?{github:clone(run.github)}:{}),...clone(details)
  });
  return log;
}
