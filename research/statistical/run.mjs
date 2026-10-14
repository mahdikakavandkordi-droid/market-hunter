// Standalone research runner. Does not call Market Hunter, SMC or live portfolios.
// node research/statistical/run.mjs --asof 2026-10-13 --from 2020-01-01
// or use --csv-dir DIR (files tsx.csv, sp500.csv, etc. with Date,Close header).
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {backtest,forecast,FEATURES,HORIZONS} from './engine.mjs';

export const MARKETS=[
  {id:'tsx',ticker:'^GSPTSE',label:'S&P/TSX Composite',type:'index'},
  {id:'sp500',ticker:'^GSPC',label:'S&P 500',type:'index'},
  {id:'nasdaq100',ticker:'^NDX',label:'NASDAQ 100',type:'index'},
  {id:'dow',ticker:'^DJI',label:'Dow Jones Industrial Average',type:'index'},
  {id:'russell2000',ticker:'^RUT',label:'Russell 2000',type:'index'},
  {id:'gold',ticker:'GLD',label:'Gold ETF proxy (GLD)',type:'etf'},
  {id:'silver',ticker:'SLV',label:'Silver ETF proxy (SLV)',type:'etf'},
  {id:'btc',ticker:'BTC-USD',label:'Bitcoin / USD',type:'crypto'},
  {id:'eth',ticker:'ETH-USD',label:'Ethereum / USD',type:'crypto'}
];
const args=process.argv.slice(2);
const opt=(flag,def)=>{const i=args.indexOf(flag);return i>=0?args[i+1]:def;};
const from=opt('--from','2020-01-01');
const asof=opt('--asof',new Date(Date.now()-86400000).toISOString().slice(0,10));
const csvDir=opt('--csv-dir',null);
const output=opt('--output',path.join(path.dirname(fileURLToPath(import.meta.url)),'results.json'));
const minBars=550;

async function fetchYahoo(ticker){
  const after=new Date(asof+'T00:00:00Z');after.setUTCDate(after.getUTCDate()+1);
  const period2=Math.floor(after.getTime()/1000);
  const period1=Math.floor(new Date(from+'T00:00:00Z').getTime()/1000);
  const query='?period1='+period1+'&period2='+period2+'&interval=1d&events=history&includeAdjustedClose=true';
  const errors=[];
  for(const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']){
    const url='https://'+host+'/v8/finance/chart/'+encodeURIComponent(ticker)+query;
    try{
      const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0','accept':'application/json'},signal:AbortSignal.timeout(25000)});
      if(!r.ok)throw Error('HTTP '+r.status);
      const data=await r.json();
      if(data.chart?.error)throw Error(JSON.stringify(data.chart.error));
      const root=data.chart?.result?.[0];
      const timestamps=root?.timestamp||[];
      const raw=root?.indicators?.quote?.[0]?.close||[];
      const adj=root?.indicators?.adjclose?.[0]?.adjclose||[];
      const bars=timestamps.map((time,i)=>({date:new Date(time*1000).toISOString().slice(0,10),
        close:Number.isFinite(adj[i])?adj[i]:raw[i]}))
        .filter(x=>x.date>=from&&x.date<=asof&&Number.isFinite(x.close)&&x.close>0);
      if(bars.length<minBars)throw Error('Insufficient bars: '+bars.length);
      return {bars,source:'Yahoo Finance chart API',url};
    }catch(e){errors.push(host+': '+e.message);}
  }
  throw Error(errors.join('; '));
}

async function readCsv(id){
  const filename=path.join(csvDir,id+'.csv');
  const lines=(await readFile(filename,'utf8')).trim().split(/\r?\n/);
  const header=lines.shift().split(',').map(x=>x.trim().toLowerCase());
  const dateCol=header.indexOf('date'),closeCol=header.indexOf('close');
  if(dateCol<0||closeCol<0)throw Error('CSV requires Date,Close columns');
  const bars=lines.map(l=>{const cells=l.split(',');return {date:cells[dateCol],close:Number(cells[closeCol])};})
    .filter(x=>x.date>=from&&x.date<=asof&&Number.isFinite(x.close)&&x.close>0);
  if(bars.length<minBars)throw Error('Insufficient valid bars: '+bars.length);
  return {bars,source:'User-supplied dated CSV',url:null};
}

const run={createdAt:new Date().toISOString(),asOf:asof,from,method:{
  input:'Daily adjusted closes where provided, otherwise close',
  features:FEATURES,horizons:HORIZONS,
  models:'Ridge regression for log returns and penalized logistic regression for positive-return probability',
  modelSelection:'Fixed lambda=20, no hyperparameter tuning',
  validation:'Expanding walk-forward; 252 matured training labels; h-bar label purge; refit every 21 bars',
  baselines:'Expanding empirical up rate, expanding mean return, 20-bar momentum direction',
  calendar:'Each asset own trading calendar; crypto includes weekends',
  limitations:'Overlapping forward returns make samples dependent. Not a tradable strategy or evidence of net profitability. No costs, slippage, confidence intervals or adjusted trading returns.'
},markets:[],failures:[]};

for(const market of MARKETS){
  try{
    const {bars,source,url}=csvDir?await readCsv(market.id):await fetchYahoo(market.ticker);
    const clean=[...new Map(bars.map(v=>[v.date,v])).values()].sort((a,b)=>a.date.localeCompare(b.date));
    const metrics=backtest(clean);
    const current=HORIZONS.map(h=>forecast(clean,h));
    run.markets.push({...market,source,sourceUrl:url,barCount:clean.length,range:[clean[0].date,clean.at(-1).date],metrics,current});
    console.log(market.id+': '+clean.length+' bars, '+clean[0].date+' through '+clean.at(-1).date);
    for(const m of metrics)console.log('  '+m.horizonBars+' bars | OOS '+m.count+
      ' | Brier skill '+m.brierSkillPct.toFixed(1)+'% | ridge MSE skill '+m.mseSkillPct.toFixed(1)+'%');
  }catch(e){
    run.failures.push({market:market.id,error:e.message});
    console.error(market.id+': '+e.message);
  }
}
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(run,null,2)+'\n');
console.log('Saved '+output+': '+run.markets.length+' markets, '+run.failures.length+' failures');
if(process.env.GITHUB_STEP_SUMMARY){
  const rows=run.markets.flatMap(a=>a.metrics.map(m=>'| '+a.id+' | '+m.horizonBars+' | '+m.count+
    ' | '+m.directionAccuracy.toFixed(1)+'% | '+m.historicalPriorAccuracy.toFixed(1)+'% | '+
    m.brierSkillPct.toFixed(1)+'% | '+m.mseSkillPct.toFixed(1)+'% |'));
  const md=['# Cross-asset statistical research (no live signals)','',
    'As of '+asof,'','| Asset | H | OOS | Direction | Base direction | Brier skill | Return MSE skill |',
    '|---|---:|---:|---:|---:|---:|---:|',...rows,'',
    '**Limitations:** '+run.method.limitations,'',...run.failures.map(x=>'- FAILED '+x.market+': '+x.error)].join('\n')+'\n';
  await writeFile(process.env.GITHUB_STEP_SUMMARY,md,{flag:'a'});
}
if(run.markets.length!==MARKETS.length)process.exitCode=2;
