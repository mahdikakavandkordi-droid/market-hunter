import fs from 'node:fs';
const report=JSON.parse(fs.readFileSync('data/daily-market-report.json','utf8'));
const pulse=JSON.parse(fs.readFileSync('data/market-pulse-report.json','utf8'));
const hunter=JSON.parse(fs.readFileSync('data/v2-latest-scan.json','utf8'));
const md=fs.readFileSync('data/daily-market-report.md','utf8');
const html=fs.readFileSync('index.html','utf8');
const expected=['TSX','SP500','NASDAQ100','GOLD','SILVER','BTC','ETH'];
const checks=[];
const fail=(name,pass,detail)=>checks.push({name,pass,detail});

fail('seven_markets_in_pulse',expected.every(k=>pulse.markets.some(x=>x.key===k))&&pulse.markets.length===7,pulse.markets.map(x=>x.key));
fail('daily_report_three_groups',report.groups?.length===3,report.groups?.map(x=>x.label));
fail('daily_report_key_developments',report.keyDevelopments?.length>=3,report.keyDevelopments?.length);
fail('mixed_dates_disclosed',report.asOf?.mixedDates===true&&report.executiveSummary?.some(x=>x.includes('timestamps differ')),report.asOf);
fail('highest_attention_present',(report.highestAttention?.length||0)>=3,report.highestAttention);
fail('hunter_context_max6',(report.hunterContext?.visible||0)<=6,report.hunterContext);
fail('hunter_context_matches_backend',report.hunterContext?.visible===hunter.integratedSurfaceCounts?.visible,{report:report.hunterContext?.visible,backend:hunter.integratedSurfaceCounts?.visible});

for(const key of expected){
  const m=report.markets?.find(x=>x.key===key);
  fail(`${key}_daily_market_present`,!!m,m&&{regime:m.regime,condition:m.condition});
  fail(`${key}_framing_present`,!!m?.framing,m?.framing);
  fail(`${key}_outlook_present`,!!m?.outlook,m?.outlook);
  fail(`${key}_watch_next_present`,!!m?.watchNext,m?.watchNext);
  fail(`${key}_evidence_5_10_20`,['sessions5','sessions10','sessions20'].every(k=>!!m?.evidence?.[k]),m?.evidence);
}
fail('markdown_title',md.startsWith('# Market Hunter — Daily Market Report'),md.slice(0,80));
fail('markdown_all_markets',expected.every(k=>{
  const name=pulse.markets.find(x=>x.key===k)?.name;
  return name&&md.includes('### '+name);
}),expected);
fail('ui_fetches_daily_report',html.includes("fetch('/data/daily-market-report.json'"),null);
fail('ui_renders_daily_report',html.includes('function renderDailyMarketReport()')&&html.includes('Daily Market Report'),null);
fail('ui_daily_before_pulse',html.indexOf('${renderDailyMarketReport()}')<html.indexOf('${renderPulse()}'),null);

const pass=checks.every(x=>x.pass);
const result={
  generatedAt:new Date().toISOString(),
  status:pass?'PASS':'FAIL',
  decision:pass?'Daily Market Report v0 is defensible for research use: deterministic summary from frozen Market Pulse evidence, explicit mixed timestamps, 7-market coverage, Hunter context, JSON + Markdown outputs, and Home rendering.':'Do not freeze Daily Market Report yet.',
  checks
};
fs.writeFileSync('data/daily-market-report-final-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({status:result.status,decision:result.decision,failed:checks.filter(x=>!x.pass)},null,2));
if(!pass)process.exitCode=2;
