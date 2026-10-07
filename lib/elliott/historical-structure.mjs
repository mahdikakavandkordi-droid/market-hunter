import {MODEL,analyzeElliott,validateImpulse,validateCorrection} from './engine.mjs';
import {hash} from './paper-account.mjs';
const iso=t=>new Date(t).toISOString();
export function regimeAt(bars,index) {
  if(index<199)return 'insufficient_history';
  const mean=n=>bars.slice(index-n+1,index+1).reduce((s,b)=>s+b.c,0)/n;
  const s50=mean(50),s200=mean(200),c=bars[index].c;
  return c>s50&&s50>s200?'up':c<s50&&s50<s200?'down':'mixed';
}
export function auditStructure(snapshot) {
  const {bars,symbol,gapBeforeTimes=[]}=snapshot;
  if(!bars.length)throw Error('empty_historical_snapshot');
  const full=analyzeElliott(bars,{symbol,asOf:bars.at(-1).endT,gapBeforeTimes});
  let prefixChecks=0;
  for(let i=0;i<bars.length;i++) {
    const time=bars[i].endT;
    const replay=analyzeElliott(bars.slice(0,i+1),{symbol,asOf:time,gapBeforeTimes});
    const expected=full.decisions.filter(d=>Date.parse(d.signalCompletedAt)<=time);
    if(hash(expected)!==hash(replay.decisions))throw Error('decision_repaint_at_'+iso(time));
    for(const kind of ['small','large'])if(hash(full.pivots[kind].filter(p=>p.confirmedAt<=time))!==hash(replay.pivots[kind]))throw Error('pivot_repaint_at_'+iso(time));
    prefixChecks++;
  }
  const counts={},reasons={};
  for(const c of full.candidates){counts[c.status]=(counts[c.status]||0)+1;if(c.reason)reasons[c.reason]=(reasons[c.reason]||0)+1}
  const signals=full.signals.map(s=>{
    const index=bars.findIndex(b=>b.endT===Date.parse(s.signalCompletedAt));
    const end=s.impulse.at(-1),last=s.correction.at(-1);
    if(!validateImpulse(s.impulse,s.dir).valid||!validateCorrection(s.impulse,s.correction,s.dir).valid
      ||s.impulse.concat(s.correction).some(p=>p.confirmedAt>Date.parse(s.signalCompletedAt)))throw Error('invalid_historical_signal');
    return {decisionId:s.decisionId,dir:s.dir,signalCompletedAt:s.signalCompletedAt,
      rewardRisk:s.rewardRisk,regime:regimeAt(bars,index),
      correctionConfirmationDelayBars:last.confirmedIndex-last.index,
      triggerDelayFromCBars:index-last.index,outerEndpointRecognitionDelayBars:bars.findIndex(b=>b.endT===Date.parse(s.identifiedAt))-end.index};
  });
  return {symbol,market:snapshot.market,firstBar:iso(bars[0].t),lastBar:iso(bars.at(-1).endT),bars:bars.length,
    snapshotHash:hash(snapshot),modelHash:hash(MODEL),prefixChecks,causality:'passed_all_prefixes',
    pivots:{small:full.pivots.small.length,large:full.pivots.large.length},candidates:full.candidates.length,
    candidateStatuses:counts,reasons,signals,decisions:full.decisions.length,knownGaps:gapBeforeTimes.length,
    regimeBars:bars.reduce((o,_,i)=>{const r=regimeAt(bars,i);o[r]=(o[r]||0)+1;return o},{}),
    // States below are final-history diagnostics, never entry eligibility.
    finalCandidates:full.candidates};
}
