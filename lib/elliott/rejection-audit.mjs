import {analyzeElliott,MODEL} from './engine.mjs';
import {hash} from './paper-account.mjs';
const terminal=new Set(['unsupported','invalidated','rejected_reward_risk','signal_confirmed']);
const iso=t=>new Date(t).toISOString();

// Reconstruct only confirmed alternating pivots that existed at the examined
// time. This diagnostic never reads a later correction or creates a trade.
export function correctionAt(pivots,candidate,time) {
  const work=[];
  for(const p of pivots.filter(p=>p.confirmedAt<=time&&p.segment===candidate.segment)) {
    const last=work.at(-1);
    if(!last||last.type!==p.type)work.push(p);
    else if((p.type==='high'&&p.price>last.price)||(p.type==='low'&&p.price<last.price))work[work.length-1]=p;
  }
  return work.filter(p=>p.t>candidate.impulse[5].t);
}

// Explicit numerical explanation of the frozen simple-ABC contract, independent
// of the core validator's generic "complex correction" label.
export function explainABC(impulse,tail,dir) {
  if(tail.length>3)return {reason:'complex_correction_unsupported',detail:'more_than_three_confirmed_pivots',tailCount:tail.length};
  if(tail.length<3)return {reason:'incomplete_abc',detail:'fewer_than_three_confirmed_pivots',tailCount:tail.length};
  const first=dir===1?'low':'high';
  if(tail.some((p,i)=>p.type!==(i===1?(first==='low'?'high':'low'):first)||p.t<=(i?tail[i-1].t:impulse[5].t)))return {reason:'invalid_abc_pivots',detail:'invalid_pivot_order_or_type'};
  const [a,b,c]=tail.map(p=>p.price*dir),origin=impulse[0].price*dir,end=impulse[5].price*dir;
  const metrics={a,b,c,origin,end,retracement:(end-c)/(end-origin)};
  if(!(a<end))return {reason:'complex_correction_unsupported',detail:'A_not_corrective',metrics};
  if(!(b>a))return {reason:'complex_correction_unsupported',detail:'B_not_retracing_A',metrics};
  if(!(b<end))return {reason:'complex_correction_unsupported',detail:'B_reaches_or_exceeds_wave5',metrics};
  if(!(c<a))return {reason:'complex_correction_unsupported',detail:'C_does_not_exceed_A',metrics};
  if(!(c>origin))return {reason:'correction_breaks_origin',detail:'C_reaches_or_exceeds_origin',metrics};
  if(metrics.retracement<MODEL.retracementMin||metrics.retracement>MODEL.retracementMax)return {reason:'retracement_out_of_range',detail:metrics.retracement<MODEL.retracementMin?'retracement_too_shallow':'retracement_too_deep',metrics};
  return {reason:null,detail:'simple_ABC_within_frozen_bounds',metrics};
}

export function auditRejections(snapshot) {
  const {bars,symbol,gapBeforeTimes=[]}=snapshot;
  if(!bars?.length)throw Error('empty_historical_snapshot');
  const full=analyzeElliott(bars,{symbol,asOf:bars.at(-1).endT,gapBeforeTimes}),records=[];
  for(const final of full.candidates) {
    if(!terminal.has(final.status))continue;
    const time=final.updatedAt,index=bars.findIndex(b=>b.endT===time);
    if(index<0)throw Error('terminal_time_not_in_source');
    const available=bars.slice(0,index+1),replay=analyzeElliott(available,{symbol,asOf:time,gapBeforeTimes});
    const c=replay.candidates.find(c=>c.id===final.id);
    if(!c||hash(c)!==hash(final))throw Error('terminal_state_changed_after_rejection');
    const before=index?analyzeElliott(bars.slice(0,index),{symbol,asOf:bars[index-1].endT,gapBeforeTimes}).candidates.find(c=>c.id===final.id):null;
    if(before&&terminal.has(before.status))throw Error('terminal_timestamp_not_first_event');
    const oriented=c.impulse.map(p=>p.price*c.dir),[p0,p1,p2,p3,p4,p5]=oriented;
    const waveLengths=[p1-p0,p3-p2,p5-p4];
    const firstType=c.dir===1?'low':'high';
    const validImpulse=c.impulse.length===6&&c.impulse.every((p,i)=>p.type===(i%2?(firstType==='low'?'high':'low'):firstType)
      &&p.confirmedAt<=c.identifiedAt&&(!i||p.t>c.impulse[i-1].t))
      &&p1>p0&&p2>p0&&p2<p1&&p3>p1&&p4>p1&&p4<p3&&p5>p3
      &&waveLengths[1]>=Math.min(waveLengths[0],waveLengths[2]);
    const anchorsAvailable=[c.impulse[0],c.impulse[5]].every(p=>replay.pivots.large.some(a=>a.t===p.t&&a.type===p.type&&a.confirmedAt<=c.identifiedAt));
    if(!validImpulse||!anchorsAvailable)throw Error('impulse_or_anchor_contract_mismatch');
    const tail=correctionAt(replay.pivots.small,c,time),abc=explainABC(c.impulse,tail,c.dir);
    const cBreached=tail.length===3&&available.slice(tail[2].index+1).some(b=>c.dir===1?b.l<tail[2].price:b.h>tail[2].price);
    const origin=c.impulse[0].price;
    const originBreached=available.slice(c.impulse[5].index+1).some(b=>c.dir===1?b.l<=origin:b.h>=origin);
    let explanation=abc.detail,independentlyVerified=false;
    if(c.reason==='origin_breached') {
      explanation='price_reached_original_impulse_origin';independentlyVerified=originBreached;
    }else if(c.reason==='correction_endpoint_breached') {
      explanation='price_breached_confirmed_C';
      independentlyVerified=!originBreached&&!abc.reason&&cBreached;
    }else if(['unsupported'].includes(c.status))independentlyVerified=!originBreached&&abc.reason===c.reason;
    else {
      const decision=replay.decisions.find(d=>d.structureId===c.id),last=available.at(-1),prev=available.at(-2);
      const risk=decision?c.dir*(last.c-decision.stop):null,reward=decision?c.dir*(decision.target-last.c):null;
      const rr=risk>0?reward/risk:null;
      const crossing=prev&&c.dir*last.c>c.dir*c.trigger&&c.dir*prev.c<=c.dir*c.trigger;
      let segmentStart=0;
      for(let j=0;j<=index;j++)if(gapBeforeTimes.includes(bars[j].t))segmentStart=j;
      let atr=null;
      if(index-segmentStart>=MODEL.atrPeriod) {
        let total=0;
        for(let j=index-MODEL.atrPeriod+1;j<=index;j++)total+=Math.max(bars[j].h-bars[j].l,Math.abs(bars[j].h-bars[j-1].c),Math.abs(bars[j].l-bars[j-1].c));
        atr=total/MODEL.atrPeriod;
      }
      const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b));
      const amplitude=c.dir*(c.impulse[5].price-c.impulse[0].price);
      const levelsValid=decision&&tail.length===3&&atr>0
        &&near(decision.stop,tail[2].price-c.dir*MODEL.stopBufferAtr*atr)
        &&near(decision.target,tail[2].price+c.dir*MODEL.targetExtension*amplitude)
        &&near(decision.signalClose,last.c);
      independentlyVerified=Boolean(decision&&levelsValid&&!originBreached&&!cBreached&&!abc.reason&&crossing&&decision.impulse.concat(decision.correction).every(p=>p.confirmedAt<=time)
        &&(c.status==='signal_confirmed'?rr>=MODEL.minRewardRisk:!(rr>=MODEL.minRewardRisk)));
      explanation=c.status==='signal_confirmed'?'confirmed_after_C_and_B_crossing':'reward_risk_below_frozen_minimum';
    }
    if(!independentlyVerified)throw Error('unexplained_terminal_state_'+c.id);
    records.push({symbol,id:c.id,dir:c.dir,status:c.status,reason:c.reason,detail:explanation,
      observedAt:iso(time),identifiedAt:iso(c.identifiedAt),barsFromRecognition:index-bars.findIndex(b=>b.endT===c.identifiedAt),
      impulse:c.impulse,availableCorrection:tail,abcDiagnostics:abc,independentlyVerified,
      impulseAndAnchorsIndependentlyVerified:true,sameTerminalStateWithoutFuture:true,unavailableFutureBars:bars.length-index-1});
  }
  return {symbol,snapshotHash:hash(snapshot),modelHash:hash(MODEL),records};
}
