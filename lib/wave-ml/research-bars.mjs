// Session aggregation copied without strategy/outcome logic from the reviewed
// Trend Breakout research runtime at b7778a9eeede310fdcfc8f0686170da411db85e1.
const HOUR=60*60*1000;
const FOUR_HOURS=4*HOUR;
const formatters=new Map();

function formatter(timeZone){
  if(!formatters.has(timeZone)){
    formatters.set(timeZone,new Intl.DateTimeFormat('en-CA',{
      timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }));
  }
  return formatters.get(timeZone);
}
export function zonedParts(ms,timeZone='America/Toronto'){
  const z=Object.fromEntries(formatter(timeZone).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
  return {date:`${z.year}-${z.month}-${z.day}`,hour:+z.hour,minute:+z.minute};
}
export const utcDate=ms=>new Date(ms).toISOString().slice(0,10);
export function weekFromDate(date){
  const d=new Date(date+'T12:00:00Z'),dw=d.getUTCDay();
  return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-((dw+6)%7))).toISOString().slice(0,10);
}
export const stockWeekKey=ms=>weekFromDate(zonedParts(ms).date);
export const cryptoWeekKey=ms=>weekFromDate(utcDate(ms));
export const dailyStock=rows=>rows.map(x=>({...x,date:zonedParts(x.t).date}));
export const dailyCrypto=rows=>rows.map(x=>({...x,date:utcDate(x.t)}));

function barFromRows(rows,date,segment,endT,meta={}){
  return {
    t:rows[0].t,endT,o:rows[0].o,
    h:Math.max(...rows.map(x=>x.h)),l:Math.min(...rows.map(x=>x.l)),
    c:rows.at(-1).c,v:rows.reduce((s,x)=>s+(x.v||0),0),
    date,sourceCount:rows.length,segment,...meta
  };
}

export function aggregateExchange4H(hourly,{nowMs=Date.now(),timeZone='America/Toronto'}={}){
  const byDate=new Map(),diagnostics=[];
  for(const r of [...hourly].sort((a,b)=>a.t-b.t)){
    if(!Number.isFinite(r?.t)||![r?.o,r?.h,r?.l,r?.c].every(Number.isFinite))continue;
    const z=zonedParts(r.t,timeZone),minute=z.hour*60+z.minute;
    if(minute<570||minute>=960)continue;
    const rawSlot=(minute-570)/60,slot=Math.round(rawSlot);
    if(slot<0||slot>6||Math.abs(rawSlot-slot)>.1){
      diagnostics.push({type:'off_session_grid',date:z.date,t:r.t});
      continue;
    }
    if(!byDate.has(z.date))byDate.set(z.date,new Map());
    const m=byDate.get(z.date);
    if(m.has(slot))diagnostics.push({type:'duplicate_hour_slot',date:z.date,slot});
    else m.set(slot,r);
  }

  const bars=[];
  const today=zonedParts(nowMs,timeZone).date;
  for(const [date,slots] of [...byDate.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
    const specs=[{segment:0,expected:[0,1,2,3]},{segment:1,expected:[4,5,6]}];
    for(const spec of specs){
      const present=spec.expected.filter(x=>slots.has(x));
      if(!present.length)continue;
      if(present.length!==spec.expected.length){
        diagnostics.push({type:'incomplete_or_missing_exchange_bar',date,segment:spec.segment,expected:spec.expected,present});
        continue;
      }
      const rows=spec.expected.map(x=>slots.get(x));
      const endT=rows.at(-1).t+HOUR;
      if(date===today&&endT>nowMs){
        diagnostics.push({type:'live_incomplete_exchange_bar_dropped',date,segment:spec.segment,endT});
        continue;
      }
      bars.push(barFromRows(rows,date,spec.segment,endT,{
        completionConvention:'last hourly source start + 1h (conservative for final/shortened session bars)'
      }));
    }
    if(date<today&&[0,1,2,3].every(x=>slots.has(x))&&![4,5,6].some(x=>slots.has(x))){
      diagnostics.push({type:'historical_session_tail_absent',date,note:'could be shortened session or missing tail; no second 4H bar emitted'});
    }
  }
  return {bars,diagnostics};
}

export function aggregateCrypto4H(hourly,{nowMs=Date.now()}={}){
  const buckets=new Map(),diagnostics=[];
  for(const r of [...hourly].sort((a,b)=>a.t-b.t)){
    if(!Number.isFinite(r?.t)||![r?.o,r?.h,r?.l,r?.c].every(Number.isFinite))continue;
    const k=Math.floor(r.t/FOUR_HOURS)*FOUR_HOURS;
    const rawSlot=(r.t-k)/HOUR,slot=Math.round(rawSlot);
    if(slot<0||slot>3||Math.abs(rawSlot-slot)>.1){
      diagnostics.push({type:'off_crypto_hour_grid',bucket:k,t:r.t});
      continue;
    }
    if(!buckets.has(k))buckets.set(k,new Map());
    const m=buckets.get(k);
    if(m.has(slot))diagnostics.push({type:'duplicate_crypto_hour_slot',bucket:k,slot});
    else m.set(slot,r);
  }
  const bars=[];
  for(const [k,slots] of [...buckets.entries()].sort((a,b)=>a[0]-b[0])){
    const expected=[0,1,2,3],present=expected.filter(x=>slots.has(x)),endT=k+FOUR_HOURS;
    if(present.length!==4){
      diagnostics.push({type:'incomplete_or_missing_crypto_bar',bucket:k,expected,present});
      continue;
    }
    if(endT>nowMs){
      diagnostics.push({type:'live_incomplete_crypto_bar_dropped',bucket:k,endT});
      continue;
    }
    const rows=expected.map(x=>slots.get(x));
    bars.push(barFromRows(rows,utcDate(k),Math.floor((k%(24*HOUR))/FOUR_HOURS),endT,{completionConvention:'four complete UTC hourly sources'}));
  }
  return {bars,diagnostics};
}

export function buildGapBeforeIndex(bars,{mode='stock',diagnostics=[],tradingDates=[]}={}){
  const gaps=new Map();
  if(!Array.isArray(bars)||bars.length<2)return gaps;
  const dates=[...new Set((tradingDates||[]).filter(Boolean))].sort();
  const add=(index,reason)=>{if(!gaps.has(index))gaps.set(index,reason)};

  for(let i=1;i<bars.length;i++){
    const prev=bars[i-1],curr=bars[i];
    if(mode==='crypto'){
      if(curr.t!==prev.endT){
        add(i,{
          type:'missing_crypto_4h_sequence',
          fromBarEnd:new Date(prev.endT).toISOString(),
          toBarStart:new Date(curr.t).toISOString()
        });
      }
      continue;
    }

    if(prev.date===curr.date){
      if(!(prev.segment===0&&curr.segment===1)){
        add(i,{type:'unexpected_exchange_segment_sequence',date:curr.date,previousSegment:prev.segment,currentSegment:curr.segment});
      }
      continue;
    }

    if(prev.segment===0){
      const diagnostic=diagnostics.find(x=>x?.date===prev.date&&(
        x.type==='historical_session_tail_absent'||
        (x.type==='incomplete_or_missing_exchange_bar'&&x.segment===1)
      ));
      add(i,{
        type:'unresolved_exchange_session_tail',
        date:prev.date,
        note:diagnostic?.note||'second session segment unavailable; shortened session vs missing intraday data is unresolved'
      });
      continue;
    }

    if(curr.segment!==0){
      add(i,{type:'missing_exchange_first_segment',date:curr.date,currentSegment:curr.segment});
      continue;
    }

    const missingTradingDates=dates.filter(d=>d>prev.date&&d<curr.date);
    if(missingTradingDates.length){
      add(i,{type:'missing_exchange_trading_date',dates:missingTradingDates});
    }
  }
  return gaps;
}

