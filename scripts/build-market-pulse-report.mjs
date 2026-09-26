import fs from 'node:fs';

const latest=JSON.parse(fs.readFileSync('data/market-pulse-latest.json','utf8'));
const backtest=JSON.parse(fs.readFileSync('data/market-pulse-state-backtest.json','utf8'));
const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;

const regimeFamily=r=>r==='Strong Bull'||r==='Bull'?'Bullish':r==='Strong Bear'||r==='Bear'?'Bearish':'Mixed';
const conditionFamily=c=>c==='Breakout / Near High'||c==='Positive Momentum'?'Advance':
  c==='Pullback'?'Pullback':
  c==='Extended'?'Extended':
  c==='Recovery Attempt'?'Recovery':'Weak / Range';

function confidence(overallN,recentN){
  if(overallN>=200&&recentN>=60)return 'High';
  if(overallN>=100&&recentN>=30)return 'Moderate';
  return 'Low';
}
function robust(stats,minOverall=100,minRecent=30){
  return !!stats&&(stats.overall?.n||0)>=minOverall&&(stats.recent?.n||0)>=minRecent;
}
function mergeSummary(xs){
  xs=xs.filter(Boolean).filter(x=>(x.n||0)>0);
  const n=xs.reduce((s,x)=>s+x.n,0);if(!n)return null;
  const w=k=>xs.reduce((s,x)=>s+(Number.isFinite(x[k])?x[k]*x.n:0),0)/n;
  return {n,mean:round(w('mean')),median:null,positiveRate:round(w('positiveRate'),1),avgMAE:round(w('avgMAE')),avgMFE:round(w('avgMFE')),hitPlus5:round(w('hitPlus5'),1),hitMinus5:round(w('hitMinus5'),1)};
}
function familyStats(byState,regime,condition){
  const rf=regimeFamily(regime),cf=conditionFamily(condition),matched=[];
  for(const [state,v] of Object.entries(byState||{})){
    const [r,c]=state.split(' | ');
    if(regimeFamily(r)===rf&&conditionFamily(c)===cf)matched.push(v);
  }
  return {
    overall:mergeSummary(matched.map(x=>x?.overall)),
    train:mergeSummary(matched.map(x=>x?.train)),
    recent:mergeSummary(matched.map(x=>x?.recent))
  };
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
function chooseAnalog(bt,h,regime,condition){
  const hz=bt?.horizons?.[h],stateKey=`${regime} | ${condition}`;
  const exact=hz?.byState?.[stateKey]||null;
  if(robust(exact))return {stats:exact,level:'Exact State',key:stateKey,exactStats:exact};

  const family=familyStats(hz?.byState||{},regime,condition);
  if(robust(family))return {stats:family,level:'State Family',key:`${regimeFamily(regime)} | ${conditionFamily(condition)}`,exactStats:exact};

  const reg=hz?.byRegime?.[regime]||null;
  if(robust(reg,150,45))return {stats:reg,level:'Regime',key:regime,exactStats:exact};

  const cond=hz?.byCondition?.[condition]||null;
  if(robust(cond,150,45))return {stats:cond,level:'Condition',key:condition,exactStats:exact};

  return {stats:hz?.overall||null,level:'Market Baseline',key:'All states',exactStats:exact};
}
function horizonAssessment(chosen,baseStats){
  const stateStats=chosen?.stats;
  if(!stateStats||!baseStats)return null;
  const overall=compareState(stateStats.overall,baseStats.overall);
  const recent=compareState(stateStats.recent,baseStats.recent);
  const exact=chosen?.exactStats;
  const exactRecent=exact?.recent||null;
  const exactVsChosen=chosen.level!=='Exact State'&&exactRecent&&stateStats.recent?{
    sample:{overall:exact?.overall?.n||0,recent:exactRecent.n||0},
    recentMeanGap:round(exactRecent.mean-stateStats.recent.mean),
    recentPositiveRateGap:round(exactRecent.positiveRate-stateStats.recent.positiveRate,1)
  }:null;
  const specificSetupWarning=!!(exactVsChosen&&exactVsChosen.sample.recent>=15&&(
    exactVsChosen.recentMeanGap<=-1||
    exactVsChosen.recentPositiveRateGap<=-10
  ));
  const favorable=x=>x&&x.meanLift>0&&x.positiveRateLift>=0;
  const weaker=x=>x&&x.meanLift<0&&x.positiveRateLift<=0;
  let label='Mixed / Near Baseline';
  if(chosen.level==='Market Baseline')label='Baseline Context';
  else if(favorable(overall)&&favorable(recent))label='Historically Favorable';
  else if(weaker(overall)&&weaker(recent))label='Historically Weaker';
  else if(favorable(overall)&&weaker(recent))label='Long-term Favorable · Recent Weaker';
  else if(weaker(overall)&&favorable(recent))label='Long-term Weaker · Recent Better';
  return {
    label,
    analogLevel:chosen.level,
    analogKey:chosen.key,
    confidence:chosen.level==='Market Baseline'?'Low':confidence(stateStats.overall?.n||0,stateStats.recent?.n||0),
    sample:{overall:stateStats.overall?.n||0,recent:stateStats.recent?.n||0},
    stateOverall:stateStats.overall,
    stateRecent:stateStats.recent,
    baselineOverall:baseStats.overall,
    baselineRecent:baseStats.recent,
    lift:{overall,recent},
    specificSetup:exactVsChosen?{
      ...exactVsChosen,
      warning:specificSetupWarning,
      note:specificSetupWarning?'Broader analog is more robust, but the exact current setup has shown materially weaker recent follow-through.':null
    }:null
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
  const usable=[a5,a10,a20].filter(x=>x&&x.analogLevel!=='Market Baseline');
  const labels=usable.map(x=>x.label);
  const weakRecent=usable.filter(x=>x?.lift?.recent?.meanLift<0).length;
  const strongRecent=usable.filter(x=>x?.lift?.recent?.meanLift>0).length;
  const specificWarnings=usable.filter(x=>x?.specificSetup?.warning).length;
  if((regime==='Strong Bull'||regime==='Bull')&&condition==='Pullback'){
    if(specificWarnings>=2)return 'Primary trend remains constructive, and the broader pullback family is reasonably supported, but the exact current setup has shown materially weaker recent follow-through. Treat rebound expectations cautiously until price confirms.';
    if(weakRecent>=2)return 'Primary trend remains constructive, but recent historical pullback analogs have been weaker than the market\'s normal baseline. Treat this as an intact trend with elevated continuation risk, not an automatic rebound signal.';
    if(strongRecent>=2)return 'Primary trend remains constructive and recent pullback analogs have generally held up better than baseline. Continuation is supported historically, but confirmation still matters.';
    return 'Primary trend remains constructive, while pullback analogs are mixed. Expect a two-sided setup until support or resistance resolves.';
  }
  if((regime==='Strong Bull'||regime==='Bull')&&(condition==='Breakout / Near High'||condition==='Positive Momentum')){
    if(weakRecent>=2)return 'Trend is strong, but advance/near-high analogs have recently produced less follow-through than the market baseline. Consolidation or slower continuation is a meaningful base case.';
    return 'Trend and location are constructive. Historical advance behavior does not remove pullback risk, so follow-through above resistance matters more than the headline trend label.';
  }
  if(condition==='Weakening'||condition==='Range / Mixed'){
    if(strongRecent>=2)return 'Short-term structure is soft, but similar recent analogs have still produced positive forward returns. This is better framed as a damaged or uncertain setup than a clean bearish call.';
    if(weakRecent>=2)return 'Short-term structure is soft and recent analogs have underperformed baseline. Risk remains elevated until the market reclaims nearby trend levels.';
    return 'Short-term structure is soft, but historical follow-through is mixed. Confirmation from support/resistance is more useful than assuming immediate continuation lower.';
  }
  if(condition==='Recovery Attempt')return 'The market is attempting to recover from a weaker regime. Historical follow-through should be treated as conditional on reclaiming resistance and improving structure.';
  if(condition==='Extended')return 'Trend is constructive but stretched. Historical context favors separating trend strength from entry timing; consolidation risk is elevated.';
  if(labels.length&&labels.every(x=>x==='Historically Favorable'))return 'Current analogs have historically outperformed this market\'s baseline across the tested horizons.';
  if(labels.length&&labels.every(x=>x==='Historically Weaker'))return 'Current analogs have historically underperformed this market\'s baseline across the tested horizons.';
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
  const bt=backtest.markets?.[m.key],regime=m.descriptiveState.regime,condition=m.descriptiveState.condition;
  const assessments={};
  for(const h of ['5','10','20']){
    const chosen=chooseAnalog(bt,h,regime,condition);
    assessments[h]=horizonAssessment(chosen,bt?.horizons?.[h]?.overall||null);
  }
  marketReports.push({
    key:m.key,name:m.name,symbol:m.symbol,group:m.group,asOf:m.asOf,price:m.price,
    regime,condition,
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
  version:'market-pulse-report-v0.3-2026-09-26',
  sourceVersion:latest.version,
  generatedAt:new Date().toISOString(),
  status:'research',
  analogPolicy:{
    exactMinimum:{overall:100,recent:30},
    familyRegimes:['Bullish','Mixed','Bearish'],
    familyConditions:['Advance','Pullback','Extended','Recovery','Weak / Range'],
    fallbackOrder:['Exact State','State Family','Regime','Condition','Market Baseline']
  },
  note:'Scenario framing is empirical and descriptive. It is not a price target or buy/sell signal. Historical analog confidence automatically falls back to broader families when exact-state samples are sparse, while weak exact-state evidence is retained as a secondary caution.',
  crossMarketRead:{headline:overall,groups:groupReads},
  markets:marketReports
};
fs.writeFileSync('data/market-pulse-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({version:report.version,headline:report.crossMarketRead.headline,markets:marketReports.map(x=>({key:x.key,regime:x.regime,condition:x.condition,analogs:Object.fromEntries(Object.entries(x.historicalAnalog).map(([h,a])=>[h,a&&{level:a.analogLevel,key:a.analogKey,confidence:a.confidence,sample:a.sample,label:a.label}]))}))},null,2));
