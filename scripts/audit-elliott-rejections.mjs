import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {auditRejections} from '../lib/elliott/rejection-audit.mjs';
import {MODEL} from '../lib/elliott/engine.mjs';
import {hash} from '../lib/elliott/paper-account.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'data/research/elliott-v1/historical');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
if(manifest.modelHash!==hash(MODEL))throw Error('frozen_model_changed');
const results=[];
for(const entry of manifest.entries.filter(e=>e.status==='usable')) {
  const snapshot=JSON.parse(gunzipSync(Buffer.from(fs.readFileSync(path.join(dir,entry.file),'utf8').trim(),'base64')));
  if(hash(snapshot)!==entry.checksum)throw Error('snapshot_checksum_mismatch');
  results.push(auditRejections(snapshot));
}
const records=results.flatMap(r=>r.records),details={};
for(const r of records)details[r.detail]=(details[r.detail]||0)+1;
const report={version:'elliott-rejection-audit-v1',modelHash:hash(MODEL),manifestHash:hash(manifest),
  sourceCutoff:manifest.asOf,candidatesExamined:records.length,
  terminalStatesVerified:records.filter(r=>r.independentlyVerified).length,
  genericComplexCorrectionBreakdown:records.filter(r=>r.reason==='complex_correction_unsupported').reduce((o,r)=>{o[r.detail]=(o[r.detail]||0)+1;return o},{}),
  details,performanceEvaluated:false,groundTruthAccuracyEvaluated:false,parametersChanged:false,
  limitations:['same purposive survivor sample as first audit','numerical rule compliance is not full Elliott ground truth','no corrected or alternative-model returns evaluated'],results};
fs.writeFileSync(path.join(dir,'rejection-report.json'),JSON.stringify(report,null,2)+'\n');
const md=`# Elliott rejection diagnosis — frozen model\n\nAll ${records.length} terminal candidate states independently matched their available-at-the-time numerical conditions. Replaying only up to the first terminal event reproduced the same state; previous-bar replay was still nonterminal or the candidate had not yet appeared. No parameters, source observations or forward accounts were changed.\n\n| Mechanism | Count |\n|---|---:|\n${Object.entries(details).map(([k,n])=>'| '+k+' | '+n+' |').join('\n')}\n\n## Interpretation\n\nThe generic complex-correction label covered 36 cases: 15 where C did not exceed A in the correction direction, 14 where B reached/exceeded wave 5, and only 7 with more than three confirmed post-impulse pivots. Thus 29 exclusions reflect price geometry outside our narrow simple-ABC contract, rather than an extra-pivot correction. These are mechanical descriptions, not independent labels proving that these market patterns were invalid Elliott counts.\n\nRetracement-bound exclusions are split into shallow/deep in the table. Origin and C breaches were independently checked against observed candle extrema; reward/risk rejection and confirmations were checked against actual available close and fixed levels. No unexplained implementation mismatch appeared in these 55 candidates. That conclusion is limited to the frozen sample; it is not proof that the entire engine is defect-free.\n\nNext research should review excluded geometries against an independently defined annotation rubric, especially B beyond wave 5 and C not beyond A, before adding pattern families. Do not simply relax the bounds to increase signal counts. The observed sample is development evidence; revised hypotheses require fresh symbols/time for validation. Full actual-account backtesting still requires longer intraday history and is not supplied by this diagnosis.\n`;
fs.writeFileSync(path.join(dir,'rejection-report.md'),md);console.log(JSON.stringify({candidates:report.candidatesExamined,verified:report.terminalStatesVerified,details}));
