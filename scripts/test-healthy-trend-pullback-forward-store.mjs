import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
import {parseJsonl} from '../lib/healthy-trend-pullback-forward.js';
import {loadSnapshot,canonicalObservations} from '../lib/healthy-trend-pullback-forward-store.js';
import {auditForwardStore} from '../lib/healthy-trend-pullback-forward-audit.js';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'htp-forward-'));
const root=path.join(tmp,'store'),preload=path.join(tmp,'fixture.mjs');
// Exercise the real collector as a subprocess with a fixed clock and no network.
fs.writeFileSync(preload,`
const NativeDate=Date;
const fixed=NativeDate.parse(process.env.FIXTURE_NOW||'2026-09-28T23:00:00Z');
globalThis.Date=class extends NativeDate{
  constructor(...args){super(...(args.length?args:[fixed]));}
  static now(){return fixed;}
};
const {UNIVERSE}=await import(${JSON.stringify(pathToFileURL(path.resolve('lib/universe.js')).href)});
const missing=process.env.FIXTURE_MISSING||UNIVERSE.find(x=>x[2]!=='CDR')[0];
globalThis.fetch=async url=>{
  const symbol=decodeURIComponent(new URL(url).pathname.split('/').at(-1));
  if(process.env.FIXTURE_PARTIAL==='1'&&symbol===missing)throw new Error('fixture_missing');
  const end=NativeDate.parse((process.env.FIXTURE_DAY||'2026-09-28')+'T20:00:00Z')/1000;
  const timestamp=[];
  for(let t=NativeDate.parse('2025-10-01T20:00:00Z')/1000;t<=end;t+=86400){
    const day=new NativeDate(t*1000).getUTCDay();if(day!==0&&day!==6)timestamp.push(t);
  }
  const close=timestamp.map((_,i)=>symbol==='^GSPTSE'?100:100+i*.2);
  const q={close,high:close.map(x=>x+1),low:close.map(x=>x-1),volume:close.map(()=>1000000)};
  return {ok:true,json:async()=>({chart:{result:[{meta:{currency:'CAD',exchangeName:'TOR',currentTradingPeriod:{regular:{end}}},
    timestamp,indicators:{quote:[q],adjclose:[{adjclose:close}]},events:{}}]}})};
};
`);
const read=name=>fs.existsSync(path.join(root,name+'.jsonl'))?parseJsonl(fs.readFileSync(path.join(root,name+'.jsonl'),'utf8')):[];
let runSequence=0;
const run=(extra={})=>{
  const r=spawnSync(process.execPath,['--import',preload,'scripts/collect-healthy-trend-pullback-forward.mjs'],{
    env:{...process.env,HTP_FORWARD_DIR:root,GITHUB_RUN_ID:String(++runSequence),...extra},encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
};
const audit=()=>auditForwardStore({root,inputs:read('inputs'),observations:read('observations'),outcomes:read('outcomes'),runs:read('runs')});
try{
  run({FIXTURE_PARTIAL:'1'});
  assert.equal(read('inputs').length,1);
  assert.ok(read('inputs')[0].observations.every(x=>x.status==='partial_coverage'));
  assert.equal(read('observations').length,0);
  const partial=fs.readFileSync(path.join(root,'inputs.jsonl'),'utf8');
  run();
  assert.ok(fs.readFileSync(path.join(root,'inputs.jsonl'),'utf8').startsWith(partial));
  assert.equal(read('inputs').length,2);
  assert.equal(read('observations').length,3);
  assert.ok(read('observations').some(x=>x.picks.length>0),'fixture must test selected picks');
  assert.equal(audit().failedChecks,0,JSON.stringify(audit().differences));
  const frozen=fs.readFileSync(path.join(root,'observations.jsonl'),'utf8');
  run();
  assert.equal(fs.readFileSync(path.join(root,'observations.jsonl'),'utf8'),frozen);
  // Simulate a crash after journal persistence but before observations publication.
  fs.unlinkSync(path.join(root,'observations.jsonl'));
  run();
  assert.equal(fs.readFileSync(path.join(root,'observations.jsonl'),'utf8'),frozen);
  assert.deepEqual(canonicalObservations(read('inputs')),read('observations'));
  // A run on a later UTC day cannot backfill yesterday's decisions.
  const before=read('inputs').length;
  assert.equal(run({FIXTURE_NOW:'2026-09-29T23:00:00Z'}).status,'market_not_completed');
  assert.equal(read('inputs').length,before);
  // The next completed capture matures prior picks; offline audit replays both stages.
  const missingPick=read('observations').find(x=>x.picks.length).picks[0].symbol;
  run({FIXTURE_NOW:'2026-10-28T23:00:00Z',FIXTURE_DAY:'2026-10-28',FIXTURE_PARTIAL:'1',FIXTURE_MISSING:missingPick});
  assert.ok(!read('outcomes').some(x=>x.symbol===missingPick));
  run({FIXTURE_NOW:'2026-10-28T23:00:00Z',FIXTURE_DAY:'2026-10-28'});
  assert.ok(read('outcomes').some(x=>x.symbol===missingPick),'same-day retry must complete missing outcomes');
  assert.equal(audit().failedChecks,0,JSON.stringify(audit().differences));
  const outcomes=fs.readFileSync(path.join(root,'outcomes.jsonl'),'utf8');
  run({FIXTURE_NOW:'2026-10-28T23:00:00Z',FIXTURE_DAY:'2026-10-28'});
  assert.equal(fs.readFileSync(path.join(root,'outcomes.jsonl'),'utf8'),outcomes);
  // A changed observation and outcome must fail the replay audit.
  const obs=read('observations');obs.find(x=>x.picks.length).picks[0].score+=1;
  assert.ok(auditForwardStore({root,inputs:read('inputs'),observations:obs,outcomes:read('outcomes'),runs:[]}).failedChecks>0);
  const changed=read('outcomes');changed[0].entryPrice+=1;
  assert.ok(auditForwardStore({root,inputs:read('inputs'),observations:read('observations'),outcomes:changed,runs:[]}).failedChecks>0);
  const ref=read('inputs')[0].snapshot,file=path.join(root,ref.path),bytes=fs.readFileSync(file);
  const payload=loadSnapshot(root,ref);payload.format=999;
  fs.writeFileSync(file,gzipSync(JSON.stringify(payload)));
  assert.throws(()=>loadSnapshot(root,ref),/snapshot_hash_mismatch/);
  assert.ok(audit().failedChecks>0);
  fs.writeFileSync(file,bytes);fs.unlinkSync(file);
  assert.ok(audit().failedChecks>0,'missing snapshots must fail closed');
  assert.throws(()=>canonicalObservations([{marketAsOf:'2026-09-28'}]),/legacy_forward_store/);
  console.log('Forward store end-to-end retry, crash recovery, replay and tamper regressions passed');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
