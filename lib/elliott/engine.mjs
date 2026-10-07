// Elliott V1: pure completed-daily-bar research core. No orders or I/O.
export const MODEL = Object.freeze({
  version: 'elliott-v1', smallRadius: 2, largeRadius: 5,
  retracementMin: 0.382, retracementMax: 0.786,
  targetExtension: 1.618, stopBufferAtr: 0.5, atrPeriod: 14,
  rsiPeriod: 14, volumePeriod: 20, minRewardRisk: 2
});
const iso = t => new Date(t).toISOString();
const terminal = new Set(['invalidated', 'unsupported', 'rejected_reward_risk', 'signal_confirmed']);
const pointKey = p => `${p.t}|${p.type}`;
const oriented = (points, dir) => points.map(p => dir * p.price);

export function validateImpulse(points, dir) {
  if (points.length !== 6 || ![1, -1].includes(dir)) return {valid:false, reason:'invalid_shape'};
  const first = dir === 1 ? 'low' : 'high';
  if (points.some((p,i) => p.type !== (i % 2 ? (first === 'low' ? 'high' : 'low') : first)
    || !Number.isFinite(p.price) || (i && p.t <= points[i-1].t))) return {valid:false, reason:'invalid_pivots'};
  const [p0,p1,p2,p3,p4,p5] = oriented(points,dir);
  if (!(p1>p0 && p2<p1 && p3>p2 && p4<p3 && p5>p4)) return {valid:false, reason:'invalid_leg_direction'};
  if (!(p2>p0)) return {valid:false, reason:'wave2_breaks_origin'};
  if (!(p3>p1)) return {valid:false, reason:'wave3_no_new_extreme'};
  if (!(p4>p1)) return {valid:false, reason:'wave4_overlap'};
  if (!(p5>p3)) return {valid:false, reason:'truncated_wave5_unsupported'};
  const lengths = [p1-p0,p3-p2,p5-p4];
  if (lengths[1] < Math.min(lengths[0],lengths[2])) return {valid:false, reason:'wave3_shortest'};
  return {valid:true, lengths, amplitude:p5-p0};
}

export function validateCorrection(impulse, abc, dir) {
  if (abc.length !== 3) return {valid:false, reason:'incomplete_abc'};
  const first = dir === 1 ? 'low' : 'high';
  if (abc.some((p,i) => p.type !== (i===1 ? (first==='low'?'high':'low') : first)
    || !Number.isFinite(p.price) || p.t <= (i ? abc[i-1].t : impulse[5].t))) return {valid:false, reason:'invalid_abc_pivots'};
  const [origin,,,,,end] = oriented(impulse,dir);
  const [a,b,c] = oriented(abc,dir);
  if (!(a<end && b>a && b<end && c<a)) return {valid:false, reason:'complex_correction_unsupported'};
  if (!(c>origin)) return {valid:false, reason:'correction_breaks_origin'};
  const retracement = (end-c)/(end-origin);
  if (retracement<MODEL.retracementMin || retracement>MODEL.retracementMax) return {valid:false, reason:'retracement_out_of_range', retracement};
  return {valid:true, retracement, trigger:abc[1].price};
}

export function indicators(bars, i=bars.length-1) {
  let atr=null, rsi=null, rvol=null;
  if (i>=MODEL.atrPeriod) {
    let sum=0;
    for (let j=i-MODEL.atrPeriod+1;j<=i;j++) {
      const b=bars[j],prev=bars[j-1];
      sum+=Math.max(b.h-b.l,Math.abs(b.h-prev.c),Math.abs(b.l-prev.c));
    }
    atr=sum/MODEL.atrPeriod;
  }
  if (i>=MODEL.rsiPeriod) {
    let gain=0,loss=0;
    for(let j=1;j<=MODEL.rsiPeriod;j++) {
      const delta=bars[j].c-bars[j-1].c;
      gain+=Math.max(0,delta);loss+=Math.max(0,-delta);
    }
    gain/=MODEL.rsiPeriod;loss/=MODEL.rsiPeriod;
    for(let j=MODEL.rsiPeriod+1;j<=i;j++) {
      const delta=bars[j].c-bars[j-1].c;
      gain=(gain*(MODEL.rsiPeriod-1)+Math.max(0,delta))/MODEL.rsiPeriod;
      loss=(loss*(MODEL.rsiPeriod-1)+Math.max(0,-delta))/MODEL.rsiPeriod;
    }
    rsi=loss===0 ? (gain===0?50:100) : 100-100/(1+gain/loss);
  }
  if(i>=MODEL.volumePeriod) {
    const history=bars.slice(i-MODEL.volumePeriod,i);
    if(Number.isFinite(bars[i].v) && bars[i].v>=0 && history.every(b=>Number.isFinite(b.v)&&b.v>=0)) {
      const mean=history.reduce((sum,b)=>sum+b.v,0)/history.length;
      if(mean>0)rvol=bars[i].v/mean;
    }
  }
  return {atr14:atr,rsi14:rsi,rvol20:rvol};
}

function confirmedPivot(bars, i, radius, segments) {
  const at=i-radius;
  if(at<radius || segments[at-radius]!==segments[i])return null;
  const b=bars[at],window=bars.slice(at-radius,i+1).filter((_,j)=>j!==radius);
  const high=window.every(x=>b.h>x.h),low=window.every(x=>b.l<x.l);
  // Equal extrema and simultaneous high/low extrema are not assigned an order.
  if(high===low)return null;
  return {index:at,t:b.t,confirmedIndex:i,confirmedAt:bars[i].endT,
    type:high?'high':'low',price:high?b.h:b.l,segment:segments[at],radius};
}

function appendAlternating(points, p) {
  const last=points.at(-1);
  if(!last || last.type!==p.type)points.push(p);
  else if(p.type==='high'?p.price>last.price:p.price<last.price)points[points.length-1]=p;
  // This is unpublished working structure; emitted pivots/signals never change.
}

function completedInput(rows, asOf) {
  if(!Array.isArray(rows)||!Number.isFinite(asOf))throw new Error('explicit_finite_asOf_required');
  const bars=[];
  for(const b of rows) {
    if(!Number.isFinite(b?.t)||!Number.isFinite(b?.endT)||b.endT<=b.t)throw new Error('invalid_bar_time');
    if(b.endT>asOf)continue;
    if(![b.o,b.h,b.l,b.c].every(v=>Number.isFinite(v)&&v>0)
      || b.h<Math.max(b.o,b.c,b.l) || b.l>Math.min(b.o,b.c,b.h))throw new Error('invalid_completed_ohlc');
    const prev=bars.at(-1);
    if(prev && (b.t<=prev.t || b.t<prev.endT || b.endT<=prev.endT))throw new Error('unordered_or_duplicate_bars');
    bars.push({...b});
  }
  return bars;
}

/**
 * Replay is causal at every bar end. The caller supplies real daily completion
 * times and gapBeforeTimes (bar-start timestamps after a known missing session).
 * Provider/calendar normalization belongs to the later runner, not this core.
 */
export function analyzeElliott(rows, {asOf, symbol='UNKNOWN', gapBeforeTimes=[]}={}) {
  const bars=completedInput(rows,asOf);
  if(typeof symbol!=='string'||!symbol.trim())throw new Error('invalid_symbol');
  if(!Array.isArray(gapBeforeTimes)||gapBeforeTimes.some(t=>!Number.isFinite(t)))throw new Error('invalid_gap_times');
  const gapSet=new Set(gapBeforeTimes),segments=[];
  let segment=0;
  for(let i=0;i<bars.length;i++){if(i&&gapSet.has(bars[i].t))segment++;segments.push(segment)}
  const pivotEvents={small:[],large:[]},largeKeys=new Set(),working=[],candidates=new Map(),signals=[],decisions=[];
  let segmentStart=0;
  for(let i=0;i<bars.length;i++) {
    if(i && segments[i]!==segments[i-1]) {
      working.length=0;largeKeys.clear();segmentStart=i;
      for(const c of candidates.values())if(!terminal.has(c.status)) {
        c.status='unsupported';c.reason='daily_path_gap';c.updatedAt=bars[i].endT;
      }
    }
    const small=confirmedPivot(bars,i,MODEL.smallRadius,segments);
    if(small){pivotEvents.small.push(small);appendAlternating(working,small)}
    const large=confirmedPivot(bars,i,MODEL.largeRadius,segments);
    if(large){pivotEvents.large.push(large);largeKeys.add(pointKey(large))}
    if(small||large) {
      for(let j=0;j+5<working.length;j++) {
        const p=working.slice(j,j+6),dir=p[0].type==='low'?1:-1;
        if(!largeKeys.has(pointKey(p[0]))||!largeKeys.has(pointKey(p[5])))continue;
        const check=validateImpulse(p,dir);if(!check.valid)continue;
        const id=[MODEL.version,symbol,dir,...p.map(pointKey)].join('|');
        if(!candidates.has(id))candidates.set(id,{id,dir,status:'waiting_correction',reason:null,
          impulse:structuredClone(p),identifiedAt:bars[i].endT,updatedAt:bars[i].endT,segment:segments[i]});
      }
    }
    for(const c of candidates.values()) {
      if(terminal.has(c.status)||c.segment!==segments[i])continue;
      const price=bars[i],origin=c.impulse[0].price;
      // A late-confirmed outer endpoint must not resurrect a setup whose
      // origin was already breached before that endpoint became available.
      const afterImpulse=bars.slice(c.impulse[5].index+1,i+1);
      if(afterImpulse.some(b=>c.dir===1?b.l<=origin:b.h>=origin)) {
        c.status='invalidated';c.reason='origin_breached';c.updatedAt=price.endT;continue;
      }
      const tail=working.filter(p=>p.t>c.impulse[5].t);
      if(tail.length>3){c.status='unsupported';c.reason='complex_correction_unsupported';c.updatedAt=price.endT;continue}
      if(tail.length<3)continue;
      const correction=validateCorrection(c.impulse,tail,c.dir);
      if(!correction.valid){c.status='unsupported';c.reason=correction.reason;c.updatedAt=price.endT;continue}
      c.correction=structuredClone(tail);c.retracement=correction.retracement;c.trigger=correction.trigger;
      c.status='waiting_breakout';c.updatedAt=price.endT;
      // C has to remain intact from its confirmation through entry confirmation.
      const ci=tail[2].index;
      if(bars.slice(ci+1,i+1).some(b=>c.dir===1?b.l<tail[2].price:b.h>tail[2].price)) {
        c.status='invalidated';c.reason='correction_endpoint_breached';continue;
      }
      if(!i || !(c.dir*price.c>c.dir*c.trigger && c.dir*bars[i-1].c<=c.dir*c.trigger))continue;
      const values=indicators(bars.slice(segmentStart,i+1));
      if(!(values.atr14>0)){c.reason='atr_unavailable';continue}
      const stop=tail[2].price-c.dir*MODEL.stopBufferAtr*values.atr14;
      const amplitude=c.dir*(c.impulse[5].price-c.impulse[0].price);
      const target=tail[2].price+c.dir*MODEL.targetExtension*amplitude;
      const risk=c.dir*(price.c-stop),reward=c.dir*(target-price.c),rewardRisk=risk>0?reward/risk:null;
      const snapshot={version:MODEL.version,symbol,dir:c.dir,structureId:c.id,
        signalT:iso(price.t),signalCompletedAt:iso(price.endT),
        impulse:structuredClone(c.impulse),correction:structuredClone(tail),
        identifiedAt:iso(c.identifiedAt),retracement:c.retracement,trigger:c.trigger,
        signalClose:price.c,stop,target,rewardRisk,indicators:values};
      c.status=rewardRisk!==null&&rewardRisk>=MODEL.minRewardRisk?'signal_confirmed':'rejected_reward_risk';
      c.reason=c.status==='signal_confirmed'?null:'insufficient_reward_risk';
      const decision={...snapshot,status:c.status,decisionId:[c.id,price.t].join('|')};
      decisions.push(decision);if(c.status==='signal_confirmed')signals.push(decision);
    }
  }
  // Selection is deterministic and never discards alternative historical evidence.
  const ordered=[...candidates.values()].sort((a,b)=>b.impulse[5].t-a.impulse[5].t
    || b.impulse[0].t-a.impulse[0].t || b.dir-a.dir || a.id.localeCompare(b.id));
  const current=ordered.filter(c=>!terminal.has(c.status)).slice(0,2);
  return {version:MODEL.version,symbol,asOf:iso(asOf),lastCompletedAt:bars.length?iso(bars.at(-1).endT):null,
    status:current[0]?.status||ordered[0]?.status||'no_supported_structure',
    current:structuredClone(current),candidates:structuredClone(ordered),pivots:pivotEvents,
    signals,decisions,coverage:{completedBars:bars.length,knownGaps:segment,
      calendarContinuity:'caller_supplied',unsupportedPatterns:['diagonal','truncated_fifth','complex_correction']}};
}
