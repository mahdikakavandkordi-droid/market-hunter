import {purgedChronSplit} from './validation-split.js';
import {PRIORITY_FLOORS,priorityBand,riskFlags,round,avg,median} from './market-hunter-v2-engine.js';

const STAGES=['Early Watch','Recovery','Attractive Growth','Established Move'];

function validIsoDay(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}

export function partitionResearchRows(rows,finalStart){
  if(!validIsoDay(finalStart))throw new Error('Invalid finalStart: '+finalStart);
  const development=[],final=[],crossing=[],invalid=[];
  let invalidDateCount=0,invalidOutcomeDateCount=0,invalidOrderCount=0;
  for(const row of Array.isArray(rows)?rows:[]){
    if(!validIsoDay(row?.date)){invalid.push(row);invalidDateCount++;continue}
    if(!validIsoDay(row?.outcomeDate)){invalid.push(row);invalidOutcomeDateCount++;continue}
    if(row.outcomeDate<row.date){invalid.push(row);invalidOrderCount++;continue}
    if(row.date>=finalStart){final.push(row);continue}
    if(row.outcomeDate>=finalStart){crossing.push(row);continue}
    development.push(row);
  }
  return {
    development,final,crossing,invalid,
    counts:{
      inputCount:Array.isArray(rows)?rows.length:0,
      developmentCount:development.length,
      finalCount:final.length,
      crossingCount:crossing.length,
      invalidCount:invalid.length,
      invalidDateCount,invalidOutcomeDateCount,invalidOrderCount
    }
  };
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
    if(Number.isFinite(prev)&&Number.isFinite(e.sessionIndex)&&e.sessionIndex-prev<h)continue;
    out.push(e);
    if(Number.isFinite(e.sessionIndex))last.set(k,e.sessionIndex);
  }
  return out;
}

function quantile(a,q){
  const x=a.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!x.length)return null;
  return x[Math.min(x.length-1,Math.floor((x.length-1)*q))];
}

function splitDevelopment(a){
  return purgedChronSplit(a,.7);
}

function rankingReport(a){
  const sp=splitDevelopment(a),scores=sp.train.map(x=>x.rankScore);
  const q33=quantile(scores,.33),q67=quantile(scores,.67),q80=quantile(scores,.80),q90=quantile(scores,.90);
  const bucket=x=>x.rankScore>=q67?'Top':x.rankScore>=q33?'Middle':'Lower';
  const pack=x=>Object.fromEntries(['Top','Middle','Lower'].map(k=>[k,summary(x.filter(e=>bucket(e)===k))]));
  const above=(rows,t)=>Number.isFinite(t)?summary(rows.filter(e=>e.rankScore>=t)):null;
  return {
    scope:'development',
    cutDate:sp.cut,
    purge:{
      prePurgeTrainCount:sp.prePurgeTrainCount,
      purgedTrainCount:sp.purgedTrainCount,
      missingOutcomeCount:sp.missingOutcomeCount,
      trainCount:sp.train.length,
      testCount:sp.test.length
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
  const pack=rows=>{const sp=splitDevelopment(rows);return {scope:'development',overall:summary(rows),train:summary(sp.train),test:summary(sp.test)}};
  const variants={
    reviewFirst:e=>review(e),
    reviewNoHighATR:e=>review(e)&&atrOk(e),
    reviewNotExtended:e=>review(e)&&distOk(e),
    reviewNoHighRSI:e=>review(e)&&rsiOk(e),
    reviewATRAndDistance:e=>review(e)&&atrOk(e)&&distOk(e),
    cleanReview:e=>review(e)&&atrOk(e)&&distOk(e)&&rsiOk(e)
  };
  return {
    scope:'development',
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
  const pack=rows=>{const sp=splitDevelopment(rows);return {scope:'development',overall:summary(rows),train:summary(sp.train),test:summary(sp.test)}};
  const candidateRank=(scoreFn)=>{
    const sp=splitDevelopment(a);
    const train=sp.train.map(e=>({...e,candidateScore:scoreFn(e)}));
    const test=sp.test.map(e=>({...e,candidateScore:scoreFn(e)}));
    const q80=quantile(train.map(e=>e.candidateScore),.80);
    const above=(rows,t)=>summary(rows.filter(e=>Number.isFinite(t)&&e.candidateScore>=t));
    return {scope:'development',cutDate:sp.cut,trainQ80:round(q80,1),q80:{train:above(train,q80),test:above(test,q80)}};
  };
  return {
    scope:'development',
    status:'recovery-structure-diagnostic-v2',
    note:'Diagnostic only. Recovery classification and production ranking are unchanged.',
    variants:Object.fromEntries(Object.entries(variants).map(([name,test])=>[name,pack(a.filter(test))])),
    ranking:{
      current:candidateRank(e=>e.rankScore),
      minorHighBoost:candidateRank(e=>e.rankScore+(broken(e)?10:0)),
      confirmedBreakBoost:candidateRank(e=>e.rankScore+(broken(e)?10:0)+(broken(e)&&rs0(e)?4:0))
    }
  };
}

function earlyWatchRewriteDiagnostic(a){
  const fresh=e=>Number.isFinite(e.features.freshReclaimAge)&&e.features.freshReclaimAge<=3;
  const rs0=e=>Number.isFinite(e.features.rs20)&&e.features.rs20>=0;
  const rsM5=e=>Number.isFinite(e.features.rs20)&&e.features.rs20>=-5;
  const exhaust=e=>e.features.downsideDecel===true&&e.features.volumeShockNearLow===true;
  const inclusion={
    baseline:e=>true,
    noSellingFadeOnly:e=>fresh(e)||exhaust(e),
    supportedReclaimOrExhaustion:e=>exhaust(e)||(fresh(e)&&(e.features.downsideDecel===true||e.features.volumeShockNearLow===true||rsM5(e))),
    coreExhaustion:e=>exhaust(e)
  };
  const packRows=rows=>{const sp=splitDevelopment(rows);return {scope:'development',overall:summary(rows),train:summary(sp.train),test:summary(sp.test)}};
  const candidateRank=(rows,scoreFn)=>{
    const sp=splitDevelopment(rows);
    const train=sp.train.map(e=>({...e,candidateScore:scoreFn(e)}));
    const test=sp.test.map(e=>({...e,candidateScore:scoreFn(e)}));
    const q80=quantile(train.map(e=>e.candidateScore),.80),q90=quantile(train.map(e=>e.candidateScore),.90);
    const above=(x,t)=>summary(x.filter(e=>Number.isFinite(t)&&e.candidateScore>=t));
    return {scope:'development',cutDate:sp.cut,trainThresholds:{q80:round(q80,1),q90:round(q90,1)},q80:{train:above(train,q80),test:above(test,q80)},q90:{train:above(train,q90),test:above(test,q90)}};
  };
  const base=a.filter(inclusion.supportedReclaimOrExhaustion);
  const rankers={
    current:e=>e.rankScore,
    robustCore:e=>{
      let s=0;if(e.features.downsideDecel===true)s+=40;if(e.features.volumeShockNearLow===true)s+=20;
      if(rs0(e))s+=25;else if(rsM5(e))s+=10;
      if(fresh(e)&&(e.features.downsideDecel===true||e.features.volumeShockNearLow===true))s+=5;
      return s;
    },
    rsForward:e=>{
      let s=0;if(e.features.downsideDecel===true)s+=35;if(e.features.volumeShockNearLow===true)s+=15;
      if(rs0(e))s+=35;else if(rsM5(e))s+=15;return s;
    },
    balancedEvidence:e=>{
      let s=0;if(e.features.downsideDecel===true)s+=35;if(e.features.volumeShockNearLow===true)s+=15;
      if(rs0(e))s+=25;else if(rsM5(e))s+=15;else if(Number.isFinite(e.features.rs20)&&e.features.rs20>=-10)s+=6;
      if(fresh(e))s+=3;if(Number.isFinite(e.features.upDownVolumeRatio)&&e.features.upDownVolumeRatio>=.85)s+=4;
      if(Number.isFinite(e.features.momentumShift)&&e.features.momentumShift<=-5)s-=8;
      if(e.features.swingTrend==='Structure improving')s+=2;else if(e.features.swingTrend==='Higher highs + higher lows')s+=3;
      return Math.max(0,s);
    }
  };
  return {
    scope:'development',
    status:'early-watch-rewrite-diagnostic-v1',
    inclusion:Object.fromEntries(Object.entries(inclusion).map(([name,test])=>[name,packRows(a.filter(test))])),
    rankBase:'supportedReclaimOrExhaustion',
    ranking:Object.fromEntries(Object.entries(rankers).map(([name,scoreFn])=>[name,candidateRank(base,scoreFn)]))
  };
}

function replaySection(mode,candidates,finalStart,maxVisible=6){
  const p=partitionResearchRows(candidates,finalStart);
  return {
    scope:'development',
    mode,maxVisible,
    dates:[...new Set(p.development.map(x=>x.date))].sort(),
    candidates:p.development,
    exclusions:{
      finalCount:p.counts.finalCount,
      crossingCount:p.counts.crossingCount,
      invalidCount:p.counts.invalidCount
    }
  };
}

function finalEvaluation(rawEvents,horizons,finalStart){
  const p=partitionResearchRows(rawEvents,finalStart);
  const out={scope:'historical-final',start:finalStart,horizons:{}};
  for(const h of horizons){
    const ev=dedupe(p.final.filter(x=>x.horizon===h),h);
    out.horizons[h]={overall:summary(ev),byStage:{}};
    for(const stage of STAGES)out.horizons[h].byStage[stage]=summary(ev.filter(x=>x.stage===stage));
  }
  return out;
}

export function buildResearchReport({
  version,generatedAt,batchIndex,batchCount,range,horizons,assumptions,validation,dataset,
  symbols,rawEvents,
  surfaceReplayCandidates,recoverySurfaceReplayCandidates,attractiveGrowthSurfaceReplayCandidates,establishedMoveSurfaceReplayCandidates,
  latestPicks,finalTestStart,openFinalTest
}){
  const rawBoundary=partitionResearchRows(rawEvents,finalTestStart);
  const report={
    version,generatedAt,batchIndex,batchCount,range,horizons,assumptions,
    validation:{
      ...validation,
      finalTestStart,
      finalTestOpened:openFinalTest,
      outputBoundary:{
        scope:'development',
        rawEvents:rawBoundary.counts,
        note:'Closed historical-final outcomes and boundary-crossing labels are excluded before every development summary, diagnostic and replay export.'
      }
    },
    dataset,
    symbolCount:symbols.length,symbols,
    horizons:{},
    surfaceReplay:replaySection('daily-review-first-candidates-before-global-cap',surfaceReplayCandidates,finalTestStart,6),
    recoverySurfaceReplay:replaySection('daily-recovery-review-first-candidates-with-stage-age-and-minor-high-confirmation',recoverySurfaceReplayCandidates,finalTestStart,6),
    attractiveGrowthSurfaceReplay:replaySection('daily-attractive-growth-review-first-candidates-with-clean-review-flag',attractiveGrowthSurfaceReplayCandidates,finalTestStart,6),
    establishedMoveSurfaceReplay:replaySection('daily-established-move-review-first-candidates-with-current-health-features',establishedMoveSurfaceReplayCandidates,finalTestStart,6),
    latestPicks:[...latestPicks].sort((a,b)=>b.score-a.score)
  };

  for(const h of horizons){
    const ev=dedupe(rawBoundary.development.filter(x=>x.horizon===h),h);
    report.horizons[h]={scope:'development',overall:summary(ev),byStage:{}};
    for(const stage of STAGES){
      const x=ev.filter(e=>e.stage===stage);
      const sp=splitDevelopment(x);
      const review=e=>priorityBand(stage,e.rankScore)==='Review First';
      const cleanReview=e=>review(e)&&riskFlags(e.features).length===0;
      const heatedReview=e=>review(e)&&riskFlags(e.features).length>0;
      const earlyPolish=e=>review(e)
        &&(!Number.isFinite(e.features.momentumShift)||e.features.momentumShift>-5)
        &&(!Number.isFinite(e.features.rs20)||e.features.rs20>=-10);
      report.horizons[h].byStage[stage]={
        scope:'development',
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

  if(openFinalTest)report.finalEvaluation=finalEvaluation(rawEvents,horizons,finalTestStart);
  return report;
}
