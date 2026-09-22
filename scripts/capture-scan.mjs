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
const historyPath='data/history.json';
let history={snapshots:[]};
try{history=JSON.parse(await fs.readFile(historyPath,'utf8'))}catch{}
if(!Array.isArray(history.snapshots)) history.snapshots=[];

const snapshot={
  at:scan.asOf || new Date().toISOString(),
  minDollar:scan.minDollar,
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
    momentumShift:x.momentumShift,volumeVsAvg:x.volumeVsAvg
  }))
};

const compact=x=>JSON.stringify({
  breadth:x?.breadth,
  indexes:x?.indexes,
  items:(x?.items||[]).map(i=>[
    i.symbol,i.stage,i.score,i.rsi14,i.ret5,i.ret20,i.rvol,i.rs20,i.momentumShift,i.volumeVsAvg
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
console.log(`Stored snapshot ${snapshot.at} with ${snapshot.items.length} candidates.`);
