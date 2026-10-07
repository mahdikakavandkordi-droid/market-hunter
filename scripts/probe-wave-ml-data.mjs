import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const probes=[];
for(const symbol of ['AAPL','RY.TO','BTC-USD'])for(const [range,interval] of [['5y','1d'],['60d','1h'],['2y','1h']])probes.push({symbol,range,interval});
const results=[];
for(let i=0;i<probes.length;i+=3){
 const batch=await Promise.all(probes.slice(i,i+3).map(async p=>{
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(p.symbol)}?range=${p.range}&interval=${p.interval}&includePrePost=false&events=splits`;
  try{const r=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{'User-Agent':'MarketHunterResearch/1.0'}}),body=await r.json(),c=body.chart?.result?.[0];
   return {...p,url,observedAt:new Date().toISOString(),httpStatus:r.status,error:body.chart?.error||null,rows:c?.timestamp?.length||0,first:c?.timestamp?.length?new Date(c.timestamp[0]*1000).toISOString():null,last:c?.timestamp?.length?new Date(c.timestamp.at(-1)*1000).toISOString():null,instrument:c?.meta?.symbol||null,currency:c?.meta?.currency||null,timezone:c?.meta?.exchangeTimezoneName||null};
  }catch(e){return {...p,url,observedAt:new Date().toISOString(),error:e.message,rows:0}}
 }));results.push(...batch);console.log(JSON.stringify(batch));
}
fs.writeFileSync(path.join(root,'data/research/wave-ml-v1/source-probes.json'),JSON.stringify({purpose:'transport/range capability only; not continuity or dataset acceptance',results},null,2)+'\n');
