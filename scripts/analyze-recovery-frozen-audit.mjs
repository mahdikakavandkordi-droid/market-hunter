import fs from 'node:fs';
import {UNIVERSE} from '../lib/universe.js';
import {PRIORITY_FLOORS} from '../lib/market-hunter-v2-engine.js';

const reports=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const OUT='data/research/recovery-frozen-audit';
fs.mkdirSync(OUT,{recursive:true});

const calendars=reports.map(r=>r?.validation?.calendar).filter(Boolean);
if(calendars.length!==4)throw new Error('Missing frozen validation calendar');
const stable=v=>JSON.stringify(v,Object.keys(v||{}).sort());
const cal=calendars[0];
for(const x of calendars)if(JSON.stringify(x)!==JSON.stringify(calendars[0]))throw new Error('Batch validation calendar mismatch');
if(reports.some(r=>r?.validation?.finalTestOpened!==false))throw new Error('Historical Final must remain sealed');
if(reports.some(r=>r?.finalEvaluation))throw new Error('Historical Final evaluation unexpectedly present');

const engineVersions=[...new Set(reports.map(r=>r.version))];
if(engineVersions.length!==1)throw new Error('Engine version mismatch across batches');
const engineVersion=engineVersions[0];

const meta=new Map(UNIVERSE.map(([symbol,name,sector])=>[symbol,{name,sector}]));
const round=(n,d=4)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const median=a=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};

function summary(rows){
  const r=rows.map(x=>x.forwardReturn).filter(Number.isFinite);
  const ex=rows.map(x=>x.excessReturn).filter(Number.isFinite);
  if(!r.length)return null;
  return {
    n:r.length,
    mean:round(avg(r)),
    median:round(median(r)),
    positiveRate:round(r.filter(x=>x>0).length/r.length*100,2),
    benchmarkBeatRate:ex.length?round(ex.filter(x=>x>0).length/ex.length*100,2):null,
    meanExcess:round(avg(ex)),
    medianExcess:round(median(ex)),
    avgMAE:round(avg(rows.map(x=>x.mae))),
    avgMFE:round(avg(rows.map(x=>x.mfe)))
  };
}

function splitRows(rows){
  const dev=[],validation=[],purged=[];
  for(const row of rows){
    if(row.date<cal.validationStart){
      if(row.outcomeDate<cal.validationStart)dev.push(row); else purged.push({...row,purgeReason:'crosses_development_validation'});
    }else if(row.date<cal.finalStart){
      if(row.outcomeDate<cal.finalStart)validation.push(row); else purged.push({...row,purgeReason:'crosses_validation_final'});
    }else{
      purged.push({...row,purgeReason:'historical_final_or_later'});
    }
  }
  return {development:dev,validation,purged};
}

const allCandidates=reports.flatMap(r=>r.recoverySurfaceReplay?.candidates||[])
  .map(x=>({...x,sector:meta.get(x.symbol)?.sector||'Unknown'}));
const rawRecoveryEpisodes=reports.flatMap(r=>r.recoveryEpisodeReplay?.rows||[])
  .map(x=>({...x,sector:meta.get(x.symbol)?.sector||'Unknown'}));
const horizons=[5,10,20];

function datesFor(h){
  return [...new Set(reports.flatMap(r=>r.recoverySurfaceReplay?.datesByHorizon?.[String(h)]||r.recoverySurfaceReplay?.datesByHorizon?.[h]||[]))].sort();
}
function selectDaily(h,{maxAge=2,scoreMode='surface'}={}){
  const dates=datesFor(h);
  const pool=allCandidates.filter(x=>x.horizon===h&&(maxAge===null||x.stageAge<=maxAge));
  const byDate=new Map();
  for(const x of pool){if(!byDate.has(x.date))byDate.set(x.date,[]);byDate.get(x.date).push(x)}
  const observations=[],daily=[];
  for(const date of dates){
    const eligible=[...(byDate.get(date)||[])].sort((a,b)=>{
      const as=scoreMode==='base'?(a.score??-Infinity):(a.surfaceScore??a.score??-Infinity);
      const bs=scoreMode==='base'?(b.score??-Infinity):(b.surfaceScore??b.score??-Infinity);
      return bs-as||(b.score??-Infinity)-(a.score??-Infinity)||a.symbol.localeCompare(b.symbol);
    });
    const selected=eligible.slice(0,6).map((x,i)=>({...x,surfaceRank:i+1}));
    daily.push({date,eligibleCount:eligible.length,pickCount:selected.length,symbols:selected.map(x=>x.symbol)});
    observations.push(...selected);
  }
  return {dates,daily,observations};
}
function firstSurfaceEpisodes(selection){
  const obsByDate=new Map();
  for(const x of selection.observations){if(!obsByDate.has(x.date))obsByDate.set(x.date,[]);obsByDate.get(x.date).push(x)}
  let prev=new Set();
  const episodes=[];
  for(const date of selection.dates){
    const rows=obsByDate.get(date)||[];
    const now=new Set(rows.map(x=>x.symbol));
    for(const x of rows)if(!prev.has(x.symbol))episodes.push({...x,episodeId:'Recovery|'+x.symbol+'|'+x.date});
    prev=now;
  }
  return episodes;
}
function concentration(rows,key){
  const m=new Map();
  for(const x of rows){
    const k=x[key]??'Unknown';
    if(!m.has(k))m.set(k,{key:k,n:0,sumExcess:0});
    const z=m.get(k);z.n++;if(Number.isFinite(x.excessReturn))z.sumExcess+=x.excessReturn;
  }
  return [...m.values()].map(x=>({...x,meanExcess:round(x.sumExcess/x.n)}))
    .sort((a,b)=>b.sumExcess-a.sumExcess||b.n-a.n);
}
function concentrationSensitivity(rows){
  const symbol=concentration(rows,'symbol').filter(x=>x.sumExcess>0);
  const removeTop=k=>{
    const drop=new Set(symbol.slice(0,k).map(x=>x.key));
    return {removed:[...drop],remaining:summary(rows.filter(x=>!drop.has(x.symbol)))};
  };
  return {
    topPositiveSymbols:symbol.slice(0,10),
    removeTop1:removeTop(1),
    removeTop3:removeTop(3),
    removeTop5:removeTop(5)
  };
}
function familySummary(rows){
  return {
    nonCdr:summary(rows.filter(x=>x.sector!=='CDR')),
    cdrDiagnostic:summary(rows.filter(x=>x.sector==='CDR'))
  };
}
function rngFactory(seed){
  let x=seed>>>0;
  return ()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296};
}
function percentile(a,p){
  const x=a.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!x.length)return null;
  const pos=(x.length-1)*p,lo=Math.floor(pos),hi=Math.ceil(pos);
  return lo===hi?x[lo]:x[lo]+(x[hi]-x[lo])*(pos-lo);
}
function blockBootstrap(rows,dates,seed,reps=5000,block=20){
  const byDate=new Map();
  for(const r of rows){if(!byDate.has(r.date))byDate.set(r.date,[]);byDate.get(r.date).push(r)}
  const rand=rngFactory(seed),means=[],excesses=[],positiveRates=[];
  if(!dates.length)return {reps:0,block,seed,mean95:null,meanExcess95:null,positiveRate95:null};
  for(let rep=0;rep<reps;rep++){
    const sampled=[];
    let drawn=0;
    while(drawn<dates.length){
      const start=Math.floor(rand()*dates.length);
      for(let k=0;k<block&&drawn<dates.length;k++,drawn++){
        const d=dates[(start+k)%dates.length];
        sampled.push(...(byDate.get(d)||[]));
      }
    }
    if(!sampled.length)continue;
    const sr=summary(sampled);
    means.push(sr.mean);excesses.push(sr.meanExcess);positiveRates.push(sr.positiveRate);
  }
  const ci=a=>[round(percentile(a,.025)),round(percentile(a,.975))];
  return {requestedReps:reps,validReps:means.length,block,seed,mean95:ci(means),meanExcess95:ci(excesses),positiveRate95:ci(positiveRates)};
}
function byYear(rows){
  const years=[...new Set(rows.map(x=>x.date.slice(0,4)))].sort();
  return Object.fromEntries(years.map(y=>[y,summary(rows.filter(x=>x.date.startsWith(y))) ]));
}
function featureSlices(rows){
  const rules={
    minorHighBroken:x=>x.highBroken===true,
    freshHighBreak3:x=>x.highBroken===true&&Number.isFinite(x.freshHighBreakAge)&&x.freshHighBreakAge<=3,
    higherLow:x=>x.higherLow===true,
    rs20NonNegative:x=>Number.isFinite(x.rs20)&&x.rs20>=0,
    ma20Reclaimed:x=>Number.isFinite(x.dist20)&&x.dist20>=0,
    volumeSupport:x=>Number.isFinite(x.upDownVolumeRatio)&&x.upDownVolumeRatio>=0.85,
    atrBelow6:x=>Number.isFinite(x.atr14Pct)&&x.atr14Pct<6
  };
  return Object.fromEntries(Object.entries(rules).map(([name,test])=>[
    name,{yes:summary(rows.filter(test)),no:summary(rows.filter(x=>!test(x)))}
  ]));
}

const result={
  format:'market-hunter-recovery-frozen-audit-v1',
  generatedAt:new Date().toISOString(),
  engineVersion,
  finalTestOpened:false,
  calendar:cal,
  interpretation:{
    validationLabel:'previously observed validation history; not untouched out-of-sample',
    observationUnits:['daily surfaced observations','first-surface episodes'],
    selectionRule:'Review First candidates, stageAge <= 2, anti-chase surfaceScore ordering, max 6, no quota fill'
  },
  horizons:{}
};

const exports=[];
for(const h of horizons){
  const current=selectDaily(h,{maxAge:2,scoreMode:'surface'});
  const noAgeLimit=selectDaily(h,{maxAge:null,scoreMode:'surface'});
  const baseRank=selectDaily(h,{maxAge:2,scoreMode:'base'});
  const episodes=firstSurfaceEpisodes(current);
  const obsSplit=splitRows(current.observations),episodeSplit=splitRows(episodes);
  const age0=current.observations.filter(x=>x.stageAge===0);
  const age1=current.observations.filter(x=>x.stageAge===1);
  const age2=current.observations.filter(x=>x.stageAge===2);
  const baseKeys=new Set(baseRank.observations.map(x=>x.date+'|'+x.symbol));
  const surfKeys=new Set(current.observations.map(x=>x.date+'|'+x.symbol));
  const overlap=[...surfKeys].filter(k=>baseKeys.has(k)).length;
  const rawStarts=rawRecoveryEpisodes.filter(x=>x.horizon===h);
  const rawStartsSplit=splitRows(rawStarts);
  const floor=PRIORITY_FLOORS['Recovery'].reviewFirst;
  const rawReviewFirst=rawStarts.filter(x=>Number.isFinite(x.rankScore)&&x.rankScore>=floor);
  const rawReviewSplit=splitRows(rawReviewFirst);
  result.horizons[h]={
    stageStartBaseline:{
      reviewFirstFloor:floor,
      all:{
        combined:summary(rawStarts),
        development:summary(rawStartsSplit.development),
        validation:summary(rawStartsSplit.validation),
        purgedCount:rawStartsSplit.purged.length
      },
      reviewFirst:{
        combined:summary(rawReviewFirst),
        development:summary(rawReviewSplit.development),
        validation:summary(rawReviewSplit.validation),
        purgedCount:rawReviewSplit.purged.length
      }
    },
    coverage:{
      confirmedDates:current.dates.length,
      daysWithPicks:current.daily.filter(x=>x.pickCount>0).length,
      zeroPickDays:current.daily.filter(x=>x.pickCount===0).length,
      totalSurfacedObservations:current.observations.length,
      firstSurfaceEpisodes:episodes.length,
      meanVisibleActiveDays:round(avg(current.daily.filter(x=>x.pickCount>0).map(x=>x.pickCount)))
    },
    currentSurface:{
      all:summary(current.observations),
      development:summary(obsSplit.development),
      validation:summary(obsSplit.validation),
      purgedCount:obsSplit.purged.length,
      byStageAge:{age0:summary(age0),age1:summary(age1),age2:summary(age2)},
      byYear:byYear(current.observations),
      features:featureSlices(current.observations),
      symbolConcentration:concentration(current.observations,'symbol').slice(0,15),
      sectorConcentration:concentration(current.observations,'sector'),
      concentrationSensitivity:concentrationSensitivity(current.observations),
      familySummary:familySummary(current.observations)
    },
    firstSurfaceEpisodes:{
      all:summary(episodes),
      development:summary(episodeSplit.development),
      validation:summary(episodeSplit.validation),
      purgedCount:episodeSplit.purged.length,
      byYear:byYear(episodes),
      features:featureSlices(episodes),
      symbolConcentration:concentration(episodes,'symbol').slice(0,15),
      sectorConcentration:concentration(episodes,'sector'),
      concentrationSensitivity:concentrationSensitivity(episodes),
      familySummary:familySummary(episodes),
      uncertainty:{
        method:'20-confirmed-session circular block bootstrap on the fixed calendar',
        all:blockBootstrap(episodes,current.dates,20260928+h*101),
        development:blockBootstrap(
          episodeSplit.development,
          current.dates.filter(d=>d<cal.validationStart),
          20260928+h*101+1
        ),
        validation:blockBootstrap(
          episodeSplit.validation,
          current.dates.filter(d=>d>=cal.validationStart&&d<cal.finalStart),
          20260928+h*101+2
        )
      }
    },
    policyDiagnostics:{
      noAgeLimit:summary(noAgeLimit.observations),
      currentMaxAge2:summary(current.observations),
      baseRankTop6:summary(baseRank.observations),
      baseVsAntiChaseSelectionOverlap:{
        antiChaseCount:surfKeys.size,baseRankCount:baseKeys.size,intersection:overlap,
        jaccard:round(overlap/new Set([...surfKeys,...baseKeys]).size)
      }
    }
  };
  for(const x of episodes)exports.push({horizon:h,...x});
}

fs.writeFileSync(OUT+'/summary.json',JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(OUT+'/episodes.json',JSON.stringify(exports,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
