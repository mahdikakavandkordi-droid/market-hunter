import fs from 'node:fs';
import path from 'node:path';
import {UNIVERSE} from '../lib/universe.js';
import {INDEX_QUOTES,regularWindow,benchmarkOpen,fetchQuote} from '../lib/intraday.js';
const now=new Date(),bootstrap=process.env.INTRADAY_BOOTSTRAP==='true';
if(!regularWindow(now)&&!bootstrap){console.log('Market window closed; no intraday capture.');process.exit(0);}
const benchmark=await fetchQuote('^GSPTSE','TSX',now);
const open=benchmarkOpen(benchmark,now);
if(!open&&!bootstrap){console.log('No fresh open TSX session (holiday, closed or unavailable); capture skipped.');process.exit(0);}
const symbols=[...new Map([...INDEX_QUOTES,...UNIVERSE.map(x=>[x[0],x[1]])].map(x=>[x[0],x])).values()];
const quotes={'^GSPTSE':benchmark},failures=[];let next=0;
await Promise.all(Array.from({length:8},async()=>{
  while(next<symbols.length){const [symbol,name]=symbols[next++];if(symbol==='^GSPTSE')continue;
    try{quotes[symbol]=await fetchQuote(symbol,name,now);}catch(e){failures.push({symbol,reason:e.message});}
  }
}));
const stocks=UNIVERSE.filter(x=>x[2]!=='CDR').map(x=>quotes[x[0]]).filter(x=>x&&x.sessionDate===benchmark.sessionDate&&!x.stale&&Number.isFinite(x.changePct));
const up=stocks.filter(x=>x.changePct>0).length,down=stocks.filter(x=>x.changePct<0).length;
const snapshot={version:'intraday-v1',capturedAt:now.toISOString(),sessionDate:benchmark.sessionDate,marketOpen:open,
  provisional:true,quoteDelayNotice:'Vendor quotes may be delayed. Intraday observations do not change daily model scores.',
  intended:symbols.length,received:Object.keys(quotes).length,failures,quotes,
  breadth:{available:stocks.length,advancing:up,declining:down},
  commentary:stocks.length?`${up} advancing and ${down} declining among ${stocks.length} fresh covered Canadian stocks. TSX ${benchmark.changePct>=0?'up':'down'} ${Math.abs(benchmark.changePct||0).toFixed(2)}% versus previous close.`:'Fresh intraday breadth unavailable; inspect quote timestamps.'};
const file=process.env.INTRADAY_OUTPUT||'data/intraday.json';fs.mkdirSync(path.dirname(file),{recursive:true});
fs.writeFileSync(file,JSON.stringify(snapshot)+'\n');
console.log(JSON.stringify({capturedAt:snapshot.capturedAt,sessionDate:snapshot.sessionDate,marketOpen:open,intended:snapshot.intended,received:snapshot.received,failures},null,2));
