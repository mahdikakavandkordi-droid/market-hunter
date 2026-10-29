import {industryContext} from '../lib/industry-context.js';
import fs from 'node:fs';
import {hunterMarket,scanCurrencyIssue} from '../lib/hunter-markets.js';
import {completedDailyRows} from '../lib/completed-daily-session.js';
import {referenceSession,quoteSessionIssue} from '../lib/scan-session-integrity.js';
import {VERSION,ASSUMPTIONS,PRIORITY_FLOORS,SURFACE_POLICY,INTEGRATED_SURFACE_POLICY,priorityBand,riskFlags,reviewLane,surfaceEligible,surfaceSelect,integratedSurfaceSelect,round,dayKey,benchmarkHist,metrics,classify,rank,surfaceRank} from '../lib/market-hunter-v2-engine.js';
import {volumeMetrics} from '../lib/volume-context.js';
import {recoverUSSessionSummary} from '../lib/us-session-summary.js';

const market=hunterMarket(process.env.MH_HUNTER_MARKET||'CA');
const sourceDeadline=market.market==='US'?Date.now()+180000:Infinity;
const UNIVERSE=market.instruments.map(x=>[x.symbol,x.name,x.sector]);
const range=process.env.V2_SCAN_RANGE||'2y';
const CDR=new Set(UNIVERSE.filter(x=>x[2]==='CDR').map(x=>x[0]));
const benchSymbol=s=>market.market==='US'?market.referenceSymbol:CDR.has(s)?'^IXIC':'^GSPTSE';
const meta=new Map(market.instruments.map(x=>[x.symbol,x]));

async function fetchRows(symbol,host='query1',deadline=sourceDeadline){
  if(Date.now()>=deadline)throw new Error('source_deadline');
  const url='https://'+host+'.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?range='+range+'&interval=1d&includePrePost=false&events=div%2Csplits';
  const res=await fetch(url,{signal:AbortSignal.timeout(Math.max(1,Math.min(12000,deadline-Date.now()))),headers:{'User-Agent':'Mozilla/5.0 MarketHunterV2ResearchScan/1.0'}});
  if(!res.ok)throw new Error(symbol+': HTTP '+res.status);
  const j=await res.json(),z=j?.chart?.result?.[0],q=z?.indicators?.quote?.[0]||{},adj=z?.indicators?.adjclose?.[0]?.adjclose||q.close||[];
  const recovery=market.market==='US'?recoverUSSessionSummary(z,symbol):null;
  const splitDays=new Set(Object.values(z?.events?.splits||{}).map(x=>dayKey(Number(x.date))));
  const rows=completedDailyRows((z?.timestamp||[]).map((t,i)=>{
    if(recovery&&i===z.timestamp.length-1)return recovery.row;
    const rawClose=q.close?.[i],factor=Number.isFinite(adj[i])&&Number.isFinite(rawClose)&&rawClose?adj[i]/rawClose:1;
    return {t,close:adj[i],rawClose,high:Number.isFinite(q.high?.[i])?q.high[i]*factor:null,low:Number.isFinite(q.low?.[i])?q.low[i]*factor:null,volume:q.volume?.[i]};
  }).filter(x=>[x.close,x.rawClose,x.high,x.low,x.volume].every(Number.isFinite)&&x.volume>0),z?.meta);
  const lastIndex=(z?.timestamp?.length||0)-1;
  return {rows,splitDays,currency:z?.meta?.currency||null,sourceRecovery:recovery?.evidence||null,sourceDiagnostic:{
    providerLastDate:lastIndex>=0?dayKey(z.timestamp[lastIndex]):null,
    rawClose:q.close?.[lastIndex]??null,adjustedClose:adj[lastIndex]??null,
    high:q.high?.[lastIndex]??null,low:q.low?.[lastIndex]??null,volume:q.volume?.[lastIndex]??null,
    regular:z?.meta?.currentTradingPeriod?.regular||null
  }};
}

function recentSplit(rows,splitDays,lookback=30){
  for(let i=Math.max(0,rows.length-1-lookback);i<rows.length;i++)if(splitDays.has(dayKey(rows[i].t)))return true;
  return false;
}

function recoveryStageAge(rows,benchRows){
  let age=0;
  for(let offset=1;offset<=12;offset++){
    const idx=rows.length-1-offset;
    if(idx<100)break;
    const date=dayKey(rows[idx].t),bh=benchmarkHist(benchRows,date);
    if(!bh||bh.length<65)break;
    const hist=rows.slice(0,idx+1),m=metrics(hist,bh);
    if(!m)break;
    if(rows[idx].rawClose<ASSUMPTIONS.liquidity.minPrice||m.avgDollar20<ASSUMPTIONS.liquidity.minAvgDollar20)break;
    if(classify(m)!=='Recovery')break;
    age++;
  }
  return age;
}

function evidence(m,stage){
  const out=[];
  if(stage==='Early Watch'){
    if(m.downsideDecel)out.push('downside decelerating');
    if(m.volumeShockNearLow)out.push('volume shock near recent low');
    if(Number.isFinite(m.freshReclaimAge)&&m.freshReclaimAge<=3)out.push('fresh low reclaim');
    if(m.sellingFading)out.push('selling volume fading');
  }else if(stage==='Recovery'){
    if(Number.isFinite(m.rs20)&&m.rs20>=0)out.push('relative strength recovered');
    if(Number.isFinite(m.momentumShift)&&m.momentumShift>=2)out.push('momentum improving');
    if(m.higherLow===true)out.push('higher low');
  }else if(stage==='Attractive Growth'){
    if(Number.isFinite(m.ma20Slope5)&&m.ma20Slope5>=1)out.push('rising MA20');
    if(Number.isFinite(m.rs20)&&m.rs20>=0)out.push('positive relative strength');
    if(Number.isFinite(m.ret20)&&m.ret20>=8)out.push('strong 20-session trend');
  }else if(stage==='Established Move'){
    if(Number.isFinite(m.ma50Slope10)&&m.ma50Slope10>=1)out.push('durable MA50 slope');
    if(Number.isFinite(m.ret60)&&m.ret60>=20)out.push('mature 60-session advance');
    if(m.higherLow===true)out.push('higher low');
  }
  return out;
}

const symbols=UNIVERSE.map(x=>x[0]),needed=[...new Set([...symbols,...symbols.map(benchSymbol)])],data={};
// Bound vendor load; failed fetches remain explicit exclusions.
let next=0;
await Promise.all(Array.from({length:market.market==='US'?4:1},async()=>{
  while(next<needed.length){
    const s=needed[next++];
    try{data[s]=await fetchRows(s)}
    catch(e){console.log('SKIP '+e.message);data[s]={rows:[],splitDays:new Set(),currency:null}}
  }
}));

// Anchor each market to its own completed benchmark session. A suspended or
// stale instrument must not enter today's ranking with months-old candles.
if(market.market==='US'&&data[market.referenceSymbol]?.currency!=='USD')throw new Error('us_benchmark_currency_mismatch');
const marketAsOf=referenceSession(data[market.referenceSymbol]?.rows);
const replacementRetries={attempted:0,recovered:0};
if(market.market==='US'){
  // Incomplete vendor responses can omit the newest stock close while supplying
  // the index close. Retry the same full range once; never patch or splice bars.
  const retry=symbols.filter(s=>data[s]?.currency==='USD'&&quoteSessionIssue(data[s].rows,marketAsOf));
  const retryDeadline=Math.min(sourceDeadline,Date.now()+60000);
  let retryIndex=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(retryIndex<retry.length&&Date.now()<retryDeadline){
      const symbol=retry[retryIndex++];
      replacementRetries.attempted++;
      try{
        const replacement=await fetchRows(symbol,'query2',retryDeadline);
        if(replacement.currency==='USD'&&replacement.rows.length>=120&&!quoteSessionIssue(replacement.rows,marketAsOf)){
          data[symbol]=replacement;replacementRetries.recovered++;
        }
      }catch(e){console.log('RETRY SKIP '+e.message)}
    }
  }));
}
const rows=[],universeRows=[],excluded={},sessionExclusions=[],screening=[];
let usableCount=0,sourceUsableCount=0;
for(const symbol of symbols){
  const pack=data[symbol],r=pack?.rows||[],bench=data[benchSymbol(symbol)]?.rows||[];
  const screen={symbol,name:meta.get(symbol)?.name,sector:meta.get(symbol)?.sector,asOf:r.length?dayKey(r.at(-1).t):null};
  screening.push(screen);
  const exclude=reason=>{screen.reason=reason;excluded[reason]=(excluded[reason]||0)+1;};
  let reason=market.market==='US'?scanCurrencyIssue(pack?.currency,market.currency):null;
  if(!reason&&(r.length<120||bench.length<80))reason='insufficient_history';
  else if(!reason&&recentSplit(r,pack.splitDays))reason='recent_split';
  if(reason){exclude(reason);continue}
  const issue=quoteSessionIssue(r,marketAsOf);
  if(issue){exclude(issue.reason);sessionExclusions.push({symbol,...issue});continue}
  const date=dayKey(r.at(-1).t),bh=benchmarkHist(bench,date);
  if(!bh||bh.length<65){exclude('benchmark_alignment');continue}
  sourceUsableCount++;
  const m=metrics(r,bh);
  if(!m){exclude('metrics');continue}
  Object.assign(screen,{price:round(m.last),rawPrice:r.at(-1).rawClose,avgDollar20:round(m.avgDollar20)});
  if(r.at(-1).rawClose<ASSUMPTIONS.liquidity.minPrice){exclude('price');continue}
  if(m.avgDollar20<ASSUMPTIONS.liquidity.minAvgDollar20){exclude('liquidity');continue}
  usableCount++;
  universeRows.push({symbol,name:meta.get(symbol)?.name,sector:meta.get(symbol)?.sector,date,market:market.market,currency:market.currency,benchmark:benchSymbol(symbol),price:round(m.last),ret5:round(m.ret5),ret20:round(m.ret20),ret60:round(m.ret60),rs20:round(m.rs20),rs60:round(m.rs60),dist20:round(m.dist20),dist50:round(m.dist50),momentumShift:round(m.momentumShift),avgDollar20:round(m.avgDollar20),atr14Pct:round(m.atr14Pct),upDownVolumeRatio:round(m.upDownVolumeRatio),lowBroken:m.lowBroken,swingTrend:m.swingTrend,riskFlags:riskFlags(m)});
  const stage=classify(m);
  if(!stage){exclude('unclassified');continue}
  screen.reason='classified';screen.stage=stage;
  const stageAge=stage==='Recovery'?recoveryStageAge(r,bench):null;
  const baseScore=rank(m,stage),score=round(baseScore,1),surfaceScore=round(surfaceRank(m,stage,baseScore),1),flags=riskFlags(m),lane=reviewLane(stage,score,m);
  rows.push({
    symbol,name:meta.get(symbol)?.name,sector:meta.get(symbol)?.sector,date,stage,
    market:market.market,currency:market.currency,exchange:meta.get(symbol)?.exchange||null,benchmark:benchSymbol(symbol),
    asOf:date,dayChangePct:round((r.at(-1).rawClose/r.at(-2).rawClose-1)*100),sourceBarMethod:pack.sourceRecovery?.method||'yahoo-daily-bar',
    score,surfaceScore,stageAge,priorityBand:priorityBand(stage,score),reviewLane:lane,riskFlags:flags,price:round(m.last),ret5:round(m.ret5),ret20:round(m.ret20),ret60:round(m.ret60),
    rs20:round(m.rs20),rs60:round(m.rs60),rsi14:round(m.rsi14,1),atr14Pct:round(m.atr14Pct,1),
    dist20:round(m.dist20),dist50:round(m.dist50),pullback60:round(m.pullback60),avgDollar20:round(m.avgDollar20),
    momentumShift:round(m.momentumShift),upDownVolumeRatio:round(m.upDownVolumeRatio,2),
    downsideDecel:m.downsideDecel,volumeShockNearLow:m.volumeShockNearLow,sellingFading:m.sellingFading,
    freshReclaimAge:m.freshReclaimAge,freshHighBreakAge:m.freshHighBreakAge,maxRvol5:round(m.maxRvol5,2),
    swingTrend:m.swingTrend,higherLow:m.higherLow,localLow:round(m.localLow),localHigh:round(m.localHigh),
    lowBroken:m.lowBroken,highBroken:m.highBroken,
    evidence:evidence(m,stage),volumeContext:volumeMetrics(r)
  });
}

rows.sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
const stages=['Early Watch','Recovery','Attractive Growth','Established Move'];
const byStage=Object.fromEntries(stages.map(stage=>[stage,rows.filter(x=>x.stage===stage)]));
const surfacePicks=Object.fromEntries(
  Object.keys(SURFACE_POLICY).map(stage=>[stage,surfaceSelect(stage,byStage[stage]||[])])
);
const surfaceCounts=Object.fromEntries(
  Object.keys(SURFACE_POLICY).map(stage=>{
    const reviewFirst=(byStage[stage]||[]).filter(x=>x.priorityBand===SURFACE_POLICY[stage].requiredBand).length;
    const eligible=(byStage[stage]||[]).filter(x=>surfaceEligible(stage,x.score,x)).length;
    const visible=surfacePicks[stage].length;
    return [stage,{reviewFirst,eligible,visible,hidden:Math.max(0,reviewFirst-visible)}];
  })
);
const integratedSurfacePicks=integratedSurfaceSelect(surfacePicks);
const integratedSurfaceCounts={
  stageSurfaceTotal:Object.values(surfacePicks).reduce((sum,x)=>sum+x.length,0),
  visible:integratedSurfacePicks.length,
  hiddenByIntegratedCap:Math.max(0,Object.values(surfacePicks).reduce((sum,x)=>sum+x.length,0)-integratedSurfacePicks.length),
  byStage:Object.fromEntries(stages.map(stage=>[stage,integratedSurfacePicks.filter(x=>x.stage===stage).length]))
};
const report={
  version:VERSION,market:market.market,currency:market.currency,universeSource:market.source,validationStatus:market.market==='US'?'unvalidated-market-extension':'existing-canadian-evidence',generatedAt:new Date().toISOString(),marketAsOf,engineCommit:process.env.GITHUB_SHA||null,range,
  purpose:ASSUMPTIONS.purpose,
  universeCount:symbols.length,sourceUsableCount,usableCount,classifiedCount:rows.length,excluded,screening,replacementRetries,
  sourceSessionRecoveries:symbols.map(s=>data[s]?.sourceRecovery).filter(Boolean),
  sessionIntegrity:{referenceSymbol:market.referenceSymbol,completedSession:marketAsOf,exclusions:sessionExclusions},
  stageCounts:Object.fromEntries(stages.map(s=>[s,byStage[s].length])),
  priorityFloors:PRIORITY_FLOORS,
  surfacePolicy:SURFACE_POLICY,surfacePicks,surfaceCounts,
  integratedSurfacePolicy:INTEGRATED_SURFACE_POLICY,integratedSurfacePicks,integratedSurfaceCounts,
  priorityCounts:{
    reviewFirst:rows.filter(x=>x.reviewLane==='Review First').length,
    highIntensity:rows.filter(x=>x.reviewLane==='High Intensity').length
  },
  reviewFirst:Object.fromEntries(stages.map(s=>[s,byStage[s].filter(x=>x.reviewLane==='Review First')])),
  highIntensity:Object.fromEntries(stages.map(s=>[s,byStage[s].filter(x=>x.reviewLane==='High Intensity')])),
  universeRows,industryContext:industryContext(universeRows,market.instruments,marketAsOf),
  byStage,all:rows
};
fs.mkdirSync('data',{recursive:true});
console.log(JSON.stringify({market:market.market,marketAsOf,universeCount:symbols.length,sourceUsableCount,usableCount,excluded,sessionExclusions:sessionExclusions.slice(0,10),sourceDiagnostics:Object.fromEntries([...symbols.slice(0,3),market.referenceSymbol].map(s=>[s,data[s]?.sourceDiagnostic||null]))},null,2));
if(market.market==='US'&&(usableCount===0||sourceUsableCount/symbols.length<0.9))throw new Error('us_scan_insufficient_source_coverage');
const output=market.file;
fs.writeFileSync(output+'.tmp',JSON.stringify(report,null,2));
fs.renameSync(output+'.tmp',output);
console.log(JSON.stringify({version:VERSION,stageCounts:report.stageCounts,top:Object.fromEntries(stages.map(s=>[s,byStage[s].slice(0,8)]))},null,2));
