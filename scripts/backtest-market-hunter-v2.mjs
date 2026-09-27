import fs from 'node:fs';
import {captureFrozenDataset,loadFrozenDataset,frozenDataDigest} from '../lib/frozen-dataset.js';
import {UNIVERSE} from '../lib/universe.js';
import {purgedChronSplit,sealedChronSplit} from '../lib/validation-split.js';
import {VERSION,ASSUMPTIONS,PRIORITY_FLOORS,priorityBand,riskFlags,round,pct,avg,median,dayKey,benchmarkHist,metrics,classify,rank,surfaceRank} from '../lib/market-hunter-v2-engine.js';

const batchIndex=Number(process.env.V2_BATCH_INDEX||0);
const batchCount=Math.max(1,Number(process.env.V2_BATCH_COUNT||4));
const range=process.env.V2_RANGE||'5y';
const frozenDatasetFile=process.env.V2_DATASET_FILE||null;
const captureDatasetFile=process.env.V2_DATASET_CAPTURE||null;
const period1=process.env.V2_PERIOD1||null;
const period2=process.env.V2_PERIOD2||null;
const expectedDataSha256=process.env.V2_EXPECT_DATA_SHA256||null;
const finalTestStart=process.env.V2_FINAL_TEST_START||'2026-01-01';
const openFinalTest=process.env.V2_OPEN_FINAL_TEST==='1';
if((period1&&!period2)||(!period1&&period2))throw new Error('V2_PERIOD1 and V2_PERIOD2 must be provided together');
const datasetMode=frozenDatasetFile?'frozen':'live';
const horizons=(process.env.V2_HORIZONS||'5,10,20').split(',').map(Number).filter(x=>x>0);
const maxH=Math.max(...horizons);
const allSymbols=UNIVERSE.map(x=>x[0]);
const symbolMeta=new Map(UNIVERSE.map(x=>[x[0],{name:x[1],sector:x[2]}]));
const symbols=allSymbols.filter((_,i)=>i%batchCount===batchIndex);
const CDR=new Set(UNIVERSE.filter(x=>x[2]==='CDR').map(x=>x[0]));
const benchSymbol=s=>CDR.has(s)?'^IXIC':'^GSPTSE';

async function fetchRows(symbol){
  const windowQuery=period1&&period2
    ?'period1='+encodeURIComponent(period1)+'&period2='+encodeURIComponent(period2)
    :'range='+encodeURIComponent(range);
  const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?'+windowQuery+'&interval=1d&includePrePost=false&events=div%2Csplits';
  const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 MarketHunterV2Research/1.0'}});
  if(!res.ok)throw new Error(symbol+': HTTP '+res.status);
  const j=await res.json(),z=j?.chart?.result?.[0],q=z?.indicators?.quote?.[0]||{},adj=z?.indicators?.adjclose?.[0]?.adjclose||q.close||[];
  const splitDays=new Set(Object.values(z?.events?.splits||{}).map(x=>dayKey(Number(x.date))));
  const rows=(z?.timestamp||[]).map((t,i)=>{
    const rawClose=q.close?.[i],factor=Number.isFinite(adj[i])&&Number.isFinite(rawClose)&&rawClose?adj[i]/rawClose:1;
    return {t,close:adj[i],rawClose,high:Number.isFinite(q.high?.[i])?q.high[i]*factor:null,low:Number.isFinite(q.low?.[i])?q.low[i]*factor:null,volume:q.volume?.[i]};
  }).filter(x=>[x.close,x.rawClose,x.high,x.low,x.volume].every(Number.isFinite)&&x.volume>0);
  return {rows,splitDays};
}

function hadRecentSplit(rows,splitDays,i,lookback=30){
  const start=Math.max(0,i-lookback);
  for(let j=start;j<=i;j++)if(splitDays.has(dayKey(rows[j].t)))return true;
  return false;
}

function summary(a){
  if(!a.length)return null;
  const r=a.map(x=>x.forwardReturn).filter(Number.isFinite),ex=a.map(x=>x.excessReturn).filter(Number.isFinite);
  return {
    n:r.length,mean:round(avg(r)),median:round(median(r)),positiveRate:round(r.filter(x=>x>0).length/r.length*100,1),
    benchmarkBeatRate:ex.length?round(ex.filter(x=>x>0).length/ex.length*100,1):null,meanExcess:round(avg(ex)),
    avgMAE:round(avg(a.map(x=>x.mae))),avgMFE:round(avg(a.map(x=>x.mfe))),
    hitPlus7:round(a.filter(x=>x.hitPlus7).length/a.length*100,1),hitMinus7:round(a.filter(x=>x.hitMinus7).length/a.length*100,1)
  };
}

function dedupe(a,h){
  const out=[],last=new Map();
  for(const e of [...a].sort((x,y)=>x.date.localeCompare(y.date)||x.symbol.localeCompare(y.symbol))){
    const k=e.symbol+'|'+e.stage,prev=last.get(k);
    if(Number.isFinite(prev)&&e.sessionIndex-prev<h)continue;
    out.push(e);last.set(k,e.sessionIndex);
  }
  return out;
}

function quantile(a,q){const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;return x[Math.min(x.length-1,Math.floor((x.length-1)*q))]}
function splitChron(a){
  return sealedChronSplit(a,{trainFraction:.7,finalStart:finalTestStart});
}
function rankingReport(a){
  const sp=splitChron(a),scores=sp.train.map(x=>x.rankScore);
  const q33=quantile(scores,.33),q67=quantile(scores,.67),q80=quantile(scores,.80),q90=quantile(scores,.90);
  const bucket=x=>x.rankScore>=q67?'Top':x.rankScore>=q33?'Middle':'Lower';
  const pack=x=>Object.fromEntries(['Top','Middle','Lower'].map(k=>[k,summary(x.filter(e=>bucket(e)===k))]));
  const above=(rows,t)=>Number.isFinite(t)?summary(rows.filter(e=>e.rankScore>=t)):null;
  return {
    cutDate:sp.cut,
    purge:{
      prePurgeTrainCount:sp.prePurgeTrainCount,
      purgedTrainCount:sp.purgedTrainCount,
      finalBoundaryPurgedCount:sp.finalBoundaryPurgedCount,
      missingOutcomeBeforeFinal:sp.missingOutcomeBeforeFinal,
      trainCount:sp.train.length,
      testCount:sp.test.length,
      finalSealedCount:sp.final.length
    },
    finalSealed:{
      start:sp.finalStart,
      count:sp.final.length,
      opened:openFinalTest,
      ...(openFinalTest?{summary:summary(sp.final)}:{})
    },
    trainThresholds:{q33:round(q33,1),q67:round(q67,1),q80:round(q80,1),q90:round(q90,1)},
    train:pack(sp.train),test:pack(sp.test),
    highPriority:{
      q80:{train:above(sp.train,q80),test:above(sp.test,q80)},
      q90:{train:above(sp.train,q90),test:above(sp.test,q90)}
    }
  };
}
function evidenceSlices(stage,a){
  const one=(name,f)=>({name,yes:summary(a.filter(f)),no:summary(a.filter(x=>!f(x)))});
  const common=[
    one('rs20>=0',x=>Number.isFinite(x.features.rs20)&&x.features.rs20>=0),
    one('upDownVolume>=0.85',x=>Number.isFinite(x.features.upDownVolumeRatio)&&x.features.upDownVolumeRatio>=.85),
    one('higherLow',x=>x.features.higherLow===true),
    one('structureImproving',x=>['Structure improving','Higher highs + higher lows'].includes(x.features.swingTrend)),
    one('atr<6',x=>Number.isFinite(x.features.atr14Pct)&&x.features.atr14Pct<6)
  ];
  if(stage==='Early Watch')return [
    one('freshReclaim<=3',x=>Number.isFinite(x.features.freshReclaimAge)&&x.features.freshReclaimAge<=3),
    one('sellingFading',x=>x.features.sellingFading===true),
    one('downsideDecel',x=>x.features.downsideDecel===true),
    one('volumeShockNearLow',x=>x.features.volumeShockNearLow===true),
    one('momentumPositive',x=>Number.isFinite(x.features.momentumShift)&&x.features.momentumShift>0),
    ...common
  ];
  if(stage==='Recovery')return [
    one('minorHighBroken',x=>x.features.highBroken===true),
    one('freshMinorHighBreak<=1',x=>Number.isFinite(x.features.freshHighBreakAge)&&x.features.freshHighBreakAge<=1),
    one('freshMinorHighBreak<=2',x=>Number.isFinite(x.features.freshHighBreakAge)&&x.features.freshHighBreakAge<=2),
    one('freshMinorHighBreak<=3',x=>Number.isFinite(x.features.freshHighBreakAge)&&x.features.freshHighBreakAge<=3),
    one('momentumShift>=2',x=>Number.isFinite(x.features.momentumShift)&&x.features.momentumShift>=2),
    one('freshReclaim<=5',x=>Number.isFinite(x.features.freshReclaimAge)&&x.features.freshReclaimAge<=5),
    one('absDist20<=3',x=>Number.isFinite(x.features.dist20)&&Math.abs(x.features.dist20)<=3),
    ...common
  ];
  if(stage==='Attractive Growth')return [
    one('rs20>=4',x=>Number.isFinite(x.features.rs20)&&x.features.rs20>=4),
    one('rs60>=0',x=>Number.isFinite(x.features.rs60)&&x.features.rs60>=0),
    one('dist20>=6',x=>Number.isFinite(x.features.dist20)&&x.features.dist20>=6),
    one('ret20>=8',x=>Number.isFinite(x.features.ret20)&&x.features.ret20>=8),
    one('ma20Slope5>=1',x=>Number.isFinite(x.features.ma20Slope5)&&x.features.ma20Slope5>=1),
    ...common
  ];
  return [
    one('rs20>=4',x=>Number.isFinite(x.features.rs20)&&x.features.rs20>=4),
    one('rs60>=8',x=>Number.isFinite(x.features.rs60)&&x.features.rs60>=8),
    one('dist20>=6',x=>Number.isFinite(x.features.dist20)&&x.features.dist20>=6),
    one('ret60>=20',x=>Number.isFinite(x.features.ret60)&&x.features.ret60>=20),
    one('ma50Slope10>=1',x=>Number.isFinite(x.features.ma50Slope10)&&x.features.ma50Slope10>=1),
    ...common
  ];
}


function attractiveGrowthRiskDiagnostic(a){
  const review=e=>priorityBand('Attractive Growth',e.rankScore)==='Review First';
  const atrOk=e=>!Number.isFinite(e.features.atr14Pct)||e.features.atr14Pct<6;
  const distOk=e=>!Number.isFinite(e.features.dist20)||e.features.dist20<6;
  const rsiOk=e=>!Number.isFinite(e.features.rsi14)||e.features.rsi14<75;
  const pack=rows=>{const sp=splitChron(rows);return {overall:summary(rows),train:summary(sp.train),test:summary(sp.test)}};
  const variants={
    reviewFirst:e=>review(e),
    reviewNoHighATR:e=>review(e)&&atrOk(e),
    reviewNotExtended:e=>review(e)&&distOk(e),
    reviewNoHighRSI:e=>review(e)&&rsiOk(e),
    reviewATRAndDistance:e=>review(e)&&atrOk(e)&&distOk(e),
    cleanReview:e=>review(e)&&atrOk(e)&&distOk(e)&&rsiOk(e)
  };
  return {
    status:'attractive-growth-risk-diagnostic-v1',
    note:'Diagnostic only. Attractive Growth classification/ranking unchanged.',
    variants:Object.fromEntries(Object.entries(variants).map(([name,test])=>[name,pack(a.filter(test))]))
  };
}

function recoveryStructureDiagnostic(a){
  const broken=e=>e.features.highBroken===true;
  const freshBreak=e=>Number.isFinite(e.features.freshHighBreakAge)?e.features.freshHighBreakAge:null;
  const higherLow=e=>e.features.higherLow===true;
  const improving=e=>['Structure improving','Higher highs + higher lows'].includes(e.features.swingTrend);
  const strongMomentum=e=>Number.isFinite(e.features.momentumShift)&&e.features.momentumShift>=2;
  const rs0=e=>Number.isFinite(e.features.rs20)&&e.features.rs20>=0;
  const volSupport=e=>Number.isFinite(e.features.upDownVolumeRatio)&&e.features.upDownVolumeRatio>=.85;
  const ma20Reclaimed=e=>Number.isFinite(e.features.dist20)&&e.features.dist20>=0;
  const review=e=>priorityBand('Recovery',e.rankScore)==='Review First';

  const variants={
    baseline:e=>true,
    ma20Reclaimed:e=>ma20Reclaimed(e),
    reviewFirstAndMa20Reclaimed:e=>review(e)&&ma20Reclaimed(e),
    requireMinorHighBreak:e=>broken(e),
    breakOrHigherLow:e=>broken(e)||higherLow(e),
    structuralConfirmation:e=>broken(e)||improving(e),
    breakWithSupport:e=>broken(e)&&(strongMomentum(e)||rs0(e)||volSupport(e)),
    currentReviewFirst:e=>review(e),
    reviewFirstAndBreak:e=>review(e)&&broken(e),
    reviewFirstAndBreakWithSupport:e=>review(e)&&broken(e)&&(strongMomentum(e)||rs0(e)||volSupport(e)),
    freshBreak1:e=>Number.isFinite(freshBreak(e))&&freshBreak(e)<=1,
    freshBreak2:e=>Number.isFinite(freshBreak(e))&&freshBreak(e)<=2,
    freshBreak3:e=>Number.isFinite(freshBreak(e))&&freshBreak(e)<=3,
    reviewFirstFreshBreak1:e=>review(e)&&Number.isFinite(freshBreak(e))&&freshBreak(e)<=1,
    reviewFirstFreshBreak2:e=>review(e)&&Number.isFinite(freshBreak(e))&&freshBreak(e)<=2,
    reviewFirstFreshBreak3:e=>review(e)&&Number.isFinite(freshBreak(e))&&freshBreak(e)<=3
  };

  const pack=rows=>{
    const sp=splitChron(rows);
    return {overall:summary(rows),train:summary(sp.train),test:summary(sp.test)};
  };

  const candidateRank=(scoreFn)=>{
    const sp=splitChron(a);
    const train=sp.train.map(e=>({...e,candidateScore:scoreFn(e)}));
    const test=sp.test.map(e=>({...e,candidateScore:scoreFn(e)}));
    const q80=quantile(train.map(e=>e.candidateScore),.80);
    const above=(rows,t)=>summary(rows.filter(e=>Number.isFinite(t)&&e.candidateScore>=t));
    return {cutDate:sp.cut,trainQ80:round(q80,1),q80:{train:above(train,q80),test:above(test,q80)}};
  };

  const ranking={
    current:candidateRank(e=>e.rankScore),
    minorHighBoost:candidateRank(e=>e.rankScore+(broken(e)?10:0)),
    confirmedBreakBoost:candidateRank(e=>e.rankScore+(broken(e)?10:0)+(broken(e)&&rs0(e)?4:0))
  };

  return {
    status:'recovery-structure-diagnostic-v2',
    note:'Diagnostic only. Recovery classification and production ranking are unchanged.',
    variants:Object.fromEntries(Object.entries(variants).map(([name,test])=>[name,pack(a.filter(test))])),
    ranking
  };
}

function earlyWatchRewriteDiagnostic(a){
  const fresh=e=>Number.isFinite(e.features.freshReclaimAge)&&e.features.freshReclaimAge<=3;
  const rs0=e=>Number.isFinite(e.features.rs20)&&e.features.rs20>=0;
  const rsM5=e=>Number.isFinite(e.features.rs20)&&e.features.rs20>=-5;
  const exhaust=e=>e.features.downsideDecel===true&&e.features.volumeShockNearLow===true;

  // Inclusion variants are intentionally simple and outcome-blind.
  // They test whether weak standalone evidence (selling fade / bare reclaim)
  // is diluting the chart-discovery cohort.
  const inclusion={
    baseline:e=>true,
    noSellingFadeOnly:e=>fresh(e)||exhaust(e),
    supportedReclaimOrExhaustion:e=>exhaust(e)||(fresh(e)&&(e.features.downsideDecel===true||e.features.volumeShockNearLow===true||rsM5(e))),
    coreExhaustion:e=>exhaust(e)
  };

  const packRows=rows=>{
    const sp=splitChron(rows);
    return {overall:summary(rows),train:summary(sp.train),test:summary(sp.test)};
  };

  const candidateRank=(rows,scoreFn)=>{
    const sp=splitChron(rows);
    const train=sp.train.map(e=>({...e,candidateScore:scoreFn(e)}));
    const test=sp.test.map(e=>({...e,candidateScore:scoreFn(e)}));
    const q80=quantile(train.map(e=>e.candidateScore),.80);
    const q90=quantile(train.map(e=>e.candidateScore),.90);
    const above=(x,t)=>summary(x.filter(e=>Number.isFinite(t)&&e.candidateScore>=t));
    return {cutDate:sp.cut,trainThresholds:{q80:round(q80,1),q90:round(q90,1)},q80:{train:above(train,q80),test:above(test,q80)},q90:{train:above(train,q90),test:above(test,q90)}};
  };

  const base=a.filter(inclusion.supportedReclaimOrExhaustion);
  const rankers={
    current:e=>e.rankScore,
    robustCore:e=>{
      let s=0;
      if(e.features.downsideDecel===true)s+=40;
      if(e.features.volumeShockNearLow===true)s+=20;
      if(rs0(e))s+=25;
      else if(rsM5(e))s+=10;
      if(fresh(e)&&(e.features.downsideDecel===true||e.features.volumeShockNearLow===true))s+=5;
      return s;
    },
    rsForward:e=>{
      let s=0;
      if(e.features.downsideDecel===true)s+=35;
      if(e.features.volumeShockNearLow===true)s+=15;
      if(rs0(e))s+=35;
      else if(rsM5(e))s+=15;
      return s;
    },
    balancedEvidence:e=>{
      let s=0;
      if(e.features.downsideDecel===true)s+=35;
      if(e.features.volumeShockNearLow===true)s+=15;
      if(rs0(e))s+=25;
      else if(rsM5(e))s+=15;
      else if(Number.isFinite(e.features.rs20)&&e.features.rs20>=-10)s+=6;
      if(fresh(e))s+=3;
      if(Number.isFinite(e.features.upDownVolumeRatio)&&e.features.upDownVolumeRatio>=.85)s+=4;
      if(Number.isFinite(e.features.momentumShift)&&e.features.momentumShift<=-5)s-=8;
      if(e.features.swingTrend==='Structure improving')s+=2;
      else if(e.features.swingTrend==='Higher highs + higher lows')s+=3;
      return Math.max(0,s);
    }
  };

  return {
    status:'early-watch-rewrite-diagnostic-v1',
    inclusion:Object.fromEntries(Object.entries(inclusion).map(([name,test])=>[name,packRows(a.filter(test))])),
    rankBase:'supportedReclaimOrExhaustion',
    ranking:Object.fromEntries(Object.entries(rankers).map(([name,scoreFn])=>[name,candidateRank(base,scoreFn)]))
  };
}

const needed=[...new Set([...symbols,...symbols.map(benchSymbol)])];
let data={};
let datasetInfo={mode:datasetMode,file:frozenDatasetFile||captureDatasetFile||null,sha256:null,dataSha256:null,snapshotId:null,period1,period2};

if(frozenDatasetFile){
  const loaded=loadFrozenDataset(frozenDatasetFile,{
    expectedRange:range,
    expectedBatchIndex:batchIndex,
    expectedBatchCount:batchCount,
    expectedSymbols:needed
  });
  data=loaded.data;
  datasetInfo={mode:'frozen',file:frozenDatasetFile,sha256:loaded.sha256,dataSha256:loaded.dataSha256,snapshotId:loaded.snapshotId,capturedAt:loaded.capturedAt,period1,period2};
  console.log('loaded frozen dataset '+loaded.snapshotId+' '+loaded.sha256);
}else{
  for(const s of needed){
    process.stdout.write('fetch '+s+'... ');
    try{data[s]=await fetchRows(s);console.log(data[s].rows.length)}
    catch(e){console.log('SKIP '+e.message);data[s]={rows:[],splitDays:new Set()}}
  }
  const dataSha256=frozenDataDigest({range,batchIndex,batchCount,symbols:needed,data});
  datasetInfo={...datasetInfo,dataSha256};
  if(expectedDataSha256&&dataSha256!==expectedDataSha256){
    throw new Error('Dataset drift detected for batch '+batchIndex+': '+dataSha256+' != '+expectedDataSha256);
  }
  if(captureDatasetFile){
    const captured=captureFrozenDataset(captureDatasetFile,{
      range,batchIndex,batchCount,symbols:needed,data,
      engineVersion:VERSION
    });
    datasetInfo={mode:'captured-live',file:captureDatasetFile,sha256:captured.sha256,dataSha256:captured.dataSha256,snapshotId:captured.snapshotId,capturedAt:captured.capturedAt,period1,period2};
    console.log('captured frozen dataset '+captured.snapshotId+' '+captured.sha256+' data '+captured.dataSha256);
  }
}

const rawEvents=[],surfaceReplayCandidates=[],recoverySurfaceReplayCandidates=[],attractiveGrowthSurfaceReplayCandidates=[],establishedMoveSurfaceReplayCandidates=[],surfaceReplayDates=new Set(),latest=[];
for(const symbol of symbols){
  const pack=data[symbol],rows=pack.rows,benchPack=data[benchSymbol(symbol)],benchRows=benchPack?.rows||[];
  if(rows.length<120||benchRows.length<80)continue;
  let prevStage=null,prevStageAge=-1;
  for(let i=100;i<rows.length-maxH;i++){
    if(hadRecentSplit(rows,pack.splitDays,i))continue;
    const date=dayKey(rows[i].t),hist=rows.slice(0,i+1),bh=benchmarkHist(benchRows,date);
    if(!bh||bh.length<65)continue;
    const m=metrics(hist,bh);if(!m)continue;
    if(rows[i].rawClose<ASSUMPTIONS.liquidity.minPrice||m.avgDollar20<ASSUMPTIONS.liquidity.minAvgDollar20){prevStage=null;prevStageAge=-1;continue}
    const stage=classify(m);
    const score=stage?rank(m,stage):null;
    const surfaceScore=stage?surfaceRank(m,stage,score):null;
    const stageAge=stage?(stage===prevStage?prevStageAge+1:0):null;
    surfaceReplayDates.add(date);
    if(stage==='Established Move'&&priorityBand(stage,score)==='Review First'){
      const flags=riskFlags(m);
      for(const h of horizons){
        const entry=rows[i].close,window=rows.slice(i+1,i+h+1),path=window.map(x=>pct(x.close,entry)).filter(Number.isFinite);
        const outcomeDate=dayKey(rows[i+h].t),benchEntry=bh.at(-1)?.close,bf=benchmarkHist(benchRows,outcomeDate)?.at(-1)?.close;
        const fr=pct(rows[i+h].close,entry),br=pct(bf,benchEntry);
        establishedMoveSurfaceReplayCandidates.push({
          symbol,date,outcomeDate,horizon:h,score:round(score,1),stageAge,cleanReview:flags.length===0,riskFlags:flags,
          forwardReturn:round(fr),benchmarkReturn:round(br),excessReturn:round(Number.isFinite(br)?fr-br:null),
          mae:round(path.length?Math.min(...path):null),mfe:round(path.length?Math.max(...path):null),
          ret5:round(m.ret5),ret20:round(m.ret20),ret60:round(m.ret60),dist20:round(m.dist20),
          rs20:round(m.rs20),rs60:round(m.rs60),rsi14:round(m.rsi14,1),atr14Pct:round(m.atr14Pct),
          ma20Slope5:round(m.ma20Slope5),ma50Slope10:round(m.ma50Slope10),upDownVolumeRatio:round(m.upDownVolumeRatio,2),
          swingTrend:m.swingTrend,higherLow:m.higherLow,highBroken:m.highBroken===true,freshHighBreakAge:m.freshHighBreakAge
        });
      }
    }
    if(stage==='Attractive Growth'&&priorityBand(stage,score)==='Review First'){
      const flags=riskFlags(m);
      for(const h of horizons){
        const entry=rows[i].close,window=rows.slice(i+1,i+h+1),path=window.map(x=>pct(x.close,entry)).filter(Number.isFinite);
        const outcomeDate=dayKey(rows[i+h].t),benchEntry=bh.at(-1)?.close,bf=benchmarkHist(benchRows,outcomeDate)?.at(-1)?.close;
        const fr=pct(rows[i+h].close,entry),br=pct(bf,benchEntry);
        attractiveGrowthSurfaceReplayCandidates.push({
          symbol,date,outcomeDate,horizon:h,score:round(score,1),stageAge,cleanReview:flags.length===0,riskFlags:flags,
          forwardReturn:round(fr),benchmarkReturn:round(br),excessReturn:round(Number.isFinite(br)?fr-br:null),
          mae:round(path.length?Math.min(...path):null),mfe:round(path.length?Math.max(...path):null),
          ret5:round(m.ret5),ret20:round(m.ret20),ret60:round(m.ret60),dist20:round(m.dist20),
          rs20:round(m.rs20),rs60:round(m.rs60),rsi14:round(m.rsi14,1),atr14Pct:round(m.atr14Pct),
          ma20Slope5:round(m.ma20Slope5),upDownVolumeRatio:round(m.upDownVolumeRatio,2),
          swingTrend:m.swingTrend,higherLow:m.higherLow
        });
      }
    }
    if(stage==='Recovery'&&priorityBand(stage,score)==='Review First'){
      for(const h of horizons){
        const entry=rows[i].close,window=rows.slice(i+1,i+h+1),path=window.map(x=>pct(x.close,entry)).filter(Number.isFinite);
        const outcomeDate=dayKey(rows[i+h].t),benchEntry=bh.at(-1)?.close,bf=benchmarkHist(benchRows,outcomeDate)?.at(-1)?.close;
        const fr=pct(rows[i+h].close,entry),br=pct(bf,benchEntry);
        recoverySurfaceReplayCandidates.push({
          symbol,date,outcomeDate,horizon:h,score:round(score,1),surfaceScore:round(surfaceScore,1),stageAge,highBroken:m.highBroken===true,freshHighBreakAge:m.freshHighBreakAge,
          forwardReturn:round(fr),benchmarkReturn:round(br),excessReturn:round(Number.isFinite(br)?fr-br:null),
          mae:round(path.length?Math.min(...path):null),mfe:round(path.length?Math.max(...path):null),
          ret5:round(m.ret5),ret20:round(m.ret20),momentumShift:round(m.momentumShift),rs20:round(m.rs20),
          rsi14:round(m.rsi14,1),swingTrend:m.swingTrend,higherLow:m.higherLow,
          upDownVolumeRatio:round(m.upDownVolumeRatio,2),atr14Pct:round(m.atr14Pct)
        });
      }
    }
    if(stage==='Early Watch'&&priorityBand(stage,score)==='Review First'){
      for(const h of horizons){
        const entry=rows[i].close,window=rows.slice(i+1,i+h+1),path=window.map(x=>pct(x.close,entry)).filter(Number.isFinite);
        const outcomeDate=dayKey(rows[i+h].t),benchEntry=bh.at(-1)?.close,bf=benchmarkHist(benchRows,outcomeDate)?.at(-1)?.close;
        const fr=pct(rows[i+h].close,entry),br=pct(bf,benchEntry);
        surfaceReplayCandidates.push({
          symbol,date,outcomeDate,horizon:h,score:round(score,1),
          forwardReturn:round(fr),benchmarkReturn:round(br),excessReturn:round(Number.isFinite(br)?fr-br:null),
          mae:round(path.length?Math.min(...path):null),mfe:round(path.length?Math.max(...path):null),
          ret5:round(m.ret5),ret20:round(m.ret20),momentumShift:round(m.momentumShift),rs20:round(m.rs20),
          rsi14:round(m.rsi14,1),swingTrend:m.swingTrend,
          downsideDecel:m.downsideDecel,volumeShockNearLow:m.volumeShockNearLow,sellingFading:m.sellingFading,
          freshReclaimAge:m.freshReclaimAge,upDownVolumeRatio:round(m.upDownVolumeRatio,2),higherLow:m.higherLow,
          atr14Pct:round(m.atr14Pct),pullback60:round(m.pullback60)
        });
      }
    }
    if(!stage){prevStage=null;prevStageAge=-1;continue}
    const episodeStart=stage!==prevStage;prevStage=stage;prevStageAge=stageAge;
    if(!episodeStart)continue;
    const features={
      freshReclaimAge:m.freshReclaimAge,sellingFading:m.sellingFading,downsideDecel:m.downsideDecel,volumeShockNearLow:m.volumeShockNearLow,
      momentumShift:round(m.momentumShift),rs20:round(m.rs20),rs60:round(m.rs60),upDownVolumeRatio:round(m.upDownVolumeRatio,2),swingTrend:m.swingTrend,
      higherLow:m.higherLow,highBroken:m.highBroken,freshHighBreakAge:m.freshHighBreakAge,lowBroken:m.lowBroken,localHigh:round(m.localHigh),localLow:round(m.localLow),
      dist20:round(m.dist20),dist50:round(m.dist50),pullback60:round(m.pullback60),atr14Pct:round(m.atr14Pct),
      ret5:round(m.ret5),ret20:round(m.ret20),ret60:round(m.ret60),ma20Slope5:round(m.ma20Slope5),ma50Slope10:round(m.ma50Slope10),rsi14:round(m.rsi14,1)
    };
    for(const h of horizons){
      const entry=rows[i].close,window=rows.slice(i+1,i+h+1),path=window.map(x=>pct(x.close,entry)).filter(Number.isFinite);
      const outcomeDate=dayKey(rows[i+h].t),benchEntry=bh.at(-1)?.close,bf=benchmarkHist(benchRows,outcomeDate)?.at(-1)?.close;
      const fr=pct(rows[i+h].close,entry),br=pct(bf,benchEntry);
      rawEvents.push({
        symbol,date,outcomeDate,sessionIndex:i,horizon:h,stage,rankScore:round(score,1),features,
        forwardReturn:round(fr),benchmarkReturn:round(br),excessReturn:round(Number.isFinite(br)?fr-br:null),
        mae:round(path.length?Math.min(...path):null),mfe:round(path.length?Math.max(...path):null),
        hitPlus7:path.some(x=>x>=7),hitMinus7:path.some(x=>x<=-7)
      });
    }
  }
}

for(const symbol of symbols){
  const pack=data[symbol],rows=pack?.rows||[],benchRows=data[benchSymbol(symbol)]?.rows||[];
  if(rows.length<120||benchRows.length<80)continue;
  const i=rows.length-1;
  if(hadRecentSplit(rows,pack.splitDays,i))continue;
  const date=dayKey(rows[i].t),bh=benchmarkHist(benchRows,date);
  if(!bh||bh.length<65)continue;
  const m=metrics(rows,bh);if(!m)continue;
  if(rows[i].rawClose<ASSUMPTIONS.liquidity.minPrice||m.avgDollar20<ASSUMPTIONS.liquidity.minAvgDollar20)continue;
  const stage=classify(m);if(!stage)continue;
  const score=rank(m,stage),surfaceScore=surfaceRank(m,stage,score);
  latest.push({symbol,name:symbolMeta.get(symbol)?.name,sector:symbolMeta.get(symbol)?.sector,stage,score:round(score,1),surfaceScore:round(surfaceScore,1),date,price:round(m.last),ret5:round(m.ret5),ret20:round(m.ret20),rs20:round(m.rs20),rsi14:round(m.rsi14,1),atr14Pct:round(m.atr14Pct,1),swingTrend:m.swingTrend});
}

const report={
  version:VERSION,generatedAt:new Date().toISOString(),batchIndex,batchCount,range,horizons,assumptions:ASSUMPTIONS,
  validation:{
    method:'purged chronological development split + sealed historical final period',
    trainFraction:.7,
    finalTestStart,
    finalTestOpened:openFinalTest,
    note:'Historical final period is sealed from this point forward but is not claimed to be a virgin holdout because earlier project iterations had already observed this history. A truly untouched forward sample begins after 2026-09-27.'
  },
  dataset:datasetInfo,
  symbolCount:symbols.length,symbols,
  horizons:{},
  surfaceReplay:{
    mode:'daily-review-first-candidates-before-global-cap',
    maxVisible:6,
    dates:[...surfaceReplayDates].sort(),
    candidates:surfaceReplayCandidates
  },
  recoverySurfaceReplay:{
    mode:'daily-recovery-review-first-candidates-with-stage-age-and-minor-high-confirmation',
    maxVisible:6,
    dates:[...surfaceReplayDates].sort(),
    candidates:recoverySurfaceReplayCandidates
  },
  attractiveGrowthSurfaceReplay:{
    mode:'daily-attractive-growth-review-first-candidates-with-clean-review-flag',
    maxVisible:6,
    dates:[...surfaceReplayDates].sort(),
    candidates:attractiveGrowthSurfaceReplayCandidates
  },
  establishedMoveSurfaceReplay:{
    mode:'daily-established-move-review-first-candidates-with-current-health-features',
    maxVisible:6,
    dates:[...surfaceReplayDates].sort(),
    candidates:establishedMoveSurfaceReplayCandidates
  },
  latestPicks:latest.sort((a,b)=>b.score-a.score)
};
for(const h of horizons){
  const ev=dedupe(rawEvents.filter(x=>x.horizon===h),h);
  report.horizons[h]={overall:summary(ev),byStage:{}};
  for(const stage of ['Early Watch','Recovery','Attractive Growth','Established Move']){
    const x=ev.filter(e=>e.stage===stage);
    const sp=splitChron(x);
    const review=e=>priorityBand(stage,e.rankScore)==='Review First';
    const cleanReview=e=>review(e)&&riskFlags(e.features).length===0;
    const heatedReview=e=>review(e)&&riskFlags(e.features).length>0;
    // Backend-only display polish candidate for Early Watch.
    // It does NOT redefine stage membership or ranking. It only removes clearly
    // deteriorating / deeply weak names after they already passed Review First.
    const earlyPolish=e=>review(e)
      &&(!Number.isFinite(e.features.momentumShift)||e.features.momentumShift>-5)
      &&(!Number.isFinite(e.features.rs20)||e.features.rs20>=-10);
    report.horizons[h].byStage[stage]={
      overall:summary(x),train:summary(sp.train),test:summary(sp.test),ranking:rankingReport(x),
      fixedPriority:{
        floors:PRIORITY_FLOORS[stage],
        reviewFirst:{train:summary(sp.train.filter(review)),test:summary(sp.test.filter(review))},
        cleanReview:{train:summary(sp.train.filter(cleanReview)),test:summary(sp.test.filter(cleanReview))},
        heatedReview:{train:summary(sp.train.filter(heatedReview)),test:summary(sp.test.filter(heatedReview))},
        ...(stage==='Early Watch'?{polishGuard:{train:summary(sp.train.filter(earlyPolish)),test:summary(sp.test.filter(earlyPolish))}}:{})
      },
      evidence:evidenceSlices(stage,x),
      ...(stage==='Early Watch'?{rewriteDiagnostic:earlyWatchRewriteDiagnostic(x)}:{}),
      ...(stage==='Recovery'?{structureDiagnostic:recoveryStructureDiagnostic(x)}:{}),
      ...(stage==='Attractive Growth'?{riskDiagnostic:attractiveGrowthRiskDiagnostic(x)}:{})
    };
  }
}

fs.mkdirSync('data',{recursive:true});
const out='data/v2-backtest-batch-'+batchIndex+'.json';
fs.writeFileSync(out,JSON.stringify(report,null,2));
console.log('wrote '+out);
console.log(JSON.stringify({
  version:VERSION,batchIndex,
  early:Object.fromEntries(horizons.map(h=>[h,report.horizons[h].byStage['Early Watch']])),
  latestPicks:report.latestPicks.slice(0,20)
},null,2));
