import {createHash} from 'node:crypto';

export const MARKETS = [
 ['tsx','^GSPTSE','index'],['sp500','^GSPC','index'],['nasdaq100','^NDX','index'],
 ['dow','^DJI','index'],['russell2000','^RUT','index'],['gold','GLD','etf'],
 ['silver','SLV','etf'],['btc','BTC-USD','crypto'],['eth','ETH-USD','crypto']
].map(([id,symbol,type])=>({id,symbol,type,priceField:type==='etf'?'adjusted':'close'}));
// Fixed semantic repair: positive-price oil ETF, NOT a continuous futures return.
// Never silently substitute symbols. Revised macro results are a separate experiment.
export const CONTEXTS=[
 {id:'vix',symbol:'^VIX',type:'index',priceField:'close'},
 {id:'us10y',symbol:'^TNX',type:'index',priceField:'close'},
 {id:'dxy',symbol:'DX-Y.NYB',type:'index',priceField:'close'},
 {id:'oil',symbol:'USO',type:'etf',priceField:'adjusted'}
];
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function usHoliday(date){
 const year=Number(date.slice(0,4)),iso=d=>d.toISOString().slice(0,10);
 const nth=(month,day,n)=>{const d=new Date(Date.UTC(year,month-1,1));d.setUTCDate(1+(day-d.getUTCDay()+7)%7+7*(n-1));return iso(d);};
 const last=(month,day)=>{const d=new Date(Date.UTC(year,month,0));d.setUTCDate(d.getUTCDate()-(d.getUTCDay()-day+7)%7);return iso(d);};
 const observed=(month,day)=>{const d=new Date(Date.UTC(year,month-1,day));if(d.getUTCDay()===6)d.setUTCDate(day-1);if(d.getUTCDay()===0)d.setUTCDate(day+1);return iso(d);};
 // Gregorian Easter (Meeus/Jones/Butcher); NYSE Good Friday is two days earlier.
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;
 const friday=new Date(Date.UTC(year,month-1,day-2));
 const newyear=new Date(Date.UTC(year,0,1));if(newyear.getUTCDay()===0)newyear.setUTCDate(2);
 const holidays=[iso(newyear),nth(1,1,3),nth(2,1,3),iso(friday),last(5,1),observed(7,4),nth(9,1,1),nth(11,4,4),observed(12,25)];
 if(year>=2022)holidays.push(observed(6,19));
 // Historical special closures, declared before the pre-2020 replication.
 if(year===2007)holidays.push('2007-01-02');
 if(year===2012)holidays.push('2012-10-29','2012-10-30');
 if(year===2018)holidays.push('2018-12-05');
 if(year===2025)holidays.push('2025-01-09');
 return holidays.includes(date);
}
function canadianHoliday(date){
 const year=Number(date.slice(0,4)),iso=d=>d.toISOString().slice(0,10);
 const nth=(month,day,n)=>{const d=new Date(Date.UTC(year,month-1,1));d.setUTCDate(1+(day-d.getUTCDay()+7)%7+7*(n-1));return iso(d);};
 const followingMonday=(month,day)=>{const d=new Date(Date.UTC(year,month-1,day));while(d.getUTCDay()===0||d.getUTCDay()===6)d.setUTCDate(d.getUTCDate()+1);return iso(d);};
 const victoria=new Date(Date.UTC(year,4,24));victoria.setUTCDate(24-(victoria.getUTCDay()+6)%7);
 const christmas=new Date(Date.UTC(year,11,25)),wd=christmas.getUTCDay();
 const christmasDates=wd===6?[27,28]:wd===0?[26,27]:wd===5?[25,28]:[25,26];
 return [followingMonday(1,1),...(year>=2008?[nth(2,1,3)]:[]),iso(victoria),followingMonday(7,1),nth(8,1,1),nth(9,1,1),nth(10,1,2),...christmasDates.map(d=>iso(new Date(Date.UTC(year,11,d))))].includes(date)
  ||(['03','04'].includes(date.slice(5,7))&&usHoliday(date));
}
export const marketHoliday=(date,spec)=>spec.id==='tsx'?canadianHoliday(date):usHoliday(date);
export function validateBars(bars,{allowSigned=false}={}){
 if(!Array.isArray(bars)||!bars.length)throw Error('Empty bars');
 for(let i=0;i<bars.length;i++){
  const b=bars[i];
  if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||new Date(b.date+'T00:00:00Z').toISOString().slice(0,10)!==b.date)throw Error('Invalid date');
  if(!Number.isFinite(b.close)||(!allowSigned&&b.close<=0))throw Error('Invalid price at '+b.date);
  if(i&&bars[i-1].date>=b.date)throw Error('Duplicate or unordered date '+b.date);
 }
 return bars;
}
function localParts(epoch,zone){
 return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(epoch)).map(p=>[p.type,p.value]));
}
function equityClose(date,zone,time='16:00'){
 // Derive UTC offset on the session date; North American DST is handled by Intl.
 const noon=Date.parse(date+'T12:00:00Z'),p=localParts(noon,zone);
 const offset=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`)-noon;
 return Date.parse(date+'T'+time+':00Z')-offset;
}
export function normalizeYahoo(raw,spec,{from,asof,retrievedAt}={}){
 const data=typeof raw==='string'?JSON.parse(raw):raw;
 if(data.chart?.error)throw Error('Provider error '+JSON.stringify(data.chart.error));
 const root=data.chart?.result?.[0];
 if(!root?.timestamp||!root.meta)throw Error('Missing chart timestamps/metadata');
 const timestamps=root.timestamp,quotes=root.indicators?.quote?.[0]?.close??[],adjusted=root.indicators?.adjclose?.[0]?.adjclose??[];
 const zone=spec.type==='crypto'?'UTC':root.meta.exchangeTimezoneName;
 if(!zone)throw Error('Missing exchange timezone');
 if(spec.type!=='crypto'&&!['America/New_York','America/Toronto','America/Chicago'].includes(zone))throw Error('Unsupported session timezone '+zone);
 const available=Date.parse(retrievedAt);
 if(!Number.isFinite(available))throw Error('Invalid retrieval time');
 const bars=[],rejected=[],warnings=[];
 for(let i=0;i<timestamps.length;i++){
  const start=timestamps[i]*1000,p=localParts(start,zone);
  const date=`${p.year}-${p.month}-${p.day}`;
  if(date<from||date>asof)continue;
  // DXY is a nearly 24-hour index; do not label its daily close as 16:00 ET.
  // VIX gets a conservative 16:15 exchange-local completion rule.
  const closeTime=spec.id==='dxy'?'23:59':spec.id==='vix'?'16:15':'16:00';
  const sessionEnd=spec.type==='crypto'?Date.parse(date+'T00:00:00Z')+86400000:equityClose(date,zone,closeTime);
  const availableAt=sessionEnd+(spec.type==='crypto'?10:30)*60000;
  if(availableAt>available){rejected.push({date,reason:'unfinished-or-publication-buffer',sessionEnd:new Date(sessionEnd).toISOString()});continue;}
  const close=spec.priceField==='adjusted'?adjusted[i]:quotes[i];
  const quote=root.indicators?.quote?.[0]??{};
  const empty=['open','high','low','close','volume'].every(k=>quote[k]?.[i]==null);
  const wd=new Date(date+'T00:00:00Z').getUTCDay();
  const knownClosed=spec.type!=='crypto'&&((wd===0||wd===6)||marketHoliday(date,spec));
  if(empty&&knownClosed){rejected.push({date,reason:wd===0||wd===6?'empty-weekend-placeholder':spec.id==='tsx'?'empty-Canadian-exchange-holiday-placeholder':'empty-US-exchange-holiday-placeholder'});continue;}
  // Invalid expected observations FAIL; do not compact signed/missing prices away.
  if(!Number.isFinite(close)||close<=0)throw Error(`Invalid ${spec.priceField} price ${spec.symbol} ${date}: ${close}`);
  bars.push({date,close,rawClose:quotes[i],adjustedClose:Number.isFinite(adjusted[i])?adjusted[i]:null,sourceTimestamp:new Date(start).toISOString(),sessionEnd:new Date(sessionEnd).toISOString(),availableAt:new Date(availableAt).toISOString()});
 }
 validateBars(bars);
 for(let i=0;i<bars.length;i++){
  const weekday=new Date(bars[i].date+'T00:00:00Z').getUTCDay();
  if(spec.type!=='crypto'&&(weekday===0||weekday===6))throw Error('Unexpected weekend '+spec.symbol+' '+bars[i].date);
  if(i){const gap=(Date.parse(bars[i].date)-Date.parse(bars[i-1].date))/86400000;
   if(spec.type==='crypto'&&gap!==1)throw Error('Missing crypto daily session '+bars[i].date);
   if(spec.type!=='crypto'){
    if(gap>4)warnings.push({date:bars[i].date,previous:bars[i-1].date,gapDays:gap,reason:'verify-long-calendar-gap'});
    for(let day=1;day<gap;day++){
     const absent=new Date(Date.parse(bars[i-1].date)+day*86400000),wd=absent.getUTCDay(),date=absent.toISOString().slice(0,10);
     if(wd===0||wd===6||marketHoliday(date,spec))continue;
     throw Error('Unexplained missing weekday '+spec.symbol+' '+date);
    }
   }
  }
 }
 return {spec,timezone:zone,bars,rejected,warnings,adjustmentPolicy:spec.priceField,calendar:'native observed sessions; known US/Canadian holiday and weekend placeholders logged; unexplained weekday gaps fail; no imputation',sessionPolicy:'crypto UTC midnight+10m; DXY 23:59 local+30m; VIX 16:15 local+30m; other declared North American regular session close+30m'};
}
export async function fetchYahoo(spec,{from,asof,fetcher=fetch}={}){
 const period1=Date.parse(from+'T00:00:00Z')/1000,period2=Date.parse(asof+'T00:00:00Z')/1000+86400;
 const failures=[];
 for(const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']){
  const url=`https://${host}/v8/finance/chart/${encodeURIComponent(spec.symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;
  let raw=null,retrievedAt=null;
  try{
   const response=await fetcher(url,{headers:{'user-agent':'Mozilla/5.0','accept':'application/json'},signal:AbortSignal.timeout(25000)});
   if(!response.ok)throw Error('HTTP '+response.status);
   raw=await response.text();retrievedAt=new Date().toISOString();
   const normalized=normalizeYahoo(raw,spec,{from,asof,retrievedAt});
   if(normalized.bars.length<550)throw Error('Insufficient history');
   return {...normalized,raw,url,retrievedAt,rawSha256:hash(raw)};
  }catch(e){failures.push({host,error:e.message,url,raw,retrievedAt});}
 }
 const error=Error(JSON.stringify(failures.map(({host,error})=>({host,error}))));error.attempts=failures;throw error;
}
