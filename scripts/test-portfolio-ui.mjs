import fs from 'node:fs';
import assert from 'node:assert/strict';
import {portfolioExposure} from '../lib/portfolio-exposure.js';

assert.equal(portfolioExposure('AAPL.TO',{sector:'CDR'}).group,'Technology');
assert.equal(portfolioExposure('AAPL.TO').instrument,'CDR');
assert.equal(portfolioExposure('PSLV.TO').group,'Silver');
assert.equal(portfolioExposure('CGL-C.TO').group,'Gold');
assert.equal(portfolioExposure('SVR.C.TO').group,'Silver');
assert.match(portfolioExposure('HUZ.TO').detail,/futures/);
assert.equal(portfolioExposure('CEF.TO').group,'Gold & silver');
assert.equal(portfolioExposure('AEM.TO',{sector:'Materials'}).group,'Materials');
assert.equal(portfolioExposure('FAKE-GOLD.TO').group,'Unknown');
assert.equal(portfolioExposure('AAPL.NE').group,'Unknown');
assert.equal(portfolioExposure('UNKNOWN.TO',{sector:'CDR'}).group,'Unknown');

const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('app.css','utf8');
const mobile=fs.readFileSync('mobile-polish.css','utf8');
const theme=fs.readFileSync('theme.css','utf8');
const portfolioApi=fs.readFileSync('api/portfolio.js','utf8');
const researchApi=fs.readFileSync('api/research-data.js','utf8');
const server=fs.readFileSync('server.js','utf8');
const {allocationData,holdingSector}=new Function('short',app.slice(app.indexOf("let allocationMode="),app.indexOf('function riskHtml()'))+';return {allocationData,holdingSector};')(s=>s.replace('.TO',''));
const allocationRows=[
  {p:{symbol:'RY.TO',quantity:2},x:{sector:'Financials'},display:{price:100}},
  {p:{symbol:'TD.TO',quantity:1},x:{sector:'Financials'},display:{price:50}},
  {p:{symbol:'TEST.TO',quantity:1},x:{sector:'CDR'},display:{price:250}}
];
const allocationFixture={rows:allocationRows,complete:allocationRows,currency:'CAD',value:500};
assert.deepEqual(allocationData(allocationFixture,'holdings').items.map(x=>x.weight),[50,40,10]);
assert.deepEqual(allocationData(allocationFixture,'sectors').items.map(x=>[x.name,x.weight]),[['Financials',50],['Unknown',50]]);
assert.equal(holdingSector({sector:'  '}),'Unknown');
assert.equal(holdingSector({sector:'CDR'}),'Unknown');
assert.equal(holdingSector({sector:'CDR',exposure:portfolioExposure('AAPL.TO')}),'Technology');
assert.equal(holdingSector({sector:null,exposure:portfolioExposure('PHYS.TO')}),'Gold');
assert.ok(allocationData({...allocationFixture,complete:allocationRows.slice(1)},'holdings').reason);
assert.ok(allocationData({...allocationFixture,currency:null},'holdings').reason);
assert.ok(allocationData({...allocationFixture,value:0},'holdings').reason);
assert.ok(allocationData({rows:[],complete:[]},'holdings').reason);
assert.equal(allocationData({rows:[allocationRows[0]],complete:[allocationRows[0]],currency:'CAD',value:200},'holdings').items[0].weight,100);

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
assert.match(fs.readFileSync('quote-policy.js','utf8'),/Intraday quote · current session/);
assert.match(fs.readFileSync('quote-policy.js','utf8'),/hourly quote unavailable/i);
assert.match(fs.readFileSync('quote-policy.js','utf8'),/Completed session/);
assert.match(app,/quoteMetaHtml/);
assert.match(app,/portfolio-carousel/);
assert.match(app,/Swipe to browse ↔/);
assert.doesNotMatch(css,/\.portfolio-layout \.portfolio-carousel\{display:grid!important/,'mobile holdings must remain horizontally swipeable');
assert.match(app,/Backend portfolio/);
assert.match(app,/Supabase is the source of truth/);
assert.match(app,/no email\/password account is required/);
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
assert.match(researchApi,/setHeader\('Cache-Control','no-store'\)/);
assert.match(researchApi,/choosePublishedResearch/);
assert.match(server,/\/api\/research-data/);
assert.match(mobile,/@media/);
assert.match(theme,/data-theme="light"/);

for(const secretPattern of [/sb_secret_/,/service_role/,/SUPABASE_SERVICE_ROLE/i]){
  assert.doesNotMatch(app,secretPattern);
  assert.doesNotMatch(html,secretPattern);
}

console.log('Current Market Hunter UI shell, scoped cloud workflow, snapshot guards, PWA, and theme checks passed');
