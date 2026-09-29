import assert from 'node:assert/strict';
import {
  sessionFromReport,presenceAndEpisodes,targetDateForHorizon,buildOutcome,
  appendJsonlStrict,parseJsonl
} from '../lib/market-hunter-forward-validation.js';

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
