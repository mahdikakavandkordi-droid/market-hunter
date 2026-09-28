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

// Cloud sync must use the dedicated Market Hunter project, a publishable browser key,
// authenticated RLS tables, local/cloud merge, and must not expose any secret/service key.
assert.match(html,/ivmpzyjxyfcefjyylybr\.supabase\.co/);
assert.match(html,/sb_publishable_/);
assert.doesNotMatch(html,/sb_secret_/);
assert.doesNotMatch(html,/service_role/);
assert.match(html,/market_hunter_portfolio_state/);
assert.match(html,/market_hunter_portfolio_snapshots/);
assert.match(html,/mergePortfolioPayload/);
assert.match(html,/loadCloudPortfolio/);
assert.match(html,/syncPortfolioCloud/);
assert.match(html,/state\.cloud\.ready=false/);
assert.match(html,/load\(\)\.then\(\(\)=>initializeCloudPortfolio\(\)\)/);
assert.match(html,/Connect cloud/);
assert.match(html,/Create account/);

console.log('Portfolio local persistence, cloud sync, and swipe UI checks passed');
