import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow=fs.readFileSync('.github/workflows/research-daily-refresh.yml','utf8');
const app=fs.readFileSync('app.js','utf8');

assert.match(workflow,/branches:\s*\n\s*- main/,'daily refresh bootstrap must run from production main');
assert.match(workflow,/ref: main/,'daily refresh must execute approved production code');
assert.match(workflow,/git pull --rebase origin main/);
assert.match(workflow,/git push origin HEAD:main/,'validated daily artifacts must reach production main');
assert.doesNotMatch(workflow,/ref: research\/market-hunter-v2-rebuild/);
assert.doesNotMatch(workflow,/HEAD:research\/market-hunter-v2-rebuild/);

for(const file of [
  'data/market-pulse-latest.json',
  'data/market-pulse-state-backtest.json',
  'data/market-pulse-report.json',
  'data/v2-latest-scan.json',
  'data/daily-market-report.json',
  'data/daily-market-report.md',
  'data/daily-market-report-final-audit.json'
]) assert.ok(workflow.includes(file),'workflow must publish '+file);

assert.match(app,/Completed markets through/);
assert.match(app,/24\/7 through/);
assert.match(app,/Completed-session data through/);

console.log('PASS: validated daily refresh publishes to main and mixed-date labels are explicit');
