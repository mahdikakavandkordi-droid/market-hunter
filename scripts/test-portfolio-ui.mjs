import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(x=>x.trim());
assert.ok(scripts.length>=1,'Expected inline application script');
for(const code of scripts){
  assert.doesNotThrow(()=>new Function(code),'Inline application JavaScript must parse');
}

assert.match(html,/marketHunterPortfolioV2/);
assert.match(html,/dailySnapshots/);
assert.match(html,/recordPortfolioDailySnapshot\(\)/);
assert.match(html,/Close &amp; archive/);
assert.match(html,/position-carousel/);
assert.match(html,/scroll-snap-type:x mandatory/);
assert.match(html,/portfolio-dot/);
assert.match(html,/Backup JSON/);

// Closing a position must archive it rather than delete its durable record.
assert.match(html,/status:'closed'/);
assert.match(html,/state\.portfolio\.positions\[symbol\]=closed/);

// Legacy active-position storage remains synchronized for intraday.js compatibility.
assert.match(html,/marketHunterPositions/);

console.log('Portfolio persistence and swipe UI checks passed');
