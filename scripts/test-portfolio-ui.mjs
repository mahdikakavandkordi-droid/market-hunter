import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('app.css','utf8');
const mobile=fs.readFileSync('mobile-polish.css','utf8');
const theme=fs.readFileSync('theme.css','utf8');

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

assert.match(css,/\.app-shell/);
assert.match(mobile,/@media/);
assert.match(theme,/data-theme="light"/);

for(const secretPattern of [/sb_secret_/,/service_role/,/SUPABASE_SERVICE_ROLE/i]){
  assert.doesNotMatch(app,secretPattern);
  assert.doesNotMatch(html,secretPattern);
}

console.log('Current Market Hunter UI shell, portfolio workflow, PWA, and theme checks passed');
