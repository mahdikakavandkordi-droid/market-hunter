import fs from 'node:fs';

const bt=JSON.parse(fs.readFileSync('data/market-pulse-state-backtest.json','utf8'));
const horizons=['5','10','20'];
const markets=Object.keys(bt.markets||{});
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;

function mergeStats(parts){
  const xs=parts.filter(Boolean).filter(x=>Number.isFinite(x.n)&&x.n>0);
  const n=xs.reduce((s,x)=>s+x.n,0);
  if(!n)return null;
  const w=k=>xs.reduce((s,x)=>s+(Number.isFinite(x[k])?x[k]*x.n:0),0)/n;
  return {n,mean:round(w('mean')),positiveRate:round(w('positiveRate'),1),avgMAE:round(w('avgMAE')),avgMFE:round(w('avgMFE'))};
}
function allStateStats(market,h,split='overall'){
  const by=bt.markets?.[market]?.horizons?.[h]?.byState||{};
  return Object.fromEntries(Object.entries(by).map(([k,v])=>[k,v?.[split]||null]));
}
function stateParts(state){
  const [regime,condition]=state.split(' | ');
  return {regime,condition};
}
function collectBy(map,pred){
  return mergeStats(Object.entries(map).filter(([s])=>pred(stateParts(s))).map(([,v])=>v));
}
function diff(a,b){
  if(!a||!b)return null;
  return {mean:round(a.mean-b.mean),positiveRate:round(a.positiveRate-b.positiveRate,1),mae:round(a.avgMAE-b.avgMAE),mfe:round(a.avgMFE-b.avgMFE)};
}
function consistency(rows,key){
  const vals=rows.map(x=>x?.[key]).filter(Number.isFinite);
  if(!vals.length)return null;
  return {positive:vals.filter(x=>x>0).length,negative:vals.filter(x=>x<0).length,zero:vals.filter(x=>x===0).length,min:round(Math.min(...vals)),max:round(Math.max(...vals)),avg:round(vals.reduce((s,x)=>s+x,0)/vals.length)};
}

const result={generatedAt:new Date().toISOString(),note:'Taxonomy audit using existing state backtest aggregates; no engine change.',fragmentation:{},comparisons:{}};

for(const market of markets){
  const by20=bt.markets[market]?.horizons?.['20']?.byState||{};
  const ns=Object.values(by20).map(x=>x?.overall?.n||0);
  result.fragmentation[market]={
    states:Object.keys(by20).length,
    statesUnder20:ns.filter(n=>n<20).length,
    statesUnder50:ns.filter(n=>n<50).length,
    states50Plus:ns.filter(n=>n>=50).length,
    minN:ns.length?Math.min(...ns):null,
    medianN:ns.length?[...ns].sort((a,b)=>a-b)[Math.floor(ns.length/2)]:null
  };
}

for(const h of horizons){
  const rows=[];
  for(const market of markets){
    for(const split of ['overall','recent']){
      const map=allStateStats(market,h,split);
      const strongBull=collectBy(map,x=>x.regime==='Strong Bull');
      const bull=collectBy(map,x=>x.regime==='Bull');
      const strongBear=collectBy(map,x=>x.regime==='Strong Bear');
      const bear=collectBy(map,x=>x.regime==='Bear');
      const breakout=collectBy(map,x=>x.condition==='Breakout / Near High');
      const positive=collectBy(map,x=>x.condition==='Positive Momentum');
      const weakening=collectBy(map,x=>x.condition==='Weakening');
      const range=collectBy(map,x=>x.condition==='Range / Mixed');
      const recovery=collectBy(map,x=>x.condition==='Recovery Attempt');
      const pullback=collectBy(map,x=>x.condition==='Pullback');
      const extended=collectBy(map,x=>x.condition==='Extended');
      rows.push({market,split,
        strongBullVsBull:diff(strongBull,bull),
        strongBearVsBear:diff(strongBear,bear),
        breakoutVsPositive:diff(breakout,positive),
        weakeningVsRange:diff(weakening,range),
        recoveryVsRange:diff(recovery,range),
        pullbackVsBreakout:diff(pullback,breakout),
        extendedVsBreakout:diff(extended,breakout),
        samples:{strongBull:strongBull?.n,bull:bull?.n,strongBear:strongBear?.n,bear:bear?.n,breakout:breakout?.n,positive:positive?.n,weakening:weakening?.n,range:range?.n,recovery:recovery?.n,pullback:pullback?.n,extended:extended?.n}
      });
    }
  }
  const overall=rows.filter(x=>x.split==='overall'),recent=rows.filter(x=>x.split==='recent');
  result.comparisons[h]={
    perMarket:rows,
    consistency:{
      overall:{
        strongBullVsBull:consistency(overall.map(x=>x.strongBullVsBull),'mean'),
        strongBearVsBear:consistency(overall.map(x=>x.strongBearVsBear),'mean'),
        breakoutVsPositive:consistency(overall.map(x=>x.breakoutVsPositive),'mean'),
        weakeningVsRange:consistency(overall.map(x=>x.weakeningVsRange),'mean'),
        recoveryVsRange:consistency(overall.map(x=>x.recoveryVsRange),'mean'),
        pullbackVsBreakout:consistency(overall.map(x=>x.pullbackVsBreakout),'mean'),
        extendedVsBreakout:consistency(overall.map(x=>x.extendedVsBreakout),'mean')
      },
      recent:{
        strongBullVsBull:consistency(recent.map(x=>x.strongBullVsBull),'mean'),
        strongBearVsBear:consistency(recent.map(x=>x.strongBearVsBear),'mean'),
        breakoutVsPositive:consistency(recent.map(x=>x.breakoutVsPositive),'mean'),
        weakeningVsRange:consistency(recent.map(x=>x.weakeningVsRange),'mean'),
        recoveryVsRange:consistency(recent.map(x=>x.recoveryVsRange),'mean'),
        pullbackVsBreakout:consistency(recent.map(x=>x.pullbackVsBreakout),'mean'),
        extendedVsBreakout:consistency(recent.map(x=>x.extendedVsBreakout),'mean')
      }
    }
  };
}

fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/market-pulse-taxonomy-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({fragmentation:result.fragmentation,comparisons:Object.fromEntries(Object.entries(result.comparisons).map(([h,x])=>[h,x.consistency]))},null,2));
