import fs from 'node:fs';
import assert from 'node:assert/strict';
import {completedDailyRows} from '../lib/completed-daily-session.js';

const sec=s=>Math.floor(new Date(s).getTime()/1000);
const rows=[
  {t:sec('2026-09-28T13:30:00Z'),close:100},
  {t:sec('2026-09-29T13:30:00Z'),close:101}
];
const meta={currentTradingPeriod:{regular:{start:sec('2026-09-29T13:30:00Z'),end:sec('2026-09-29T20:00:00Z')}}};

assert.equal(completedDailyRows(rows,meta,new Date('2026-09-29T14:30:00Z').getTime()).length,1,'active equity session must be excluded');
assert.equal(completedDailyRows(rows,meta,new Date('2026-09-29T20:05:00Z').getTime()).length,2,'closed session must be retained');

const priorOnly=[rows[0]];
assert.equal(completedDailyRows(priorOnly,meta,new Date('2026-09-29T14:30:00Z').getTime()).length,1,'do not drop a prior completed row when the provider has not emitted the active session');

const cryptoMeta={currentTradingPeriod:{regular:{start:sec('2026-09-29T00:00:00Z'),end:sec('2026-09-30T00:00:00Z')}}};
const crypto=[
  {t:sec('2026-09-28T00:00:00Z'),close:100},
  {t:sec('2026-09-29T00:00:00Z'),close:102}
];
assert.equal(completedDailyRows(crypto,cryptoMeta,new Date('2026-09-29T14:30:00Z').getTime()).length,1,'active 24/7 daily candle must remain outside completed-session research');

for(const file of ['scripts/scan-market-hunter-v2.mjs','scripts/scan-market-pulse.mjs','scripts/backtest-market-pulse.mjs']){
  const source=fs.readFileSync(file,'utf8');
  assert.match(source,/completedDailyRows/,'completed-session guard missing from '+file);
}

console.log('PASS: active daily bars are excluded from completed-session research paths');
