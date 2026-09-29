import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('app.css','utf8');
const mobile=fs.readFileSync('mobile-polish.css','utf8');
const theme=fs.readFileSync('theme.css','utf8');
const portfolioApi=fs.readFileSync('api/portfolio.js','utf8');
const researchApi=fs.readFileSync('api/research-data.js','utf8');
const server=fs.readFileSync('server.js','utf8');

assert.match(html,/class="app-shell"/);
assert.match(html,/id="homeView"/);
assert.match(html,/id="shortlistView"/);
assert.match(html,/id="portfolioView"/);
assert.match(html,/id="watchlistView"/);
assert.match(html,/href="\/app\.css"/);
assert.match(html,/src="\/app\.js"/);
assert.match(html,/manifest\.webmanifest/);

assert.doesNotThrow(()=>new Function(app),'app.js must parse');
assert.match(app,/marketHunterPositions/);
assert.match(app,/function portfolioHtml\(/);
assert.match(app,/function openPosition\(/);
assert.match(app,/data-buy/);
assert.match(app,/api\/portfolio/);
assert.match(app,/serviceWorker/);
assert.match(app,/marketHunterPositions/); // preserve the user's existing local portfolio key
assert.match(app,/marketHunterCloudSessionV1/);
assert.match(app,/market_hunter_portfolio_state/);
assert.match(app,/market_hunter_portfolio_snapshots/);
assert.match(app,/dayChangePct/);
assert.match(app,/getJson\('\/api\/intraday'\)/);
assert.match(app,/getJsonFallback\('\/api\/research-data\?kind=daily'/);
assert.match(app,/getJsonFallback\('\/api\/research-data\?kind=pulse'/);
assert.match(app,/getJsonFallback\('\/api\/research-data\?kind=v2'/);
assert.match(app,/Hourly quote · provisional/);
assert.match(app,/Not covered by hourly feed/);
assert.match(app,/completed-session fallback/);
assert.match(app,/quoteMetaHtml/);
assert.match(app,/portfolio-carousel/);
assert.match(app,/Connect cloud/);
assert.match(app,/Account data stays isolated/);
assert.match(app,/Import local data into this account/);
assert.match(app,/revision=eq/);
assert.match(app,/deleted:true/);
assert.match(app,/partial_mixed_dates/);
assert.doesNotMatch(app,/sb_secret_/);
assert.doesNotMatch(app,/service_role/);

assert.match(css,/\.app-shell/);
assert.match(css,/\.portfolio-carousel/);
assert.match(css,/scroll-snap-type:x mandatory/);
assert.match(css,/\.day-change/);
assert.match(css,/\.price-line/);
assert.match(css,/\.quote-meta/);
assert.match(css,/\.cloud-panel/);
assert.match(portfolioApi,/dayChangePct/);
assert.match(portfolioApi,/r\.value\.rows\.at\(-2\)/); // completed-session fallback only; UI prefers /api/intraday
assert.match(researchApi,/raw\.githubusercontent\.com\/mahdikakavandkordi-droid\/market-hunter\/main\/data/);
assert.match(researchApi,/X-Market-Hunter-Source/);
assert.match(researchApi,/s-maxage=60/);
assert.match(server,/\/api\/research-data/);
assert.match(mobile,/@media/);
assert.match(theme,/data-theme="light"/);

for(const secretPattern of [/sb_secret_/,/service_role/,/SUPABASE_SERVICE_ROLE/i]){
  assert.doesNotMatch(app,secretPattern);
  assert.doesNotMatch(html,secretPattern);
}

console.log('Current Market Hunter UI shell, scoped cloud workflow, snapshot guards, PWA, and theme checks passed');
