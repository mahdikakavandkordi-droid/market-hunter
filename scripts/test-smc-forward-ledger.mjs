import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRunContext,loadLedgerStrict,reconcileLedger,tradeIdentity,evidenceProvenanceClass} from '../lib/smc-forward-evidence.mjs';

const run=createRunContext('test','fixture','2026-10-04T12:00:00.000Z');
const momentum={score:70,bucket:'high'};
const base={symbol:'AAA',signalT:'2026-10-04T08:00:00.000Z',entryT:'2026-10-04T09:00:00.000Z',dir:1,entry:100,stop:95,target:110,risk:5,status:'open',R:null,exitT:null,momentumShadow:momentum};

{
  const prior={trades:[{...base,decisionId:tradeIdentity(base),firstObservedAt:'2026-10-04T08:30:00.000Z',firstObservedProvenance:{tracker:'x'},entryObservationClass:'prospective'}]};
  const observed=[{...base,entry:101,status:'closed',R:2,exitT:'2026-10-04T13:00:00.000Z',momentumShadow:{score:80,bucket:'high'}}];
  const r=reconcileLedger(prior,observed,run);
  assert.equal(r.trades[0].entry,100,'recorded entry must win over revised data');
  assert.equal(r.trades[0].status,'open','core decision conflict must block lifecycle rewrite');
  assert.equal(r.trades[0].momentumShadow.score,70,'momentum snapshot must remain immutable');
  assert.ok(r.runDiscrepancies.some(x=>x.field==='entry'));
  assert.ok(r.runDiscrepancies.some(x=>x.field==='momentumShadow'));
}
{
  const old={...base,decisionId:tradeIdentity(base),firstObservedAt:'2026-10-04T08:30:00.000Z',firstObservedProvenance:{tracker:'x'},entryObservationClass:'prospective'};
  const r=reconcileLedger({trades:[old]},[{...base,status:'closed',R:-1,exitT:'2026-10-04T13:00:00.000Z',exitTimeConvention:'bar_end',momentumShadow:{score:71,bucket:'high'}}],run);
  assert.equal(r.trades[0].status,'closed');
  assert.equal(r.trades[0].R,-1);
  assert.equal(r.trades[0].momentumShadow.score,70,'snapshot revisions cannot rewrite momentum');
}
{
  const old={...base,status:'closed',R:2,exitT:'2026-10-04T13:00:00.000Z'};
  const r=reconcileLedger({trades:[old]},[{...old,R:-1,exitT:'2026-10-04T12:00:00.000Z'}],run);
  assert.equal(r.trades[0].R,2);
  assert.equal(r.trades[0].exitT,'2026-10-04T13:00:00.000Z');
  assert.ok(r.runDiscrepancies.some(x=>x.type==='closed_outcome_revision'));
  assert.equal(r.trades[0].firstObservedAt,undefined,'legacy provenance must not be invented');
}
{
  const r=reconcileLedger({trades:[]},[base],run);
  assert.equal(r.trades.length,1);
  assert.equal(r.trades[0].entryObservationClass,'reconstructed');
  assert.equal(r.trades[0].firstObservedAt,run.observedAt);
  const again=reconcileLedger({trades:r.trades,discrepancyLog:r.discrepancyLog},[base],run);
  assert.deepEqual(again.trades,r.trades,'reprocessing must be idempotent');
}
{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'smc-ledger-'));
  const p=path.join(dir,'ledger.json');
  fs.writeFileSync(p,'{bad json');
  assert.throws(()=>loadLedgerStrict(p,{trades:[]}),/corrupt ledger JSON/);
}
{
  const pending={symbol:'P',signalT:'2026-10-04T08:00:00.000Z',dir:1,status:'pending_entry',R:null,exitT:null,momentumShadow:{score:60,bucket:'medium'},decisionId:'P|2026-10-04T08:00:00.000Z|1',firstObservedAt:'2026-10-04T08:30:00.000Z',firstObservedProvenance:{tracker:'test'},entryObservationClass:'pending'};
  const observed={...pending,entryT:'2026-10-04T12:00:00.000Z',entry:100,stop:95,target:110,risk:5,status:'open'};
  delete observed.firstObservedAt; delete observed.firstObservedProvenance; delete observed.decisionId;
  const r=reconcileLedger({trades:[pending]},[observed],run);
  assert.equal(r.trades[0].status,'open');
  assert.equal(r.trades[0].entry,100);
  assert.equal(r.trades[0].entryObservationClass,'prospective');
  assert.equal(r.summary.lifecycleUpdates,1);
}
{
  const old={...base,decisionId:tradeIdentity(base),firstObservedAt:'2026-10-04T08:30:00.000Z',firstObservedProvenance:{tracker:'x'},entryObservationClass:'prospective'};
  const r=reconcileLedger({trades:[old]},[],run);
  assert.equal(r.trades.length,1,'a fetch/data gap must not erase prior evidence');
  assert.equal(r.trades[0].decisionId,old.decisionId);
  assert.equal(r.summary.missingPreviouslyRecorded,1);
}
{
  const stale={...base,decisionId:tradeIdentity(base),firstObservedAt:'2026-10-04T08:30:00.000Z',firstObservedProvenance:{tracker:'x'},entryObservationClass:'pending'};
  const r=reconcileLedger({trades:[stale]},[],run);
  assert.equal(r.trades[0].entryObservationClass,'prospective','stale pending provenance must normalize even when the trade is not re-observed');
  assert.equal(r.summary.prospectiveCount,1);
  assert.equal(r.summary.reconstructedCount,0);
  assert.equal(r.summary.missingPreviouslyRecorded,1);
}
{
  const r=reconcileLedger({trades:[]},[base],run);
  assert.equal(r.trades[0].firstObservedProvenance.marketDataSource,'Yahoo Finance chart API');
  assert.equal(r.trades[0].firstObservedProvenance.tracker,'test');
  assert.equal(r.trades[0].firstObservedProvenance.cohort,'fixture');
}
{
  assert.throws(
    ()=>reconcileLedger({trades:[]},[base,{...base}],run),
    /duplicate trade identity/,
    'duplicate observations must fail rather than duplicate ledger evidence'
  );
}
{
  const closedProspective={...base,status:'closed',R:2,firstObservedAt:'2026-10-04T08:30:00.000Z',entryObservationClass:'prospective'};
  const closedReconstructed={...base,status:'closed',R:-1,firstObservedAt:'2026-10-04T12:00:00.000Z',entryObservationClass:'pending'};
  const closedLegacy={...base,status:'closed',R:2};
  assert.equal(evidenceProvenanceClass(closedProspective),'prospective');
  assert.equal(evidenceProvenanceClass(closedReconstructed),'reconstructed','reporting must repair stale pending labels from timestamps');
  assert.equal(evidenceProvenanceClass(closedLegacy),'legacy_unprovenanced');
}
console.log('SMC forward ledger integrity tests passed');
