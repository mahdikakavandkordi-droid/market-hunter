import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {VERSION,SYMBOLS,RULES,MODELS,initialState,advanceDaily} from '../lib/trend-daily-long.js';
const root=process.env.TREND_DAILY_ROOT||'data/research/trend-daily-long';
fs.mkdirSync(root+'/inputs',{recursive:true});
const config={version:VERSION,symbols:SYMBOLS,rules:RULES,models:MODELS};
const configHash=createHash('sha256').update(JSON.stringify(config)).digest('hex');
const now=new Date(),observedAt=now.toISOString(),path=root+'/ledger.json';
const prior=fs.existsSync(path)?JSON.parse(fs.readFileSync(path)):initialState(observedAt,configHash);
if(prior.configHash!==configHash)throw Error('Config changed: launch a new version');
async function fetchSymbol(symbol){
 let error;
 for(const host of ['query1','query2'])for(let attempt=0;attempt<2;attempt++){
  try{
   const r=await fetch('https://'+host+'.finance.yahoo.com/v8/finance/chart/'+symbol+'?range=2y&interval=1d&events=div%2Csplits',{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error('HTTP '+r.status);
   const raw=await r.text(),d=JSON.parse(raw).chart.result?.[0],q=d?.indicators?.quote?.[0];
   if(!q||!d.timestamp?.length)throw Error('No data');
   const dividends=new Map(Object.values(d.events?.dividends||{}).map(x=>[new Date(x.date*1000).toISOString().slice(0,10),x.amount]));
   const splits=new Set(Object.values(d.events?.splits||{}).map(x=>new Date(x.date*1000).toISOString().slice(0,10)));
   const rows=d.timestamp.map((t,i)=>({t:t*1000,endT:t*1000+6.5*3600000,date:new Date(t*1000).toISOString().slice(0,10),o:q.open[i],h:q.high[i],l:q.low[i],c:q.close[i],v:q.volume[i]}))
    .filter(b=>b.endT<=now.getTime()&&[b.o,b.h,b.l,b.c].every(x=>Number.isFinite(x)&&x>0))
    .map(b=>({...b,dividend:dividends.get(b.date)||0,split:splits.has(b.date)}));
   if(rows.length<220)throw Error('Insufficient history');
   const hash=createHash('sha256').update(raw).digest('hex');
   fs.writeFileSync(root+'/inputs/'+symbol+'-'+hash.slice(0,12)+'.json.gz',gzipSync(raw));
   return {rows,hash};
  }catch(e){error=e.message}
 }
 throw Error(symbol+' '+error);
}
const symbols=[...SYMBOLS,'SPY'],series={},inputs={},failures=[];let cursor=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<symbols.length){const symbol=symbols[cursor++];try{const d=await fetchSymbol(symbol);series[symbol]=d.rows;inputs[symbol]=d.hash}catch(e){failures.push(e.message)}}}));
let state=prior;
if(!failures.length){try{state=advanceDaily(prior,series,observedAt)}catch(e){failures.push(e.message)}}
const report={version:VERSION,activatedAt:state.activatedAt,generatedAt:observedAt,lastSession:state.lastSession,config,configHash,failures,inputs,
 assumptions:['Paper account, USD, fully funded long stock positions.','Whole shares, 5 bps slippage per side, zero broker commission.','Cash dividends credited on ex-date. Taxes and FX excluded.','SPY buy-hold and daily-rebalanced 50% SPY/cash include distributions; cash interest zero.','No signals from closes earlier than launch or missed collection sessions.'],
 sessions:state.sessions.length,benchmarks:state.benchmarks,
 models:Object.fromEntries(MODELS.map(id=>{const m=state.models[id],last=m.curve.at(-1);return [id,{cash:m.cash,equity:last?.equity??10000,pending:m.pending,open:m.trades.filter(t=>t.status==='open'),closed:m.trades.filter(t=>t.status==='closed'),skipped:m.skipped.length,curve:m.curve}]}))};
function atomic(file,value){fs.writeFileSync(file+'.tmp',JSON.stringify(value,null,2));fs.renameSync(file+'.tmp',file)}
if(!failures.length)atomic(path,state);
atomic(root+'/latest.json',report);
console.log(JSON.stringify({activatedAt:state.activatedAt,lastSession:state.lastSession,sessions:state.sessions.length,failures}));
if(failures.length)process.exitCode=1;
