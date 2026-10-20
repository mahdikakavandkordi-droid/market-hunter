// Read-only provider diagnostics. No files, quotes or portfolios are modified.
const end=Math.floor(Date.now()/1000),start=end-730*86400,deadline=Date.now()+30000;
const variants={
  range2y:'range=2y',range1y:'range=1y',range5d:'range=5d',
  explicit2y:`period1=${start}&period2=${end}`
};
for(const symbol of ['AAPL','NVDA','MSFT','^GSPC']){
  for(const [variant,period] of Object.entries(variants)){
    if(Date.now()>=deadline)break;
    try{
      const response=await fetch('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?'+period+'&interval=1d&includePrePost=false&events=div%2Csplits',{
        signal:AbortSignal.timeout(Math.max(1,Math.min(10000,deadline-Date.now()))),headers:{'User-Agent':'Mozilla/5.0 MarketHunterSourceDiagnostic/1.0'}
      });
      if(!response.ok){console.log(JSON.stringify({symbol,variant,status:response.status}));continue}
      const z=(await response.json())?.chart?.result?.[0],q=z?.indicators?.quote?.[0]||{},a=z?.indicators?.adjclose?.[0]?.adjclose||[];
      console.log(JSON.stringify({symbol,variant,currency:z?.meta?.currency,regularMarketTime:z?.meta?.regularMarketTime,regularMarketPrice:z?.meta?.regularMarketPrice,
        sessionMetadata:variant==='range2y'?z?.meta:null,
        rows:(z?.timestamp||[]).slice(-3).map((t,i)=>{const n=z.timestamp.length-3+i;return {date:new Date(t*1000).toISOString().slice(0,10),close:q.close?.[n]??null,adjclose:a[n]??null,volume:q.volume?.[n]??null}})}));
    }catch(e){console.log(JSON.stringify({symbol,variant,error:e.message}))}
  }
}
