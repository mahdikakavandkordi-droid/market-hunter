import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ichimoku-guard-')),repo=root+'/work',bare=root+'/remote.git';
const script=path.resolve('scripts/persist-ichimoku-evidence.mjs');
function run(cmd,args,cwd=repo){const p=spawnSync(cmd,args,{cwd,encoding:'utf8'});assert.equal(p.status,0,p.stderr||p.stdout);return p}
try{
 fs.mkdirSync(repo);run('git',['init','--bare',bare],root);run('git',['init','-b','research/test'],repo);
 run('git',['config','user.name','fixture']);run('git',['config','user.email','fixture@example.invalid']);run('git',['remote','add','origin',bare]);
 const tr={symbol:'A',signalT:'2026-10-05T00:00Z',dir:1,signalSnapshot:{meanTarget:110},status:'pending_entry',decisionId:'fixture',firstObservedAt:'2026-10-06',firstObservedProvenance:{tracker:'ichimoku-v1'},decisionAvailableAt:'2026-10-06',entryWaitHours:36,historicalDiagnostic:false};
 const ledger={configHash:'frozen',forwardStart:'2026-10-04',trades:[tr]};
 const file='fixture-ledger.json',write=()=>fs.writeFileSync(repo+'/'+file,JSON.stringify(ledger));write();
 run('git',['add',file]);run('git',['commit','-m','fixture']);run('git',['push','-u','origin','research/test']);
 const args=[script,'--branch','research/test','--message','fixture transition','--files',file];
 Object.assign(tr,{status:'cancelled',cancelReason:'entry_window_expired',cancelledAt:'2026-10-08'});write();run(process.execPath,args);
 tr.cancelReason='rewritten';write();assert.notEqual(spawnSync(process.execPath,args,{cwd:repo,encoding:'utf8'}).status,0,'cancelled decision rewrite blocked');
 tr.cancelReason='entry_window_expired';ledger.configHash='changed';write();assert.notEqual(spawnSync(process.execPath,args,{cwd:repo,encoding:'utf8'}).status,0,'config rewrite blocked');
 console.log('Ichimoku persistence: pending-to-cancelled accepted; cancelled evidence and frozen fingerprint rewrite rejected');
}finally{fs.rmSync(root,{recursive:true,force:true})}
