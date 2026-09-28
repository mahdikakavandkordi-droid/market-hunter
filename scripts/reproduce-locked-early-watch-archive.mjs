import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const archiveRef=process.env.MH_ARCHIVE_REF||'locked-v2-validation-36420714736-archive-v1';
const archiveRoot=process.env.MH_ARCHIVE_ROOT||'archive/locked-v2-validation/run-36420714736';
const outputFile=path.resolve(process.env.MH_REPRO_OUTPUT||'data/reproduced-v2-early-watch-surface-replay.json');
const reportFile=path.resolve(process.env.MH_REPRO_REPORT||'data/reproduced-v2-early-watch-handoff-comparison.json');
const analyzer=path.join(repoRoot,'scripts/analyze-early-watch-surface-replay.mjs');

function fail(message){throw new Error(message)}
function gitShow(relativePath){
  const spec=archiveRef+':'+archiveRoot+'/'+relativePath;
  const r=spawnSync('git',['show',spec],{cwd:repoRoot,encoding:'utf8',maxBuffer:64*1024*1024});
  if(r.status!==0)fail('git show failed for '+spec+': '+String(r.stderr||r.stdout).trim());
  return r.stdout;
}
function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
function comparableReplay(value){
  const copy=structuredClone(value);
  delete copy.generatedAt;
  return stable(copy);
}
function get(obj,pathParts){
  let cur=obj;
  for(const part of pathParts)cur=cur?.[part];
  return cur;
}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b)}

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-locked-ew-repro-'));
const tmpData=path.join(tmp,'data');
const tmpManifestDir=path.join(tmpData,'frozen/market-hunter-v2-numerical-snapshot');
fs.mkdirSync(tmpManifestDir,{recursive:true});

for(let i=0;i<4;i++){
  fs.writeFileSync(
    path.join(tmpData,'v2-backtest-batch-'+i+'.json'),
    gitShow('raw-reports/batch-'+i+'/v2-backtest-batch-'+i+'.json')
  );
}
fs.writeFileSync(path.join(tmpManifestDir,'manifest.json'),gitShow('snapshot/manifest.json'));

const run=spawnSync(process.execPath,[analyzer],{
  cwd:tmp,
  encoding:'utf8',
  maxBuffer:64*1024*1024,
  env:{
    ...process.env,
    V2_DATASET_LOCK_MANIFEST:'data/frozen/market-hunter-v2-numerical-snapshot/manifest.json',
    V2_OPEN_FINAL_TEST:'0'
  }
});
if(run.status!==0)fail('Early Watch analyzer failed: '+String(run.stderr||run.stdout).trim());

const reproduced=JSON.parse(fs.readFileSync(path.join(tmpData,'v2-early-watch-surface-replay.json'),'utf8'));
const archivedReplay=JSON.parse(gitShow('evidence/v2-early-watch-surface-replay.json'));
if(reproduced?.validationIdentity?.finalTestOpened!==false)fail('Reproduction did not preserve finalTestOpened=false');

const archiveReplayMatch=same(comparableReplay(reproduced),comparableReplay(archivedReplay));

const expectedHandoff={
  5:{
    coverage:{confirmedScanDays:965,partialCoverageDays:0},
    episodes:{n:1259,mean:0.73,meanExcess:0.45,benchmarkBeatRate:53.5,avgMAE:-1.79},
    counts:{inputCount:1661,trainCount:1213,validationCount:448,validationBoundaryPurgedCount:0},
    selection:{scanDays:965,daysWithPicks:628,zeroPickDays:337,maxVisibleObserved:6,capBindingDays:76}
  },
  10:{
    coverage:{confirmedScanDays:960,partialCoverageDays:0},
    episodes:{n:1254,mean:1.23,meanExcess:0.64,benchmarkBeatRate:50.5,avgMAE:-3.18},
    counts:{inputCount:1655,trainCount:1191,validationCount:442,validationBoundaryPurgedCount:22},
    selection:{scanDays:960,daysWithPicks:625,zeroPickDays:335,maxVisibleObserved:6,capBindingDays:76}
  },
  20:{
    coverage:{confirmedScanDays:950,partialCoverageDays:0},
    episodes:{n:1249,mean:2.21,meanExcess:1.01,benchmarkBeatRate:50.5,avgMAE:-5.07},
    counts:{inputCount:1649,trainCount:1174,validationCount:436,validationBoundaryPurgedCount:39},
    selection:{scanDays:950,daysWithPicks:620,zeroPickDays:330,maxVisibleObserved:6,capBindingDays:76}
  }
};

const discrepancies=[];
function compareFields(h,section,actual,expected){
  for(const [key,value] of Object.entries(expected)){
    const got=actual?.[key];
    if(!same(got,value))discrepancies.push({horizon:Number(h),section,field:key,expected:value,actual:got});
  }
}

const horizons={};
for(const h of ['5','10','20']){
  const x=reproduced.horizons[h];
  compareFields(h,'coverage',x.coverage,expectedHandoff[h].coverage);
  compareFields(h,'combined firstSurfaceEpisodes',x.firstSurfaceEpisodes,expectedHandoff[h].episodes);
  compareFields(h,'fixed-calendar counts',x.pickDayObservations?.fixedCalendar?.counts,expectedHandoff[h].counts);
  compareFields(h,'selection',x.selection,expectedHandoff[h].selection);
  horizons[h]={
    combined:{
      firstSurfaceEpisodes:x.firstSurfaceEpisodes,
      pickDayObservations:x.pickDayObservations?.overall,
      coverage:x.coverage,
      selection:x.selection
    },
    development:{
      label:'Development only',
      pickDayObservations:x.pickDayObservations?.fixedCalendar?.train
    },
    validation:{
      label:'Validation only',
      pickDayObservations:x.pickDayObservations?.fixedCalendar?.validation
    },
    splitCounts:x.pickDayObservations?.fixedCalendar?.counts,
    capOrderingTest:x.capOrderingTest
  };
}

const comparison={
  format:'market-hunter-locked-early-watch-reproduction-v1',
  archiveRef,
  archiveRoot,
  validationRunId:36420714736,
  validationCodeSha:'4ff7b858df9e702f0b69485b245bb92ee2db6779',
  historicalFinal:'SEALED',
  finalTestOpened:reproduced.validationIdentity.finalTestOpened,
  archiveReplayMatchIgnoringGeneratedAt:archiveReplayMatch,
  handoffComparison:{status:discrepancies.length?'DISCREPANCIES':'MATCH',discrepancyCount:discrepancies.length,discrepancies},
  horizons
};

fs.mkdirSync(path.dirname(outputFile),{recursive:true});
fs.mkdirSync(path.dirname(reportFile),{recursive:true});
fs.writeFileSync(outputFile,JSON.stringify(reproduced,null,2));
fs.writeFileSync(reportFile,JSON.stringify(comparison,null,2));

console.log('Locked Early Watch reproduction');
console.log('archiveRef='+archiveRef);
console.log('archiveReplayMatchIgnoringGeneratedAt='+archiveReplayMatch);
console.log('handoffComparison='+comparison.handoffComparison.status+' discrepancies='+discrepancies.length);
for(const h of ['5','10','20']){
  const x=horizons[h];
  console.log(
    h+'D Development n='+x.development.pickDayObservations?.n+
    ' mean='+x.development.pickDayObservations?.mean+
    ' excess='+x.development.pickDayObservations?.meanExcess+
    ' | Validation n='+x.validation.pickDayObservations?.n+
    ' mean='+x.validation.pickDayObservations?.mean+
    ' excess='+x.validation.pickDayObservations?.meanExcess+
    ' | Combined episodes n='+x.combined.firstSurfaceEpisodes?.n+
    ' mean='+x.combined.firstSurfaceEpisodes?.mean+
    ' excess='+x.combined.firstSurfaceEpisodes?.meanExcess
  );
}
if(!archiveReplayMatch)process.exitCode=2;
if(discrepancies.length)process.exitCode=3;
