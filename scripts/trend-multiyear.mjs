import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {trendSignal,advanceTrade,stats} from '../lib/trend-breakout/engine.mjs';
import {aggregateExchange4H,dailyStock,buildGapBeforeIndex} from '../lib/smc-forward-runtime.mjs';
const rules=JSON.parse(fs.readFileSync('data/research/trend-breakout-v1/config.json')).rules;
const end=Date.parse('2026-11-10T00:00:00Z');
const symbols=['AAPL','MSFT','AMZN','GOOGL','META','NVDA','JPM','XOM','JNJ','COST','CAT','NEE','RY.TO','TD.TO','BMO.TO','ENB.TO','CNQ.TO','CNR.TO','CP.TO','BCE.TO','FTS.TO','NTR.TO','AEM.TO','SHOP.TO'];
const dir='data/research/trend-multiyear';
fs.mkdirSync(dir+'/raw',{recursive:true});
async function get(symbol,interval){
 let error;
 for(const host of ['query1','query2'])for(let attempt=0;attempt<2;attempt++){
  try{
   const start=interval==='1h'?end-729*86400000:Date.parse('2015-01-01');
   const url='https://'+host+'.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?period1='+Math.floor(start/1000)+'&period2='+Math.floor(end/1000)+'&interval='+interval+'&includePrePost=false&events=div%2Csplits';
   const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(25000)});
   if(!r.ok)throw Error('HTTP '+r.status);
   const raw=await r.text(),j=JSON.parse(raw).chart.result?.[0];
   if(!j?.timestamp)throw Error('No bars');
   fs.writeFileSync(dir+'/raw/'+symbol+'-'+interval+'.json',raw);
   const q=j.indicators.quote[0];
   return {hash:createHash('sha256').update(raw).digest('hex'),rows:j.timestamp.map((t,i)=>({t:t*1000,o:q.open[i],h:q.high[i],l:q.low[i],c:q.close[i],v:q.volume[i]})).filter(b=>[b.o,b.h,b.l,b.c].every(x=>Number.isFinite(x)&&x>0)&&b.t<end)};
  }catch(e){error=e.message}
 }
 throw Error(symbol+' '+interval+' '+error);
}
const inputs={},failures=[];
for(const symbol of [...symbols,'SPY','XIU.TO']){
 try{const daily=await get(symbol,'1d');let hourly=null;
 if(symbol!=='SPY'&&symbol!=='XIU.TO')try{hourly=await get(symbol,'1h')}catch(e){failures.push(e.message)}
 inputs[symbol]={daily,hourly};console.log(symbol,daily.rows.length,hourly?.rows.length);
 }catch(e){failures.push(e.message)}
}
const variants=['baseline_both','baseline_long','relative_strength','volume','relative_and_volume'];
function summarize(trades){return {closed:stats(trades,.05),stressCost:stats(trades,.1),open:trades.filter(t=>t.status==='open').length};}
const results=[];
for(const timeframe of ['4h','daily'])for(const symbol of symbols){
 const input=inputs[symbol],benchmark=inputs[symbol.endsWith('.TO')?'XIU.TO':'SPY'];
 if(!input||!benchmark||timeframe==='4h'&&!input.hourly)continue;
 const daily=dailyStock(input.daily.rows),bench=new Map(dailyStock(benchmark.daily.rows).map(r=>[r.date,r.c]));
 const aggregate=timeframe==='4h'?aggregateExchange4H(input.hourly.rows,{nowMs:end}):null;
 const bars=aggregate?aggregate.bars:daily.map(r=>({...r,endT:r.t+6.5*3600000}));
 const gaps=aggregate?buildGapBeforeIndex(bars,{mode:'stock',diagnostics:aggregate.diagnostics,tradingDates:daily.map(r=>r.date)}):new Map();
 for(const variant of variants){
  const trades=[];let occupied=-Infinity;
  for(let i=0;i<bars.length-1;i++){
   const b=bars[i];if(b.t<occupied||b.t<Date.parse(timeframe==='4h'?'2024-12-01':'2016-01-01'))continue;
   const signal=trendSignal(daily,bars,i,'stock',rules);
   if(!signal||variant!=='baseline_both'&&signal.dir!==1)continue;
   if(Array.from({length:rules.breakoutBars},(_,k)=>i-k).some(j=>gaps.has(j)))continue;
   const history=daily.filter(d=>d.date<dailyStock([b])[0].date),last=history.at(-1),prior=history.at(-21);
   const rs=last&&prior&&bench.has(last.date)&&bench.has(prior.date)?last.c/prior.c-bench.get(last.date)/bench.get(prior.date):null;
   const recent=bars.slice(i-20,i),meanVolume=recent.reduce((s,r)=>s+r.v,0)/20,volumeRatio=meanVolume>0?b.v/meanVolume:null;
   if(['relative_strength','relative_and_volume'].includes(variant)&&!(rs>0))continue;
   if(['volume','relative_and_volume'].includes(variant)&&!(volumeRatio>=1.5))continue;
   const trade=advanceTrade({...signal,symbol,firstObservedAt:new Date(b.endT).toISOString(),decisionAvailableAt:new Date(b.endT).toISOString()},bars,gaps,rules,new Date(end).toISOString());
   if(trade.status==='pending_entry')continue;
   trade.rs=rs;trade.volumeRatio=volumeRatio;trades.push(trade);
   occupied=trade.exitT?Date.parse(trade.exitT):Infinity;
  }
  results.push({timeframe,symbol,market:symbol.endsWith('.TO')?'CA':'US',variant,firstBar:new Date(bars[0].t).toISOString(),lastBar:new Date(bars.at(-1).t).toISOString(),trades});
 }
}
const summaries=[];
for(const timeframe of ['4h','daily'])for(const market of ['CA','US'])for(const variant of variants){
 const sets=results.filter(r=>r.timeframe===timeframe&&r.market===market&&r.variant===variant),trades=sets.flatMap(r=>r.trades);
 const split=timeframe==='4h'?'2026-01-01':'2023-01-01';
 summaries.push({timeframe,market,variant,symbols:sets.length,all:summarize(trades),development:summarize(trades.filter(t=>t.exitT&&t.exitT<split)),validation:summarize(trades.filter(t=>t.entryT>=split)),
 purgedBoundary:trades.filter(t=>t.entryT<split&&(!t.exitT||t.exitT>=split)).length,
 yearly:Object.fromEntries([...new Set(trades.map(t=>t.entryT.slice(0,4)))].map(y=>[y,summarize(trades.filter(t=>t.entryT.startsWith(y)))]))});
}
fs.writeFileSync(dir+'/trades.json',JSON.stringify(results));
fs.writeFileSync(dir+'/summary.json',JSON.stringify({createdAt:new Date().toISOString(),rules,variants,symbols,failures,
limitations:['Current liquid-stock sample has survivorship bias.','Raw OHLC uses provider split adjustment, dividends excluded.','Trade-level R statistics, not investable portfolio returns.','Daily version changes the bar interval; it is a separate strategy.','4h history limited by source availability.','Validation is an exploratory chronological check, not untouched future evidence.'],
sources:Object.fromEntries(Object.entries(inputs).map(([s,d])=>[s,{daily:d.daily.hash,hourly:d.hourly?.hash}])),summaries},null,2));
console.log('Completed',summaries.length,'groups',failures);
