import {fetchChart} from '../lib/hunter-monitor-source.js';
import {buildHunterMonitor} from '../lib/hunter-monitor.js';
import fs from 'node:fs';
import path from 'node:path';
import {
  FORWARD_VALIDATION_VERSION,HORIZONS,parseJsonl,appendJsonlStrict,sessionFromReport,
  presenceAndEpisodes,targetDateForHorizon,buildOutcome,statusFromStore,dayKey,sha256Json,marketCalendarDate
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

function readText(file){return fs.existsSync(file)?fs.readFileSync(file,'utf8'):''}
function writeText(file,text){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file+'.tmp',text);
  fs.renameSync(file+'.tmp',file);
}
function nowIso(){return new Date().toISOString()}
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
  const today=marketCalendarDate(Date.parse(attemptedAt));

  if(latestBenchmarkDate!==today){
    appendRun({
      runId:rid,collectorVersion:FORWARD_VALIDATION_VERSION,attemptedAt,
      status:'no_completed_market_session',marketCalendarDate:today,todayUtc:attemptedAt.slice(0,10),latestBenchmarkDate,
      sourceMarketDate:candidateSession.marketDate
    });
    return {status:'no_completed_market_session',latestBenchmarkDate};
  }
  if(candidateSession.marketDate!==latestBenchmarkDate){
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
  const neededSymbols=[...new Set([...pending.map(x=>x.episode.symbol),...afterCanonical.episodes.filter(x=>x.scope==='stage').map(x=>x.symbol)])];
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
  const monitor=buildHunterMonitor({...readStore(),symbolRows,benchmarkRows,generatedAt:attemptedAt});
  writeText(path.join(ROOT,'monitor.json'),JSON.stringify(monitor,null,2)+'\n');
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
  const attemptedAt=nowIso(),message=String(error?.message||error);
  const status=message.startsWith('stale_source_report:')?'stale_source_report':'collector_failure';
  try{
    appendRun({
      runId:runId('failure|'+attemptedAt),collectorVersion:FORWARD_VALIDATION_VERSION,
      attemptedAt,status,error:String(error?.stack||error?.message||error)
    });
  }catch{}
  console.error(error);
  process.exitCode=1;
}
