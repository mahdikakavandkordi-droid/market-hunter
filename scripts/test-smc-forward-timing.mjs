import assert from 'node:assert/strict';
import {aggregateExchange4H,aggregateCrypto4H,evaluateExit,effectiveExitMs,HOUR_MS} from '../lib/smc-forward-runtime.mjs';

const bar=(t,o=100)=>({t,o,h:o+2,l:o-2,c:o+1,v:1000});
{
  const start=Date.parse('2026-01-15T14:30:00Z');
  const rows=Array.from({length:7},(_,i)=>bar(start+i*HOUR_MS,100+i));
  const r=aggregateExchange4H(rows,{nowMs:Date.parse('2026-01-16T00:00:00Z')});
  assert.equal(r.bars.length,2);
  assert.equal(r.bars[0].sourceCount,4);
  assert.equal(r.bars[1].sourceCount,3);
  assert.equal(r.bars[0].t,start);
}
{
  const start=Date.parse('2026-07-15T13:30:00Z');
  const rows=Array.from({length:7},(_,i)=>bar(start+i*HOUR_MS,100+i));
  const r=aggregateExchange4H(rows,{nowMs:Date.parse('2026-07-16T00:00:00Z')});
  assert.equal(r.bars.length,2,'DST session must remain on 09:30 Toronto grid');
  assert.equal(r.bars[0].t,start);
}
{
  const start=Date.parse('2026-01-15T14:30:00Z');
  const rows=[0,1,3].map(i=>bar(start+i*HOUR_MS));
  const r=aggregateExchange4H(rows,{nowMs:Date.parse('2026-01-16T00:00:00Z')});
  assert.equal(r.bars.length,0);
  assert.ok(r.diagnostics.some(x=>x.type==='incomplete_or_missing_exchange_bar'));
}
{
  const start=Date.parse('2026-01-15T14:30:00Z');
  const rows=Array.from({length:4},(_,i)=>bar(start+i*HOUR_MS));
  const r=aggregateExchange4H(rows,{nowMs:start+3.5*HOUR_MS});
  assert.equal(r.bars.length,0,'live partial final hourly source must not complete a 4H bar');
}
{
  const k=Date.parse('2026-10-04T08:00:00Z');
  const three=[0,1,2].map(i=>bar(k+i*HOUR_MS));
  assert.equal(aggregateCrypto4H(three,{nowMs:k+5*HOUR_MS}).bars.length,0);
  const four=[0,1,2,3].map(i=>bar(k+i*HOUR_MS));
  assert.equal(aggregateCrypto4H(four,{nowMs:k+4*HOUR_MS}).bars.length,1);
}
{
  const bars=[
    {t:0,endT:4*HOUR_MS,o:100,h:101,l:99,c:100},
    {t:4*HOUR_MS,endT:8*HOUR_MS,o:100,h:111,l:94,c:105}
  ];
  const x=evaluateExit(bars,0,1,100,95,110,16);
  assert.equal(x.R,-1,'simultaneous stop/target touch must remain conservative stop-first');
  assert.equal(x.executionAudit.stopTargetCollision,true);
  assert.equal(Date.parse(x.exitT),8*HOUR_MS,'exit evidence must use candle completion time');
}
{
  const bars=[
    {t:0,endT:4*HOUR_MS,o:100,h:101,l:99,c:100},
    {t:4*HOUR_MS,endT:8*HOUR_MS,o:90,h:92,l:88,c:91}
  ];
  const x=evaluateExit(bars,0,1,100,95,110,16);
  assert.equal(x.R,-1);
  assert.equal(x.executionAudit.gapThroughStop,true);
  assert.match(x.executionAudit.gapFillAssumption,/true gap fill unknown/);
}
{
  const legacy={exitT:'2026-10-04T08:00:00.000Z'};
  const corrected={exitT:'2026-10-04T12:00:00.000Z',exitTimeConvention:'bar_end'};
  assert.equal(effectiveExitMs(legacy),Date.parse(legacy.exitT)+4*HOUR_MS,'legacy start-time exits get conservative +4h availability');
  assert.equal(effectiveExitMs(corrected),Date.parse(corrected.exitT));
  const sameCandleEntry=Date.parse('2026-10-04T08:00:00.000Z');
  assert.ok(effectiveExitMs(legacy)>sameCandleEntry,'legacy exit cannot release capital at its candle open');
}
{
  const start=Date.parse('2026-11-27T14:30:00Z');
  const rows=[0,1,2,3].map(i=>bar(start+i*HOUR_MS,100+i));
  const r=aggregateExchange4H(rows,{nowMs:Date.parse('2026-11-28T00:00:00Z')});
  assert.equal(r.bars.length,1,'shortened session with a complete first segment should emit only that segment');
  assert.equal(r.bars[0].sourceCount,4);
  assert.equal(r.bars[0].endT,start+4*HOUR_MS,'shortened-session completion stays conservative at final source start + 1h');
  assert.ok(r.diagnostics.some(x=>x.type==='historical_session_tail_absent'));
}
{
  const bars=[
    {t:0,endT:4*HOUR_MS,o:100,h:101,l:99,c:100},
    {t:4*HOUR_MS,endT:8*HOUR_MS,o:112,h:113,l:94,c:96}
  ];
  const x=evaluateExit(bars,0,1,100,95,110,16);
  assert.equal(x.R,2,'a target gap at the bar open must precede later intrabar stop contact');
  assert.equal(x.exitReason,'gap_target');
  assert.equal(x.executionAudit.gapOpenPrecedence,true);
}
{
  const bars=[
    {t:0,endT:4*HOUR_MS,o:100,h:101,l:99,c:100},
    {t:4*HOUR_MS,endT:8*HOUR_MS,o:90,h:112,l:88,c:108}
  ];
  const x=evaluateExit(bars,0,1,100,95,110,16);
  assert.equal(x.R,-1,'a stop gap at the bar open must precede later intrabar target contact');
  assert.equal(x.exitReason,'gap_stop');
}
{
  const bars=[{t:0,endT:4*HOUR_MS,o:100,h:101,l:99,c:100}];
  for(let i=1;i<=16;i++){
    bars.push({t:i*4*HOUR_MS,endT:(i+1)*4*HOUR_MS,o:100,h:104,l:96,c:101});
  }
  const x=evaluateExit(bars,0,1,100,95,110,16);
  assert.equal(x.status,'closed');
  assert.equal(x.exitReason,'max_hold_close');
  assert.equal(x.exitIndex,16,'entry bar is holding-period bar 1 and forced exit occurs on bar 16');
  assert.equal(Date.parse(x.exitT),17*4*HOUR_MS);
}
{
  const bars=[{t:0,endT:4*HOUR_MS,o:100,h:101,l:99,c:100}];
  for(let i=1;i<=15;i++){
    bars.push({t:i*4*HOUR_MS,endT:(i+1)*4*HOUR_MS,o:100,h:104,l:96,c:101});
  }
  const x=evaluateExit(bars,0,1,100,95,110,16);
  assert.equal(x.status,'open','15 completed holding bars are not enough to force the 16-bar exit');
}
console.log('SMC forward candle timing tests passed');
