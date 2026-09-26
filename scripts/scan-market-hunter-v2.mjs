import fs from 'node:fs';
import {UNIVERSE} from '../lib/universe.js';
import {VERSION,ASSUMPTIONS,PRIORITY_FLOORS,priorityBand,round,dayKey,benchmarkHist,metrics,classify,rank} from '../lib/market-hunter-v2-engine.js';

const range=process.env.V2_SCAN_RANGE||'2y';
const CDR=new Set(UNIVERSE.filter(x=>x[2]==='CDR').map(x=>x[0]));
const benchSymbol=s=>CDR.has(s)?'^IXIC':'^GSPTSE';
const meta=new Map(UNIVERSE.map(x=>[x[0],{name:x[1],sector:x[2]}]));

async function fetchRows(symbol){
  const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?range='+range+'&interval=1d&includePrePost=false&events=div%2Csplits';
  const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 MarketHunterV2ResearchScan/1.0'}});
  if(!res.ok)throw new Error(symbol+': HTTP '+res.status);
  const j=await res.json(),z=j?.chart?.result?.[0],q=z?.indicators?.quote?.[0]||{},adj=z?.indicators?.adjclose?.[0]?.adjclose||q.close||[];
  const splitDays=new Set(Object.values(z?.events?.splits||{}).map(x=>dayKey(Number(x.date))));
  const rows=(z?.timestamp||[]).map((t,i)=>{
    const rawClose=q.close?.[i],factor=Number.isFinite(adj[i])&&Number.isFinite(rawClose)&&rawClose?adj[i]/rawClose:1;
    return {t,close:adj[i],rawClose,high:Number.isFinite(q.high?.[i])?q.high[i]*factor:null,low:Number.isFinite(q.low?.[i])?q.low[i]*factor:null,volume:q.volume?.[i]};
  }).filter(x=>[x.close,x.rawClose,x.high,x.low,x.volume].every(Number.isFinite)&&x.volume>0);
  return {rows,splitDays};
}

function recentSplit(rows,splitDays,lookback=30){
  for(let i=Math.max(0,rows.length-1-lookback);i<rows.length;i++)if(splitDays.has(dayKey(rows[i].t)))return true;
  return false;
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
  if(Number.isFinite(m.atr14Pct)&&m.atr14Pct>=6)out.push('high ATR risk');
  if(Number.isFinite(m.dist20)&&m.dist20>=6)out.push('extended above MA20');
  return out;
}

const symbols=UNIVERSE.map(x=>x[0]),needed=[...new Set([...symbols,...symbols.map(benchSymbol)])],data={};
for(const s of needed){
  process.stdout.write('fetch '+s+'... ');
  try{data[s]=await fetchRows(s);console.log(data[s].rows.length)}
  catch(e){console.log('SKIP '+e.message);data[s]={rows:[],splitDays:new Set()}}
}

const rows=[],excluded={};
for(const symbol of symbols){
  const pack=data[symbol],r=pack?.rows||[],bench=data[benchSymbol(symbol)]?.rows||[];
  let reason=null;
  if(r.length<120||bench.length<80)reason='insufficient_history';
  else if(recentSplit(r,pack.splitDays))reason='recent_split';
  if(reason){excluded[reason]=(excluded[reason]||0)+1;continue}
  const date=dayKey(r.at(-1).t),bh=benchmarkHist(bench,date);
  if(!bh||bh.length<65){excluded.benchmark_alignment=(excluded.benchmark_alignment||0)+1;continue}
  const m=metrics(r,bh);
  if(!m){excluded.metrics=(excluded.metrics||0)+1;continue}
  if(r.at(-1).rawClose<ASSUMPTIONS.liquidity.minPrice){excluded.price=(excluded.price||0)+1;continue}
  if(m.avgDollar20<ASSUMPTIONS.liquidity.minAvgDollar20){excluded.liquidity=(excluded.liquidity||0)+1;continue}
  const stage=classify(m);
  if(!stage){excluded.unclassified=(excluded.unclassified||0)+1;continue}
  const score=round(rank(m,stage),1);
  rows.push({
    symbol,name:meta.get(symbol)?.name,sector:meta.get(symbol)?.sector,date,stage,
    score,priorityBand:priorityBand(stage,score),price:round(m.last),ret5:round(m.ret5),ret20:round(m.ret20),ret60:round(m.ret60),
    rs20:round(m.rs20),rs60:round(m.rs60),rsi14:round(m.rsi14,1),atr14Pct:round(m.atr14Pct,1),
    dist20:round(m.dist20),dist50:round(m.dist50),pullback60:round(m.pullback60),
    upDownVolumeRatio:round(m.upDownVolumeRatio,2),swingTrend:m.swingTrend,higherLow:m.higherLow,
    evidence:evidence(m,stage)
  });
}

rows.sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
const stages=['Early Watch','Recovery','Attractive Growth','Established Move'];
const byStage=Object.fromEntries(stages.map(stage=>[stage,rows.filter(x=>x.stage===stage)]));
const report={
  version:VERSION,generatedAt:new Date().toISOString(),range,
  purpose:ASSUMPTIONS.purpose,
  universeCount:symbols.length,classifiedCount:rows.length,excluded,
  stageCounts:Object.fromEntries(stages.map(s=>[s,byStage[s].length])),
  priorityFloors:PRIORITY_FLOORS,
  priorityCounts:{
    reviewFirst:rows.filter(x=>x.priorityBand==='Review First'||x.priorityBand==='Prime').length,
    prime:rows.filter(x=>x.priorityBand==='Prime').length
  },
  reviewFirst:Object.fromEntries(stages.map(s=>[s,byStage[s].filter(x=>x.priorityBand==='Review First'||x.priorityBand==='Prime')])),
  prime:Object.fromEntries(stages.map(s=>[s,byStage[s].filter(x=>x.priorityBand==='Prime')])),
  byStage,all:rows
};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/v2-latest-scan.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({version:VERSION,stageCounts:report.stageCounts,top:Object.fromEntries(stages.map(s=>[s,byStage[s].slice(0,8)]))},null,2));
