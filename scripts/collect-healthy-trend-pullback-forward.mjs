import fs from 'node:fs';
import path from 'node:path';
import {evaluateForwardModels} from '../lib/healthy-trend-pullback-forward-models.js';
import {saveSnapshot,canonicalObservations,assertModernInputs} from '../lib/healthy-trend-pullback-forward-store.js';
import {HTP_VERSION,HTP_PARAMS,dayKey} from '../lib/healthy-trend-pullback.js';
import {VERSION as EARLY_WATCH_VERSION} from '../lib/market-hunter-v2-engine.js';
import {UNIVERSE,UNIVERSE_SOURCE} from '../lib/universe.js';
import {
  HTP_FORWARD_COLLECTOR_VERSION,normalizeYahooChart,sha256Json,
  parseJsonl,appendJsonlStrict,observationId,pickObservationId,coverageStatus,matureForwardPick
} from '../lib/healthy-trend-pullback-forward.js';

const OUT_DIR=process.env.HTP_FORWARD_DIR||'data/research/healthy-trend-pullback-forward';
const INPUTS_FILE=path.join(OUT_DIR,'inputs.jsonl');
const OBS_FILE=path.join(OUT_DIR,'observations.jsonl');
const OUTCOMES_FILE=path.join(OUT_DIR,'outcomes.jsonl');
const RUNS_FILE=path.join(OUT_DIR,'runs.jsonl');
const STATUS_FILE=path.join(OUT_DIR,'status.json');
const FETCH_RANGE=process.env.HTP_FORWARD_RANGE||'1y';
const FETCH_TIMEOUT_MS=Number(process.env.HTP_FORWARD_FETCH_TIMEOUT_MS||12000);
const CONCURRENCY=Number(process.env.HTP_FORWARD_CONCURRENCY||12);
const BENCHMARK='^GSPTSE';
const HEADLINE_UNIVERSE=UNIVERSE.filter(x=>x[2]!=='CDR');
const universeDefinition={
  source:UNIVERSE_SOURCE,
  policy:'non-CDR Canadian headline universe; current reviewed membership frozen by hash per observation',
  symbols:HEADLINE_UNIVERSE.map(([symbol,name,sector])=>({symbol,name,sector}))
};
const UNIVERSE_VERSION=sha256Json(universeDefinition);

function readText(p){return fs.existsSync(p)?fs.readFileSync(p,'utf8'):''}
function writeText(p,s){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p+'.tmp',s);fs.renameSync(p+'.tmp',p)}
function nowIso(){return new Date().toISOString()}
function todayUtc(){return new Date().toISOString().slice(0,10)}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function fetchChart(symbol){
  let last=null;
  for(const host of ['query1','query2']){
    for(let attempt=0;attempt<2;attempt++){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
      try{
        const url=`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${FETCH_RANGE}&interval=1d&includePrePost=false&events=div%2Csplits`;
        const res=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0 MarketHunterForwardResearch/1.0'}});
        if(!res.ok){const e=new Error('http_'+res.status);e.status=res.status;throw e}
        const payload=await res.json();
        const pack=normalizeYahooChart(payload,symbol);
        if(!pack.rows.length)throw new Error('empty_rows');
        return pack;
      }catch(e){
        last=e;
        if(attempt===0)await sleep(300);
      }finally{clearTimeout(timer)}
    }
  }
  throw last||new Error('fetch_failed');
}
async function mapLimit(values,limit,worker){
  const out=new Array(values.length);let next=0;
  async function run(){
    while(true){
      const i=next++;if(i>=values.length)return;
      try{out[i]={status:'fulfilled',value:await worker(values[i],i)}}
      catch(reason){out[i]={status:'rejected',reason}}
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,values.length)},()=>run()));
  return out;
}
function appendFile(file,records,keyFn){
  const r=appendJsonlStrict(readText(file),records,keyFn);if(r.added.length)writeText(file,r.text);return r.added.length;
}
function appendRun(record){return appendFile(RUNS_FILE,[record],x=>x.runId)}
function latestFirstSurfaceCounts(observations,outcomes){
  const byModel=new Map();
  for(const o of observations){
    if(!byModel.has(o.model))byModel.set(o.model,[]);
    byModel.get(o.model).push(o);
  }
  const matured=new Set(outcomes.map(x=>x.pickObservationId));
  const result={};
  for(const [model,rows] of byModel){
    rows.sort((a,b)=>a.marketAsOf.localeCompare(b.marketAsOf));
    let prev=new Set(),episodes=0,maturedEpisodes=0,completeSessions=0;
    for(const o of rows){
      if(o.status==='complete_zero_pick'||o.status==='complete_nonzero')completeSessions++;
      if(!o.status.startsWith('complete_'))continue;
      const now=new Set((o.picks||[]).map(x=>x.symbol));
      for(const p of o.picks||[])if(!prev.has(p.symbol)){
        episodes++;if(matured.has(p.pickObservationId))maturedEpisodes++;
      }
      prev=now;
    }
    result[model]={completeSessions,firstSurfaceEpisodes:episodes,maturedFirstSurfaceEpisodes:maturedEpisodes};
  }
  return result;
}

async function collect(){
  const capturedAt=nowIso(),runId=[process.env.GITHUB_RUN_ID||'local',process.env.GITHUB_RUN_ATTEMPT||'1',capturedAt].join('|');
  const existingInputs=parseJsonl(readText(INPUTS_FILE));
  assertModernInputs(existingInputs);
  const needed=[BENCHMARK,...HEADLINE_UNIVERSE.map(x=>x[0])];
  const fetched=await mapLimit(needed,CONCURRENCY,s=>fetchChart(s));
  const data={},fetchFailures=[];
  needed.forEach((symbol,i)=>{
    const r=fetched[i];
    if(r.status==='fulfilled')data[symbol]=r.value;
    else fetchFailures.push({symbol,reason:r.reason?.name==='AbortError'?'timeout':String(r.reason?.message||'fetch_failed')});
  });
  const benchmark=data[BENCHMARK];
  if(!benchmark?.rows?.length)throw new Error('benchmark_unavailable');
  const marketAsOf=dayKey(benchmark.rows.at(-1).t);
  if(marketAsOf!==todayUtc()||marketAsOf!==capturedAt.slice(0,10)){
    appendRun({
      runId,collectorVersion:HTP_FORWARD_COLLECTOR_VERSION,attemptedAt:capturedAt,status:'market_not_completed',
      latestBenchmarkSession:marketAsOf,todayUtc:todayUtc(),gitCommit:process.env.GITHUB_SHA||null
    });
    return {status:'market_not_completed',marketAsOf};
  }
  const {evaluated,failures:modelFailures,modelSpecs}=evaluateForwardModels({data,marketAsOf,universeDefinition});
  const failures=[...fetchFailures,...modelFailures];
  const symbolSnapshots=[...evaluated].map(([symbol,{pack,i}])=>({
    symbol,sourceHash:pack.sourceHash,rowCount:pack.rows.length,latestSession:dayKey(pack.rows[i].t),currency:pack.currency
  })).sort((a,b)=>a.symbol.localeCompare(b.symbol));
  const snapshot=saveSnapshot(OUT_DIR,{format:2,data});
  const inputIdentity={
    snapshot,
    marketAsOf,provider:'Yahoo Finance chart API query1/query2',range:FETCH_RANGE,
    universeVersion:UNIVERSE_VERSION,benchmark:{symbol:BENCHMARK,sourceHash:benchmark.sourceHash},
    symbolSnapshots,failures:[...failures].sort((a,b)=>a.symbol.localeCompare(b.symbol))
  };
  const inputManifestHash=sha256Json(inputIdentity);
  const inputRecord={
    inputId:'htp-forward-input|'+marketAsOf+'|'+runId,marketAsOf,capturedAt,
    schemaVersion:2,collectorVersion:HTP_FORWARD_COLLECTOR_VERSION,gitCommit:process.env.GITHUB_SHA||null,
    universeDefinition,universeVersion:UNIVERSE_VERSION,...inputIdentity,inputManifestHash
  };

  const intended=HEADLINE_UNIVERSE.length,evaluatedCount=evaluated.size;
  const observations=modelSpecs.map(spec=>{
    const status=coverageStatus({intended,evaluated:evaluatedCount,pickCount:spec.picks.length});
    const obsId=observationId(spec.modelVersion,marketAsOf,spec.model);
    return {
      observationId:obsId,collectorVersion:HTP_FORWARD_COLLECTOR_VERSION,
      model:spec.model,modelVersion:spec.modelVersion,marketAsOf,capturedAt,status,
      inputId:inputRecord.inputId,gitCommit:process.env.GITHUB_SHA||null,universeVersion:UNIVERSE_VERSION,inputManifestHash,
      intendedUniverseCount:intended,evaluatedUniverseCount:evaluatedCount,
      failedSymbols:[...failures].sort((a,b)=>a.symbol.localeCompare(b.symbol)),
      naturalEligibleCount:spec.naturalEligibleCount,maxVisible:HTP_PARAMS.maxVisible,
      zeroPick:status==='complete_zero_pick',
      picks:spec.picks.map(x=>({
        ...x,
        pickObservationId:pickObservationId(spec.modelVersion,marketAsOf,spec.model,x.symbol)
      }))
    };
  });

  // The input record atomically journals all three model results. Partial attempts stay
  // here; only the first complete attempt per date can publish canonical observations.
  if(todayUtc()!==marketAsOf)throw new Error('capture_crossed_same_day_cutoff');
  inputRecord.observations=observations;
  appendFile(INPUTS_FILE,[inputRecord],x=>x.inputId);
  const canonical=canonicalObservations([...existingInputs,inputRecord]);
  const addedObservations=appendFile(OBS_FILE,canonical,x=>x.observationId);

  const allObservations=parseJsonl(readText(OBS_FILE)),existingOutcomes=parseJsonl(readText(OUTCOMES_FILE));
  const haveOutcome=new Set(existingOutcomes.map(x=>x.pickObservationId)),newOutcomes=[];
  for(const obs of allObservations){
    for(const p of obs.picks||[]){
      if(haveOutcome.has(p.pickObservationId))continue;
      const pack=data[p.symbol];if(!pack)continue;
      const result=matureForwardPick({
        pack,decisionDate:obs.marketAsOf,decisionAtr14:p.decisionAtr14,
        decisionPriceAnchor:p.decisionPriceAnchor,decisionHistory:p.decisionHistory,
        benchmarkRows:benchmark.rows,maturedAt:marketAsOf
      });
      if(!result)continue;
      newOutcomes.push({
        outcomeId:p.pickObservationId,pickObservationId:p.pickObservationId,
        observationId:obs.observationId,model:obs.model,modelVersion:obs.modelVersion,symbol:p.symbol,
        appendedAt:capturedAt,outcomeInputMarketAsOf:marketAsOf,outcomeSnapshot:snapshot,
        outcomeSourceHash:pack.sourceHash,benchmarkSourceHash:benchmark.sourceHash,...result
      });
      haveOutcome.add(p.pickObservationId);
    }
  }
  const addedOutcomes=appendFile(OUTCOMES_FILE,newOutcomes,x=>x.outcomeId);
  const finalObservations=parseJsonl(readText(OBS_FILE)),finalOutcomes=parseJsonl(readText(OUTCOMES_FILE));
  const status={
    format:'market-hunter-healthy-trend-pullback-forward-status-v1',
    generatedAt:capturedAt,collectorVersion:HTP_FORWARD_COLLECTOR_VERSION,
    activation:'prospective collector implementation; schedule only becomes live when workflow is present on the default branch',
    historicalBackfillAllowed:false,
    leadChallenger:{model:'core',modelVersion:HTP_VERSION},
    baselines:[
      {model:'trend_rs',modelVersion:HTP_VERSION},
      {model:'early_watch',modelVersion:EARLY_WATCH_VERSION}
    ],
    universeVersion:UNIVERSE_VERSION,latestMarketAsOf:marketAsOf,
    observationRecords:finalObservations.length,outcomeRecords:finalOutcomes.length,
    progress:latestFirstSurfaceCounts(finalObservations,finalOutcomes),
    stoppingRule:{
      firstReview:'earlier of 160 complete Canadian market sessions with matured primary horizons, or 120 matured Core first-surface episodes after at least 80 complete sessions',
      incompleteEvidenceDate:'2027-06-30',administrativeReviewDate:'2027-07-30'
    },
    fileHashes:{
      inputs:sha256Json(parseJsonl(readText(INPUTS_FILE))),
      observations:sha256Json(finalObservations),
      outcomes:sha256Json(finalOutcomes)
    }
  };
  writeText(STATUS_FILE,JSON.stringify(status,null,2)+'\n');
  appendRun({
    runId,collectorVersion:HTP_FORWARD_COLLECTOR_VERSION,attemptedAt:capturedAt,status:'collected',
    marketAsOf,gitCommit:process.env.GITHUB_SHA||null,inputManifestHash,
    addedObservations,addedOutcomes,coverage:{intended,evaluated:evaluatedCount,failures:failures.length}
  });
  return {status:'collected',marketAsOf,addedObservations,addedOutcomes,coverage:{intended,evaluated:evaluatedCount,failures:failures.length},picks:Object.fromEntries(modelSpecs.map(x=>[x.model,x.picks.length]))};
}

try{
  const result=await collect();
  console.log(JSON.stringify(result,null,2));
}catch(error){
  const attemptedAt=nowIso(),runId=[process.env.GITHUB_RUN_ID||'local',process.env.GITHUB_RUN_ATTEMPT||'1','failure',attemptedAt].join('|');
  try{
    appendRun({
      runId,collectorVersion:HTP_FORWARD_COLLECTOR_VERSION,attemptedAt,status:'collector_failure',
      gitCommit:process.env.GITHUB_SHA||null,error:String(error?.stack||error?.message||error)
    });
  }catch{}
  console.error(error);
  process.exitCode=1;
}

