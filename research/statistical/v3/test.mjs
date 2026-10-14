import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {normalizeYahoo,validateBars,MARKETS,CONTEXTS,marketHoliday,hash} from './data.mjs';
import {volatilityLedger,fitGarch,garchForecast,ridgeFit,ridgePredict} from './models.mjs';
import {summarizeLedger,pairedBootstrap,holm} from './diagnostics.mjs';
import {directionLedger} from './direction.mjs';
import {runResearch,assertComplete} from './run.mjs';
import {volatilityBacktest,macroBacktest} from '../phase2.mjs';

// Synthetic data validate execution/causality only; NEVER financial evidence.
let seed=23,price=100;
const bars=Array.from({length:650},(_,i)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;price*=Math.exp((seed/2**32-.5)*.045);return {date:new Date(Date.UTC(2020,0,1)+i*86400000).toISOString().slice(0,10),close:price};});
const changed=bars.map((b,i)=>i>500?{...b,close:b.close*(2+i/100)}:b);
const ledger=volatilityLedger(bars),shock=volatilityLedger(changed);
assert.equal(ledger.records.length,shock.records.length);
for(let i=0;i<ledger.records.length;i++)if(ledger.records[i].t<=500){
 const a=ledger.records[i],b=shock.records[i];
 assert.deepEqual(a.forecasts,b.forecasts);assert.equal(a.regime,b.regime);
 assert(a.trainingLabelEnd<=a.date);assert(a.trainingLastOrigin<a.date);assert(a.targetEndDate>a.date);
}
for(const fit of ledger.fits)if(fit.decisionDate<=bars[500].date)assert.deepEqual(fit,shock.fits.find(f=>f.horizonBars===fit.horizonBars&&f.decisionDate===fit.decisionDate));
const summary=summarizeLedger(ledger.records,{bootstrapReps:49});
const old=volatilityBacktest(bars);
for(let i=0;i<old.length;i++){
 assert.equal(summary[i].n,old[i].n);
 assert(Math.abs(summary[i].models.harLog.volatilityMSE-old[i].harMSE)<1e-14);
 assert(Math.abs(summary[i].comparisons.persistence20.volatilityMseSkillPct-old[i].skillVsPersistencePct)<1e-10);
 assert(Math.abs(summary[i].models.mean.volatilityMSE-old[i].historicalMeanMSE)<1e-14);
 assert.equal(summary[i].comparisons.ewma.allOffsets.reduce((s,v)=>s+v.n,0),summary[i].n);
}
assert.deepEqual(pairedBootstrap(Array(50).fill(-2),{reps:99}).ci95,[-2,-2]);
assert.equal(pairedBootstrap(Array(50).fill(0),{reps:99}).centeredTwoSidedP,1);
assert.deepEqual(holm([{p:.01},{p:.04},{p:.03}]).map(x=>x.adjustedP),[.03,.06,.06]);
const constantGarch=fitGarch(Array(300).fill(.02));
assert(Math.abs(garchForecast(constantGarch,constantGarch.state,20)-.0004)<1e-12);
const fit=ridgeFit(Array.from({length:100},(_,i)=>({x:[i],y:2+i*.3})),0);
assert(Math.abs(ridgePredict(fit,[150])-47)<1e-9);

const context=Object.fromEntries(['vix','us10y','dxy','oil','spx'].map(k=>[k,bars]));
const contextShock=Object.fromEntries(['vix','us10y','dxy','oil','spx'].map(k=>[k,changed]));
const directions=directionLedger(bars,context),directionsShock=directionLedger(changed,contextShock);
for(let i=0;i<directions.records.length;i++)if(directions.records[i].t<=500){const a=directions.records[i],b=directionsShock.records[i];assert.deepEqual(a.price,b.price);assert.deepEqual(a.macro,b.macro);assert.equal(a.prior,b.prior);}
const originalMacro=macroBacktest(bars,context);
for(const old of originalMacro){const rows=directions.records.filter(r=>r.horizonBars===old.horizonBars);const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
 const bs=key=>avg(rows.map(r=>(r[key].probabilityUp-+(r.actualLogReturn>0))**2));
 assert(Math.abs(100*(1-bs('macro')/bs('price'))-old.macroBrierSkillVsPricePct)<1e-10);
}
const crypto=MARKETS.find(s=>s.id==='btc');
const rawFor=(dates,prices,zone='UTC')=>({chart:{result:[{meta:{exchangeTimezoneName:zone},timestamp:dates.map(d=>Date.parse(d)/1000),indicators:{quote:[{close:prices}],adjclose:[{adjclose:prices}]}}]}});
const options={from:'2020-01-01',asof:'2020-01-03',retrievedAt:'2020-01-03T12:00:00Z'};
const raw=rawFor(['2020-01-01T00:00:00Z','2020-01-02T00:00:00Z','2020-01-03T00:00:00Z'],[100,101,102]);
const normalized=normalizeYahoo(raw,crypto,options);assert.equal(normalized.bars.length,2);assert.equal(normalized.rejected.length,1);
assert.throws(()=>normalizeYahoo(rawFor(['2020-01-01','2020-01-02'],[100,-37]),crypto,{...options,retrievedAt:'2020-01-04T00:00:00Z'}),/Invalid/);
assert.throws(()=>normalizeYahoo(rawFor(['2020-01-01','2020-01-01'],[100,101]),crypto,options),/Duplicate/);
assert.throws(()=>normalizeYahoo(rawFor(['2020-01-01','2020-01-03'],[100,101]),crypto,{...options,retrievedAt:'2020-01-04T12:00:00Z'}),/Missing crypto/);
assert.throws(()=>validateBars([{date:'2020-01-01',close:0}]),/Invalid price/);
validateBars([{date:'2020-01-01',close:-37}],{allowSigned:true});
const spx=MARKETS.find(s=>s.id==='sp500');
const dst=normalizeYahoo(rawFor(['2020-03-06T14:30:00Z','2020-03-09T13:30:00Z'],[100,101],'America/New_York'),spx,{from:'2020-03-01',asof:'2020-03-10',retrievedAt:'2020-03-11T00:00:00Z'});
assert.equal(dst.bars[0].sessionEnd,'2020-03-06T21:00:00.000Z');assert.equal(dst.bars[1].sessionEnd,'2020-03-09T20:00:00.000Z');
const missingAdj=rawFor(['2020-03-06T14:30:00Z'],[100],'America/New_York');missingAdj.chart.result[0].indicators.adjclose=[];
assert.throws(()=>normalizeYahoo(missingAdj,MARKETS.find(s=>s.id==='gold'),{from:'2020-01-01',asof:'2020-03-10',retrievedAt:'2020-03-11T00:00:00Z'}),/Invalid adjusted/);
const vix=CONTEXTS.find(s=>s.id==='vix');
const holiday=normalizeYahoo(rawFor(['2020-01-17T08:00:00Z','2020-01-20T08:00:00Z','2020-01-21T08:00:00Z'],[12,null,13],'America/Chicago'),vix,{from:'2020-01-01',asof:'2020-01-22',retrievedAt:'2020-01-23T00:00:00Z'});
assert.equal(holiday.bars.length,2);assert.equal(holiday.rejected[0].reason,'empty-US-exchange-holiday-placeholder');
assert.throws(()=>normalizeYahoo(rawFor(['2020-01-17T08:00:00Z','2020-01-21T08:00:00Z'],[12,null],'America/Chicago'),vix,{from:'2020-01-01',asof:'2020-01-22',retrievedAt:'2020-01-23T00:00:00Z'}),/Invalid close/);
assert.throws(()=>assertComplete({errors:[],markets:[],contexts:{}}),/Incomplete/);
const tsx=MARKETS.find(s=>s.id==='tsx');
for(const date of ['2022-01-03','2022-12-26','2022-12-27','2026-05-18','2026-10-12'])assert(marketHoliday(date,tsx));
assert(!marketHoliday('2026-06-19',tsx));assert(marketHoliday('2026-06-19',spx));
assert.throws(()=>normalizeYahoo(rawFor(['2020-03-05T14:30:00Z','2020-03-09T13:30:00Z'],[100,101],'America/New_York'),spx,{from:'2020-03-01',asof:'2020-03-10',retrievedAt:'2020-03-11T00:00:00Z'}),/Unexplained missing weekday/);

// Complete private bundle + network-disabled replay, then integrity corruption.
const tmp=await mkdtemp(path.join(os.tmpdir(),'statistical-v3-test-'));
try{
 const payloads={};
 for(const spec of [...MARKETS,...CONTEXTS]){
  const dates=[],prices=[];let count=0;
  for(let day=0;count<560;day++){
   const date=new Date(Date.UTC(2020,0,1)+day*86400000),wd=date.getUTCDay();
   if(spec.type!=='crypto'&&(wd===0||wd===6))continue;
   dates.push(date.toISOString().slice(0,10)+(spec.type==='crypto'?'T00:00:00Z':'T14:30:00Z'));prices.push(100*Math.exp(count*.0003+Math.sin(count*.2)*.01));count++;
  }
  payloads[spec.symbol]=JSON.stringify(rawFor(dates,prices,spec.type==='crypto'?'UTC':'America/New_York'));
 }
 const fetcher=async url=>({ok:true,text:async()=>payloads[decodeURIComponent(new URL(url).pathname.split('/').at(-1))]});
 const a=await runResearch({from:'2020-01-01',asof:'2023-01-01',output:path.join(tmp,'first'),bootstrapReps:19,fetcher});assert.equal(a.status,'complete');
 const noNetwork=()=>{throw Error('Network forbidden during replay');};
 const b=await runResearch({from:'2020-01-01',asof:'2023-01-01',output:path.join(tmp,'replay'),input:path.join(tmp,'first'),bootstrapReps:19,fetcher:noNetwork});assert.equal(b.status,'complete');assert.deepEqual(a.markets,b.markets);
 await assert.rejects(()=>runResearch({output:path.join(tmp,'first')}),/EEXIST/);
 const filename=path.join(tmp,'first','bars','tsx.json');await writeFile(filename,'[]');
 await assert.rejects(()=>runResearch({from:'2020-01-01',asof:'2023-01-01',output:path.join(tmp,'tampered'),input:path.join(tmp,'first'),bootstrapReps:19,fetcher:noNetwork}),/Evidence hash mismatch/);
}finally{await rm(tmp,{recursive:true,force:true});}
console.log('PASS v3: original-model numerical parity, complete-fit future invariance, target maturity, signed/missing/duplicate/partial/DST data, benchmark oracles, dependence diagnostics, complete bundle, offline replay and tamper/overwrite rejection. All fixtures SYNTHETIC.');
