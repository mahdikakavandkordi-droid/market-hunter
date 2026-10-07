import {completedDailyRows} from './completed-daily-session.js';
const TIMEOUT=Number(process.env.MH_FORWARD_FETCH_TIMEOUT_MS||12000);
export async function fetchChart(symbol){
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
