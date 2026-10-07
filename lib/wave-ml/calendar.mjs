import {zonedParts} from './research-bars.mjs';
import {digest} from './features.mjs';
const DAY=86400000,HOUR=3600000;
export function easternTime(date,hour,minute=0) {
  const guess=Date.parse(date+'T12:00:00Z'),p=zonedParts(guess);
  return guess+(hour*60+minute-p.hour*60-p.minute)*60000;
}
export function buildSchedule(market,calendar) {
  const m=calendar.markets[market];if(!m||!calendar.sources?.length)throw Error('calendar_market_missing');
  const start=Date.parse(calendar.coverageStart+'T00:00:00Z'),end=Date.parse(calendar.coverageEndExclusive+'T00:00:00Z');
  const closed=new Set(m.closed),early=new Set(m.early13),slots=[];
  for(const d of [...closed,...early])if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||closed.has(d)&&early.has(d))throw Error('invalid_calendar_dates');
  for(let t=start;t<end;t+=DAY){const date=new Date(t).toISOString().slice(0,10),weekday=new Date(t).getUTCDay();if([0,6].includes(weekday)||closed.has(date))continue;
    const open=easternTime(date,9,30),close=easternTime(date,early.has(date)?13:16),qualityAvailableAt=easternTime(date,17);
    slots.push({t:open,endT:open+4*HOUR,date,segment:0,sourceCount:4,regularClose:close,qualityAvailableAt,earlyClose:early.has(date)});
    if(!early.has(date))slots.push({t:open+4*HOUR,endT:open+7*HOUR,date,segment:1,sourceCount:3,regularClose:close,qualityAvailableAt,earlyClose:false});
  }
  return {verified:true,provenance:digest(calendar),calendarVersion:calendar.version,market,coverageStart:start,coverageEnd:end,slots};
}
export function acceptExecution(snapshot,schedule) {
  if(snapshot.mode!=='stock'||snapshot.market!==schedule.market||!schedule.verified)throw Error('execution_schedule_mismatch');
  const expected=new Map(schedule.slots.map(s=>[s.t,s])),bars=snapshot.executionBars.filter(b=>expected.has(b.t));
  const byDate=new Map();for(const s of schedule.slots){if(!byDate.has(s.date))byDate.set(s.date,[]);byDate.get(s.date).push(s);}
  const actual=new Map(bars.map(b=>[b.t,b])),daily=new Map(snapshot.daily.map(b=>[b.date,b]));
  const mismatches=new Set(snapshot.quality.priceMismatchDates),unverified=new Set(),gapBefore=[];
  for(const [date,slots] of byDate){const d=daily.get(date),xs=slots.map(s=>actual.get(s.t));
    if(!d||xs.some((b,i)=>!b||b.endT!==slots[i].endT||b.sourceCount!==slots[i].sourceCount)){unverified.add(date);continue;}
    if(Math.abs(xs[0].o-d.o)/d.o>.005||Math.abs(xs.at(-1).c-d.c)/d.c>.005)mismatches.add(date);
  }
  for(let i=1;i<bars.length;i++){const previous=expected.get(bars[i-1].t),at=schedule.slots.indexOf(previous);if(schedule.slots[at+1]?.t!==bars[i].t)gapBefore.push(bars[i].t);}
  return {...snapshot,version:'wave-ml-calendar-accepted-execution-v2',executionBars:bars,executionGapBeforeTimes:gapBefore,
    quality:{...snapshot.quality,executionCalendarApproval:'official_calendar_v1',calendarProvenance:schedule.provenance,priceMismatchDates:[...mismatches].sort(),executionUnverifiedDates:[...unverified].sort(),outOfCalendarExecutionBars:snapshot.executionBars.filter(b=>!expected.has(b.t)&&b.t>=schedule.coverageStart).map(b=>b.t)},
    audit:{originalSnapshotHash:digest(snapshot),calendarHash:schedule.provenance,pricesChanged:false,dailyFeaturesChanged:false}};
}
