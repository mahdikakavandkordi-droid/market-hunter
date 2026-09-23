import fs from 'node:fs/promises';

const url=process.env.SCAN_URL || 'https://market-hunter-five.vercel.app/api/scan?minDollar=2000000';

async function getScan(){
  let lastError;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const res=await fetch(url,{headers:{'user-agent':'MarketHunter-History/1.0'}});
      if(!res.ok) throw new Error(`Scan HTTP ${res.status}`);
      return await res.json();
    }catch(err){
      lastError=err;
      if(attempt<3) await new Promise(r=>setTimeout(r,10000));
    }
  }
  throw lastError;
}

const scan=await getScan();
const expectedShadowVersion='hunter-1.4-candidate-v2-shadow';
if(scan.version!==expectedShadowVersion){
  throw new Error(`Shadow capture refused: expected ${expectedShadowVersion}, got ${scan.version||'unknown'}. Production is not serving the frozen Candidate V2 shadow build yet.`);
}
const historyPath='data/history.json';
let history={snapshots:[]};
try{history=JSON.parse(await fs.readFile(historyPath,'utf8'))}catch{}
if(!Array.isArray(history.snapshots)) history.snapshots=[];

const snapshot={
  at:scan.asOf || new Date().toISOString(),
  minDollar:scan.minDollar,
  marketAsOf:scan.marketAsOf,
  version:scan.version,
  breadth:{
    percentAbove50:scan.breadth?.percentAbove50 ?? null,
    trend:scan.breadth?.trend ?? null,
    candidates:scan.breadth?.candidates ?? null
  },
  indexes:Object.fromEntries(Object.entries(scan.indexes||{}).map(([k,v])=>[
    k,{price:v?.price??null,ret5:v?.ret5??null,ret20:v?.ret20??null}
  ])),
  items:(scan.items||[]).map(x=>({
    symbol:x.symbol,stage:x.stage,score:x.score,rsi14:x.rsi14,
    ret5:x.ret5,ret20:x.ret20,rvol:x.rvol,rs20:x.rs20,
    momentumShift:x.momentumShift,volumeVsAvg:x.volumeVsAvg,
    candidateV2:x.candidateV2===true
  })),
  candidateV2Items:(scan.candidateV2Items||[]).map(x=>({
    symbol:x.symbol,stage:x.stage,score:x.score,rsi14:x.rsi14,
    ret5:x.ret5,ret20:x.ret20,rvol:x.rvol,rs20:x.rs20,
    momentumShift:x.momentumShift,upDownVolumeRatio:x.upDownVolumeRatio,
    higherLow:x.higherLow,lowState:x.lowState
  }))
};

const compact=x=>JSON.stringify({
  marketAsOf:x?.marketAsOf,
  version:x?.version,
  minDollar:x?.minDollar,
  breadth:x?.breadth,
  indexes:x?.indexes,
  items:(x?.items||[]).map(i=>[
    i.symbol,i.stage,i.score,i.rsi14,i.ret5,i.ret20,i.rvol,i.rs20,i.momentumShift,i.volumeVsAvg,i.candidateV2
  ]),
  candidateV2Items:(x?.candidateV2Items||[]).map(i=>[
    i.symbol,i.stage,i.score,i.rsi14,i.ret5,i.ret20,i.rvol,i.rs20,i.momentumShift,i.upDownVolumeRatio,i.higherLow,i.lowState
  ])
});

const last=history.snapshots.at(-1);
if(last && compact(last)===compact(snapshot)){
  console.log('No market changes since last stored snapshot; skipping.');
  process.exit(0);
}

history.snapshots.push(snapshot);
history.snapshots=history.snapshots.slice(-60);
await fs.writeFile(historyPath,JSON.stringify(history,null,2)+'\n');
console.log(`Stored snapshot ${snapshot.at} with ${snapshot.items.length} live candidates and ${snapshot.candidateV2Items.length} Candidate V2 shadow picks.`);

