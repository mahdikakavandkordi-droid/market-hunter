import fs from 'node:fs';
import {captureFrozenDataset,loadFrozenDataset,frozenDataDigest,structuralDataDigest,NORMALIZATION_VERSION} from '../lib/frozen-dataset.js';
import {UNIVERSE} from '../lib/universe.js';
import {VERSION,ASSUMPTIONS,priorityBand,riskFlags,round,pct,dayKey,benchmarkHist,metrics,classify,rank,surfaceRank} from '../lib/market-hunter-v2-engine.js';
import {emptyStageContinuity,advanceStageContinuity} from '../lib/stage-continuity.js';
import {buildResearchReport} from '../lib/backtest-report-builder.js';

const batchIndex=Number(process.env.V2_BATCH_INDEX||0);
const batchCount=Math.max(1,Number(process.env.V2_BATCH_COUNT||4));
const range=process.env.V2_RANGE||'5y';
const frozenDatasetFile=process.env.V2_DATASET_FILE||null;
const captureDatasetFile=process.env.V2_DATASET_CAPTURE||null;
const period1=process.env.V2_PERIOD1||null;
const period2=process.env.V2_PERIOD2||null;
const expectedDataSha256=process.env.V2_EXPECT_DATA_SHA256||null;
const expectedStructureSha256=process.env.V2_EXPECT_STRUCTURE_SHA256||null;
const expectedSnapshotId=process.env.V2_EXPECT_SNAPSHOT_ID||null;
const expectedNormalizationVersion=process.env.V2_EXPECT_NORMALIZATION_VERSION||null;
const expectedSource=process.env.V2_EXPECT_SOURCE_JSON?JSON.parse(process.env.V2_EXPECT_SOURCE_JSON):null;
const forbidNetwork=process.env.V2_FORBID_NETWORK==='1';
const datasetArtifactId=process.env.V2_DATASET_ARTIFACT_ID||null;
const developmentStart=process.env.V2_DEVELOPMENT_START||'2021-09-27';
const validationStart=process.env.V2_VALIDATION_START||'2024-09-20';
const finalTestStart=process.env.V2_FINAL_TEST_START||'2026-01-01';
const openFinalTest=process.env.V2_OPEN_FINAL_TEST==='1';
if((period1&&!period2)||(!period1&&period2))throw new Error('V2_PERIOD1 and V2_PERIOD2 must be provided together');
const datasetMode=frozenDatasetFile?'frozen':'live';
const horizons=(process.env.V2_HORIZONS||'5,10,20').split(',').map(Number).filter(x=>x>0);
const maxH=Math.max(...horizons);
const allSymbols=UNIVERSE.map(x=>x[0]);
const symbols=allSymbols.filter((_,i)=>i%batchCount===batchIndex);
const CDR=new Set(UNIVERSE.filter(x=>x[2]==='CDR').map(x=>x[0]));
const benchSymbol=s=>CDR.has(s)?'^IXIC':'^GSPTSE';

async function fetchRows(symbol){
  if(forbidNetwork)throw new Error('Network access forbidden in frozen dataset mode');
  const windowQuery=period1&&period2
    ?'period1='+encodeURIComponent(period1)+'&period2='+encodeURIComponent(period2)
    :'range='+encodeURIComponent(range);
  const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?'+windowQuery+'&interval=1d&includePrePost=false&events=div%2Csplits';
  const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 MarketHunterV2Research/1.0'}});
  if(!res.ok)throw new Error(symbol+': HTTP '+res.status);
  const j=await res.json(),z=j?.chart?.result?.[0],q=z?.indicators?.quote?.[0]||{},adj=z?.indicators?.adjclose?.[0]?.adjclose||q.close||[];
  const splitEvents=Object.values(z?.events?.splits||{}).map(x=>({
    date:dayKey(Number(x.date)),
    numerator:Number(x.numerator),
    denominator:Number(x.denominator),
    splitRatio:String(x.splitRatio||'')
  })).sort((a,b)=>a.date.localeCompare(b.date));
  const dividends=Object.values(z?.events?.dividends||{}).map(x=>({
    date:dayKey(Number(x.date)),
    amount:Number(x.amount)
  })).sort((a,b)=>a.date.localeCompare(b.date));
  const splitDays=new Set(splitEvents.map(x=>x.date));
  const rows=(z?.timestamp||[]).map((t,i)=>{
    const rawClose=q.close?.[i],rawHigh=q.high?.[i],rawLow=q.low?.[i],factor=Number.isFinite(adj[i])&&Number.isFinite(rawClose)&&rawClose?adj[i]/rawClose:1;
    return {
      t,close:adj[i],rawClose,rawHigh,rawLow,
      high:Number.isFinite(rawHigh)?rawHigh*factor:null,
      low:Number.isFinite(rawLow)?rawLow*factor:null,
      volume:q.volume?.[i]
    };
  }).filter(x=>[x.close,x.rawClose,x.rawHigh,x.rawLow,x.high,x.low,x.volume].every(Number.isFinite)&&x.volume>0);
  return {rows,splitDays,splitEvents,dividends};
}

function hadRecentSplit(rows,splitDays,i,lookback=30){
  const start=Math.max(0,i-lookback);
  for(let j=start;j<=i;j++)if(splitDays.has(dayKey(rows[j].t)))return true;
  return false;
}

const needed=[...new Set([...symbols,...symbols.map(benchSymbol)])];
const sourceMeta={
  provider:'Yahoo Finance chart endpoint',
  interval:'1d',
  period1:period1||null,
  period2:period2||null,
  range:period1&&period2?null:range,
  includePrePost:false,
  events:['div','splits']
};
let data={};
let datasetInfo={mode:datasetMode,file:frozenDatasetFile||captureDatasetFile||null,sha256:null,dataSha256:null,structureSha256:null,snapshotId:null,period1,period2};

if(frozenDatasetFile){
  const loaded=loadFrozenDataset(frozenDatasetFile,{
    expectedSnapshotId,
    expectedDataSha256,
    expectedStructureSha256,
    expectedSource:expectedSource||undefined,
    expectedNormalizationVersion:expectedNormalizationVersion||undefined,
    expectedBatchIndex:batchIndex,
    expectedBatchCount:batchCount,
    expectedSymbols:needed
  });
  data=loaded.data;
  datasetInfo={
    mode:'frozen',file:frozenDatasetFile,artifactId:datasetArtifactId,
    sha256:loaded.sha256,dataSha256:loaded.dataSha256,structureSha256:loaded.structureSha256,
    snapshotId:loaded.snapshotId,capturedAt:loaded.capturedAt,
    normalizationVersion:loaded.normalizationVersion,source:loaded.source,
    captureRevision:loaded.captureRevision
  };
  console.log('loaded frozen dataset '+loaded.snapshotId+' '+loaded.sha256);
}else{
  for(const s of needed){
    process.stdout.write('fetch '+s+'... ');
    try{data[s]=await fetchRows(s);console.log(data[s].rows.length)}
    catch(e){console.log('SKIP '+e.message);data[s]={rows:[],splitDays:new Set(),splitEvents:[],dividends:[]}}
  }
  const dataSha256=frozenDataDigest({source:sourceMeta,batchIndex,batchCount,symbols:needed,data,normalizationVersion:NORMALIZATION_VERSION});
  const structureSha256=structuralDataDigest({source:sourceMeta,batchIndex,batchCount,symbols:needed,data,normalizationVersion:NORMALIZATION_VERSION});
  datasetInfo={...datasetInfo,dataSha256,structureSha256};
  if(expectedStructureSha256&&structureSha256!==expectedStructureSha256){
    throw new Error('Structural dataset drift detected for batch '+batchIndex+': '+structureSha256+' != '+expectedStructureSha256);
  }
  if(expectedDataSha256&&dataSha256!==expectedDataSha256){
    console.warn('Adjusted-price precision drift for batch '+batchIndex+': '+dataSha256+' != '+expectedDataSha256);
  }
  if(captureDatasetFile){
    const captured=captureFrozenDataset(captureDatasetFile,{
      source:sourceMeta,batchIndex,batchCount,symbols:needed,data,
      engineVersion:VERSION,
      captureRevision:process.env.V2_CAPTURE_REVISION||process.env.VERCEL_GIT_COMMIT_SHA||null,
      normalizationVersion:NORMALIZATION_VERSION
    });
    datasetInfo={
      mode:'captured-live',file:captureDatasetFile,artifactId:datasetArtifactId,
      sha256:captured.sha256,dataSha256:captured.dataSha256,structureSha256:captured.structureSha256,
      snapshotId:captured.snapshotId,capturedAt:captured.capturedAt,
      normalizationVersion:captured.normalizationVersion,source:captured.source,
      captureRevision:captured.captureRevision
    };
    console.log('captured frozen dataset '+captured.snapshotId+' '+captured.sha256+' data '+captured.dataSha256);
  }
}

const rawEvents=[],surfaceReplayCandidates=[],recoverySurfaceReplayCandidates=[],attractiveGrowthSurfaceReplayCandidates=[],establishedMoveSurfaceReplayCandidates=[],scanCalendar=[];
for(const symbol of symbols){
  const pack=data[symbol],rows=pack.rows,benchPack=data[benchSymbol(symbol)],benchRows=benchPack?.rows||[];
  if(rows.length<120||benchRows.length<80)continue;
  let stageContinuity=emptyStageContinuity();
  for(let i=100;i<rows.length-maxH;i++){
    if(hadRecentSplit(rows,pack.splitDays,i)){stageContinuity=emptyStageContinuity();continue}
    const date=dayKey(rows[i].t),hist=rows.slice(0,i+1),bh=benchmarkHist(benchRows,date);
    if(!bh||bh.length<65)continue;
    const m=metrics(hist,bh);if(!m)continue;
    for(const h of horizons)scanCalendar.push({date,outcomeDate:dayKey(rows[i+h].t),horizon:h});
    if(rows[i].rawClose<ASSUMPTIONS.liquidity.minPrice||m.avgDollar20<ASSUMPTIONS.liquidity.minAvgDollar20){stageContinuity=emptyStageContinuity();continue}
    const stage=classify(m);
    const score=stage?rank(m,stage):null;
    const surfaceScore=stage?surfaceRank(m,stage,score):null;
    const continuityStep=advanceStageContinuity(stageContinuity,stage);
    const stageAge=continuityStep.stageAge;
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
    stageContinuity=continuityStep.state;
    if(!stage)continue;
    const episodeStart=continuityStep.episodeStart;
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

const report=buildResearchReport({
  version:VERSION,
  generatedAt:new Date().toISOString(),
  batchIndex,batchCount,range,horizons,assumptions:ASSUMPTIONS,
  validation:{
    method:'purged chronological development split + sealed historical final period',
    trainFraction:.7,
    calendarMode:'fixed_calendar',
    note:'Historical final period is sealed from this point forward but is not claimed to be a virgin holdout because earlier project iterations had already observed this history. A truly untouched forward sample begins after 2026-09-27.'
  },
  dataset:datasetInfo,
  symbols,
  rawEvents,
  surfaceReplayCandidates,
  recoverySurfaceReplayCandidates,
  attractiveGrowthSurfaceReplayCandidates,
  establishedMoveSurfaceReplayCandidates,
  scanCalendar,
  finalTestStart,
  openFinalTest,
  validationCalendar:{developmentStart,validationStart,finalStart:finalTestStart}
});

fs.mkdirSync('data',{recursive:true});
const out='data/v2-backtest-batch-'+batchIndex+'.json';
fs.writeFileSync(out,JSON.stringify(report,null,2));
console.log('wrote '+out);
console.log(JSON.stringify({
  version:VERSION,batchIndex,
  early:Object.fromEntries(horizons.map(h=>[h,report.horizons[h].byStage['Early Watch']]))
},null,2));

