import fs from 'node:fs';

const latest=JSON.parse(fs.readFileSync('data/market-pulse-latest.json','utf8'));
const backtest=JSON.parse(fs.readFileSync('data/market-pulse-state-backtest.json','utf8'));
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;

function confidence(overallN,recentN){
  if(overallN>=200&&recentN>=80)return 'High';
  if(overallN>=100&&recentN>=30)return 'Moderate';
  return 'Low';
}
function compareState(state,base){
  if(!state||!base)return null;
  return {
    meanLift:round(state.mean-base.mean),
    positiveRateLift:round(state.positiveRate-base.positiveRate,1),
    maeDelta:round(state.avgMAE-base.avgMAE),
    mfeDelta:round(state.avgMFE-base.avgMFE)
  };
}
function horizonAssessment(stateStats,baseStats){
  if(!stateStats||!baseStats)return null;
  const overall=compareState(stateStats.overall,baseStats.overall);
  const recent=compareState(stateStats.recent,baseStats.recent);
  const favorable=x=>x&&x.meanLift>0&&x.positiveRateLift>=0;
  const weaker=x=>x&&x.meanLift<0&&x.positiveRateLift<=0;
  let label='Mixed / Near Baseline';
  if(favorable(overall)&&favorable(recent))label='Historically Favorable';
  else if(weaker(overall)&&weaker(recent))label='Historically Weaker';
  else if(favorable(overall)&&weaker(recent))label='Long-term Favorable · Recent Weaker';
  else if(weaker(overall)&&favorable(recent))label='Long-term Weaker · Recent Better';
  return {
    label,
    confidence:confidence(stateStats.overall?.n||0,stateStats.recent?.n||0),
    stateOverall:stateStats.overall,
    stateRecent:stateStats.recent,
    baselineOverall:baseStats.overall,
    baselineRecent:baseStats.recent,
    lift:{overall,recent}
  };
}
function signed(n){return Number.isFinite(n)?(n>=0?'+':'')+round(n,1)+'%':'—'}
function happened(m){
  return `${m.name}: 1D ${signed(m.returns.d1)}, 5D ${signed(m.returns.d5)}, 20D ${signed(m.returns.d20)}, 60D ${signed(m.returns.d60)}.`;
}
function where(m){
  const s=m.structure||{},t=m.trend||{},d=m.descriptiveState||{};
  const parts=[`${d.regime} / ${d.condition}`,`Daily ${t.daily}`,`Weekly ${t.weekly}`,s.swingTrend].filter(Boolean);
  return parts.join(' · ')+'.';
}
function watch(m){
  const bull=m.levels?.bullishTrigger,bear=m.levels?.bearishTrigger,warn=m.levels?.warningLevel;
  const parts=[];
  if(Number.isFinite(bull))parts.push(`bullish continuation above ${round(bull)}`);
  if(Number.isFinite(warn))parts.push(`trend warning near ${round(warn)}`);
  if(Number.isFinite(bear))parts.push(`structure risk below ${round(bear)}`);
  return parts.join(' · ')+'.';
}
function outlookText(m,a5,a10,a20){
  const regime=m.descriptiveState?.regime,condition=m.descriptiveState?.condition;
  const labels=[a5?.label,a10?.label,a20?.label].filter(Boolean);
  const weakRecent=[a5,a10,a20].filter(x=>x?.lift?.recent?.meanLift<0).length;
  const strongRecent=[a5,a10,a20].filter(x=>x?.lift?.recent?.meanLift>0).length;
  if((regime==='Strong Bull'||regime==='Bull')&&condition==='Pullback'){
    if(weakRecent>=2)return 'Primary trend remains constructive, but recent historical pullback analogs have been weaker than the market\'s normal baseline. Treat this as an intact trend with elevated continuation risk, not an automatic rebound signal.';
    if(strongRecent>=2)return 'Primary trend remains constructive and recent pullback analogs have generally held up better than baseline. Continuation is supported historically, but confirmation still matters.';
    return 'Primary trend remains constructive, while pullback analogs are mixed. Expect a two-sided setup until support or resistance resolves.';
  }
  if((regime==='Strong Bull'||regime==='Bull')&&condition==='Breakout / Near High'){
    if(weakRecent>=2)return 'Trend is strong, but near-high analogs have recently produced less follow-through than the market baseline. Consolidation or slower continuation is a meaningful base case.';
    return 'Trend and location are constructive. Historical near-high behavior does not remove pullback risk, so follow-through above resistance matters more than the headline trend label.';
  }
  if(condition==='Weakening'){
    if(strongRecent>=2)return 'Momentum and structure are weakening, but similar recent states have still produced positive forward returns. This is better framed as a damaged/uncertain setup than a clean bearish call.';
    if(weakRecent>=2)return 'Momentum and structure are weakening and recent analogs have underperformed baseline. Risk remains elevated until the market reclaims nearby trend levels.';
    return 'Momentum is weakening, but historical follow-through is mixed. Confirmation from support/resistance is more useful than assuming immediate continuation lower.';
  }
  if(condition==='Recovery Attempt')return 'The market is attempting to recover from a weaker regime. Historical follow-through should be treated as conditional on reclaiming resistance and improving structure.';
  if(condition==='Extended')return 'Trend is constructive but stretched. Historical context favors separating trend strength from entry timing; consolidation risk is elevated.';
  if(labels.every(x=>x==='Historically Favorable'))return 'Current analogs have historically outperformed this market\'s baseline across the tested horizons.';
  if(labels.every(x=>x==='Historically Weaker'))return 'Current analogs have historically underperformed this market\'s baseline across the tested horizons.';
  return 'Historical analogs are mixed across horizons, so scenario levels matter more than a single directional forecast.';
}
function groupRead(rows,label){
  if(!rows.length)return {label,state:'Unavailable',detail:'No data.'};
  const strongBull=rows.filter(x=>x.descriptiveState?.regime==='Strong Bull').length;
  const bull=rows.filter(x=>['Strong Bull','Bull'].includes(x.descriptiveState?.regime)).length;
  const weakening=rows.filter(x=>x.descriptiveState?.condition==='Weakening').length;
  const pullback=rows.filter(x=>x.descriptiveState?.condition==='Pullback').length;
  let state='Mixed',detail='';
  if(strongBull===rows.length){state=pullback?'Strong trend · Pullback':'Strong trend';detail='All tracked markets in this group remain in a strong bull regime.'}
  else if(bull>=Math.ceil(rows.length/2)){state='Constructive but uneven';detail='Most tracked markets remain constructive, but leadership is not uniform.'}
  else if(weakening>=Math.ceil(rows.length/2)){state='Weakening';detail='Most tracked markets in this group show weakening short-term conditions.'}
  else detail='Signals are mixed across the tracked markets.';
  return {label,state,detail};
}

const marketReports=[];
for(const m of latest.markets){
  const bt=backtest.markets?.[m.key],stateKey=`${m.descriptiveState.regime} | ${m.descriptiveState.condition}`;
  const assessments={};
  for(const h of ['5','10','20']){
    const stateStats=bt?.horizons?.[h]?.byState?.[stateKey]||null;
    const baseStats=bt?.horizons?.[h]?.overall||null;
    assessments[h]=horizonAssessment(stateStats,baseStats);
  }
  marketReports.push({
    key:m.key,name:m.name,symbol:m.symbol,group:m.group,asOf:m.asOf,price:m.price,
    regime:m.descriptiveState.regime,condition:m.descriptiveState.condition,
    whatHappened:happened(m),
    whereWeAre:where(m),
    historicalAnalog:assessments,
    outlook:outlookText(m,assessments['5'],assessments['10'],assessments['20']),
    watchNext:watch(m),
    levels:m.levels,
    current:m
  });
}

const equities=latest.markets.filter(x=>x.group==='Equity Index');
const metals=latest.markets.filter(x=>x.group==='Commodity');
const crypto=latest.markets.filter(x=>x.group==='Crypto');
const groupReads=[groupRead(equities,'Equities'),groupRead(metals,'Metals'),groupRead(crypto,'Crypto')];
const us=latest.markets.filter(x=>['SP500','NASDAQ100'].includes(x.key));
const tsx=latest.markets.find(x=>x.key==='TSX');
let overall='Mixed cross-market environment.';
if(us.every(x=>x.descriptiveState?.regime==='Strong Bull')&&crypto.every(x=>x.descriptiveState?.regime==='Strong Bull')){
  overall=tsx?.descriptiveState?.condition==='Weakening'?'Risk-on but uneven: U.S. equities and crypto retain strong primary trends while Canada lags and metals are not confirming.':'Broadly risk-on, led by U.S. equities and crypto, with confirmation varying across other groups.';
}
if(metals.every(x=>x.descriptiveState?.condition==='Weakening'))overall+=' Precious metals are currently in a weakening short-term phase.';

const report={
  version:'market-pulse-report-v0.1-2026-09-26',
  sourceVersion:latest.version,
  generatedAt:new Date().toISOString(),
  status:'research',
  note:'Scenario framing is empirical and descriptive. It is not a price target or buy/sell signal.',
  crossMarketRead:{headline:overall,groups:groupReads},
  markets:marketReports
};
fs.writeFileSync('data/market-pulse-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({headline:report.crossMarketRead.headline,markets:marketReports.map(x=>({key:x.key,regime:x.regime,condition:x.condition,outlook:x.outlook,watchNext:x.watchNext}))},null,2));
