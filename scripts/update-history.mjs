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
function snapshotItem(x,stage=x.stage){
  return {
    symbol:x.symbol,stage,score:x.score,price:x.price,rsi14:x.rsi14,
    ret5:x.ret5,ret20:x.ret20,ret60:x.ret60,rvol:x.rvol,max5Rvol:x.max5Rvol,
    rs20:x.rs20,sectorRs:x.sectorRs,momentumShift:x.momentumShift,prev5:x.prev5,
    trendState:x.trendState,pullback:x.pullback,dist20:x.dist20,dist50:x.dist50,
    unusual5dDirection:x.unusual5dDirection,unusual5dLabel:x.unusual5dLabel,
    highState:x.highState,lowState:x.lowState,localHigh:x.localHigh,localLow:x.localLow,
    sector:x.sector,sectorStrength:x.sectorStrength,sectorBreadth:x.sectorBreadth,
    ...intelligenceFields(x,stage),triggers:triggerFields(x,stage)
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
