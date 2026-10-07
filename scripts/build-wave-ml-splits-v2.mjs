import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import {digest} from '../lib/wave-ml/features.mjs';
import {buildSplitsV2,partitionV2} from '../lib/wave-ml/splits-v2.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base=path.join(root,'data/research/wave-ml-v1'),dir=path.join(base,'dataset');
const json=file=>JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
const parent=json('contract.json'),contract=json('evaluation-v2-contract.json'),source=json('dataset/manifest.json'),features=json('dataset/feature-manifest.json'),accepted=json('task3-calendar-report.json'),calendar=json('official-calendar.json');
function compressed(file){return JSON.parse(gunzipSync(Buffer.from(fs.readFileSync(path.join(dir,file),'utf8').trim(),'base64')));}
if(contract.parent.contractHash!==digest(parent)||source.contractHash!==digest(parent)||features.contractHash!==digest(parent)||features.manifestHash!==digest(source))throw Error('parent_provenance_mismatch');
const input=compressed('task3-calendar-accepted-labels.json.gz.b64');
if(accepted.asOf!==input.asOf||accepted.calendarApproved!==true||accepted.finalLabelsOpened!==false||accepted.trainingStarted!==false||input.version!=='wave-ml-task3-calendar-accepted-v2'||input.contractHash!==digest(parent)||input.sourceManifestHash!==digest(source)||input.featureManifestHash!==digest(features)||input.calendarHash!==digest(calendar)||digest(input.labels)!==accepted.labelHash||digest(input.split)!==accepted.splitHash||input.asOf!==source.asOf||accepted.calendarHash!==input.calendarHash||accepted.contractHash!==input.contractHash||accepted.sourceManifestHash!==input.sourceManifestHash||accepted.featureManifestHash!==input.featureManifestHash)throw Error('accepted_label_provenance_mismatch');
const tags=[],featureById=new Map(),tagCounts={};
for(const f of features.featureFiles){const matrix=compressed(f.file);if(digest(matrix)!==f.checksum)throw Error('feature_checksum_mismatch');
 for(const r of matrix.rows){if(featureById.has(r.id))throw Error('duplicate_feature_id');featureById.set(r.id,r);
  const partition=partitionV2(r.symbol,r.availableAt,contract);tags.push({id:r.id,symbol:r.symbol,market:r.market,dir:r.dir,availableAt:r.availableAt,partition});const k=r.market+'|'+partition;tagCounts[k]=(tagCounts[k]||0)+1;
 }
}
for(const r of input.labels){const f=featureById.get(r.id);if(!f||['symbol','market','dir','availableAt'].some(k=>f[k]!==r[k]))throw Error('label_feature_identity_mismatch');}
const split=buildSplitsV2(input.labels,contract,{asOf:Date.parse(input.asOf)}),byId=new Map(input.labels.map(r=>[r.id,r])),counts={};
for(const r of split.records){const label=byId.get(r.id),k=[r.fold,r.role,label.market,label.dir].join('|');counts[k]=(counts[k]||0)+1;}
const coverage={};for(const r of split.records){const label=byId.get(r.id),k=[r.fold,r.cohortRole,label.market,label.dir].join('|');coverage[k]=(coverage[k]||0)+1;}
const output={version:'wave-ml-evaluation-v2-task2-manifest-1',parentContractHash:digest(parent),evaluationContractHash:digest(contract),sourceManifestHash:digest(source),featureManifestHash:digest(features),acceptedLabelHash:accepted.labelHash,calendarHash:input.calendarHash,observationCutoff:input.asOf,finalLabelsOpened:false,trainingStarted:false,featureTags:tags,split};
const file=path.join(dir,'evaluation-v2-splits.json.gz.b64');if(fs.existsSync(file)){if(digest(compressed('evaluation-v2-splits.json.gz.b64'))!==digest(output))throw Error('split_v2_replay_changed');}else fs.writeFileSync(file,gzipSync(JSON.stringify(output)).toString('base64')+'\n',{flag:'wx'});
const report={version:output.version,parentContractHash:output.parentContractHash,evaluationContractHash:output.evaluationContractHash,sourceManifestHash:output.sourceManifestHash,featureManifestHash:output.featureManifestHash,acceptedLabelHash:output.acceptedLabelHash,calendarHash:output.calendarHash,observationCutoff:output.observationCutoff,manifestHash:digest(output),splitHash:digest(split),featureTagsHash:digest(tags),featureRows:tags.length,developmentLabelRows:input.labels.length,foldRows:split.records.length,tagCounts,counts,coverage,finalLabelsOpened:false,trainingStarted:false,researchTrainingReady:false,status:'task2_split_implementation; formal causality/replay suite and readiness review remain tasks3_4',finalDecisionDays:39};
const reportPath=path.join(base,'evaluation-v2-task2-report.json');if(fs.existsSync(reportPath)&&digest(JSON.parse(fs.readFileSync(reportPath)))!==digest(report))throw Error('report_v2_replay_changed');else fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({featureRows:report.featureRows,developmentLabels:report.developmentLabelRows,manifestHash:report.manifestHash,validationCounts:Object.fromEntries(Object.entries(counts).filter(([k])=>k.includes('|evaluate|'))),finalLabelsOpened:false,trainingStarted:false}));
