// Independent phase-2 experiment, no production use.
// node research/statistical/run-phase2.mjs --asof 2026-10-13
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {volatilityBacktest,regimeRows,macroBacktest,MACRO_FEATURES} from './phase2.mjs';
const markets=[
 ['tsx','^GSPTSE'],['sp500','^GSPC'],['nasdaq100','^NDX'],
 ['dow','^DJI'],['russell2000','^RUT'],['gold','GLD'],
 ['silver','SLV'],['btc','BTC-USD'],['eth','ETH-USD']
];
const contexts=[
 ['vix',['^VIX']],['us10y',['^TNX']],
 ['dxy',['DX-Y.NYB','UUP']],['oil',['CL=F','USO']]
];
const args=process.argv.slice(2);
const opt=(key,defaultValue)=>{const i=args.indexOf(key);return i<0?defaultValue:args[i+1];};
const from=opt('--from','2020-01-01'),asof=opt('--asof','2026-10-13');
const output=opt('--output',path.join(path.dirname(fileURLToPath(import.meta.url)),'phase2-results.json'));
const end=new Date(asof+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+1);
const p1=Math.floor(new Date(from+'T00:00:00Z').getTime()/1000);
const p2=Math.floor(end.getTime()/1000);
async function fetchBars(symbol){
 const errors=[];
 for(const hostname of ['query1.finance.yahoo.com','query2.finance.yahoo.com']){
  const url='https://'+hostname+'/v8/finance/chart/'+encodeURIComponent(symbol)+
    '?period1='+p1+'&period2='+p2+'&interval=1d&events=history&includeAdjustedClose=true';
  try{
   const response=await fetch(url,{headers:{'user-agent':'Mozilla/5.0','accept':'application/json'},signal:AbortSignal.timeout(25000)});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   if(data.chart?.error)throw Error(JSON.stringify(data.chart.error));
   const root=data.chart?.result?.[0];
   if(!root?.timestamp)throw Error('Missing dated bars');
   const original=root.indicators?.quote?.[0]?.close||[];
   const adjusted=root.indicators?.adjclose?.[0]?.adjclose||[];
   const bars=root.timestamp.map((v,i)=>({date:new Date(v*1000).toISOString().slice(0,10),
      close:Number.isFinite(adjusted[i])?adjusted[i]:original[i]}))
      .filter(v=>v.date>=from&&v.date<=asof&&Number.isFinite(v.close)&&v.close>0);
   const sorted=[...new Map(bars.map(v=>[v.date,v])).values()].sort((a,b)=>a.date.localeCompare(b.date));
   if(sorted.length<500)throw Error('Not enough valid bars: '+sorted.length);
   return sorted;
  }catch(e){errors.push(hostname+': '+e.message);}
 }
 throw Error(errors.join(' | '));
}
const report={
 generated:new Date().toISOString(),asOf:asof,source:'Yahoo Finance chart daily close (adjusted for ETF if available)',
 classification:'EXPLORATORY only: previously examined history is reused; NO unbiased fresh holdout',
 models:{
 volatility:'Daily-close HAR-style log realized-volatility ridge; no intraday realized-vol data',
 regime:'Close>SMA200 and 20-bar volatility above trailing median of 252 observed values',
 macro:'Lagged previous-calendar-day-only VIX, US10Y, DXY/UUP, oil/USO, SPX',
 features:MACRO_FEATURES,
 fairness:'Macro and own-price logistic/regression model on exact same available sample dates, expanding walk-forward, 252 matured observations, refit 21 bars',
 horizon:'5,10,20 native daily bars; indices use trading days; crypto includes weekends',
 caveat:'Overlapping labels, no execution or trading costs; avoid treating small historical gains as validated alpha'
 },markets:[],contexts:{},errors:[]
};
const loaded={};
for(const [id,ticker] of markets){
 try{
  const bars=await fetchBars(ticker);
  loaded[id]=bars;
  const vol=volatilityBacktest(bars);
  const regimes=regimeRows(bars);
  report.markets.push({id,ticker,barCount:bars.length,range:[bars[0].date,bars.at(-1).date],
    volatility:vol,regimes,macro:[]});
  console.log('VOL '+id+' '+bars.length+' bars; '+vol.map(v=>'h='+v.horizonBars+
    ' skill-vs-persistence='+v.skillVsPersistencePct.toFixed(2)+'%').join(', '));
 }catch(e){report.errors.push({id,error:e.message});console.error('DATA ERROR '+id+': '+e.message);}
}
for(const [id,choices] of contexts){
 let error;
 for(const symbol of choices){
  try{
   const bars=await fetchBars(symbol);
   report.contexts[id]={symbol,barCount:bars.length,range:[bars[0].date,bars.at(-1).date]};
   loaded['context:'+id]=bars;
   console.log('MACRO SOURCE '+id+' '+symbol+' '+bars.length);
   break;
  }catch(e){error=e.message;}
 }
 if(!loaded['context:'+id])report.errors.push({id:'macro:'+id,error});
}
if(loaded.sp500)loaded['context:spx']=loaded.sp500;
const c={vix:loaded['context:vix'],us10y:loaded['context:us10y'],
 dxy:loaded['context:dxy'],oil:loaded['context:oil'],spx:loaded['context:spx']};
if(Object.values(c).every(Boolean)){
 for(const entry of report.markets){
  try{
   entry.macro=macroBacktest(loaded[entry.id],c);
   console.log('MACRO '+entry.id+' '+entry.macro.map(v=>'h='+v.horizonBars+
      ' gain-vs-price-brier='+v.macroBrierSkillVsPricePct.toFixed(2)+'%').join(', '));
  }catch(e){report.errors.push({id:'macro:'+entry.id,error:e.message});}
 }
}else console.error('Macro source incomplete: all macro-vs-price comparisons skipped');
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log('Saved report to '+output+'; markets='+report.markets.length+' errors='+report.errors.length);
if(process.env.GITHUB_STEP_SUMMARY){
 const rows=report.markets.map(m=>{
  const v=m.volatility.find(a=>a.horizonBars===20),a=m.macro.find(a=>a.horizonBars===20);
  return '| '+m.id+' | '+(v?.skillVsPersistencePct.toFixed(1)??'NA')+
     '% | '+(v?.skillVsMeanPct.toFixed(1)??'NA')+'% | '+
     (a?.macroBrierSkillVsPricePct.toFixed(1)??'NA')+'% | '+
     (a?.macroBrierSkillVsPriorPct.toFixed(1)??'NA')+'% |';
 });
 const summary=['# Exploratory phase-2 research, as-of '+asof,'',
   '**Note: historical data has already been inspected, so these are NOT independent holdout results.**','',
   '| Market | HAR MSE skill vs vol20 | vs historic vol mean | Macro Brier skill vs price-only | vs historical prior |',
   '|---|---:|---:|---:|---:|',...rows,'',
   'Sources: '+JSON.stringify(report.contexts),'',
   ...report.errors.map(x=>'- ERROR '+x.id+': '+x.error)].join('\n')+'\n';
 await writeFile(process.env.GITHUB_STEP_SUMMARY,summary,{flag:'a'});
}
if(report.markets.length!==markets.length)process.exitCode=2;
