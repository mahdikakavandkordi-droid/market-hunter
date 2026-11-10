import fs from 'node:fs';
import {createHash} from 'node:crypto';
const [inputDir,portfolioDir,outputDir]=process.argv.slice(2);
if(!inputDir||!portfolioDir||!outputDir)throw Error('Expected frozen source, portfolio output and comparison output directories');
const source=JSON.parse(fs.readFileSync(inputDir+'/summary.json'));
const portfolioAssumptions=JSON.parse(fs.readFileSync(portfolioDir+'/summary.json')).assumptions;
const accounts=JSON.parse(fs.readFileSync(portfolioDir+'/paths.json'));
const results=[];
function metrics(curve,capital){
 let peak=capital,drawdown=0;
 const returns=[];
 for(let i=0;i<curve.length;i++){
  const value=curve[i].equity;
  if(!Number.isFinite(value)||value<=0)throw Error('Invalid benchmark equity');
  peak=Math.max(peak,value);drawdown=Math.min(drawdown,value/peak-1);
  if(i)returns.push(value/curve[i-1].equity-1);
 }
 const years=(Date.parse(curve.at(-1).day)-Date.parse(curve[0].day))/(365.25*86400000);
 const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
 const variance=returns.reduce((sum,r)=>sum+(r-mean)**2,0)/(returns.length-1);
 return {endingEquity:curve.at(-1).equity,returnPct:(curve.at(-1).equity/capital-1)*100,
  cagrPct:((curve.at(-1).equity/capital)**(1/years)-1)*100,
  maxDrawdownPct:drawdown*100,annualVolatilityPct:Math.sqrt(variance*252)*100};
}
for(const account of accounts.filter(a=>a.capital===10000&&a.slippagePerSide===.0005)){
 const symbol=account.benchmark,raw=fs.readFileSync(inputDir+'/raw/'+symbol+'-1d.json');
 if(createHash('sha256').update(raw).digest('hex')!==source.sources[symbol].daily)throw Error('Benchmark hash mismatch');
 const data=JSON.parse(raw).chart.result[0],close=data.indicators.quote[0].close,adjusted=data.indicators.adjclose[0].adjclose;
 const prices=new Map(data.timestamp.map((t,i)=>[new Date(t*1000).toISOString().slice(0,10),{close:close[i],adjusted:adjusted[i]}]));
 const exposure=account.curve.map(p=>(p.equity-p.cash)/p.equity);
 if(exposure.some(w=>w<-.000001||w>1.000001))throw Error('Exposure outside funded bounds');
 const weight=exposure.slice(0,-1).reduce((a,b)=>a+b,0)/(exposure.length-1);
 const references=[];
 for(const basis of ['close','adjusted']){
  for(const type of ['fixed_half','matched_average','lagged_strategy_exposure']){
   let equity=account.capital;
   const curve=[{day:account.curve[0].day,equity}];
   for(let i=1;i<account.curve.length;i++){
    const previous=prices.get(account.curve[i-1].day)?.[basis],current=prices.get(account.curve[i].day)?.[basis];
    if(!(previous>0&&current>0))throw Error('Missing benchmark bar');
    const w=type==='fixed_half'?.5:type==='matched_average'?weight:exposure[i-1];
    equity*=1+w*(current/previous-1);
    curve.push({day:account.curve[i].day,equity});
   }
   const years={};
   for(const year of [...new Set(curve.map(p=>p.day.slice(0,4)))]){
    const ids=curve.map((p,i)=>p.day.startsWith(year)?i:-1).filter(i=>i>=0);
    const before=Math.max(0,ids[0]-1),last=ids.at(-1);
    const strategyReturn=account.curve[last].equity/account.curve[before].equity-1;
    const referenceReturn=curve[last].equity/curve[before].equity-1;
    years[year]={strategyReturnPct:strategyReturn*100,referenceReturnPct:referenceReturn*100,
     differencePp:(strategyReturn-referenceReturn)*100};
   }
   references.push({type,basis,weight:type==='fixed_half'?.5:type==='matched_average'?weight:null,
    metrics:metrics(curve,account.capital),years});
  }
 }
 const strategy=metrics(account.curve,account.capital);
 results.push({market:account.market,start:account.start,end:account.end,capital:account.capital,
  commissionPerOrder:account.commissionPerOrder,slippagePerSide:account.slippagePerSide,
  averageExposurePct:weight*100,strategy,references});
}
const output={createdAt:new Date().toISOString(),sourceRun:42898507377,assumptions:{
 capital:10000,cashInterest:0,referenceFees:0,
 strategyDividends:portfolioAssumptions.dividends,
 priceBasis:'Close is ETF price return; adjusted is ETF return including reinvested distributions. Select the basis consistent with the strategy dividend scenario.',
 fixedHalf:'50% ETF and 50% cash, rebalanced at every close. A fixed allocation chosen before examining results.',
 matchedAverage:'Constant ETF weight equal to strategy mean invested fraction over the matching return intervals. Retrospective exposure diagnostic.',
 laggedExposure:'ETF return during each close-to-close interval multiplied by strategy invested fraction at the preceding close. Retrospective strategy-dependent timing diagnostic.',
 referenceCosts:'ETF rebalancing costs excluded, making these optimistic reference returns. Strategy retains actual modeled fees and slippage.',
 limitations:['Surviving liquid-stock sample.','Dividend scenario credits stock distributions on ex-date rather than payment date.','2023 onward already inspected.','Mean exposure does not equal matched volatility or matched factor exposure.','Lagged exposure uses preceding-close holdings; portfolio may trade at next open.']
},results};
fs.mkdirSync(outputDir,{recursive:true});
fs.writeFileSync(outputDir+'/summary.json',JSON.stringify(output,null,2));
console.log(JSON.stringify(results.map(r=>({market:r.market,start:r.start,commission:r.commissionPerOrder,
 exposure:r.averageExposurePct,strategy:r.strategy,references:r.references.filter(b=>b.basis==='close').map(b=>({type:b.type,...b.metrics}))})),null,2));
