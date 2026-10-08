import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {digest} from '../lib/wave-ml/features.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base=path.join(root,'data/research/wave-ml-v1'),dir=path.join(base,'single-hourly-pilot-v1');
const source=JSON.parse(fs.readFileSync(path.join(base,'dataset/manifest.json'))),report=JSON.parse(fs.readFileSync(path.join(dir,'report.json'))),checks=[];
assert.equal(digest(source),report.sourceManifestHash);
for(const s of report.symbols){const e=source.entries.find(e=>e.symbol===s.symbol),raw=JSON.parse(gunzipSync(Buffer.from(fs.readFileSync(path.join(base,'dataset',e.rawFile),'utf8').trim(),'base64')));assert.equal(digest(raw),e.rawChecksum);
 const c=raw.hourly.c,q=c.indicators.quote[0],indices=new Map(c.timestamp.map((t,i)=>[t*1000,i])),counts={absentTimestamp:0,nullQuote:0,invalidOHLC:0},examples=[];
 for(const day of s.incompleteDays)for(const iso of day.missingOrInvalidHours){
  const i=indices.get(Date.parse(iso));let reason;
  if(i===undefined)reason='absentTimestamp';else{const [o,h,l,close]=['open','high','low','close'].map(k=>q[k]?.[i]);if([o,h,l,close].some(x=>x===null||x===undefined))reason='nullQuote';else{assert.ok(![o,h,l,close].every(x=>Number.isFinite(x)&&x>0)||h<Math.max(o,l,close)||l>Math.min(o,h,close),'unexpected_valid_hour_missing_from_pilot');reason='invalidOHLC';}}
  counts[reason]++;if(examples.length<3)examples.push({expectedHour:iso,reason});
 }
 checks.push({symbol:s.symbol,rawSourceHash:e.rawChecksum,missingScheduledHours:Object.values(counts).reduce((n,x)=>n+x,0),counts,examples,allMissingHoursExplainedByRawSource:true});
}
const result={version:'wave-ml-single-hourly-pilot-source-checks-1',pilotReportHash:digest(report),checks,interpretation:'Scheduled short-session hours are required by the approved calendar; null or absent raw quotes are actual unavailable inputs, not invented afternoon-session requirements',finalLabelsOpened:false,trainingStarted:false};
const file=path.join(dir,'source-checks.json');if(fs.existsSync(file))assert.deepEqual(JSON.parse(fs.readFileSync(file)),result);else fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
