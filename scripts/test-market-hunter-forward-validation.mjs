import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  sessionFromReport,presenceAndEpisodes,targetDateForHorizon,buildOutcome,
  appendJsonlStrict,parseJsonl,marketCalendarDate,reportMarketDate
} from '../lib/market-hunter-forward-validation.js';

assert.equal(marketCalendarDate(Date.parse('2026-10-06T00:11:00Z')),'2026-10-05','post-midnight UTC retry still belongs to Monday in Toronto');
assert.equal(marketCalendarDate(Date.parse('2026-01-07T00:30:00Z')),'2026-01-06','winter offset');
assert.equal(marketCalendarDate(Date.parse('2026-10-06T04:01:00Z')),'2026-10-06','never capture a previous session after exchange-local midnight');
assert.equal(marketCalendarDate(Date.parse('2026-03-09T00:30:00Z')),'2026-03-08','spring DST');
assert.equal(marketCalendarDate(Date.parse('2026-11-02T00:30:00Z')),'2026-11-01','autumn DST');
assert.throws(()=>reportMarketDate({marketAsOf:'2026-10-06',all:[{date:'2026-10-06'},{date:'2026-08-11'}]}),/mixed_report_market_dates/,'an explicit date must not hide stale classified rows');
assert.throws(()=>reportMarketDate({marketAsOf:'2026-10-06',all:[],integratedSurfacePicks:[{date:'2026-08-11'}]}),/mixed_report_surface_dates/);

function pick(symbol,stage,price,score=60){
  return {symbol,name:symbol,sector:'Test',date:'2026-09-01',stage,price,score,surfaceScore:score,evidence:['fixture']};
}
function report(date,stagePicks,integrated){
  const all=[];
  for(const [stage,rows] of Object.entries(stagePicks))for(const row of rows){
    row.date=date;all.push({...row,stage,date});
  }
  return {
    version:'fixture-v1',generatedAt:date+'T22:00:00Z',marketAsOf:date,engineCommit:'fixture',
    stageCounts:{},surfaceCounts:{},integratedSurfaceCounts:{visible:integrated.length},
    surfacePicks:stagePicks,
    integratedSurfacePicks:integrated.map((x,i)=>({...x,date,integratedRank:i+1})),
    all
  };
}
const d1='2026-09-01',d2='2026-09-02';
const a1=pick('AAA.TO','Early Watch',10,65),b1=pick('BBB.TO','Recovery',20,55);
const s1=sessionFromReport(report(d1,{
  'Early Watch':[a1],'Recovery':[b1],'Attractive Growth':[],'Established Move':[]
},[a1,b1]));
const first=presenceAndEpisodes(s1,null,new Map(),false);
assert.equal(first.episodes.length,4);
assert.ok(first.presences.every(x=>x.isFirstSurface));

const a2={...a1,date:d2,price:10.5},b2={...b1,date:d2,stage:'Attractive Growth',price:21};
const s2=sessionFromReport(report(d2,{
  'Early Watch':[a2],'Recovery':[],'Attractive Growth':[b2],'Established Move':[]
},[a2,b2]));
const prior=new Map(first.presences.map(p=>[
  p.scope==='integrated'?'integrated|'+p.symbol:'stage|'+p.stage+'|'+p.symbol,p
]));
const second=presenceAndEpisodes(s2,s1,prior,true);
const aStage=second.presences.find(x=>x.scope==='stage'&&x.symbol==='AAA.TO');
const bStage=second.presences.find(x=>x.scope==='stage'&&x.symbol==='BBB.TO');
const bIntegrated=second.presences.find(x=>x.scope==='integrated'&&x.symbol==='BBB.TO');
assert.equal(aStage.isFirstSurface,false);
assert.equal(bStage.isFirstSurface,true);
assert.equal(bIntegrated.isFirstSurface,false);

const day=(iso,close,high=close,low=close)=>({t:Math.floor(new Date(iso+'T20:00:00Z').getTime()/1000),close,high,low});
const bench=[
  day('2026-09-01',100),day('2026-09-02',101),day('2026-09-03',102),
  day('2026-09-04',103),day('2026-09-05',104),day('2026-09-06',105)
];
const stock=[
  day('2026-09-01',10),day('2026-09-02',10.2,10.3,10.1),day('2026-09-03',10.4,10.5,10.2),
  day('2026-09-04',10.6,10.7,10.4),day('2026-09-05',10.8,10.9,10.6),day('2026-09-06',11,11.2,10.8)
];
assert.equal(targetDateForHorizon(bench,d1,5),'2026-09-06');
const episode=first.episodes.find(x=>x.scope==='stage'&&x.symbol==='AAA.TO');
const targetSession={...s2,marketDate:'2026-09-06',classified:[{symbol:'AAA.TO',stage:'Recovery',score:60,price:11,sector:'Test'}],stagePicks:{...s2.stagePicks,'Recovery':[a2],'Early Watch':[]},integrated:[a2]};
const outcome=buildOutcome({episode,horizon:5,targetDate:'2026-09-06',symbolRows:stock,benchmarkRows:bench,targetSession,computedAt:'2026-09-06T23:00:00Z'});
assert.equal(outcome.stageAtHorizon,'Recovery');
assert.equal(outcome.integratedAtHorizon,true);
assert.ok(outcome.returnPct>9.9&&outcome.returnPct<10.1);
assert.ok(outcome.maxFavourableExcursionPct>11);

const once=appendJsonlStrict('',[s1],x=>x.sessionId);
const twice=appendJsonlStrict(once.text,[s1],x=>x.sessionId);
assert.equal(twice.added.length,0);
assert.equal(parseJsonl(twice.text).length,1);
assert.throws(()=>appendJsonlStrict(once.text,[{...s1,modelVersion:'changed'}],x=>x.sessionId),/append_only_conflict/);

console.log('PASS: four-stage forward validation journaling is append-only and episode-aware');

// Exercise the actual collector after UTC midnight, not just its date helper.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-market-calendar-'));
const source=path.join(temp,'source.json'),store=path.join(temp,'evidence'),preload=path.join(temp,'fixture.mjs');
const fixture={version:'fixture-v1',generatedAt:'2026-10-06T00:10:00Z',marketAsOf:'2026-10-05',surfacePicks:{},integratedSurfacePicks:[],all:[]};
fs.writeFileSync(source,JSON.stringify(fixture));
fs.writeFileSync(preload,`
const NativeDate=Date,ms=NativeDate.parse(process.env.FIXTURE_NOW);
globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[ms]))}static now(){return ms}};
const t=Math.floor(NativeDate.parse('2026-10-05T13:30:00Z')/1000);
globalThis.fetch=async()=>({ok:true,json:async()=>({chart:{result:[{timestamp:[t],meta:{},indicators:{quote:[{close:[100],high:[101],low:[99],volume:[100000]}]}}]}})});
`);
function collectAt(now){return spawnSync(process.execPath,['--import',preload,'scripts/collect-market-hunter-forward-validation.mjs'],{encoding:'utf8',env:{...process.env,MH_FORWARD_DIR:store,MH_FORWARD_SOURCE:source,FIXTURE_NOW:now}})}
let run=collectAt('2026-10-06T00:11:00Z');assert.equal(run.status,0,run.stderr);
assert.equal(JSON.parse(run.stdout).addedSessions,1);
const canonical=fs.readFileSync(path.join(store,'sessions.jsonl'),'utf8');
fs.writeFileSync(source,JSON.stringify({...fixture,generatedAt:'2026-10-06T00:12:00Z'}));
run=collectAt('2026-10-06T00:13:00Z');assert.equal(run.status,0,run.stderr);
assert.equal(JSON.parse(run.stdout).addedSessions,0);
assert.equal(fs.readFileSync(path.join(store,'sessions.jsonl'),'utf8'),canonical,'retry cannot replace the first complete session');
run=collectAt('2026-10-06T04:01:00Z');assert.equal(run.status,0,run.stderr);
assert.equal(JSON.parse(run.stdout).status,'no_completed_market_session');
fs.writeFileSync(source,JSON.stringify({...fixture,marketAsOf:'2026-10-02'}));
run=collectAt('2026-10-06T00:13:00Z');assert.equal(run.status,1);
assert.match(run.stderr,/stale_source_report/);
assert.equal(fs.readFileSync(path.join(store,'sessions.jsonl'),'utf8'),canonical);
console.log('PASS: real collector UTC-midnight capture, immutable retry, exchange-midnight exclusion and stale-source rejection');
