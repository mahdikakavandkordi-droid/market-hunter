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

function tradingSessionsBetween(a,b){
  // We use saved market snapshots rather than calendar days, so the index distance
  // below is the authoritative session count for evaluation.
  return null;
}
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
    items:(scan.items||[]).map(x=>({
      symbol:x.symbol,stage:x.stage,score:x.score,price:x.price,rsi14:x.rsi14,
      ret5:x.ret5,ret20:x.ret20,rvol:x.rvol,rs20:x.rs20,momentumShift:x.momentumShift
    })),
    earlyWatch:(scan.watchItems||[]).map(x=>({
      symbol:x.symbol,stage:'Early Watch',score:x.score,price:x.price,rsi14:x.rsi14,
      ret5:x.ret5,ret20:x.ret20,rvol:x.rvol,rs20:x.rs20,momentumShift:x.momentumShift
    }))
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

fs.mkdirSync(new URL('.', 'file://'+process.cwd()+'/'+historyPath).pathname,{recursive:true});
fs.writeFileSync(historyPath,JSON.stringify(history,null,2)+'\n');
console.log('history snapshots:',history.snapshots.length,'marketAsOf:',scan.marketAsOf);
