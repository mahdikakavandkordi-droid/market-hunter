import {buildSchedule} from './calendar.mjs';
const HOUR=3600000,DAY=24*HOUR;
const date=t=>new Date(t).toISOString().slice(0,10);
const valid=r=>[r.o,r.h,r.l,r.c].every(x=>Number.isFinite(x)&&x>0)&&r.h>=Math.max(r.o,r.l,r.c)&&r.l<=Math.min(r.o,r.h,r.c);
function bar(rows,{t,endT,date,segment}){
 const hasVolume=rows.every(r=>Number.isFinite(r.v)&&r.v>=0);
 return {t,endT,date,o:rows[0].o,h:Math.max(...rows.map(r=>r.h)),l:Math.min(...rows.map(r=>r.l)),c:rows.at(-1).c,v:hasVolume?rows.reduce((n,r)=>n+r.v,0):null,sourceCount:rows.length,...(segment===undefined?{}:{segment})};
}
export function buildSingleHourly({symbol,market,hourly,splits=[],calendar,startDate,asOf}){
 if(!['us','ca','crypto'].includes(market)||!Number.isFinite(asOf))throw Error('invalid_pilot_configuration');
 const start=Date.parse(startDate+'T00:00:00Z');if(!Number.isFinite(start)||start>=asOf)throw Error('invalid_pilot_range');
 const map=new Map(),invalidTimes=[];
 for(const r of hourly){
  if(!Number.isFinite(r.t))throw Error('invalid_hourly_timestamp');
  if(r.t<start||r.t+HOUR>asOf)continue;
  if(map.has(r.t))throw Error('duplicate_hourly_timestamp');
  map.set(r.t,valid(r)?r:null);if(!valid(r))invalidTimes.push(r.t);
 }
 let days=[];
 if(market==='crypto'){
  for(let t=start;t<asOf;t+=DAY)days.push({date:date(t),t,endT:t+DAY,groups:Array.from({length:6},(_,segment)=>({t:t+segment*4*HOUR,endT:t+(segment+1)*4*HOUR,segment,times:Array.from({length:4},(_,j)=>t+(segment*4+j)*HOUR)}))});
 }else{
  const schedule=buildSchedule(market,calendar);if(start<schedule.coverageStart||asOf>schedule.coverageEnd)throw Error('calendar_outside_verified_range');
  const grouped=new Map();for(const slot of schedule.slots){if(slot.t<start||slot.t>=asOf)continue;if(!grouped.has(slot.date))grouped.set(slot.date,{date:slot.date,t:slot.t,endT:slot.qualityAvailableAt,groups:[]});grouped.get(slot.date).groups.push({...slot,times:Array.from({length:slot.sourceCount},(_,i)=>slot.t+i*HOUR)});}days=[...grouped.values()];
 }
 const expected=new Set(days.flatMap(d=>d.groups.flatMap(g=>g.times))),offScheduleTimes=[...map.keys()].filter(t=>!expected.has(t)),daily=[],executionBars=[],incompleteDays=[],dailyGapBeforeTimes=[],executionGapBeforeTimes=[];
 let missingDaily=false,missingExecution=false,lastDailyDate=null;
 for(const d of days){
  for(const g of d.groups){if(g.endT>asOf)continue;const hs=g.times.map(t=>map.get(t));if(hs.some(r=>!r)){missingExecution=true;continue;}const b=bar(hs,{...g,date:d.date});if(missingExecution&&executionBars.length)executionGapBeforeTimes.push(b.t);executionBars.push(b);missingExecution=false;}
  if(d.endT>asOf)continue;
  const times=d.groups.flatMap(g=>g.times),missing=times.filter(t=>!map.get(t));
  if(missing.length){incompleteDays.push({date:d.date,missingOrInvalidHours:missing.map(t=>new Date(t).toISOString())});missingDaily=true;continue;}
  const b=bar(times.map(t=>map.get(t)),d),splitSincePrior=lastDailyDate!==null&&splits.some(s=>s.date>lastDailyDate&&s.date<=d.date);
  if(daily.length&&(missingDaily||splitSincePrior))dailyGapBeforeTimes.push(b.t);
  daily.push(b);lastDailyDate=d.date;missingDaily=false;
 }
 return {version:'wave-ml-single-hourly-snapshot-1',symbol,market,mode:market==='crypto'?'crypto':'stock',asOf:new Date(asOf).toISOString(),daily,dailyGapBeforeTimes,executionBars,executionGapBeforeTimes,
  quality:{expectedCompletedDays:days.filter(d=>d.endT<=asOf).length,completeDays:daily.length,incompleteDays,invalidTimes,offScheduleTimes,splits,priceAuthority:'unverified; cross-timeframe equality is constructed, not independent source validation',volumeSemantics:'sum of finite nonnegative hourly values; additive provider semantics not independently verified'}};
}
