import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {dailyReportUiContract} from '../lib/daily-report-ui-contract.js';
import {assertHunterSessionCurrent} from '../lib/market-freshness.js';

const workflow=fs.readFileSync('.github/workflows/research-daily-refresh.yml','utf8');
const app=fs.readFileSync('app.js','utf8');
const audit=fs.readFileSync('scripts/audit-daily-market-report-final.mjs','utf8');
assert.deepEqual(dailyReportUiContract(app),{renders:true,beforeMarkets:true});
assert.deepEqual(dailyReportUiContract(app.replaceAll('Market at a glance','A renamed heading').replace('ui("Markets","بازارها")','ui("Market prices","قیمت بازارها")')),{renders:true,beforeMarkets:true});
assert.equal(dailyReportUiContract(app.replace('id="homeBrief"','id="missingBrief"')).renders,false);
assert.equal(dailyReportUiContract(app.replace('id="homeMarkets"','id="missingMarkets"')).beforeMarkets,false);
assert.equal(dailyReportUiContract(app.replaceAll('overview.groups','missingGroups')).renders,false);
assert.equal(dailyReportUiContract(app.replaceAll('MarketHunterOverview.build(p,d','missingOverview(p,d')).renders,false);
assert.equal(dailyReportUiContract(app.replaceAll('d?.keyDevelopments','missingDevelopments')).renders,false);
assert.doesNotMatch(audit,/app\.includes\('What Changed Today'\)/);
const gateScript=workflow.split('Select first post-close Toronto slot')[1].split('run: |')[1].split('\n  refresh:')[0].replace(/^          /gm,'').replaceAll('>> "$GITHUB_OUTPUT"','');
const fixtureDate='date(){ if [[ "$*" == "-u +%F" || "$*" == "+%F" ]]; then printf "%s\\n" "$FIXTURE_DATE"; elif [[ "$*" == "+%H" ]]; then printf "18\\n"; else command date "$@"; fi; };\n';
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

// Execute the production equity-gate step, with only date and scanner IO
// substituted. These fixtures reproduce the actual queued Friday incident.
const stockScript=workflow.split('Refresh V2 stock shortlist source')[1].split('run: |')[1].split('      - name: Validate source snapshots')[0].replace(/^          /gm,'');
const stockFixture='date(){ command date -d "$FIXTURE_INSTANT" "$@"; }; node(){ printf "STOCK_SCAN_EXECUTED\\n"; };\n';
for(const [instant,event,scan] of [
  ['2026-10-10T00:14:54Z','schedule',true],
  ['2026-12-12T01:14:54Z','schedule',true],
  ['2026-10-10T16:00:00Z','push',false],
  ['2026-10-11T16:00:00Z','schedule',false],
  ['2026-10-11T16:00:00Z','workflow_dispatch',true],
  ['2026-10-12T20:30:00Z','schedule',true]
]){
  const result=spawnSync('bash',['-c',stockFixture+stockScript],{encoding:'utf8',env:{...process.env,TZ:'UTC',FIXTURE_INSTANT:instant,GITHUB_EVENT_NAME:event}});
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout.includes('STOCK_SCAN_EXECUTED'),scan,instant+' '+event);
}

const verifiedPulse={markets:[{key:'TSX',asOf:'2026-10-09',freshness:{status:'fresh',latestCompletedSession:'2026-10-09',expectedCompletedSession:'2026-10-09'}}]};
assert.equal(assertHunterSessionCurrent(verifiedPulse,{marketAsOf:'2026-10-09'}),'2026-10-09','latest Friday is valid during weekend/holiday/intraday refresh');
assert.throws(()=>assertHunterSessionCurrent(verifiedPulse,{marketAsOf:'2026-10-08'}),/stale or misaligned/);
assert.throws(()=>assertHunterSessionCurrent(verifiedPulse,{marketAsOf:'2026-10-12'}),/stale or misaligned/,'ahead date must not publish either');
assert.throws(()=>assertHunterSessionCurrent({}, {marketAsOf:'2026-10-09'}),/reference is missing or unverified/);
for(const status of ['stale','provider_failure','unknown']){
  const pulse=structuredClone(verifiedPulse);pulse.markets[0].freshness.status=status;
  assert.throws(()=>assertHunterSessionCurrent(pulse,{marketAsOf:'2026-10-09'}),/reference is missing or unverified/);
}
const inconsistent=structuredClone(verifiedPulse);inconsistent.markets[0].freshness.latestCompletedSession='2026-10-08';
assert.throws(()=>assertHunterSessionCurrent(inconsistent,{marketAsOf:'2026-10-09'}),/reference is missing or unverified/);
assert.match(workflow,/assertHunterSessionCurrent\(pulse,v2\)/,'freshness guard must run before report build/publication');
assert.match(workflow,/node scripts\/test-daily-refresh-production\.mjs/,'refresh must run the incident regression before fetching data');
assert.doesNotMatch(stockScript,/date -u \+%u/);
console.log('PASS: delayed Friday stock refresh, weekend preservation, and verified TSX session publication guard');
