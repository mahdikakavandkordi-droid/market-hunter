import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const PIN='df4cdb289f3f111a6c7dcbe1d73e0d694bf25405';
const workflow=fs.readFileSync('.github/workflows/htp-live-prospective.yml','utf8');
assert.doesNotMatch(workflow,/if:\s*steps\.precheck\.outputs\.complete\s*!=\s*'true'/,'completed daily capture must not skip outcome processing');
assert.match(workflow,new RegExp('HTP_PINNED_COLLECTOR_SHA:\\s*'+PIN),'approved collector pin must remain unchanged');
assert.match(workflow,/CAPTURE_WAS_COMPLETE/);
assert.match(workflow,/outcome reconciliation attempt/);
assert.match(workflow,/canonical decisions already exist and remain immutable/);

function runGit(args,options={}){
  return execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],...options});
}
try{runGit(['cat-file','-e',PIN+'^{commit}'])}
catch{
  // Shallow CI clones fetch only the approved commit object; fixture data remains fully local.
  runGit(['fetch','--quiet','--no-tags','--depth=1','origin',PIN]);
  runGit(['cat-file','-e',PIN+'^{commit}']);
}

const root=fs.mkdtempSync(path.join(os.tmpdir(),'market-hunter-htp-integration-'));
const collector=path.join(root,'collector'),evidence=path.join(root,'evidence'),preload=path.join(root,'fixture-provider.mjs');
const today=new Date().toISOString().slice(0,10);

function dateSeries(count=135){
  const end=Date.parse(today+'T12:00:00Z'),out=[];
  for(let i=count-1;i>=0;i--)out.push(new Date(end-i*86400000).toISOString().slice(0,10));
  return out;
}
const dates=dateSeries(),decisionIndex=90,decisionDate=dates[decisionIndex];
assert.ok(dates.length-decisionIndex-2>20,'fixture must contain a matured primary horizon');

const ts=d=>Math.floor(Date.parse(d+'T12:00:00Z')/1000);
const decisionHistory=dates.slice(decisionIndex-14,decisionIndex+1).map(d=>({
  t:ts(d),close:100,rawClose:100,high:101,low:99,rawHigh:101,rawLow:99,volume:1000000
}));
const earlierPickId=['fixture-model-v1',decisionDate,'core','RY.TO'].join('|');
const earlierObservation={
  observationId:['fixture-model-v1',decisionDate,'core'].join('|'),
  collectorVersion:'fixture-seed',
  model:'core',modelVersion:'fixture-model-v1',marketAsOf:decisionDate,
  capturedAt:decisionDate+'T23:00:00.000Z',status:'complete_nonzero',
  intendedUniverseCount:1,evaluatedUniverseCount:1,failedSymbols:[],naturalEligibleCount:1,maxVisible:6,zeroPick:false,
  picks:[{
    symbol:'RY.TO',rank:1,score:1,decisionAtr14:2,atr14Pct:2,
    decisionPriceAnchor:{close:100,rawClose:100},decisionHistory,
    pickObservationId:earlierPickId
  }]
};

const preloadCode=String.raw`
const today=process.env.HTP_FIXTURE_TODAY;
const variant=process.env.HTP_FIXTURE_VARIANT||'full';
function dates(count=135){
  const end=Date.parse(today+'T12:00:00Z'),out=[];
  for(let i=count-1;i>=0;i--)out.push(new Date(end-i*86400000).toISOString().slice(0,10));
  return out;
}
const all=dates(),missingDate=all[90];
const sec=d=>Math.floor(Date.parse(d+'T12:00:00Z')/1000);
function payload(symbol){
  const chosen=(variant==='missing-decision'&&symbol==='RY.TO')?all.filter(d=>d!==missingDate):all;
  const timestamps=chosen.map(sec),n=timestamps.length;
  const close=Array(n).fill(100),high=Array(n).fill(101),low=Array(n).fill(99),volume=Array(n).fill(1000000);
  return {chart:{result:[{
    meta:{
      currency:'CAD',exchangeName:'TOR',regularMarketPrice:100,chartPreviousClose:100,
      regularMarketTime:timestamps.at(-1),
      currentTradingPeriod:{regular:{start:Math.floor(Date.parse(today+'T00:00:00Z')/1000)-3600,end:Math.floor(Date.parse(today+'T00:00:00Z')/1000)-1}}
    },
    timestamp:timestamps,
    indicators:{quote:[{close,high,low,volume}],adjclose:[{adjclose:close}]},
    events:{}
  }],error:null}};
}
globalThis.fetch=async url=>{
  const m=String(url).match(/\/chart\/([^?]+)/);
  if(!m)return {ok:false,status:404,async json(){return {}}};
  const symbol=decodeURIComponent(m[1]);
  return {ok:true,status:200,async json(){return payload(symbol)}};
};
`;

const readJsonl=file=>fs.existsSync(file)?fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(JSON.parse):[];
function runCollector(runId,variant){
  const stdout=execFileSync(process.execPath,['--import',preload,'scripts/collect-healthy-trend-pullback-forward.mjs'],{
    cwd:collector,encoding:'utf8',
    env:{...process.env,
      HTP_FORWARD_DIR:evidence,
      HTP_FORWARD_CONCURRENCY:'48',
      HTP_FORWARD_FETCH_TIMEOUT_MS:'1000',
      HTP_FIXTURE_TODAY:today,
      HTP_FIXTURE_VARIANT:variant,
      GITHUB_RUN_ID:runId,
      GITHUB_RUN_ATTEMPT:'1',
      GITHUB_SHA:PIN
    }
  });
  return stdout;
}

try{
  runGit(['worktree','add','--detach',collector,PIN]);
  fs.mkdirSync(evidence,{recursive:true});
  fs.writeFileSync(path.join(evidence,'observations.jsonl'),JSON.stringify(earlierObservation)+'\n');
  fs.writeFileSync(preload,preloadCode);

  // Run 1: actual approved collector records today's first complete canonical observations.
  // The earlier RY decision-date bar is deliberately absent, so its already-mature horizon
  // cannot yet be reconstructed and no outcome is appended.
  runCollector('fixture-run-1','missing-decision');
  const obsAfterFirst=readJsonl(path.join(evidence,'observations.jsonl'));
  const todayFirst=obsAfterFirst.filter(x=>x.marketAsOf===today);
  assert.equal(todayFirst.length,3,'actual collector must publish exactly three canonical model observations for the complete day');
  assert.ok(todayFirst.every(x=>['complete_nonzero','complete_zero_pick'].includes(x.status)));
  assert.equal(readJsonl(path.join(evidence,'outcomes.jsonl')).some(x=>x.pickObservationId===earlierPickId),false,
    'mature earlier outcome must remain absent while its provider history is unavailable');
  const frozenCanonical=JSON.parse(JSON.stringify(todayFirst));

  // Run 2: same UTC day, after canonical observations already exist. The provider fixture
  // now contains the missing historical bar. Running the real pinned collector must append
  // the matured outcome without rewriting the first complete decisions.
  runCollector('fixture-run-2','full');
  const obsAfterSecond=readJsonl(path.join(evidence,'observations.jsonl')).filter(x=>x.marketAsOf===today);
  assert.deepEqual(obsAfterSecond,frozenCanonical,'later same-day collector run must not rewrite canonical observations or picks');
  let outcomes=readJsonl(path.join(evidence,'outcomes.jsonl')).filter(x=>x.pickObservationId===earlierPickId);
  assert.equal(outcomes.length,1,'later same-day run must append the previously unavailable matured outcome');
  assert.equal(outcomes[0].status,'evaluated');
  assert.equal(outcomes[0].decisionDate,decisionDate);

  // Run 3: idempotency through the same production append-only path.
  runCollector('fixture-run-3','full');
  const obsAfterThird=readJsonl(path.join(evidence,'observations.jsonl')).filter(x=>x.marketAsOf===today);
  assert.deepEqual(obsAfterThird,frozenCanonical);
  outcomes=readJsonl(path.join(evidence,'outcomes.jsonl')).filter(x=>x.pickObservationId===earlierPickId);
  assert.equal(outcomes.length,1,'repeating reconciliation must not duplicate an existing outcome');

  console.log('PASS: actual pinned collector appends a missing matured outcome on a later same-day run while canonical decisions remain immutable');
}finally{
  try{runGit(['worktree','remove','--force',collector])}catch{}
  fs.rmSync(root,{recursive:true,force:true});
}
