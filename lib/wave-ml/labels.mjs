// Outcome-only machinery. Never import this module from the feature builder.
const HOUR=3600000,DAY=24*HOUR,FOUR=4*HOUR;
const iso=t=>new Date(t).toISOString();
export function assertDevelopment(row,contract) {
  const t=Date.parse(row.availableAt);
  if(!Number.isFinite(t)||t>=Date.parse(contract.split.finalTestStart)||contract.split.holdoutSymbols.includes(row.symbol)||!['train','validation'].includes(row.partition))throw Error('sealed_or_nondevelopment_label');
}
function validateBar(b,mode) {
  return [b.t,b.endT,b.o,b.h,b.l,b.c].every(Number.isFinite)&&b.endT>b.t&&Math.min(b.o,b.h,b.l,b.c)>0&&b.h>=Math.max(b.o,b.c,b.l)&&b.l<=Math.min(b.o,b.c,b.h)&&(mode!=='crypto'||(b.t%FOUR===0&&b.endT===b.t+FOUR&&b.sourceCount===4));
}
export function labelDecision(row,snapshot,contract,{asOf=Date.parse(snapshot.asOf),schedule=null}={}) {
  assertDevelopment(row,contract);
  if(row.symbol!==snapshot.symbol||row.market!==snapshot.market||![1,-1].includes(row.dir)||(!Number.isFinite(row.decisionATR14)||!(row.decisionATR14>0))||!Number.isFinite(asOf)||asOf>Date.parse(snapshot.asOf))throw Error('invalid_label_input');
  const p=contract.executionLabel,available=Date.parse(row.availableAt),mode=snapshot.mode;
  if(asOf<available)throw Error('decision_not_yet_available');
  if(available!==Date.parse(row.decisionCompletedAt)+contract.sample.historicalAvailabilityDelayMinutes*60000)throw Error('invalid_availability');
  const deadline=available+p.entryHours[mode]*HOUR,wallEnd=available+p.maxLabelWallDaysIncludingEntry*DAY;
  const base={id:row.id,symbol:row.symbol,market:row.market,dir:row.dir,availableAt:row.availableAt,partition:row.partition,status:'unresolved',class:null,grossR:null,netR:null,informationStart:row.availableAt,informationEnd:null};
  const unresolved=(reason,end=asOf)=>({...base,reason,informationEnd:iso(Math.max(available,Math.min(end,asOf)))});
  if(mode==='stock'&&(!schedule?.verified||!schedule.provenance||!Array.isArray(schedule.slots)))return unresolved('stock_calendar_unverified');
  if(mode!=='crypto'&&mode!=='stock')throw Error('invalid_execution_mode');
  let slots;
  if(mode==='crypto') {const first=Math.ceil(available/FOUR)*FOUR;slots=Array.from({length:p.maxHeldResearchBars},(_,i)=>({t:first+i*FOUR,endT:first+(i+1)*FOUR,date:iso(first+i*FOUR).slice(0,10)}));}
  else {
    if(schedule.coverageStart>available||schedule.coverageEnd<Math.min(wallEnd,asOf))return unresolved('schedule_coverage_missing');
    for(let i=0;i<schedule.slots.length;i++){const s=schedule.slots[i];if(!Number.isFinite(s.t)||!Number.isFinite(s.endT)||s.endT<=s.t||(i&&s.t<schedule.slots[i-1].endT))throw Error('invalid_schedule');}
    slots=schedule.slots.filter(s=>s.t>=available).slice(0,p.maxHeldResearchBars);
  }
  if(!slots.length||slots[0].t>deadline) {
    if(asOf<deadline)return unresolved('entry_right_censored');
    return {...base,status:'resolved',class:'entry_expired',grossR:0,netR:0,informationEnd:iso(deadline)};
  }
  const index=new Map();for(const b of snapshot.executionBars){if(index.has(b.t))throw Error('duplicate_execution_time');index.set(b.t,b);}
  const dailyByDate=new Map((snapshot.daily||[]).map(b=>[b.date,b]));
  const mismatch=new Set(snapshot.quality.priceMismatchDates),invalidDay=new Set(snapshot.quality.dailyInvalid.map(x=>x.date));
  const gaps=new Set(snapshot.executionGapBeforeTimes),splits=snapshot.quality.splits;
  let entry=null,stop=null,target=null,risk=2*row.decisionATR14,informationEnd=available;
  for(let i=0;i<p.maxHeldResearchBars;i++) {
    const slot=slots[i];if(!slot)return unresolved('schedule_path_missing');
    const dayEnd=mode==='crypto'?Date.parse(slot.date+'T00:00:00Z')+DAY:(slot.qualityAvailableAt??slot.endT);
    const verifiedAt=Math.max(slot.endT,dayEnd); // Cross-frequency quality is known only after daily completion.
    if(verifiedAt>asOf)return unresolved('path_right_censored');
    if(verifiedAt>wallEnd)return unresolved('label_wall_limit',wallEnd);
    informationEnd=Math.max(informationEnd,verifiedAt);
    if(splits.some(x=>x.date>=iso(available).slice(0,10)&&x.date<=slot.date))return unresolved('split_in_label_path',informationEnd);
    if(mismatch.has(slot.date)||invalidDay.has(slot.date))return unresolved('untrusted_price_day',informationEnd);
    if(mode==='stock'&&schedule.calendarVersion){
      if(snapshot.quality.calendarProvenance!==schedule.provenance)throw Error('calendar_provenance_mismatch');
      if(snapshot.quality.executionUnverifiedDates?.includes(slot.date))return unresolved('daily_crosscheck_unverified',informationEnd);
    }
    if(mode==='crypto'){
      const midnight=Date.parse(slot.date+'T00:00:00Z'),dayBars=Array.from({length:6},(_,j)=>index.get(midnight+j*FOUR)),daily=dailyByDate.get(slot.date);
      if(!daily||daily.endT>asOf||dayBars.some(b=>!b||!validateBar(b,mode)))return unresolved('daily_crosscheck_unverified',informationEnd);
      if(Math.abs(dayBars[0].o-daily.o)/daily.o>.005||Math.abs(dayBars[5].c-daily.c)/daily.c>.005)return unresolved('untrusted_price_day',informationEnd);
    }
    const b=index.get(slot.t);
    if(!b||!validateBar(b,mode)||b.endT!==slot.endT||(mode==='stock'&&slot.sourceCount!==undefined&&b.sourceCount!==slot.sourceCount))return unresolved('missing_or_invalid_execution_bar',informationEnd);
    if(i>0&&gaps.has(b.t))return unresolved('execution_gap',informationEnd);
    if(i===0){entry=b.o;stop=entry-row.dir*risk;target=entry+row.dir*2*risk;if(!(stop>0&&target>0))return unresolved('nonpositive_boundary',informationEnd);}
    let cls=null,fill=null;
    if(row.dir*(b.o-stop)<=0){cls='stop_first';fill=b.o;}
    else if(row.dir*(b.o-target)>=0){cls='target_first';fill=target;}
    else {
      const adverse=row.dir===1?b.l:b.h,favorable=row.dir===1?b.h:b.l;
      if(row.dir*(adverse-stop)<=0){cls='stop_first';fill=stop;}
      else if(row.dir*(favorable-target)>=0){cls='target_first';fill=target;}
    }
    if(!cls&&i===p.maxHeldResearchBars-1){cls='time_exit';fill=b.c;}
    if(cls){const grossR=row.dir*(fill-entry)/risk;return {...base,status:'resolved',class:cls,reason:null,grossR,netR:grossR-p.costR,entryAt:iso(slots[0].t),entryOpen:entry,stop,target,riskDistance:risk,exitAt:iso(b.endT),exitFill:fill,heldBars:i+1,informationEnd:iso(informationEnd)};}
  }
  throw Error('unreachable_label_state');
}
