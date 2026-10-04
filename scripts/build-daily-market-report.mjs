import fs from 'node:fs';

const pulse=JSON.parse(fs.readFileSync('data/market-pulse-report.json','utf8'));
const hunter=fs.existsSync('data/v2-latest-scan.json')?JSON.parse(fs.readFileSync('data/v2-latest-scan.json','utf8')):null;
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const signed=n=>Number.isFinite(n)?`${n>=0?'+':''}${round(n,1)}%`:'—';

function horizonTone(a){
  if(!a)return 'Unknown';
  if(a.label==='Historically Favorable')return 'Supportive';
  if(a.label==='Historically Weaker')return 'Cautious';
  if(a.label==='Long-term Favorable · Recent Weaker')return 'Constructive, recent caution';
  if(a.label==='Long-term Weaker · Recent Better')return 'Improving, longer-term caution';
  return 'Mixed';
}
function evidenceSummary(m){
  const a=m.historicalAnalog||{};
  const horizons=Object.fromEntries(['5','10','20'].map(h=>[h,{
    tone:horizonTone(a[h]),
    label:a[h]?.label||null,
    confidence:a[h]?.confidence||null,
    analogLevel:a[h]?.analogLevel||null,
    sample:a[h]?.sample||null
  }]));
  return {
    sessions5:horizons['5'].tone,
    sessions10:horizons['10'].tone,
    sessions20:horizons['20'].tone,
    confidence:[horizons['5'].confidence,horizons['10'].confidence,horizons['20'].confidence].filter(Boolean),
    analogLevels:[horizons['5'].analogLevel,horizons['10'].analogLevel,horizons['20'].analogLevel].filter(Boolean),
    horizons
  };
}
function attentionScore(m){
  const a=m.historicalAnalog||{};
  let s=0;
  if(['Weakening','Recovery Attempt','Extended'].includes(m.condition))s+=2;
  if(m.condition==='Pullback')s+=1.5;
  if(Object.values(a).some(x=>x?.specificSetup?.warning))s+=3;
  s+=Object.values(a).filter(x=>x?.label==='Historically Weaker').length*1.5;
  s+=Object.values(a).filter(x=>x?.label==='Long-term Favorable · Recent Weaker').length;
  const d20=Math.abs(m.current?.returns?.d20||0);if(d20>=8)s+=1;
  const d5=Math.abs(m.current?.returns?.d5||0);if(d5>=4)s+=.5;
  return s;
}
function marketView(m){
  const ev=evidenceSummary(m),a=m.historicalAnalog||{};
  const specific=Object.values(a).find(x=>x?.specificSetup?.warning)?.specificSetup||null;
  let framing='Two-sided / evidence mixed';
  const support=[ev.sessions5,ev.sessions10,ev.sessions20].filter(x=>x==='Supportive').length;
  const caution=[ev.sessions5,ev.sessions10,ev.sessions20].filter(x=>x==='Cautious').length;
  const recentCaution=[ev.sessions5,ev.sessions10,ev.sessions20].filter(x=>x.includes('recent caution')).length;
  if(specific)framing='Broader setup constructive, exact setup caution';
  else if(support>=2)framing='Historical analogs supportive';
  else if(caution>=2)framing='Historical analogs cautious';
  else if(recentCaution>=2)framing='Long-term constructive, recent follow-through weaker';
  else if(m.regime==='Strong Bull'&&m.condition==='Breakout / Near High')framing='Strong trend, slower follow-through risk';
  else if((m.regime==='Strong Bull'||m.regime==='Bull')&&m.condition==='Pullback')framing='Primary trend intact, pullback unresolved';
  else if(m.condition==='Weakening')framing='Short-term damage, confirmation required';

  return {
    key:m.key,name:m.name,asOf:m.asOf,price:m.price,regime:m.regime,condition:m.condition,freshness:m.freshness||null,
    returns:m.current?.returns||{},
    framing,
    evidence:ev,
    outlook:m.outlook,
    watchNext:m.watchNext,
    levels:m.levels,
    specificSetupWarning:specific,
    attentionScore:round(attentionScore(m),1)
  };
}
function moverLine(m){
  const r=m.current?.returns||{};
  return `${m.name}: 1D ${signed(r.d1)}, 5D ${signed(r.d5)}, 20D ${signed(r.d20)} — ${m.regime} / ${m.condition}`;
}
function groupSummary(label){
  const g=pulse.crossMarketRead?.groups?.find(x=>x.label===label);
  const members=pulse.markets.filter(x=>{
    if(label==='Equities')return x.group==='Equity Index';
    if(label==='Metals')return x.group==='Commodity';
    if(label==='Crypto')return x.group==='Crypto';
    return false;
  });
  return {
    label,state:g?.state||'Mixed',detail:g?.detail||'',
    markets:members.map(x=>({key:x.key,name:x.name,regime:x.regime,condition:x.condition,d5:x.current?.returns?.d5,d20:x.current?.returns?.d20}))
  };
}
function regimeRank(r){
  return ({'Strong Bear':0,'Bear':1,'Mixed':2,'Bull':3,'Strong Bull':4})[r]??2;
}
function buildDivergences(){
  const by=Object.fromEntries(pulse.markets.map(x=>[x.key,x]));
  const out=[];
  const tsx=by.TSX,sp=by.SP500,nq=by.NASDAQ100,gold=by.GOLD,silver=by.SILVER,btc=by.BTC,eth=by.ETH;
  if(tsx&&sp&&nq&&regimeRank(tsx.regime)<Math.min(regimeRank(sp.regime),regimeRank(nq.regime))){
    out.push({id:'canada-vs-us',label:'Equity leadership',text:`Canada is lagging U.S. equity leadership: TSX is ${tsx.regime} / ${tsx.condition}, while S&P 500 and Nasdaq-100 are both in stronger primary regimes.`});
  }
  if(gold&&silver&&gold.condition==='Weakening'&&silver.condition==='Weakening'&&sp&&nq&&regimeRank(sp.regime)>=3&&regimeRank(nq.regime)>=3){
    out.push({id:'metals-vs-risk',label:'Cross-asset confirmation',text:'U.S. equities remain constructive while both gold and silver are weakening short term, so metals are not confirming the current risk-on tone.'});
  }
  if(btc&&eth&&regimeRank(btc.regime)>=3&&regimeRank(eth.regime)>=3&&btc.condition==='Pullback'&&eth.condition==='Pullback'){
    out.push({id:'crypto-timeframe',label:'Timeframe divergence',text:'Bitcoin and Ethereum retain bullish primary regimes, but both are in short-term pullbacks. The higher-timeframe trend and near-term condition are pointing in different directions.'});
  }
  const ethSpecific=eth&&Object.values(eth.historicalAnalog||{}).find(x=>x?.specificSetup?.warning)?.specificSetup;
  if(ethSpecific){
    out.push({id:'eth-exact-vs-family',label:'Analog divergence',text:'Ethereum’s broader bullish-pullback family is more robust than the sparse exact setup; the exact recent setup has shown materially weaker follow-through.'});
  }
  return out.slice(0,4);
}
function watchItem(m){
  return {
    market:m.key,
    name:m.name,
    regime:m.regime,
    condition:m.condition,
    text:`${m.name}: ${m.watchNext}`,
    levels:m.levels||null
  };
}

const views=pulse.markets.map(marketView);
const attention=[...views].sort((a,b)=>b.attentionScore-a.attentionScore||a.name.localeCompare(b.name));
const movers=[...pulse.markets].sort((a,b)=>Math.abs(b.current?.returns?.d1||0)-Math.abs(a.current?.returns?.d1||0));

const dataDates=[...new Set(pulse.markets.map(x=>x.asOf).filter(Boolean))].sort();
const latestAsOf=dataDates.at(-1)||null,earliestAsOf=dataDates[0]||null;
const mixedDates=dataDates.length>1;
const datesByMarket=Object.fromEntries(pulse.markets.map(x=>[x.key,x.asOf||null]));
const freshnessByMarket=Object.fromEntries(pulse.markets.map(x=>[x.key,x.freshness||null]));
const mixedDateSummary=pulse.markets.map(x=>`${x.key} ${x.asOf||'—'}`).join(' · ');
const keyDivergences=buildDivergences();

const headline=pulse.crossMarketRead?.headline||'Cross-market conditions are mixed.';
const keyDevelopments=[];
for(const m of attention){
  if(keyDevelopments.length>=5)break;
  if(m.specificSetupWarning){
    keyDevelopments.push({market:m.key,severity:'Caution',text:`${m.name}: broader analog is usable, but the exact current setup has materially weaker recent follow-through.`});
    continue;
  }
  if(m.condition==='Weakening'){
    keyDevelopments.push({market:m.key,severity:'Watch',text:`${m.name}: short-term structure is weakening; reclaim/hold levels matter more than the long-term label right now.`});
    continue;
  }
  if(m.condition==='Pullback'){
    keyDevelopments.push({market:m.key,severity:'Watch',text:`${m.name}: primary trend remains constructive, but the pullback is unresolved and rebound should be confirmed rather than assumed.`});
    continue;
  }
  if(m.condition==='Breakout / Near High'){
    keyDevelopments.push({market:m.key,severity:'Context',text:`${m.name}: trend is strong near highs, but historical follow-through is not automatically stronger than baseline.`});
  }
}
if(keyDevelopments.length<3){
  for(const m of movers){
    if(keyDevelopments.length>=3)break;
    if(keyDevelopments.some(x=>x.market===m.key))continue;
    keyDevelopments.push({market:m.key,severity:'Move',text:moverLine(m)});
  }
}

const watchNext=attention.slice(0,5).map(x=>watchItem(pulse.markets.find(m=>m.key===x.key))).filter(Boolean);

const hunterSummary=hunter?{
  generatedAt:hunter.generatedAt,
  visible:hunter.integratedSurfaceCounts?.visible??hunter.integratedSurfacePicks?.length??null,
  hiddenByIntegratedCap:hunter.integratedSurfaceCounts?.hiddenByIntegratedCap??null,
  picks:(hunter.integratedSurfacePicks||[]).map(x=>({rank:x.integratedRank,stage:x.stage,symbol:x.symbol,score:x.score}))
}:null;

const report={
  version:'daily-market-report-v0.2-2026-09-26',
  generatedAt:new Date().toISOString(),
  status:'research',
  asOf:{earliest:earliestAsOf,latest:latestAsOf,mixedDates,byMarket:datesByMarket},
  freshness:{byMarket:freshnessByMarket,source:pulse.freshness||null},
  headline,
  executiveSummary:[
    headline,
    mixedDates?`Completed-session dates differ by instrument: ${mixedDateSummary}.`: `All tracked markets are aligned to ${latestAsOf}.`,
    'The report separates primary trend from short-term condition and uses historically validated analogs for 5, 10 and 20 market sessions. It does not produce price targets.'
  ],
  groups:[groupSummary('Equities'),groupSummary('Metals'),groupSummary('Crypto')],
  keyDevelopments,
  keyDivergences,
  watchNext,
  markets:views,
  highestAttention:attention.slice(0,4).map(x=>x.key),
  hunterContext:hunterSummary,
  methodology:{
    source:pulse.version,
    horizons:['5 sessions','10 sessions','20 sessions'],
    interpretation:'Scenario framing, not a buy/sell signal or deterministic forecast.',
    evidence:'Exact State when sample policy is met; otherwise State Family → Regime → Condition → Market Baseline.'
  }
};

function mdMarket(m){
  const a=m.evidence;
  return `### ${m.name}
- **State:** ${m.regime} / ${m.condition}
- **Returns:** 1D ${signed(m.returns.d1)} · 5D ${signed(m.returns.d5)} · 20D ${signed(m.returns.d20)} · 60D ${signed(m.returns.d60)}
- **Historical read:** 5 sessions: ${a.sessions5} · 10: ${a.sessions10} · 20: ${a.sessions20}
- **Framing:** ${m.framing}
- **Outlook:** ${m.outlook}
- **Watch next:** ${m.watchNext}${m.specificSetupWarning?'\n- **Specific setup caution:** '+m.specificSetupWarning.note:''}
`;
}
let md=`# Market Hunter — Daily Market Report

**As of:** ${mixedDates?`${earliestAsOf} to ${latestAsOf} (${mixedDateSummary})`:latestAsOf}

## Executive read

${report.executiveSummary.map(x=>'- '+x).join('\n')}

## Key developments

${keyDevelopments.map(x=>`- **${x.severity}:** ${x.text}`).join('\n')}

## Group read

${report.groups.map(g=>`- **${g.label}: ${g.state}** — ${g.detail}`).join('\n')}

## Key divergences

${keyDivergences.length?keyDivergences.map(x=>`- **${x.label}:** ${x.text}`).join('\n'):'- No major cross-market divergence flagged today.'}

## What to watch next

${watchNext.map(x=>`- **${x.name}:** ${x.text.replace(x.name+': ','')}`).join('\n')}

## Market detail

${views.map(mdMarket).join('\n')}

## Hunter context

${hunterSummary?`Final shortlist: ${hunterSummary.visible} charts. ${hunterSummary.hiddenByIntegratedCap} additional validated stage picks remain in the backend.\n\n${hunterSummary.picks.map(x=>`${x.rank}. ${x.symbol} — ${x.stage}`).join('\n')}`:'Hunter shortlist unavailable.'}

---
Scenario framing is empirical and descriptive. It is not a price target or buy/sell signal.
`;

fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/daily-market-report.json',JSON.stringify(report,null,2));
fs.writeFileSync('data/daily-market-report.md',md);
console.log(JSON.stringify({version:report.version,asOf:report.asOf,headline:report.headline,keyDevelopments:report.keyDevelopments,highestAttention:report.highestAttention,hunter:report.hunterContext},null,2));
