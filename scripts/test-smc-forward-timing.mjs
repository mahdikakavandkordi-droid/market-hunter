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
console.log('SMC forward candle timing tests passed');
