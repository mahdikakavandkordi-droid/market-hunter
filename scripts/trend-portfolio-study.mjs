import fs from 'node:fs';
import {createHash} from 'node:crypto';
const inputDir=process.argv[2],outputDir=process.argv[3];
if(!inputDir||!outputDir)throw Error('Expected input artifact directory and output directory');
const source=JSON.parse(fs.readFileSync(inputDir+'/summary.json'));
const candidates=JSON.parse(fs.readFileSync(inputDir+'/trades.json')).filter(r=>r.timeframe==='daily'&&r.variant==='baseline_long');
const allSeries=new Map(),distributions=new Map();
const includeDividends=process.argv[4]==='dividends';
for(const symbol of [...source.symbols,'SPY','XIU.TO']){
 const raw=fs.readFileSync(inputDir+'/raw/'+symbol+'-1d.json');
 if(createHash('sha256').update(raw).digest('hex')!==source.sources[symbol].daily)throw Error('Input hash mismatch '+symbol);
 const data=JSON.parse(raw).chart.result[0];
 distributions.set(symbol,new Map(Object.values(data.events?.dividends||{}).map(d=>[new Date(d.date*1000).toISOString().slice(0,10),d.amount])));
 const q=data.indicators.quote[0],adj=data.indicators.adjclose?.[0]?.adjclose;
 allSeries.set(symbol,new Map(data.timestamp.map((t,i)=>[new Date(t*1000).toISOString().slice(0,10),{open:q.open[i],close:q.close[i],adjusted:adj?.[i]}])));
}
function simulate(market,start,capital,slippage,commission){
 const symbolBenchmark=market==='US'?'SPY':'XIU.TO',benchmark=allSeries.get(symbolBenchmark);
 const sets=candidates.filter(r=>r.market===market),symbols=sets.map(r=>r.symbol);
 const calendar=[...benchmark.keys()].filter(d=>d>=start&&d<='2026-11-09').sort();
 const opportunities=sets.flatMap(r=>r.trades).filter(t=>t.entryT.slice(0,10)>=start);
 const entryDays=new Map();
 for(const t of opportunities){const d=t.entryT.slice(0,10);if(!entryDays.has(d))entryDays.set(d,[]);entryDays.get(d).push(t)}
 let cash=capital,cost=0,dividendsReceived=0,peak=capital,maxDD=0,investedSum=0,skipped=0;
 const open=new Map(),entered=[],curve=[];
 function equity(day,key){return cash+[...open.values()].reduce((sum,p)=>{
  const bar=allSeries.get(p.symbol).get(day);
  if(!bar||!Number.isFinite(bar[key]))throw Error('Missing mark '+p.symbol+' '+day);
  return sum+p.quantity*bar[key];
 },0)}
 function sell(p,price,day,reason){
  const proceeds=p.quantity*price*(1-slippage)-commission;
  cash+=proceeds;cost+=p.quantity*price*slippage+commission;
  p.exitFill=price*(1-slippage);p.exitDate=day;p.exitReason=reason;p.pnl=proceeds-p.outlay;
  open.delete(p.symbol);
 }
 for(const day of calendar){
  if(includeDividends){
   for(const p of open.values()){
    const amount=p.quantity*(distributions.get(p.symbol).get(day)||0);
    cash+=amount;dividendsReceived+=amount;
   }
  }
  const equityAtOpen=equity(day,'open');
  for(const trade of (entryDays.get(day)||[]).sort((a,b)=>a.symbol.localeCompare(b.symbol))){
   if(open.size>=4||open.has(trade.symbol)){skipped++;continue}
   const price=trade.entry*(1+slippage),stopDistance=trade.risk;
   const existingRisk=[...open.values()].reduce((sum,p)=>sum+p.quantity*p.risk,0);
   const capacity=Math.max(0,.04*equityAtOpen-existingRisk);
   const quantity=Math.floor(Math.min(.01*equityAtOpen,capacity)/stopDistance);
   const units=Math.min(quantity,Math.floor(.25*equityAtOpen/price),Math.floor((cash-commission)/price));
   if(units<1){skipped++;continue}
   const p={symbol:trade.symbol,entryDate:day,entryFill:price,quantity:units,risk:stopDistance,
    scheduledExit:trade.exitT?.slice(0,10),exitPrice:trade.exitPriceAssumed,outlay:units*price+commission};
   cash-=p.outlay;cost+=units*trade.entry*slippage+commission;
   open.set(p.symbol,p);entered.push(p);
  }
  // Exit proceeds become available after the day's opening decisions.
  for(const p of [...open.values()])if(p.scheduledExit===day)sell(p,p.exitPrice,day,'strategy_exit');
  if(day===calendar.at(-1))for(const p of [...open.values()])sell(p,allSeries.get(p.symbol).get(day).close,day,'end_of_sample');
  const value=equity(day,'close');
  if(cash<-.000001||open.size>4||!Number.isFinite(value)||value<=0)throw Error('Invalid account state');
  peak=Math.max(peak,value);maxDD=Math.min(maxDD,value/peak-1);
  investedSum+=(value-cash)/value;curve.push({day,equity:value,cash,openCount:open.size});
 }
 const first=benchmark.get(calendar[0]),last=benchmark.get(calendar.at(-1));
 const years=(Date.parse(calendar.at(-1))-Date.parse(calendar[0]))/(365.25*86400000);
 const ending=curve.at(-1).equity;
 let bp=0,bdd=0;
 for(const d of calendar){const v=benchmark.get(d).close;bp=Math.max(bp,v);bdd=Math.min(bdd,v/bp-1)}
 return {market,start:calendar[0],end:calendar.at(-1),capital,slippagePerSide:slippage,commissionPerOrder:commission,
  endingEquity:ending,returnPct:(ending/capital-1)*100,cagrPct:(Math.pow(ending/capital,1/years)-1)*100,
  maxDrawdownPct:maxDD*100,benchmark:symbolBenchmark,benchmarkReturnPct:(last.close/first.close-1)*100,
  benchmarkCagrPct:(Math.pow(last.close/first.close,1/years)-1)*100,benchmarkDrawdownPct:bdd*100,
  benchmarkAdjustedReturnPct:(last.adjusted/first.adjusted-1)*100,
  investedPct:investedSum/calendar.length*100,entered:entered.length,skipped,cost,dividendsReceived,curve,trades:entered};
}
const runs=[];
for(const market of ['CA','US'])for(const start of ['2016-01-01','2023-01-01']){
 runs.push(simulate(market,start,10000,.0005,1));
 runs.push(simulate(market,start,10000,.001,1));
 runs.push(simulate(market,start,1000,.0005,1));
 runs.push(simulate(market,start,1000,.0005,0));
 runs.push(simulate(market,start,10000,.0005,0));
}
fs.mkdirSync(outputDir,{recursive:true});
fs.writeFileSync(outputDir+'/paths.json',JSON.stringify(runs));
fs.writeFileSync(outputDir+'/summary.json',JSON.stringify({sourceRun:42898507377,sourceArtifactSha256:'503a93be806bc9076c57c24ab5abceacacb581f16c760a447ab74c38ea4c24ad',
 assumptions:{maxPositions:4,maxAllocation:.25,targetRisk:.01,maxOpenInitialRisk:.04,wholeShares:true,dividends:includeDividends?'Cash dividends credited at ex-date for preceding-close holdings; taxes and payment delay excluded.':'Excluded from strategy and price benchmark; adjusted benchmark shown separately.',entryOrdering:'Alphabetical for simultaneous signals; exit proceeds usable from next session.',sizing:'Current opening marks, initial stop distance, no borrowing.',source:'Frozen inputs of the preceding multiyear experiment. Current surviving-symbol sample.',candidateLifecycle:'Per-symbol signal lifecycle retained even when a portfolio skips entry.',validation:'2023 onward previously inspected; exploratory portfolio check.'},
 runs:runs.map(({curve,trades,...summary})=>summary)},null,2));
console.log(JSON.stringify(runs.map(({curve,trades,...r})=>r),null,2));
