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

function gapBefore(gapBeforeIndex,index){
  if(gapBeforeIndex instanceof Map)return gapBeforeIndex.get(index)||null;
  return gapBeforeIndex?.[index]||null;
}

export function evaluateExitFromEntry(bars,entryIndex,dir,entry,stop,target,maxHold=16,{gapBeforeIndex=new Map()}={}){
  if(entryIndex<0||entryIndex>=bars.length)return {status:'open',R:null,exitT:null};
  const lastRequired=entryIndex+maxHold-1;
  for(let j=entryIndex;j<=Math.min(bars.length-1,lastRequired);j++){
    if(j>entryIndex){
      const gap=gapBefore(gapBeforeIndex,j);
      if(gap){
        return {
          status:'open',R:null,exitT:null,
          lifecycleDataGap:{phase:'holding_period',beforeBarIndex:j,...structuredClone(gap)}
        };
      }
    }
    const b=bars[j];
    const gapStop=dir===1?b.o<=stop:b.o>=stop;
    const gapTarget=dir===1?b.o>=target:b.o<=target;
    const hitStop=dir===1?b.l<=stop:b.h>=stop;
    const hitTarget=dir===1?b.h>=target:b.l<=target;

    // The bar open is temporally known before any later intrabar path. A gap through
    // one boundary therefore resolves the strategy-level outcome before applying the
    // conservative stop-first policy to otherwise unordered high/low touches.
    if(gapStop||gapTarget){
      const stopWins=gapStop;
      return {
        status:'closed',R:stopWins?-1:2,exitIndex:j,exitT:new Date(b.endT).toISOString(),
        exitReason:stopWins?'gap_stop':'gap_target',
        exitPriceAssumed:stopWins?stop:target,
        exitTimeConvention:'bar_end',
        executionAudit:{
          stopTargetCollision:false,collisionPolicy:null,
          gapThroughStop:gapStop,gapThroughTarget:gapTarget,
          gapFillAssumption:'strategy-level boundary price retained; true gap fill unknown',
          gapOpenPrecedence:true,
          exitBarStartT:new Date(b.t).toISOString(),exitBarEndT:new Date(b.endT).toISOString()
        }
      };
    }
    if(hitStop||hitTarget){
      const collision=hitStop&&hitTarget;
      const stopWins=hitStop;
      const R=stopWins?-1:2;
      return {
        status:'closed',R,exitIndex:j,exitT:new Date(b.endT).toISOString(),
        exitReason:collision?'stop_target_collision_stop_first':(stopWins?'stop':'target'),
        exitPriceAssumed:stopWins?stop:target,
        exitTimeConvention:'bar_end',
        executionAudit:{
          stopTargetCollision:collision,collisionPolicy:collision?'stop-first-conservative':null,
          gapThroughStop:false,gapThroughTarget:false,gapFillAssumption:null,gapOpenPrecedence:false,
          exitBarStartT:new Date(b.t).toISOString(),exitBarEndT:new Date(b.endT).toISOString()
        }
      };
    }
  }
  if(bars.length-1>=lastRequired){
    const b=bars[lastRequired],R=dir*(b.c-entry)/Math.abs(entry-stop);
    return {
      status:'closed',R,exitIndex:lastRequired,exitT:new Date(b.endT).toISOString(),exitReason:'max_hold_close',
      exitPriceAssumed:b.c,exitTimeConvention:'bar_end',
      executionAudit:{stopTargetCollision:false,collisionPolicy:null,gapThroughStop:false,gapThroughTarget:false,gapFillAssumption:null,exitBarStartT:new Date(b.t).toISOString(),exitBarEndT:new Date(b.endT).toISOString()}
    };
  }
  return {status:'open',R:null,exitT:null};
}

export function evaluateExit(bars,eventIndex,dir,entry,stop,target,maxHold=16,{gapBeforeIndex=new Map()}={}){
  const entryIndex=eventIndex+1;
  if(entryIndex>=bars.length)return {status:'pending_entry',R:null,exitT:null};
  const entryGap=gapBefore(gapBeforeIndex,entryIndex);
  if(entryGap){
    return {
      status:'pending_entry',R:null,exitT:null,
      lifecycleDataGap:{phase:'entry',beforeBarIndex:entryIndex,...structuredClone(entryGap)}
    };
  }
  return evaluateExitFromEntry(bars,entryIndex,dir,entry,stop,target,maxHold,{gapBeforeIndex});
}

export function resumeRecordedTrade(trade,bars,{gapBeforeIndex=new Map(),stopBufferAtr=.1,maxHold=16}={}){
  if(!trade||!Array.isArray(bars))return trade;
  const next=structuredClone(trade);
  if(trade.status==='closed')return next;

  if(trade.status==='pending_entry'){
    const signalMs=Date.parse(trade.signalT);
    const signalIndex=bars.findIndex(b=>b.t===signalMs);
    if(signalIndex<0){
      next.lifecycleDataGap={phase:'entry',type:'recorded_signal_bar_unavailable'};
      return next;
    }
    const entryIndex=signalIndex+1;
    if(entryIndex>=bars.length)return next;
    const entryGap=gapBefore(gapBeforeIndex,entryIndex);
    if(entryGap){
      next.lifecycleDataGap={phase:'entry',beforeBarIndex:entryIndex,...structuredClone(entryGap)};
      return next;
    }
    const opp=trade.signalSnapshot?.opposingSwing;
    const atr14=trade.signalSnapshot?.atr14;
    if(!Number.isFinite(opp)||!Number.isFinite(atr14)){
      next.lifecycleDataGap={phase:'entry',type:'recorded_signal_snapshot_incomplete'};
      return next;
    }
    const entry=bars[entryIndex].o;
    const stop=trade.dir===1?opp-stopBufferAtr*atr14:opp+stopBufferAtr*atr14;
    const risk=trade.dir===1?entry-stop:stop-entry;
    if(!(risk>0)){
      next.lifecycleDataGap={phase:'entry',type:'recorded_signal_snapshot_invalid_risk'};
      return next;
    }
    const target=entry+trade.dir*2*risk;
    const outcome=evaluateExit(bars,signalIndex,trade.dir,entry,stop,target,maxHold,{gapBeforeIndex});
    delete next.lifecycleDataGap;
    return {
      ...next,
      entryT:new Date(bars[entryIndex].t).toISOString(),
      entry,stop,target,risk,
      ...outcome,
      lifecycleRefreshSource:'recorded_signal_snapshot'
    };
  }

  if(trade.status==='open'){
    if(!Number.isFinite(trade.entry)||!Number.isFinite(trade.stop)||!Number.isFinite(trade.target)||!trade.entryT){
      next.lifecycleDataGap={phase:'holding_period',type:'recorded_open_fields_incomplete'};
      return next;
    }
    const entryMs=Date.parse(trade.entryT);
    const entryIndex=bars.findIndex(b=>b.t===entryMs);
    if(entryIndex<0){
      next.lifecycleDataGap={phase:'holding_period',type:'recorded_entry_bar_unavailable'};
      return next;
    }
    const outcome=evaluateExitFromEntry(bars,entryIndex,trade.dir,trade.entry,trade.stop,trade.target,maxHold,{gapBeforeIndex});
    delete next.lifecycleDataGap;
    return {...next,...outcome,lifecycleRefreshSource:'recorded_immutable_fields'};
  }

  return next;
}

export function effectiveExitMs(trade){
  if(!trade?.exitT)return null;
  const t=Date.parse(trade.exitT);
  if(!Number.isFinite(t))return null;
  return trade.exitTimeConvention==='bar_end'?t:t+FOUR_HOURS;
}

export const HOUR_MS=HOUR;
export const FOUR_HOURS_MS=FOUR_HOURS;
