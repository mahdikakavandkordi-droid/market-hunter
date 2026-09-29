import fs from 'node:fs';
import path from 'node:path';
import {completedDailyRows} from '../lib/completed-daily-session.js';
import {
  FORWARD_VALIDATION_VERSION,HORIZONS,parseJsonl,appendJsonlStrict,sessionFromReport,
  presenceAndEpisodes,targetDateForHorizon,buildOutcome,statusFromStore,dayKey,sha256Json
} from '../lib/market-hunter-forward-validation.js';

const ROOT=process.env.MH_FORWARD_DIR||'data/research/market-hunter-forward-validation';
const SOURCE=process.env.MH_FORWARD_SOURCE||'data/v2-latest-scan.json';
const SESSIONS=path.join(ROOT,'sessions.jsonl');
const PRESENCES=path.join(ROOT,'presences.jsonl');
const EPISODES=path.join(ROOT,'episodes.jsonl');
const OUTCOMES=path.join(ROOT,'outcomes.jsonl');
const RUNS=path.join(ROOT,'runs.jsonl');
const STATUS=path.join(ROOT,'status.json');
const BENCHMARK='^GSPTSE';
const TIMEOUT=Number(process.env.MH_FORWARD_FETCH_TIMEOUT_MS||12000);

function readText(file){return fs.existsSync(file)?fs.readFileSync(file,'utf8'):''}
function writeText(file,text){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file+'.tmp',text);
  fs.renameSync(file+'.tmp',file);
}
function nowIso(){return new Date().toISOString()}
function todayUtc(){return nowIso().slice(0,10)}
function appendFile(file,records,keyFn){
  const result=appendJsonlStrict(readText(file),records,keyFn);
  if(result.added.length)writeText(file,result.text);
  return result.added;
}
function readStore(){
  return {
    sessions:parseJsonl(readText(SESSIONS)),
    presences:parseJsonl(readText(PRESENCES)),
    episodes:parseJsonl(readText(EPISODES)),
    outcomes:parseJsonl(readText(OUTCOMES)),
    runs:parseJsonl(readText(RUNS))
  };
}
function writeStatus(){
  const store=readStore();
  writeText(STATUS,JSON.stringify(statusFromStore(store),null,2)+'\n');
}
function runId(stamp){return [process.env.GITHUB_RUN_ID||'local',process.env.GITHUB_RUN_ATTEMPT||'1',stamp].join('|')}
function appendRun(record){
  appendFile(RUNS,[record],x=>x.runId);
  writeStatus();
}
async function fetchChart(symbol){
  let lastError=null;
  for(const host of ['query1','query2']){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),TIMEOUT);
    try{
      const url='https://'+host+'.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?range=1y&interval=1d&includePrePost=false&events=div%2Csplits';
      const response=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0 MarketHunterForwardValidation/1.0'}});
      if(!response.ok)throw new Error(symbol+':http_'+response.status);
      const payload=await response.json(),result=payload?.chart?.result?.[0];
      if(!result)throw new Error(symbol+':chart_missing');
      const q=result.indicators?.quote?.[0]||{},adj=result.indicators?.adjclose?.[0]?.adjclose||q.close||[];
      const rows=completedDailyRows((result.timestamp||[]).map((t,i)=>{
        const rawClose=q.close?.[i],factor=Number.isFinite(adj[i])&&Number.isFinite(rawClose)&&rawClose?adj[i]/rawClose:1;
        return {
          t,close:adj[i],rawClose,
          high:Number.isFinite(q.high?.[i])?q.high[i]*factor:null,
          low:Number.isFinite(q.low?.[i])?q.low[i]*factor:null,
          volume:q.volume?.[i]
        };
      }).filter(x=>Number.isFinite(x.close)&&x.close>0&&Number.isFinite(x.high)&&Number.isFinite(x.low)),result.meta);
      if(!rows.length)throw new Error(symbol+':empty_rows');
      return rows;
    }catch(error){
      lastError=error;
    }finally{clearTimeout(timer)}
  }
  throw lastError||new Error(symbol+':fetch_failed');
}
async function mapLimit(values,limit,worker){
  const out=new Array(values.length);let next=0;
  async function runner(){
    while(true){
      const i=next++;if(i>=values.length)return;
      try{out[i]={status:'fulfilled',value:await worker(values[i])}}
      catch(reason){out[i]={status:'rejected',reason}}
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,values.length)},()=>runner()));
  return out;
}
function previousPresenceMap(presences,date){
  const map=new Map();
  for(const p of presences.filter(x=>x.marketDate===date)){
    const key=p.scope==='integrated'?'integrated|'+p.symbol:'stage|'+p.stage+'|'+p.symbol;
    map.set(key,p);
  }
  return map;
}

async function collect(){
  const attemptedAt=nowIso(),rid=runId(attemptedAt);
  if(!fs.existsSync(SOURCE))throw new Error('source_report_missing');
  const report=JSON.parse(fs.readFileSync(SOURCE,'utf8'));
  const candidateSession=sessionFromReport(report);
  const benchmarkRows=await fetchChart(BENCHMARK);
  const latestBenchmarkDate=dayKey(benchmarkRows.at(-1).t);
  const today=todayUtc();

  if(latestBenchmarkDate!==today){
    appendRun({
      runId:rid,collectorVersion:FORWARD_VALIDATION_VERSION,attemptedAt,
      status:'no_completed_market_session',todayUtc:today,latestBenchmarkDate,
      sourceMarketDate:candidateSession.marketDate
    });
    return {status:'no_completed_market_session',latestBenchmarkDate};
  }
  if(candidateSession.marketDate!==latestBenchmarkDate){
    appendRun({
      runId:rid,collectorVersion:FORWARD_VALIDATION_VERSION,attemptedAt,
      status:'stale_source_report',todayUtc:today,latestBenchmarkDate,
      sourceMarketDate:candidateSession.marketDate,sourceReportHash:candidateSession.sourceReportHash
    });
    throw new Error('stale_source_report:'+candidateSession.marketDate+' expected '+latestBenchmarkDate);
  }

  const before=readStore();
  const existingSession=before.sessions.find(x=>x.marketDate===candidateSession.marketDate)||null;
  let canonicalSession=existingSession,addedSessions=0,addedPresences=0,addedEpisodes=0;
  if(!existingSession){
    const previousBenchmarkDate=benchmarkRows.length>1?dayKey(benchmarkRows.at(-2).t):null;
    const previousSession=before.sessions.find(x=>x.marketDate===previousBenchmarkDate)||null;
    const continuity=Boolean(previousSession);
    const priorMap=previousPresenceMap(before.presences,previousBenchmarkDate);
    const built=presenceAndEpisodes(candidateSession,previousSession,priorMap,continuity);
    addedSessions=appendFile(SESSIONS,[candidateSession],x=>x.sessionId).length;
    addedPresences=appendFile(PRESENCES,built.presences,x=>x.presenceId).length;
    addedEpisodes=appendFile(EPISODES,built.episodes,x=>x.episodeId).length;
    canonicalSession=candidateSession;
  }

  const afterCanonical=readStore();
  const outcomeKeys=new Set(afterCanonical.outcomes.map(x=>x.outcomeId));
  const pending=[];
  for(const episode of afterCanonical.episodes){
    for(const horizon of HORIZONS){
      const outcomeId=episode.episodeId+'|h'+horizon;
      if(outcomeKeys.has(outcomeId))continue;
      const targetDate=targetDateForHorizon(benchmarkRows,episode.startDate,horizon);
      if(targetDate)pending.push({episode,horizon,targetDate});
    }
  }
  const neededSymbols=[...new Set(pending.map(x=>x.episode.symbol))];
  const fetched=await mapLimit(neededSymbols,8,fetchChart);
  const symbolRows=new Map();
  const fetchFailures=[];
  neededSymbols.forEach((symbol,i)=>{
    const result=fetched[i];
    if(result.status==='fulfilled')symbolRows.set(symbol,result.value);
    else fetchFailures.push({symbol,reason:String(result.reason?.message||result.reason||'fetch_failed')});
  });

  const outcomes=[];
  for(const item of pending){
    const rows=symbolRows.get(item.episode.symbol);
    if(!rows)continue;
    const targetSession=afterCanonical.sessions.find(x=>x.marketDate===item.targetDate)||null;
    const outcome=buildOutcome({
      episode:item.episode,horizon:item.horizon,targetDate:item.targetDate,
      symbolRows:rows,benchmarkRows,targetSession,computedAt:attemptedAt
    });
    if(outcome)outcomes.push(outcome);
  }
  const addedOutcomes=appendFile(OUTCOMES,outcomes,x=>x.outcomeId).length;
  const canonicalSourceChanged=Boolean(existingSession&&existingSession.sourceReportHash!==candidateSession.sourceReportHash);

  appendRun({
    runId:rid,collectorVersion:FORWARD_VALIDATION_VERSION,attemptedAt,status:'collected',
    marketAsOf:canonicalSession.marketDate,modelVersion:canonicalSession.modelVersion,
    sourceReportHash:candidateSession.sourceReportHash,
    canonicalSourceChangedSameDay:canonicalSourceChanged,
    addedSessions,addedPresences,addedEpisodes,addedOutcomes,
    pendingMaturedOutcomes:pending.length,fetchFailures
  });
  return {
    status:'collected',marketAsOf:canonicalSession.marketDate,modelVersion:canonicalSession.modelVersion,
    addedSessions,addedPresences,addedEpisodes,addedOutcomes,
    pendingMaturedOutcomes:pending.length,fetchFailures:fetchFailures.length,
    sourceReportHash:sha256Json(report)
  };
}

try{
  const result=await collect();
  console.log(JSON.stringify(result,null,2));
}catch(error){
  const attemptedAt=nowIso();
  try{
    appendRun({
      runId:runId('failure|'+attemptedAt),collectorVersion:FORWARD_VALIDATION_VERSION,
      attemptedAt,status:'collector_failure',error:String(error?.stack||error?.message||error)
    });
  }catch{}
  console.error(error);
  process.exitCode=1;
}
