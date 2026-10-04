import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const run=(cmd,args,cwd,allow=false)=>{
  const r=spawnSync(cmd,args,{cwd,encoding:'utf8'});
  if(r.status!==0&&!allow)throw new Error(cmd+' '+args.join(' ')+' failed\n'+r.stdout+'\n'+r.stderr);
  return r;
};
const git=(args,cwd,allow=false)=>run('git',args,cwd,allow);
const helper=path.resolve('scripts/persist-smc-evidence.mjs');
const branch='research/synthetic-evidence';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'smc-persist-'));
const remote=path.join(root,'remote.git'),seed=path.join(root,'seed'),a=path.join(root,'a'),b=path.join(root,'b');
git(['init','--bare',remote],root);
git(['clone',remote,seed],root);
git(['checkout','-b',branch],seed);
git(['config','user.name','seed'],seed);git(['config','user.email','seed@example.test'],seed);
fs.mkdirSync(path.join(seed,'data/research'),{recursive:true});
const empty={version:'test',updatedAt:'2026-10-01T00:00:00Z',trades:[]};
fs.writeFileSync(path.join(seed,'data/research/test-ledger.json'),JSON.stringify(empty,null,2)+'\n');
fs.writeFileSync(path.join(seed,'data/research/test-latest.json'),'{}\n');
fs.writeFileSync(path.join(seed,'other.txt'),'base\n');
git(['add','.'],seed);git(['commit','-m','seed'],seed);git(['push','-u','origin',branch],seed);

git(['clone','--branch',branch,remote,a],root);
git(['clone','--branch',branch,remote,b],root);
git(['config','user.name','writer-b'],b);git(['config','user.email','b@example.test'],b);
fs.writeFileSync(path.join(b,'other.txt'),'concurrent unrelated evidence\n');
git(['add','other.txt'],b);git(['commit','-m','concurrent branch update'],b);git(['push','origin',branch],b);

const trade={symbol:'AAA.TO',signalT:'2026-10-02T13:30:00.000Z',entryT:'2026-10-02T17:30:00.000Z',dir:1,entry:101,stop:99,target:105,risk:2,status:'open',R:null,exitT:null};
fs.writeFileSync(path.join(a,'data/research/test-ledger.json'),JSON.stringify({version:'test',updatedAt:'2026-10-02T20:00:00Z',trades:[trade]},null,2)+'\n');
fs.writeFileSync(path.join(a,'data/research/test-latest.json'),JSON.stringify({generatedAt:'2026-10-02T20:00:00Z'},null,2)+'\n');

let r=run(process.execPath,[helper,'--branch',branch,'--message','persist synthetic ledger','--files','data/research/test-ledger.json','data/research/test-latest.json'],a,true);
assert.equal(r.status,0,'helper must recover from a non-fast-forward caused by an unrelated concurrent branch write: '+r.stderr);
const remoteLedger=JSON.parse(git(['show',`origin/${branch}:data/research/test-ledger.json`],a).stdout);
assert.equal(remoteLedger.trades.length,1);
assert.equal(remoteLedger.trades[0].entry,101);
assert.equal(git(['show',`origin/${branch}:other.txt`],a).stdout.trim(),'concurrent unrelated evidence');

const before=git(['rev-parse',`origin/${branch}`],a).stdout.trim();
r=run(process.execPath,[helper,'--branch',branch,'--message','persist synthetic ledger','--files','data/research/test-ledger.json','data/research/test-latest.json'],a,true);
assert.equal(r.status,0,'idempotent retry should succeed');
git(['fetch','origin',branch],a);
const after=git(['rev-parse',`origin/${branch}`],a).stdout.trim();
assert.equal(after,before,'no-op retry must not create another commit');

const tampered={...remoteLedger,trades:[{...remoteLedger.trades[0],entry:999}]};
fs.writeFileSync(path.join(a,'data/research/test-ledger.json'),JSON.stringify(tampered,null,2)+'\n');
r=run(process.execPath,[helper,'--branch',branch,'--message','tamper','--files','data/research/test-ledger.json'],a,true);
assert.notEqual(r.status,0,'immutable entry rewrite must be rejected');
assert.match(r.stderr+r.stdout,/immutable field changed/);
git(['fetch','origin',branch],a);
const still=JSON.parse(git(['show',`origin/${branch}:data/research/test-ledger.json`],a).stdout);
assert.equal(still.trades[0].entry,101,'rejected rewrite must not reach remote');

for(const file of ['.github/workflows/smc-forward-paper.yml','.github/workflows/smc-forward-expanded.yml','.github/workflows/smc-forward-alternatives.yml']){
  const src=fs.readFileSync(file,'utf8');
  assert.match(src,/group: smc-forward-evidence-writes/);
  assert.match(src,/persist-smc-evidence\.mjs/);
  assert.match(src,/fetch-depth: 0/);
}

console.log('PASS: SMC persistence survives unrelated concurrent writes, retries idempotently and rejects immutable rewrites');
