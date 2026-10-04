import assert from 'node:assert/strict';
import {simulatePortfolioMarked,latestCompletedMark} from '../lib/smc-forward-portfolio.mjs';

const rules={startingCapital:1000,targetRiskPct:.01,maxPositionPct:.25,maxOpenRiskPct:.04,maxPositions:4,costR:.05};
const long={symbol:'L',signalT:'2026-10-04T00:00:00Z',entryT:'2026-10-04T04:00:00Z',dir:1,entry:100,stop:90,target:120,risk:10,status:'open',R:null,exitT:null};
{
  const marks=new Map([['L',{price:110,markT:'2026-10-04T08:00:00Z',status:'fresh',source:'test'}]]);
  const p=simulatePortfolioMarked([long],rules,{marksBySymbol:marks,observedAt:'2026-10-04T09:00:00Z',runKey:'r1'});
  assert.equal(p.realizedCurrentEquity,1000);
  assert.equal(p.markedCurrentEquity,1010);
  assert.equal(p.open[0].unrealizedPnl,10);
  assert.ok(Math.abs(p.markedReturnPct-.01)<1e-12);
}
{
  const short={...long,symbol:'S',dir:-1,stop:110,target:80};
  const marks=new Map([['S',{price:90,markT:'2026-10-04T08:00:00Z',status:'fresh',source:'test'}]]);
  const p=simulatePortfolioMarked([short],rules,{marksBySymbol:marks,observedAt:'2026-10-04T09:00:00Z',runKey:'r2'});
  assert.equal(p.realizedCurrentEquity,1000);
  assert.equal(p.markedCurrentEquity,1010);
  assert.equal(p.open[0].unrealizedPnl,10);
}
{
  const p=simulatePortfolioMarked([long],rules,{marksBySymbol:new Map(),observedAt:'2026-10-04T09:00:00Z',runKey:'r3'});
  assert.equal(p.markedCurrentEquity,null);
  assert.equal(p.open[0].markStatus,'missing');
  assert.deepEqual(p.markedObservation.missingSymbols,['L']);
}
{
  const bars=[{endT:Date.parse('2026-10-01T08:00:00Z'),c:105}];
  const m=latestCompletedMark(bars,'2026-10-04T09:00:00Z',{freshnessMs:24*3600000});
  assert.equal(m.status,'stale');
}
{
  const one={...rules,maxPositions:1};
  const a={...long,symbol:'A',entryT:'2026-10-04T04:00:00Z',status:'closed',R:2,exitT:'2026-10-04T08:00:00Z',exitTimeConvention:'bar_end'};
  const b={...long,symbol:'B',entryT:'2026-10-04T08:00:00Z'};
  const p=simulatePortfolioMarked([a,b],one,{marksBySymbol:new Map([['B',{price:100,markT:'2026-10-04T12:00:00Z',status:'fresh'}]]),observedAt:'2026-10-04T12:00:00Z',runKey:'r4'});
  assert.ok(p.entered.some(x=>x.symbol==='B'),'capital from a completed prior bar may be reused at the boundary');
}
{
  const one={...rules,maxPositions:1};
  const a={...long,symbol:'A',entryT:'2026-10-04T04:00:00Z',status:'closed',R:2,exitT:'2026-10-04T08:00:00Z'};
  const b={...long,symbol:'B',entryT:'2026-10-04T08:00:00Z'};
  const p=simulatePortfolioMarked([a,b],one,{marksBySymbol:new Map(),observedAt:'2026-10-04T12:00:00Z',runKey:'r5'});
  assert.ok(p.skipped.some(x=>x.symbol==='B'&&x.reason==='max_positions'),'legacy candle-open exit must not free capital within the same candle');
}
{
  const closed={...long,status:'closed',R:2,exitT:'2026-10-04T08:00:00Z',exitTimeConvention:'bar_end'};
  const p=simulatePortfolioMarked([closed],rules,{marksBySymbol:new Map(),observedAt:'2026-10-04T12:00:00Z',runKey:'r6'});
  assert.equal(p.realizedCurrentEquity,1019.5,'0.05R cost must be charged once on a 2R close');
}
{
  const pending={symbol:'P',signalT:'2026-10-04T08:00:00Z',dir:1,status:'pending_entry',R:null,exitT:null};
  const p=simulatePortfolioMarked([pending],rules,{marksBySymbol:new Map(),observedAt:'2026-10-04T12:00:00Z',runKey:'pending'});
  assert.equal(p.enteredCount,0,'pending signals must not consume capital before a validated next-bar open');
  assert.equal(p.realizedCurrentEquity,1000);
}
{
  const closed={...long,symbol:'C',entryT:'2026-10-04T00:00:00Z',status:'closed',R:2,exitT:'2026-10-04T08:00:00Z',exitTimeConvention:'bar_end'};
  const longOpen={...long,symbol:'L2',entryT:'2026-10-04T12:00:00Z'};
  const shortOpen={...long,symbol:'S2',entryT:'2026-10-04T12:00:00Z',dir:-1,stop:110,target:80};
  const marks=new Map([
    ['L2',{price:110,markT:'2026-10-04T16:00:00Z',status:'fresh',source:'test'}],
    ['S2',{price:90,markT:'2026-10-04T16:00:00Z',status:'fresh',source:'test'}]
  ]);
  const p=simulatePortfolioMarked([closed,longOpen,shortOpen],rules,{marksBySymbol:marks,observedAt:'2026-10-04T17:00:00Z',runKey:'reconcile'});
  assert.ok(Math.abs(p.realizedCurrentEquity-1019.5)<1e-9);
  assert.ok(Math.abs(p.cash+p.reservedEntryNotional-p.realizedCurrentEquity)<1e-9,'cash + reserved capital must reconcile realized equity');
  assert.ok(Math.abs(p.markedCurrentEquity-(p.realizedCurrentEquity+p.markedObservation.totalUnrealizedPnl))<1e-9,'marked equity must equal realized equity plus unrealized P/L');
  assert.equal(p.open.length,2);
  assert.ok(p.open.every(x=>Number.isFinite(x.unrealizedPnl)));
  assert.equal(p.costAccounting.closedTradeCostR,.05);
  assert.equal(p.costAccounting.chargedOnceOnSettlement,true);
  assert.equal(p.costAccounting.openMarkedEquityIncludesHypotheticalExitCost,false);
}
{
  const marks=new Map([['L',{price:110,markT:'2026-10-04T03:00:00Z',status:'fresh',source:'test'}]]);
  const p=simulatePortfolioMarked([long],rules,{marksBySymbol:marks,observedAt:'2026-10-04T09:00:00Z',runKey:'pre-entry-mark'});
  assert.equal(p.markedCurrentEquity,null,'a mark from before entry must not value the position');
  assert.equal(p.open[0].markStatus,'pre_entry_or_invalid_mark');
  assert.deepEqual(p.markedObservation.invalidMarkSymbols,['L']);
  assert.deepEqual(p.markedObservation.missingSymbols,['L']);
}
{
  const marks=new Map([['L',{price:110,markT:'2026-10-04T10:00:00Z',status:'fresh',source:'test'}]]);
  const p=simulatePortfolioMarked([long],rules,{marksBySymbol:marks,observedAt:'2026-10-04T09:00:00Z',runKey:'future-mark'});
  assert.equal(p.markedCurrentEquity,null,'a future mark must not be used');
  assert.equal(p.open[0].markStatus,'future_mark_invalid');
}
{
  const prior=[
    {runKey:'a',observedAt:'2026-10-04T08:00:00Z',quality:'incomplete_missing_marks',markedEquity:null,totalUnrealizedPnl:null,missingSymbols:['L'],staleSymbols:[]}
  ];
  const marks=new Map([['L',{price:105,markT:'2026-10-04T12:00:00Z',status:'fresh',source:'test'}]]);
  const p=simulatePortfolioMarked([long],rules,{marksBySymbol:marks,observedAt:'2026-10-04T13:00:00Z',runKey:'b',priorMarkedSeries:prior});
  assert.equal(p.markedSeriesCoverageStartAt,'2026-10-04T08:00:00Z');
  assert.equal(p.firstCompleteMarkedEquityAt,'2026-10-04T13:00:00Z','complete marked-equity coverage must not be backdated to an incomplete observation');
}
console.log('SMC marked portfolio tests passed');
