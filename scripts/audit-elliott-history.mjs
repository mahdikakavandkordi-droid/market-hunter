import fs from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSymbolAnalysis,normalizeChart,detectGaps} from '../lib/elliott/symbol-analysis.mjs';
import {auditStructure} from '../lib/elliott/historical-structure.mjs';
import {hash} from '../lib/elliott/paper-account.mjs';
import {MODEL,analyzeElliott} from '../lib/elliott/engine.mjs';
import {chartSVG,escapeHTML} from '../elliott.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'data/research/elliott-v1/historical');
const protocol=JSON.parse(fs.readFileSync(path.join(dir,'protocol.json'),'utf8'));
const cache=new Map(),raw=new Map();
async function cachedFetch(url,options){
  if(!cache.has(url))cache.set(url,(async()=>{const r=await fetch(url,options);if(!r.ok)throw Error('provider_http_'+r.status);const body=await r.json();raw.set(url,body);return body})());
  return {ok:true,json:async()=>structuredClone(await cache.get(url))};
}
const capture=process.argv.includes('--capture');
if(!capture&&!fs.existsSync(path.join(dir,'manifest.json')))throw Error('capture_required_before_replay');
let manifest;
if(capture){
  if(fs.existsSync(path.join(dir,'manifest.json')))throw Error('frozen_snapshot_already_exists');
  const asOf=Date.now(),entries=[];fs.mkdirSync(path.join(dir,'snapshots'),{recursive:true});
  for(let at=0;at<protocol.instruments.length;at+=4){
    const batch=await Promise.all(protocol.instruments.slice(at,at+4).map(async instrument=>{
      try{
        const data=await loadSymbolAnalysis(instrument.symbol,instrument.market,{nowMs:asOf,fetcher:cachedFetch});
        const reference=data.quality.reference;
        const refChart=reference?[...raw.values()].map(p=>p.chart?.result?.[0]).find(c=>c?.meta?.symbol?.toUpperCase()===reference):null;
        const referenceDates=refChart?normalizeChart(refChart,{mode:'stock',asOf}).rows.map(b=>b.date):[];
        const snapshot={...instrument,capturedAt:new Date().toISOString(),asOf:new Date(asOf).toISOString(),
          source:data.source,quality:data.quality,currency:data.currency,bars:data.bars,referenceDates,
          gapBeforeTimes:detectGaps(data.bars,{mode:data.mode,referenceDates})};
        const file='snapshots/'+instrument.symbol+'.json.gz.b64';fs.writeFileSync(path.join(dir,file),gzipSync(JSON.stringify(snapshot),{mtime:0}).toString('base64')+'\n');
        return {...instrument,status:data.quality.usable?'usable':'excluded',quality:data.quality,file,checksum:hash(snapshot),bars:data.bars.length};
      }catch(e){return {...instrument,status:'failed',error:e.message}}
    }));entries.push(...batch);console.log(JSON.stringify({captured:entries.length,total:protocol.instruments.length,batch:batch.map(x=>({symbol:x.symbol,status:x.status,bars:x.bars}))}));
  }
  manifest={version:protocol.version,protocolHash:hash(protocol),modelHash:hash(MODEL),asOf:new Date(asOf).toISOString(),entries};
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}else manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
if(manifest.protocolHash!==hash(protocol)||manifest.modelHash!==hash(MODEL))throw Error('frozen_protocol_or_model_changed');
const results=[],cases=[];
for(const entry of manifest.entries.filter(e=>e.status==='usable')){
  const snapshot=JSON.parse(gunzipSync(Buffer.from(fs.readFileSync(path.join(dir,entry.file),'utf8').trim(),'base64')));
  if(hash(snapshot)!==entry.checksum)throw Error('snapshot_checksum_mismatch');
  const result=auditStructure(snapshot);results.push(result);
  // Selection is rule based before any future-return calculations (none exist).
  const chosen=new Map();
  for(const s of result.signals)if(!chosen.has('signal_'+s.dir))chosen.set('signal_'+s.dir,{time:Date.parse(s.signalCompletedAt),id:s.decisionId,kind:'signal_'+s.dir});
  const chronological=[...result.finalCandidates].sort((a,b)=>a.updatedAt-b.updatedAt||a.id.localeCompare(b.id));
  for(const c of chronological)if(c.reason&&!chosen.has(c.reason))chosen.set(c.reason,{time:c.updatedAt,id:c.id,kind:c.reason});
  for(const selected of [...chosen.values()]){
    const bars=snapshot.bars.filter(b=>b.endT<=selected.time),analysis=analyzeElliott(bars,{symbol:entry.symbol,asOf:selected.time,gapBeforeTimes:snapshot.gapBeforeTimes});
    const signal=analysis.decisions.find(s=>s.decisionId===selected.id);
    const scenario=analysis.candidates.find(c=>c.id===(signal?.structureId||selected.id));
    if(scenario)cases.push({symbol:entry.symbol,kind:selected.kind,asOf:new Date(selected.time).toISOString(),scenario,signal:signal||null,bars});
  }
  console.log(JSON.stringify({audited:entry.symbol,bars:result.bars,candidates:result.candidates,signals:result.signals.length,prefixChecks:result.prefixChecks}));
}
const sum=key=>results.reduce((n,r)=>n+r[key],0),signals=results.flatMap(r=>r.signals),reasons={};
for(const r of results)for(const [k,n] of Object.entries(r.reasons))reasons[k]=(reasons[k]||0)+n;
const byMarket={};for(const r of results){const m=byMarket[r.market]??={symbols:0,bars:0,candidates:0,long:0,short:0};m.symbols++;m.bars+=r.bars;m.candidates+=r.candidates;m.long+=r.signals.filter(s=>s.dir===1).length;m.short+=r.signals.filter(s=>s.dir===-1).length}
const report={version:protocol.version,model:MODEL,protocolHash:hash(protocol),manifestHash:hash(manifest),
  generatedFromFrozenAsOf:manifest.asOf,sampleSize:manifest.entries.length,usable:results.length,
  excluded:manifest.entries.filter(e=>e.status!=='usable'),prefixChecks:sum('prefixChecks'),bars:sum('bars'),
  candidates:sum('candidates'),signals:signals.length,long:signals.filter(s=>s.dir===1).length,short:signals.filter(s=>s.dir===-1).length,
  byMarket,reasons,signalsByRegime:signals.reduce((o,s)=>{o[s.regime]=(o[s.regime]||0)+1;return o},{}),
  caseCount:cases.length,performanceEvaluated:false,groundTruthAccuracyEvaluated:false,
  limits:protocol.limits,results};
fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
const table=Object.entries(byMarket).map(([m,r])=>`| ${m} | ${r.symbols} | ${r.bars} | ${r.candidates} | ${r.long} | ${r.short} |`).join('\n');
const md=`# Elliott fixed-model historical structure audit\n\nFrozen source cutoff: ${manifest.asOf}. Model parameters unchanged.\n\n${results.length}/${manifest.entries.length} usable symbols; ${report.bars} completed daily bars; ${report.prefixChecks} prefix checks passed. ${report.candidates} impulse candidates; ${report.long} long and ${report.short} short confirmations.\n\n| Market | Symbols | Bars | Impulses | Long | Short |\n|---|---:|---:|---:|---:|---:|\n${table}\n\n## Rejection/state reasons\n\n${Object.entries(reasons).map(([k,n])=>'- '+k+': '+n).join('\n')}\n\n## Interpretation\n\nPrefix equality verifies that later candles do not change emitted pivots or decisions on these frozen observations. It does not establish objectively correct Elliott counts or a trading edge. The count is a strict six-pivot impulse with simple ABC, not full discretionary Elliott analysis. Final candidate states include subsequent invalidations and are not historical entry signals. Chart cases show only candles available at the indicated time.\n\nThe 20-symbol sample was fixed before fetching, but is a purposive liquid survivor sample. Source history is currently observed/revised data; it is not historical point-in-time data. The two-year window has limited cycle coverage. SMA regimes use only past closes and need 200 warm-up bars. Split/invalid/stale sources are excluded, not repaired to improve the outcome. This audit reports diagnostics across the period, so its final third is not an untouched holdout for later tuning. No parameters were tuned.\n\nNo 4H trade replay, costs, win rate, return or drawdown is claimed. Two-year daily data does not supply the two-year intraday path required by the actual account model. Full 4H execution validation requires a frozen longer intraday dataset; it must not substitute daily bars or invent fills. Existing forward ledgers are untouched and the runner remains disabled.\n\n## Next decision\n\nReview count frequency, rejected corrections and confirmation delays in report.json and cases.html before changing a parameter. Any later development must pre-register limited alternatives and reserve fresh time/symbol data. Separately obtain long intraday history for account backtesting.\n`;
fs.writeFileSync(path.join(dir,'report.md'),md);
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Elliott historical count review</title><style>body{background:#101a2a;color:#d6e5f3;font:16px system-ui;margin:24px}article{margin:30px 0;padding:20px;border:1px solid #345}svg{width:100%;max-width:1100px}.chart-label,.wave-label{fill:#d6e5f3;font-size:12px}.chart-grid{stroke:#30445c}.wave-line{fill:none;stroke:#f4c575;stroke-width:2}.wave-point{fill:#f4c575}small{color:#9bb1c9}</style><h1>Fixed-model historical wave review</h1><p>Daily structural diagnostics only. No profitability or ground-truth accuracy claim. Each chart stops at its observation time.</p>${cases.map(c=>`<article><h2>${escapeHTML(c.symbol)} · ${escapeHTML(c.kind)}</h2><small>Available at ${escapeHTML(c.asOf)} · status ${escapeHTML(c.scenario.status)} · ${escapeHTML(c.scenario.reason||'')}</small>${chartSVG(c.bars,c.scenario,{lang:'en',signal:c.signal})}</article>`).join('')}</html>`;
fs.writeFileSync(path.join(dir,'cases.html'),html);console.log(JSON.stringify({summary:{usable:report.usable,bars:report.bars,prefixChecks:report.prefixChecks,candidates:report.candidates,long:report.long,short:report.short,cases:cases.length},byMarket,reasons}));
