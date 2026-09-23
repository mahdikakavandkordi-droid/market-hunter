import fs from 'node:fs';

const [scanPath='/tmp/scan.json',historyPath='data/history.json']=process.argv.slice(2);
const scan=JSON.parse(fs.readFileSync(scanPath,'utf8'));
let history={snapshots:[]};
if(fs.existsSync(historyPath)){
  try{history=JSON.parse(fs.readFileSync(historyPath,'utf8'))}catch{}
}
if(!Array.isArray(history.snapshots)) history.snapshots=[];

const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const pct=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b!==0?round((a/b-1)*100,2):null;
const allNow=new Map([...(scan.availableItems||[]),...(scan.items||[]),...(scan.watchItems||[])].map(x=>[x.symbol,x]));
const stageNow=new Map((scan.items||[]).map(x=>[x.symbol,x.stage]));
for(const x of scan.watchItems||[]) stageNow.set(x.symbol,'Early Watch');

function median(a){
  const v=a.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!v.length)return null;
  const m=Math.floor(v.length/2);
  return round(v.length%2?v[m]:(v[m-1]+v[m])/2,2);
}
function mean(a){
  const v=a.filter(Number.isFinite);
  return v.length?round(v.reduce((s,x)=>s+x,0)/v.length,2):null;
}

function intelligenceFields(x,stage){
  const setup=[];
  if(x.nearRecentLow===true&&(x.sellingPressureFading===true||x.downsideSlowing===true)&&x.ret20<0) setup.push('Selling Exhaustion');
  if(stage==='Recovery') setup.push('Recovery');
  if(x.higherLow===true&&Number.isFinite(x.momentumShift)&&x.momentumShift>0) setup.push('Higher-Low Turn');
  if(x.highState==='local_high_broken') setup.push('Local Breakout');
  if(x.weeklyUp===true&&x.dailyUp===true&&Number.isFinite(x.pullback)&&x.pullback<=-2&&x.pullback>=-12) setup.push('Pullback in Uptrend');
  if(x.lowState==='failed_low_break') setup.push('Failed Breakdown / Reclaim');
  return {
    atr14Pct:x.atr14Pct??null,upDownVolumeRatio:x.upDownVolumeRatio??null,
    swingTrend:x.swingTrend??null,higherHigh:x.higherHigh??null,higherLow:x.higherLow??null,
    support:x.support??null,resistance:x.resistance??null,roomToResistance:x.roomToResistance??null,
    supportDistance:x.supportDistance??null,resistanceTouches:x.resistanceTouches??0,supportTouches:x.supportTouches??0,
    setups:setup
  };
}
function priorCompatible(symbol){
  for(let i=history.snapshots.length-1;i>=0;i--){
    const snap=history.snapshots[i];
    if(snap.version!==scan.version||snap.minDollar!==scan.minDollar) continue;
    const x=[...(snap.items||[]),...(snap.earlyWatch||[])].find(v=>v.symbol===symbol);
    if(x) return x;
  }
  return null;
}
function triggerFields(x,stage){
  const prev=priorCompatible(x.symbol),triggers=[];
  if(!prev) return triggers;
  if(prev.stage!==stage) triggers.push(`${prev.stage||'Unstaged'} → ${stage||'Unstaged'}`);
  if(prev.lowState!==x.lowState&&x.lowState==='failed_low_break') triggers.push('Low reclaimed');
  if(prev.highState!==x.highState&&x.highState==='local_high_broken') triggers.push('Resistance/local high broken');
  if(Number.isFinite(prev.momentumShift)&&Number.isFinite(x.momentumShift)&&prev.momentumShift<2&&x.momentumShift>=2) triggers.push('Momentum turned positive');
  if(Number.isFinite(prev.rs20)&&Number.isFinite(x.rs20)&&prev.rs20<=0&&x.rs20>0) triggers.push('Relative strength turned positive');
  if(prev.unusual5dDirection!=='positive'&&x.unusual5dDirection==='positive') triggers.push('Positive unusual volume appeared');
  if(prev.lowState!==x.lowState&&x.lowState==='local_low_broken') triggers.push('Local low broken');
  return triggers;
}
const HUNTER_V2_FORWARD=Object.freeze({version:'hunter-v2-frozen-2026-09-23',frozenAt:'2026-09-23'});
function hunterV2Forward(x,stage){
  const setups=intelligenceFields(x,stage).setups;
  const higherLow=setups.includes('Higher-Low Turn')&&Number.isFinite(x.momentumShift)&&x.momentumShift>=3&&Number.isFinite(x.upDownVolumeRatio)&&x.upDownVolumeRatio>=.85&&Number.isFinite(x.atr14Pct)&&x.atr14Pct>=3&&x.atr14Pct<6&&Number.isFinite(x.rs20)&&x.rs20>=0;
  const failedBreakdown=setups.includes('Failed Breakdown / Reclaim')&&Number.isFinite(x.atr14Pct)&&x.atr14Pct<3&&Number.isFinite(x.rs20)&&x.rs20>=0&&x.rs20<4&&Number.isFinite(x.upDownVolumeRatio)&&x.upDownVolumeRatio>=.85&&x.upDownVolumeRatio<1.2;
  return {hunterV2Version:HUNTER_V2_FORWARD.version,hunterV2Qualified:higherLow||failedBreakdown,hunterV2Paths:[...(higherLow?['Higher-Low Turn']:[]),...(failedBreakdown?['Failed Breakdown / Reclaim']:[])]};
}
function snapshotItem(x,stage=x.stage){
  return {
    symbol:x.symbol,stage,score:x.score,price:x.price,rsi14:x.rsi14,
    ret5:x.ret5,ret20:x.ret20,ret60:x.ret60,rvol:x.rvol,max5Rvol:x.max5Rvol,
    rs20:x.rs20,sectorRs:x.sectorRs,momentumShift:x.momentumShift,prev5:x.prev5,
    trendState:x.trendState,pullback:x.pullback,dist20:x.dist20,dist50:x.dist50,
    unusual5dDirection:x.unusual5dDirection,unusual5dLabel:x.unusual5dLabel,
    highState:x.highState,lowState:x.lowState,localHigh:x.localHigh,localLow:x.localLow,
    sector:x.sector,sectorStrength:x.sectorStrength,sectorBreadth:x.sectorBreadth,
    ...intelligenceFields(x,stage),...hunterV2Forward(x,stage),triggers:triggerFields(x,stage)
  };
}

// Append today's exact surfaced cohort once. Never rewrite the original selection.
if(!history.snapshots.some(s=>s.marketAsOf===scan.marketAsOf&&s.version===scan.version&&s.minDollar===scan.minDollar)){
  history.snapshots.push({
    capturedAt:new Date().toISOString(),
    marketAsOf:scan.marketAsOf,
    version:scan.version,
    minDollar:scan.minDollar,
    breadth:scan.breadth,
    marketContext:scan.marketContext,
    hunterV2Spec:HUNTER_V2_FORWARD,
    top5:(scan.top5||[]).map(x=>({...x,outcomes:{}})),
    items:(scan.items||[]).map(x=>snapshotItem(x,x.stage)),
    earlyWatch:(scan.watchItems||[]).map(x=>snapshotItem(x,'Early Watch'))
  });
}

history.snapshots.sort((a,b)=>a.marketAsOf.localeCompare(b.marketAsOf));
const currentIndex=history.snapshots.findIndex(s=>s.marketAsOf===scan.marketAsOf&&s.version===scan.version&&s.minDollar===scan.minDollar);

// Update only matured 1/3/5/10-session Top 5 outcomes. Entry fields stay immutable.
for(let i=0;i<currentIndex;i++){
  const snap=history.snapshots[i];
  if(snap.version!==scan.version||snap.minDollar!==scan.minDollar||!Array.isArray(snap.top5)) continue;
  const sameConfig=history.snapshots.filter(s=>s.version===snap.version&&s.minDollar===snap.minDollar);
  const entryPos=sameConfig.findIndex(s=>s.marketAsOf===snap.marketAsOf);
  const nowPos=sameConfig.findIndex(s=>s.marketAsOf===scan.marketAsOf);
  const sessions=nowPos-entryPos;
  if(![1,3,5,10].includes(sessions)) continue;
  for(const pick of snap.top5){
    pick.outcomes??={};
    if(pick.outcomes[String(sessions)]) continue;
    const now=allNow.get(pick.symbol);
    if(!now||!Number.isFinite(now.price)||!Number.isFinite(pick.entryPrice)) continue;
    pick.outcomes[String(sessions)]={
      price:now.price,
      forwardReturn:pct(now.price,pick.entryPrice),
      stage:stageNow.get(pick.symbol)||'Unclassified',
      momentumShift:now.momentumShift??null,
      highState:now.highState??null,
      lowState:now.lowState??null
    };
  }
}

// Mature objective outcomes for every surfaced candidate. These are diagnostics only:
// they never auto-change scanner rules, stage thresholds, or Hunter weights.
const horizons=[1,3,5,10,20];
for(let i=0;i<currentIndex;i++){
  const snap=history.snapshots[i];
  if(snap.version!==scan.version||snap.minDollar!==scan.minDollar) continue;
  const sameConfig=history.snapshots.filter(s=>s.version===snap.version&&s.minDollar===snap.minDollar);
  const entryPos=sameConfig.findIndex(s=>s.marketAsOf===snap.marketAsOf);
  const nowPos=sameConfig.findIndex(s=>s.marketAsOf===scan.marketAsOf);
  const sessions=nowPos-entryPos;
  if(!horizons.includes(sessions)) continue;
  for(const entry of [...(snap.items||[]),...(snap.earlyWatch||[])]){
    entry.outcomes??={};
    if(entry.outcomes[String(sessions)]) continue;
    const now=allNow.get(entry.symbol);
    if(!now||!Number.isFinite(now.price)||!Number.isFinite(entry.price)) continue;
    entry.outcomes[String(sessions)]={
      price:now.price,forwardReturn:pct(now.price,entry.price),
      stage:stageNow.get(entry.symbol)||'Unclassified',
      momentumShift:now.momentumShift??null,rs20:now.rs20??null,
      highState:now.highState??null,lowState:now.lowState??null
    };
  }
}

function observationRows(){
  const rows=[];
  for(const snap of history.snapshots){
    for(const x of [...(snap.items||[]),...(snap.earlyWatch||[])]){
      for(const h of horizons){
        const r=x.outcomes?.[String(h)]?.forwardReturn;
        if(Number.isFinite(r)) rows.push({snap,x,h,r});
      }
    }
  }
  return rows;
}
function summarize(rows){
  const returns=rows.map(v=>v.r).filter(Number.isFinite);
  if(!returns.length) return null;
  return {
    observed:returns.length,meanReturn:mean(returns),medianReturn:median(returns),
    positiveRate:round(returns.filter(v=>v>0).length/returns.length*100,1),
    gain7Rate:round(returns.filter(v=>v>=7).length/returns.length*100,1),
    loss7Rate:round(returns.filter(v=>v<=-7).length/returns.length*100,1)
  };
}
const observations=observationRows();
history.validation={generatedAt:new Date().toISOString(),note:'Diagnostic historical outcomes only; no automatic rule or weight changes.',hunterV2Forward:{version:HUNTER_V2_FORWARD.version,byHorizon:{}},bySetup:{},byStage:{},byTrigger:{}};
for(const h of horizons){history.validation.hunterV2Forward.byHorizon[String(h)]=summarize(observations.filter(v=>v.h===h&&v.x.hunterV2Version===HUNTER_V2_FORWARD.version&&v.x.hunterV2Qualified===true));}
for(const h of horizons){
  for(const row of observations.filter(v=>v.h===h)){
    for(const setup of row.x.setups||[]){
      history.validation.bySetup[setup]??={};
      history.validation.bySetup[setup][String(h)]??=[];
      history.validation.bySetup[setup][String(h)].push(row);
    }
    const stage=row.x.stage||'Unclassified';
    history.validation.byStage[stage]??={};
    history.validation.byStage[stage][String(h)]??=[];
    history.validation.byStage[stage][String(h)].push(row);
    for(const trigger of row.x.triggers||[]){
      history.validation.byTrigger[trigger]??={};
      history.validation.byTrigger[trigger][String(h)]??=[];
      history.validation.byTrigger[trigger][String(h)].push(row);
    }
  }
}
for(const group of ['bySetup','byStage','byTrigger']){
  for(const [name,hs] of Object.entries(history.validation[group])){
    for(const [h,rows] of Object.entries(hs)) history.validation[group][name][h]=summarize(rows);
  }
}

// Cohort summaries are derived only from recorded outcomes.
for(const snap of history.snapshots){
  if(!Array.isArray(snap.top5)) continue;
  snap.top5Summary??={};
  for(const h of [1,3,5,10]){
    const returns=snap.top5.map(x=>x.outcomes?.[String(h)]?.forwardReturn).filter(Number.isFinite);
    if(returns.length){
      snap.top5Summary[String(h)]={
        observed:returns.length,
        meanReturn:mean(returns),
        medianReturn:median(returns),
        positiveRate:round(returns.filter(x=>x>0).length/returns.length*100,1)
      };
    }
  }
}

const dir=historyPath.includes('/')?historyPath.slice(0,historyPath.lastIndexOf('/')):'.';
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(historyPath,JSON.stringify(history,null,2)+'\n');
console.log('history snapshots:',history.snapshots.length,'marketAsOf:',scan.marketAsOf);
