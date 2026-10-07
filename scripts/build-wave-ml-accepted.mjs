import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync,gzipSync} from 'node:zlib';
import {digest} from '../lib/wave-ml/features.mjs';
import {labelDecision} from '../lib/wave-ml/labels.mjs';
import {buildSchedule,acceptExecution} from '../lib/wave-ml/calendar.mjs';
import {buildSplits} from '../lib/wave-ml/splits.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base=path.join(root,'data/research/wave-ml-v1'),dir=path.join(base,'dataset');
const contract=JSON.parse(fs.readFileSync(path.join(base,'contract.json'))),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))),features=JSON.parse(fs.readFileSync(path.join(dir,'feature-manifest.json')));
if(manifest.contractHash!==digest(contract)||features.contractHash!==digest(contract)||features.manifestHash!==digest(manifest))throw Error('provenance_changed');
function read(file,hash){const value=JSON.parse(gunzipSync(Buffer.from(fs.readFileSync(path.join(dir,file),'utf8').trim(),'base64')));if(digest(value)!==hash)throw Error('checksum_mismatch_'+file);return value;}
const accepted=true;
const calendar=accepted?JSON.parse(fs.readFileSync(path.join(base,'official-calendar.json'))):null;
const schedules=accepted?Object.fromEntries(['us','ca'].map(m=>[m,buildSchedule(m,calendar)])):{};
const labels=[],quality=[],coverage={sealedFinalFeatureRows:0,developmentFinalFeatureRows:0,reservedSymbolsSkipped:0};
for(const e of manifest.entries.filter(x=>x.status==='captured')) {
  const original=read(e.file,e.checksum);const snapshot=accepted&&original.mode==='stock'?acceptExecution(original,schedules[e.market]):original;read(e.rawFile,e.rawChecksum);
  const f=features.featureFiles.find(x=>x.symbol===e.symbol);if(!f)throw Error('feature_manifest_missing');const matrix=read(f.file,f.checksum);
  const featureRows=matrix.rows;
  coverage.sealedFinalFeatureRows+=featureRows.filter(r=>r.partition==='sealed_final').length;
  coverage.developmentFinalFeatureRows+=featureRows.filter(r=>r.partition==='development_final_time').length;
  if(contract.split.holdoutSymbols.includes(e.symbol)){coverage.reservedSymbolsSkipped++;continue;}
  let openOnly=0,closeOnly=0,both=0;
  for(const date of snapshot.quality.priceMismatchDates.filter(d=>d<contract.split.finalTestStart.slice(0,10))) {
    const d=snapshot.daily.find(b=>b.date===date),xs=snapshot.executionBars.filter(b=>b.date===date);
    if(!d||!xs.length)throw Error('mismatch_audit_missing');
    const o=Math.abs(xs[0].o-d.o)/d.o>.005,c=Math.abs(xs.at(-1).c-d.c)/d.c>.005;
    if(o&&c)both++;else if(o)openOnly++;else if(c)closeOnly++;
  }
  quality.push({symbol:e.symbol,market:e.market,developmentMismatchDays:openOnly+closeOnly+both,openOnly,closeOnly,both,calendarApproved:['continuous','official_calendar_v1'].includes(snapshot.quality.executionCalendarApproval),zeroEligibleFeatures:featureRows.length===0});
  for(const row of featureRows.filter(r=>['train','validation'].includes(r.partition)))labels.push(labelDecision(row,snapshot,contract,{schedule:schedules[e.market]||null}));
}
const split=buildSplits(labels,contract),counts={};
for(const r of labels){const key=[r.market,r.dir,r.partition].join('|');counts[key]??={rows:0,resolved:0,reasons:{}};const c=counts[key];c.rows++;if(r.status==='resolved')c.resolved++;else c.reasons[r.reason]=(c.reasons[r.reason]||0)+1;}
const labelById=new Map(labels.map(r=>[r.id,r]));const foldCounts={};for(const r of split.records){const label=labelById.get(r.id);const key=[r.fold,r.role,label.market,label.dir].join('|');foldCounts[key]=(foldCounts[key]||0)+1;}
const minimumFailures=[];
for(const w of split.windows.filter(w=>w.name!=='final_fit_only'))for(const market of ['us','ca','crypto'])for(const dir of [1,-1])for(const [role,minimum] of [['fit',500],['evaluate',100]]) {
  const n=foldCounts[[w.name,role,market,dir].join('|')]||0;if(n<minimum)minimumFailures.push({fold:w.name,market,dir,role,count:n,minimum});
}
const fitCoverage=[];
for(const w of split.windows)for(const market of ['us','ca','crypto'])for(const direction of [1,-1]){
 const times=split.records.filter(x=>x.fold===w.name&&x.role==='fit').map(x=>labelById.get(x.id)).filter(x=>x.market===market&&x.dir===direction).map(x=>Date.parse(x.availableAt)).sort((a,b)=>a-b);
 const first=times[0],last=times.at(-1),anniversary=new Date(first);anniversary.setUTCFullYear(anniversary.getUTCFullYear()+1);
 fitCoverage.push({fold:w.name,market,dir:direction,rows:times.length,first:times.length?new Date(first).toISOString():null,last:times.length?new Date(last).toISOString():null,atLeast12Months:times.length>0&&last>=anniversary.getTime()});
}
const output={version:accepted?'wave-ml-task3-calendar-accepted-v2':'wave-ml-task3-development-v1',...(accepted?{calendarHash:digest(calendar)}:{}),contractHash:digest(contract),sourceManifestHash:digest(manifest),featureManifestHash:digest(features),asOf:manifest.asOf,labels,split};
const report={version:output.version,calendarHash:output.calendarHash,calendarApproved:accepted,priceQuarantinePolicy:'unchanged 0.5% boundary check; require complete same-day source path; no rescaling',contractHash:output.contractHash,sourceManifestHash:output.sourceManifestHash,featureManifestHash:output.featureManifestHash,asOf:manifest.asOf,labelHash:digest(labels),splitHash:digest(split),developmentRows:labels.length,resolved:labels.filter(r=>r.status==='resolved').length,unresolved:labels.filter(r=>r.status==='unresolved').length,counts,foldCounts,minimumFailures,fitCoverage,coverage,quality,finalLabelsOpened:false,trainingStarted:false,trainingReady:false,blockers:accepted?['source_mismatch_origin_not_verified_and_affected_paths_quarantined',...(minimumFailures.length?['insufficient_second_validation_window_after_horizon_purge']:[]),'reserved_symbol_feature_feasibility_and_independent_block_support_not_approved']:['stock_calendar_unverified','source_mismatch_origin_not_verified','minimum_support_and_12_month_coverage_not_approved'],outcomePolicy:'ATR challenger; not Elliott account returns; development diagnostics only'};
// Data and labels are separate immutable files; task-2 archive stays unchanged.
const file=path.join(dir,accepted?'task3-calendar-accepted-labels.json.gz.b64':'task3-development-labels.json.gz.b64');if(fs.existsSync(file)){const old=JSON.parse(gunzipSync(Buffer.from(fs.readFileSync(file,'utf8').trim(),'base64')));if(digest(old)!==digest(output))throw Error('label_replay_changed');}else fs.writeFileSync(file,gzipSync(JSON.stringify(output)).toString('base64')+'\n',{flag:'wx'});
fs.writeFileSync(path.join(base,accepted?'task3-calendar-report.json':'task3-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({rows:report.developmentRows,resolved:report.resolved,unresolved:report.unresolved,minimumFailures:minimumFailures.length,finalLabelsOpened:false,trainingReady:false,labelHash:report.labelHash,splitHash:report.splitHash}));
