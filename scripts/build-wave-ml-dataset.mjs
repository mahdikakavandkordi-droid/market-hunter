import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import {chart,normalize,makeSnapshot} from '../lib/wave-ml/source.mjs';
import {buildFeatures,digest} from '../lib/wave-ml/features.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/research/wave-ml-v1/dataset');
const contract=JSON.parse(fs.readFileSync(path.join(root,'data/research/wave-ml-v1/contract.json'),'utf8'));
const capture=process.argv.includes('--capture');
function write(file,value){const text=JSON.stringify(value);fs.writeFileSync(path.join(dir,file),gzipSync(text).toString('base64')+'\n',{flag:'wx'});return digest(value)}
function read(file,checksum){const value=JSON.parse(gunzipSync(Buffer.from(fs.readFileSync(path.join(dir,file),'utf8').trim(),'base64')));if(digest(value)!==checksum)throw Error('checksum_mismatch');return value}
let manifest;
if(capture) {
  if(fs.existsSync(path.join(dir,'manifest.json')))throw Error('snapshot_already_frozen');fs.mkdirSync(dir,{recursive:true});
  const asOf=Date.now(),refs={};
  for(const [market,symbol] of [['us','SPY'],['ca','XIU.TO']]) {const source=await chart(symbol,'5y','1d');refs[market]=normalize(source.c,{mode:'stock',interval:'1d',asOf}).rows.map(b=>b.date);write('reference-'+market+'.json.gz.b64',source)}
  const instruments=Object.entries(contract.universe).flatMap(([cohort,u])=>u.symbols.map(symbol=>({symbol,cohort,market:u.mode==='crypto'?'crypto':symbol.endsWith('.TO')?'ca':'us'}))),entries=[];
  for(let at=0;at<instruments.length;at+=6) {
    const batch=await Promise.all(instruments.slice(at,at+6).map(async item=>{
      try {
        const [daily,hourly]=await Promise.all([chart(item.symbol,'5y','1d'),chart(item.symbol,'2y','1h')]);
        const snapshot=makeSnapshot(item.symbol,item.market,daily,hourly,refs[item.market]||[],asOf);
        const file=item.symbol+'.snapshot.json.gz.b64',rawFile=item.symbol+'.raw.json.gz.b64';
        const rawChecksum=write(rawFile,{daily,hourly}),checksum=write(file,snapshot);
        return {...item,status:'captured',file,checksum,rawFile,rawChecksum,dailyRows:snapshot.daily.length,hourlyRows:snapshot.hourly.length,executionBars:snapshot.executionBars.length};
      }catch(e){return {...item,status:'failed',error:e.message}}
    }));entries.push(...batch);console.log(JSON.stringify({captured:entries.length,total:instruments.length,failures:entries.filter(e=>e.status==='failed').length}));
  }
  manifest={version:'wave-ml-dataset-v1',asOf:new Date(asOf).toISOString(),contractHash:digest(contract),entries};
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
}else manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
if(manifest.contractHash!==digest(contract))throw Error('contract_changed');
const reports=[],featureFiles=[];
for(const entry of manifest.entries.filter(e=>e.status==='captured')) {
  const snapshot=read(entry.file,entry.checksum);read(entry.rawFile,entry.rawChecksum);
  const rows=buildFeatures(snapshot,contract),columns=Object.keys(rows[0]?.features||{});
  const compact={columns,rows:rows.map(({features,...r})=>({...r,values:columns.map(c=>features[c])}))};
  const file=entry.symbol+'.features.json.gz.b64';
  if(fs.existsSync(path.join(dir,file))){const old=JSON.parse(gunzipSync(Buffer.from(fs.readFileSync(path.join(dir,file),'utf8').trim(),'base64')));if(digest(old)!==digest(compact))throw Error('feature_replay_changed')}
  else write(file,compact);
  // Fixed representative prefixes on every real symbol. Full-prefix and future
  // perturbation checks are exercised by synthetic tests without source I/O.
  let prefixChecks=0;
  for(const fraction of [.25,.5,.75,1]){const i=Math.floor((snapshot.daily.length-1)*fraction),time=snapshot.daily[i].endT+300000;
    const partial=buildFeatures(snapshot,contract,{asOf:time}),expected=rows.filter(r=>Date.parse(r.availableAt)<=time);
    if(digest(partial)!==digest(expected))throw Error('prefix_mismatch_'+entry.symbol);prefixChecks++}
  const partitions={};for(const r of rows)partitions[r.partition]=(partitions[r.partition]||0)+1;
  reports.push({symbol:entry.symbol,market:entry.market,rows:rows.length,partitions,prefixChecks,dailyGaps:snapshot.dailyGapBeforeTimes.length,
    executionGaps:snapshot.executionGapBeforeTimes.length,invalidDaily:snapshot.quality.dailyInvalid.length,invalidHourly:snapshot.quality.hourlyInvalid.length,
    splits:snapshot.quality.splits.length,priceMismatchDays:snapshot.quality.priceMismatchDates.length,
    executionCalendarApproval:snapshot.quality.executionCalendarApproval,firstFeature:rows[0]?.availableAt||null,lastFeature:rows.at(-1)?.availableAt||null});
  featureFiles.push({symbol:entry.symbol,file,checksum:digest(compact),rows:rows.length});
}
const report={version:manifest.version,contractHash:manifest.contractHash,manifestHash:digest(manifest),asOf:manifest.asOf,
  captured:reports.length,failed:manifest.entries.filter(e=>e.status!=='captured'),featureRows:reports.reduce((s,r)=>s+r.rows,0),
  realPrefixChecks:reports.reduce((s,r)=>s+r.prefixChecks,0),labelsBuilt:false,trainingStarted:false,
  readiness:'feature_engineering_complete; labels require source-quality and authoritative stock short-session calendar review',reports,featureFiles};
fs.writeFileSync(path.join(dir,'feature-manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({captured:report.captured,failed:report.failed.length,featureRows:report.featureRows,prefixChecks:report.realPrefixChecks}));
