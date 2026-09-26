import fs from 'node:fs';
const bt=JSON.parse(fs.readFileSync('data/market-pulse-state-backtest.json','utf8'));
const horizons=['5','10','20'];
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;

const regimeFamily=r=>r==='Strong Bull'||r==='Bull'?'Bullish':r==='Strong Bear'||r==='Bear'?'Bearish':'Mixed';
const conditionFamily=c=>c==='Breakout / Near High'||c==='Positive Momentum'?'Advance':
  c==='Pullback'?'Pullback':
  c==='Extended'?'Extended':
  c==='Recovery Attempt'?'Recovery':'Weak / Range';

function parts(s){const [regime,condition]=s.split(' | ');return {regime,condition}}
function mergeStats(xs){
  xs=xs.filter(Boolean).filter(x=>x.n>0);
  const n=xs.reduce((s,x)=>s+x.n,0);if(!n)return null;
  const w=k=>xs.reduce((s,x)=>s+(Number.isFinite(x[k])?x[k]*x.n:0),0)/n;
  return {n,mean:round(w('mean')),positiveRate:round(w('positiveRate'),1),avgMAE:round(w('avgMAE')),avgMFE:round(w('avgMFE'))};
}
function familyMap(byState,split){
  const groups={};
  for(const [state,v] of Object.entries(byState||{})){
    const p=parts(state),key=regimeFamily(p.regime)+' | '+conditionFamily(p.condition);
    (groups[key]??=[]).push(v?.[split]||null);
  }
  return Object.fromEntries(Object.entries(groups).map(([k,x])=>[k,mergeStats(x)]));
}
const result={generatedAt:new Date().toISOString(),note:'Audit of coarser analog fallback families. Display taxonomy remains unchanged.',markets:{}};
for(const [market,m] of Object.entries(bt.markets||{})){
  result.markets[market]={horizons:{}};
  for(const h of horizons){
    const by=m.horizons?.[h]?.byState||{};
    const overall=familyMap(by,'overall'),recent=familyMap(by,'recent');
    const rows=Object.keys(overall).map(k=>({family:k,overall:overall[k],recent:recent[k]}));
    result.markets[market].horizons[h]={
      families:rows,
      coverage:{
        families:rows.length,
        overall100Plus:rows.filter(x=>(x.overall?.n||0)>=100).length,
        recent30Plus:rows.filter(x=>(x.recent?.n||0)>=30).length,
        robust:rows.filter(x=>(x.overall?.n||0)>=100&&(x.recent?.n||0)>=30).length,
        minOverallN:Math.min(...rows.map(x=>x.overall?.n||0)),
        medianOverallN:[...rows.map(x=>x.overall?.n||0)].sort((a,b)=>a-b)[Math.floor(rows.length/2)]
      }
    };
  }
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/market-pulse-family-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.markets).map(([k,v])=>[k,Object.fromEntries(Object.entries(v.horizons).map(([h,z])=>[h,z.coverage]))])),null,2));
