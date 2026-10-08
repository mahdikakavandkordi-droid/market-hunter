import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),temp=await fs.mkdtemp(path.join(os.tmpdir(),'mh-fundamental-build-'));
try{
  const input=path.join(temp,'input'),output=path.join(temp,'report');
  await fs.cp(path.join(root,'tests/fixtures/fundamental-pilot'),input,{recursive:true});
  const build=()=>execFileSync(process.execPath,[path.join(root,'scripts/build-fundamental-pilot.mjs'),input,output],{cwd:temp});
  const read=async()=>({report:JSON.parse(await fs.readFile(path.join(output,'latest.json'))),public:JSON.parse(await fs.readFile(path.join(temp,'data/fundamental-context.json')))});
  build();const initial=await read();assert.equal(initial.public.items.length,4);
  const fixtureFile=path.join(input,'BHC.json'),fixture=JSON.parse(await fs.readFile(fixtureFile));
  const broken=structuredClone(fixture);broken.proofs.facts=[];
  await fs.writeFile(fixtureFile,JSON.stringify(broken));build();
  const partial=await read();
  assert.deepEqual(partial.report.snapshots,initial.report.snapshots);
  assert.deepEqual(partial.public.items,initial.public.items);
  assert.equal(partial.report.lastAttempts[0].status,'partial');
  await fs.rm(fixtureFile);build();const missing=await read();
  assert.deepEqual(missing.public.items,initial.public.items);
  assert.equal(missing.report.lastAttempts[0].status,'failed');
  await fs.writeFile(fixtureFile,JSON.stringify(fixture));
  // A newer accepted complete snapshot must survive an older input attempt.
  const prior=await read();const bhc=prior.report.snapshots.find(x=>x.symbol==='BHC.TO');
  bhc.filing.acceptedAt='2026-08-01T00:00:00Z';bhc.reviewedAt='2026-10-08T10:00:00Z';
  await fs.writeFile(path.join(output,'latest.json'),JSON.stringify(prior.report));build();
  const older=await read();assert.deepEqual(older.report.snapshots.find(x=>x.symbol==='BHC.TO'),bhc);
  assert.equal(older.public.items.find(x=>x.symbol==='BHC.TO').reviewedAt,bhc.reviewedAt);
  assert.equal(older.report.lastAttempts[0].status,'complete');
  // A failed first collection has no valid snapshot to publish, but other issuers survive.
  await fs.rm(output,{recursive:true});await fs.rm(fixtureFile);build();const first=await read();
  assert.equal(first.public.items.length,3);assert(!first.public.items.some(x=>x.symbol==='BHC.TO'));
  assert.equal(first.report.lastAttempts[0].status,'failed');
  assert(!(await fs.readdir(path.join(temp,'data'))).some(name=>name.endsWith('.tmp')));
  console.log('Actual generator: partial, missing, older, per-issuer dates and first-run failures preserve safe output');
}finally{await fs.rm(temp,{recursive:true,force:true});}
