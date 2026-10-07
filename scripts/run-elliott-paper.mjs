import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runPaperCohort} from '../lib/elliott/paper-runner.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'data/research/elliott-v1/config.json'),'utf8'));
const observedAt=new Date().toISOString();
for(const cohort of Object.keys(config.universes)) {
  const result=await runPaperCohort({config,cohort,runKey:observedAt,
    stateRoot:path.join(root,'data/research/elliott-v1/forward')});
  console.log(JSON.stringify({cohort,status:result.status||'recorded',revision:result.revision}));
}
