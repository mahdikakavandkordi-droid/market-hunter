import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const FIXTURE_NOW='2026-09-29T22:00:00.000Z';
const PIN='df4cdb289f3f111a6c7dcbe1d73e0d694bf25405';
const workflow=fs.readFileSync('.github/workflows/htp-live-prospective.yml','utf8');
assert.doesNotMatch(workflow,/if:\s*steps\.precheck\.outputs\.complete\s*!=\s*'true'/,'completed daily capture must not skip outcome processing');
assert.match(workflow,new RegExp('HTP_PINNED_COLLECTOR_SHA:\\s*'+PIN));
assert.match(workflow,/CAPTURE_WAS_COMPLETE/);
assert.match(workflow,/outcome reconciliation attempt/);

function run(cmd,args,options={}){
  const r=spawnSync(cmd,args,{encoding:'utf8',...options});
  if(r.status!==0)throw new Error([cmd,...args].join(' ')+' failed\nSTDOUT:\n'+r.stdout+'\nSTDERR:\n'+r.stderr);
  return r;
}
{
  const present=spawnSync('git',['cat-file','-e',PIN+'^{commit}'],{encoding:'utf8'});
  if(present.status!==0){
    run('git',['fetch','--quiet','--no-tags','--depth=1','origin',PIN]);
    run('git',['cat-file','-e',PIN+'^{commit}']);
  }
}

const root=fs.mkdtempSync(path.join(os.tmpdir(),'mh-htp-integration-'));
const pinned=path.join(root,'pinned'),evidence=path.join(root,'evidence');
fs.mkdirSync(pinned,{recursive:true});fs.mkdirSync(evidence,{recursive:true});
const archive=path.join(root,'pinned.tar');
const tar=spawnSync('git',['archive','--format=tar','-o',archive,PIN],{encoding:'utf8'});
if(tar.status!==0)throw new Error(tar.stderr);
run('tar',['-xf',archive,'-C',pinned]);

const preload=path.join(root,'fixture-provider.mjs');
fs.writeFileSync(preload,`
const NativeDate=Date;
const fixtureTime=NativeDate.parse('${FIXTURE_NOW}');
globalThis.Date=class extends NativeDate {
  constructor(...args){super(...(args.length?args:[fixtureTime]))}
  static now(){return fixtureTime}
};
const mode=process.env.HTP_FIXTURE_MODE||'initial';
const today=new Date().toISOString().slice(0,10);
const end=new Date(today+'T01:00:00Z').getTime();
const hash=s=>[...s].reduce((a,c)=>(a*33+c.charCodeAt(0))>>>0,5381);
function fullRows(symbol){
  const h=hash(symbol),base=symbol==='^GSPTSE'?30000:40+(h%120);
  return Array.from({length:180},(_,i)=>{
    const t=Math.floor((end-(179-i)*86400000)/1000);
    const wave=Math.sin((i+(h%13))/7)*0.008;
    const close=base*(1+i*0.0012+wave);
    return {t,close,rawClose:close,high:close*1.012,low:close*0.988,volume:2000000+(h%500000)+i*1000};
  });
}
function rowsFor(symbol){
  const rows=fullRows(symbol);
  if(symbol!=='RY.TO'||mode!=='initial')return rows;
  const di=rows.length-25;
  return [...rows.slice(0,di+1),...rows.slice(-14)];
}
function payload(symbol){
  const rows=rowsFor(symbol),timestamps=rows.map(x=>x.t);
  return {chart:{result:[{
    meta:{currency:'CAD',exchangeName:'TOR',currentTradingPeriod:{regular:{end:Math.floor(new Date(today+'T00:00:00Z').getTime()/1000)}}},
    timestamp:timestamps,
    indicators:{quote:[{close:rows.map(x=>x.rawClose),high:rows.map(x=>x.high),low:rows.map(x=>x.low),volume:rows.map(x=>x.volume)}],adjclose:[{adjclose:rows.map(x=>x.close)}]},
    events:{}
  }]}};
}
globalThis.fetch=async url=>{
  const m=String(url).match(/\\/chart\\/([^?]+)/);
  if(!m)return {ok:false,status:404,json:async()=>({})};
  const symbol=decodeURIComponent(m[1]);
  return {ok:true,status:200,json:async()=>payload(symbol)};
};
`);

function fixtureRows(symbol='RY.TO'){
  const today=new Date(FIXTURE_NOW).toISOString().slice(0,10),end=new Date(today+'T01:00:00Z').getTime();
  const h=[...symbol].reduce((a,c)=>(a*33+c.charCodeAt(0))>>>0,5381),base=40+(h%120);
  return Array.from({length:180},(_,i)=>{
    const t=Math.floor((end-(179-i)*86400000)/1000),wave=Math.sin((i+(h%13))/7)*0.008,close=base*(1+i*0.0012+wave);
    return {t,close,rawClose:close,high:close*1.012,low:close*0.988,rawHigh:close*1.012,rawLow:close*0.988,volume:2000000+(h%500000)+i*1000};
  });
}
const full=fixtureRows(),di=full.length-25,decision=full[di],decisionDate=new Date(decision.t*1000).toISOString().slice(0,10);
const earlierPickId=['fixture-model-v1',decisionDate,'core','RY.TO'].join('|');
const seedObservation={
  observationId:['fixture-model-v1',decisionDate,'core'].join('|'),
  collectorVersion:'fixture-seed',model:'core',modelVersion:'fixture-model-v1',marketAsOf:decisionDate,
  capturedAt:FIXTURE_NOW,status:'complete_nonzero',
  picks:[{symbol:'RY.TO',pickObservationId:earlierPickId,decisionAtr14:2,
    decisionPriceAnchor:{close:decision.close,rawClose:decision.rawClose},
    decisionHistory:full.slice(di-14,di+1)}]
};
fs.writeFileSync(path.join(evidence,'observations.jsonl'),JSON.stringify(seedObservation)+'\n');

function collect(mode,runId){
  const r=spawnSync(process.execPath,['--import',preload,'scripts/collect-healthy-trend-pullback-forward.mjs'],{
    cwd:pinned,encoding:'utf8',
    env:{...process.env,HTP_FORWARD_DIR:evidence,HTP_FORWARD_RANGE:'1y',HTP_FORWARD_FETCH_TIMEOUT_MS:'2000',HTP_FORWARD_CONCURRENCY:'32',HTP_FIXTURE_MODE:mode,GITHUB_RUN_ID:runId,GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:PIN}
  });
  if(r.status!==0)throw new Error('collector '+mode+' failed\nSTDOUT:\n'+r.stdout+'\nSTDERR:\n'+r.stderr);
}
const readJsonl=name=>{
  const file=path.join(evidence,name);return fs.existsSync(file)?fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(JSON.parse):[];
};
const today=new Date(FIXTURE_NOW).toISOString().slice(0,10);

collect('initial','fixture-1');
let observations=readJsonl('observations.jsonl'),outcomes=readJsonl('outcomes.jsonl');
const firstToday=observations.filter(x=>x.marketAsOf===today);
assert.equal(firstToday.length,3,'first collector run must record exactly three canonical model observations');
assert.ok(firstToday.every(x=>['complete_nonzero','complete_zero_pick'].includes(x.status)),'first daily observations must be complete');
assert.equal(outcomes.some(x=>x.pickObservationId===earlierPickId),false,'earlier outcome must remain unavailable in the first fixture');
const frozen=JSON.parse(JSON.stringify(firstToday));

collect('mature','fixture-2');
observations=readJsonl('observations.jsonl');outcomes=readJsonl('outcomes.jsonl');
assert.deepEqual(observations.filter(x=>x.marketAsOf===today),frozen,'later same-day collector run must not replace canonical observations or picks');
assert.equal(outcomes.filter(x=>x.pickObservationId===earlierPickId).length,1,'later same-day collector run must append the newly matured outcome');

const outcomeCount=outcomes.length;
collect('mature','fixture-3');
observations=readJsonl('observations.jsonl');outcomes=readJsonl('outcomes.jsonl');
assert.deepEqual(observations.filter(x=>x.marketAsOf===today),frozen,'repeated reconciliation must keep canonical observations immutable');
assert.equal(outcomes.length,outcomeCount,'repeated reconciliation must not duplicate outcomes');
assert.equal(outcomes.filter(x=>x.pickObservationId===earlierPickId).length,1);

fs.rmSync(root,{recursive:true,force:true});
console.log('PASS: pinned collector fixture integration appends delayed matured outcomes without changing same-day canonical decisions');
