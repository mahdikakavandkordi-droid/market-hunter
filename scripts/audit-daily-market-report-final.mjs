import fs from 'node:fs';
const report=JSON.parse(fs.readFileSync('data/daily-market-report.json','utf8'));
const pulse=JSON.parse(fs.readFileSync('data/market-pulse-report.json','utf8'));
const pulseLatest=JSON.parse(fs.readFileSync('data/market-pulse-latest.json','utf8'));
const hunter=JSON.parse(fs.readFileSync('data/v2-latest-scan.json','utf8'));
const md=fs.readFileSync('data/daily-market-report.md','utf8');
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const expected=['TSX','SP500','NASDAQ100','GOLD','SILVER','BTC','ETH'];
const checks=[];
const fail=(name,pass,detail)=>checks.push({name,pass,detail});

fail('seven_markets_in_pulse',expected.every(k=>pulse.markets.some(x=>x.key===k))&&pulse.markets.length===7,pulse.markets.map(x=>x.key));
fail('daily_report_three_groups',report.groups?.length===3,report.groups?.map(x=>x.label));
fail('daily_report_key_developments',report.keyDevelopments?.length>=3,report.keyDevelopments?.length);
fail('daily_report_key_divergences',Array.isArray(report.keyDivergences)&&report.keyDivergences.every(x=>x?.id&&x?.label&&x?.text),report.keyDivergences);
fail('daily_report_watch_next',(report.watchNext?.length||0)>=3&&report.watchNext.every(x=>x.market&&x.text&&x.levels),report.watchNext);
const mixedDatesExpected=report.asOf?.earliest!==report.asOf?.latest;
fail('mixed_dates_disclosed',
  report.asOf?.mixedDates===mixedDatesExpected&&
  (!mixedDatesExpected||report.executiveSummary?.some(x=>x.includes('timestamps differ'))),
  report.asOf);
fail('highest_attention_present',(report.highestAttention?.length||0)>=3,report.highestAttention);
fail('hunter_context_max6',(report.hunterContext?.visible||0)<=6,report.hunterContext);
fail('hunter_context_matches_backend',report.hunterContext?.visible===hunter.integratedSurfaceCounts?.visible,{report:report.hunterContext?.visible,backend:hunter.integratedSurfaceCounts?.visible});
fail('pulse_report_matches_latest_source',pulse.sourceVersion===pulseLatest.version,{reportSource:pulse.sourceVersion,latestVersion:pulseLatest.version});
fail('daily_report_matches_pulse_report',report.methodology?.source===pulse.version,{dailySource:report.methodology?.source,pulseVersion:pulse.version});
fail('daily_report_matches_latest_hunter',report.hunterContext?.generatedAt===hunter.generatedAt,{dailyHunterGeneratedAt:report.hunterContext?.generatedAt,hunterGeneratedAt:hunter.generatedAt});
fail('pulse_report_not_older_than_source',Date.parse(pulse.generatedAt)>=Date.parse(pulseLatest.generatedAt),{pulseGeneratedAt:pulse.generatedAt,sourceGeneratedAt:pulseLatest.generatedAt});
fail('daily_report_not_older_than_inputs',Date.parse(report.generatedAt)>=Math.max(Date.parse(pulse.generatedAt),Date.parse(hunter.generatedAt)),{dailyGeneratedAt:report.generatedAt,pulseGeneratedAt:pulse.generatedAt,hunterGeneratedAt:hunter.generatedAt});

for(const key of expected){
  const m=report.markets?.find(x=>x.key===key);
  fail(`${key}_daily_market_present`,!!m,m&&{regime:m.regime,condition:m.condition});
  fail(`${key}_framing_present`,!!m?.framing,m?.framing);
  fail(`${key}_outlook_present`,!!m?.outlook,m?.outlook);
  fail(`${key}_watch_next_present`,!!m?.watchNext,m?.watchNext);
  fail(`${key}_evidence_5_10_20`,['sessions5','sessions10','sessions20'].every(k=>!!m?.evidence?.[k]),m?.evidence);
  fail(`${key}_evidence_metadata`,['5','10','20'].every(h=>{
    const x=m?.evidence?.horizons?.[h];
    return !!x?.tone&&!!x?.confidence&&!!x?.analogLevel&&Number.isFinite(x?.sample?.overall)&&Number.isFinite(x?.sample?.recent);
  }),m?.evidence?.horizons);
}
fail('markdown_title',md.startsWith('# Market Hunter — Daily Market Report'),md.slice(0,80));
fail('markdown_all_markets',expected.every(k=>{
  const name=pulse.markets.find(x=>x.key===k)?.name;
  return name&&md.includes('### '+name);
}),expected);
fail('ui_fetches_daily_report',app.includes("getJson('/data/daily-market-report.json')"),null);
fail('ui_renders_daily_report',app.includes('function homeHtml()')&&app.includes('What Changed Today')&&app.includes('keyDevelopments'),null);
fail('ui_daily_before_pulse',app.indexOf('What Changed Today')<app.indexOf('<h3>Markets</h3>'),null);

const pass=checks.every(x=>x.pass);
const result={
  generatedAt:new Date().toISOString(),
  status:pass?'PASS':'FAIL',
  decision:pass?'Daily Market Report v0.2 is defensible for research use: deterministic summary from frozen Market Pulse evidence, explicit mixed timestamps, 7-market coverage, cross-market divergences, scenario watch levels, horizon evidence metadata, Hunter context, JSON + Markdown outputs, and Home rendering.':'Do not freeze Daily Market Report yet.',
  checks
};
fs.writeFileSync('data/daily-market-report-final-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({status:result.status,decision:result.decision,failed:checks.filter(x=>!x.pass)},null,2));
if(!pass)process.exitCode=2;
