import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {dailyReportUiContract} from '../lib/daily-report-ui-contract.js';

const workflow=fs.readFileSync('.github/workflows/research-daily-refresh.yml','utf8');
const app=fs.readFileSync('app.js','utf8');
const audit=fs.readFileSync('scripts/audit-daily-market-report-final.mjs','utf8');
assert.deepEqual(dailyReportUiContract(app),{renders:true,beforeMarkets:true});
assert.deepEqual(dailyReportUiContract(app.replaceAll('Market at a glance','A renamed heading').replace('ui("Markets","بازارها")','ui("Market prices","قیمت بازارها")')),{renders:true,beforeMarkets:true});
assert.equal(dailyReportUiContract(app.replace('id="homeBrief"','id="missingBrief"')).renders,false);
assert.equal(dailyReportUiContract(app.replace('id="homeMarkets"','id="missingMarkets"')).beforeMarkets,false);
assert.equal(dailyReportUiContract(app.replaceAll('d?.groups','missingGroups')).renders,false);
assert.equal(dailyReportUiContract(app.replaceAll('d?.keyDevelopments','missingDevelopments')).renders,false);
assert.doesNotMatch(audit,/app\.includes\('What Changed Today'\)/);
const gateScript=workflow.split('Select first post-close Toronto slot')[1].split('run: |')[1].split('\n  refresh:')[0].replace(/^          /gm,'').replaceAll('>> "$GITHUB_OUTPUT"','');
const fixtureDate='date(){ if [[ "$*" == "-u +%F" ]]; then printf "%s\\n" "$FIXTURE_DATE"; elif [[ "$*" == "+%H" ]]; then printf "18\\n"; else command date "$@"; fi; };\n';
for(const [day,cron,expected] of [
  ['2026-10-05','30 20 * * 1-5',true],
  ['2026-10-05','30 21 * * 1-5',false],
  ['2026-12-07','30 20 * * 1-5',false],
  ['2026-12-07','30 21 * * 1-5',true]
]){
  const result=spawnSync('bash',['-c',fixtureDate+gateScript],{encoding:'utf8',env:{...process.env,GITHUB_EVENT_NAME:'schedule',GITHUB_OUTPUT:'/dev/stdout',SCHEDULED_CRON:cron,FIXTURE_DATE:day}});
  assert.equal(result.status,0,result.stderr);
  assert.ok(result.stdout.includes('run_refresh='+expected),'delayed runner must preserve intended Toronto slot: '+day+' '+cron);
}

assert.match(workflow,/branches:\s*\n\s*- main/,'daily refresh bootstrap must run from production main');
assert.match(workflow,/ref: main/,'daily refresh must execute approved production code');
assert.match(workflow,/git pull --rebase origin main/);
assert.match(workflow,/git push origin HEAD:main/,'validated daily artifacts must reach production main');
assert.doesNotMatch(workflow,/ref: research\/market-hunter-v2-rebuild/);
assert.doesNotMatch(workflow,/HEAD:research\/market-hunter-v2-rebuild/);
assert.ok(workflow.includes("scripts/audit-daily-market-report-final.mjs"),'audit changes must trigger a fresh daily package');

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
assert.match(audit,/keyDivergences\.every/,'audit should validate divergence structure without forcing a quota');
assert.doesNotMatch(audit,/keyDivergences\?\.length\|\|0\)>=2/,'audit must not force at least two divergences');
assert.match(audit,/api\/research-data\?kind=daily/,'audit must recognize the live daily-report endpoint');
assert.match(audit,/daily-market-report\.json/,'audit must require the static daily-report fallback');

console.log('PASS: validated daily refresh publishes to main and mixed-date labels are explicit');

const assetWorkflow=fs.readFileSync('.github/workflows/asset-freshness-refresh.yml','utf8');
const scheduleDoc=fs.readFileSync('docs/market-data-refresh-schedule.md','utf8');
assert.match(assetWorkflow,/MARKET_PULSE_KEYS/);
assert.match(assetWorkflow,/MARKET_PULSE_MERGE_EXISTING/);
assert.doesNotMatch(assetWorkflow,/backtest-market-pulse/,'targeted freshness retry must not rerun historical backtests');
assert.doesNotMatch(assetWorkflow,/scan-market-hunter-v2/,'targeted freshness retry must not rerun the stock scanner');
assert.match(assetWorkflow,/git diff --exit-code -- data\/v2-latest-scan\.json data\/history\.json data\/market-pulse-state-backtest\.json/);
assert.match(scheduleDoc,/16:30 America\/Toronto/);
assert.match(scheduleDoc,/18:00 local time/);
assert.match(scheduleDoc,/00:15 UTC/);
assert.match(scheduleDoc,/04:15 UTC/);

assert.match(workflow,/Weekend push\/schedule: preserve the latest completed-session V2 stock snapshot/,'weekend code refresh must not silently replace the equity shortlist');
