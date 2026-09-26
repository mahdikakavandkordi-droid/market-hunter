import fs from 'node:fs';
const report=JSON.parse(fs.readFileSync('data/market-pulse-report.json','utf8'));
const latest=JSON.parse(fs.readFileSync('data/market-pulse-latest.json','utf8'));
const expected=['TSX','SP500','NASDAQ100','GOLD','SILVER','BTC','ETH'];
const checks=[];
checks.push({name:'seven_markets_present',pass:expected.every(k=>report.markets.some(x=>x.key===k))&&report.markets.length===7,detail:report.markets.map(x=>x.key)});
checks.push({name:'silver_present',pass:report.markets.some(x=>x.key==='SILVER'),detail:report.markets.find(x=>x.key==='SILVER')?.symbol});
checks.push({name:'source_has_seven_markets',pass:latest.markets?.length===7,detail:latest.markets?.map(x=>x.key)});
for(const m of report.markets){
  checks.push({name:`${m.key}_regime_condition_present`,pass:!!m.regime&&!!m.condition,detail:{regime:m.regime,condition:m.condition}});
  for(const h of ['5','10','20']){
    const a=m.historicalAnalog?.[h];
    checks.push({name:`${m.key}_${h}_analog_present`,pass:!!a&&!!a.label&&!!a.analogLevel,detail:a&&{label:a.label,level:a.analogLevel,confidence:a.confidence,sample:a.sample}});
    checks.push({name:`${m.key}_${h}_no_low_confidence`,pass:a?.confidence!=='Low',detail:a&&{confidence:a.confidence,level:a.analogLevel,sample:a.sample}});
    checks.push({name:`${m.key}_${h}_sample_policy`,pass:a?.analogLevel==='Market Baseline'||((a?.sample?.overall||0)>=100&&(a?.sample?.recent||0)>=30),detail:a&&{level:a.analogLevel,sample:a.sample}});
    if(a?.analogLevel!=='Exact State'&&a?.specificSetup?.sample?.recent>=15&&(
      a.specificSetup.recentMeanGap<=-1||a.specificSetup.recentPositiveRateGap<=-10
    )){
      checks.push({name:`${m.key}_${h}_specific_divergence_retained`,pass:a.specificSetup.warning===true&&!!a.specificSetup.note,detail:a.specificSetup});
    }
  }
}
const eth=report.markets.find(x=>x.key==='ETH');
checks.push({
  name:'eth_sparse_exact_uses_family_with_warning',
  pass:['5','10','20'].every(h=>eth?.historicalAnalog?.[h]?.analogLevel==='State Family'&&eth?.historicalAnalog?.[h]?.specificSetup?.warning===true),
  detail:Object.fromEntries(['5','10','20'].map(h=>[h,eth?.historicalAnalog?.[h]&&{level:eth.historicalAnalog[h].analogLevel,specific:eth.historicalAnalog[h].specificSetup}]))
});
const pass=checks.every(x=>x.pass);
const result={
  generatedAt:new Date().toISOString(),
  status:pass?'PASS':'FAIL',
  decision:pass?'Freeze Market Pulse v0 methodology: 7-market universe; descriptive Regime + Condition display; hierarchical analog evidence Exact State → State Family → Regime → Condition → Baseline; sparse exact-state divergences retained as secondary warnings; scenario levels remain descriptive, not price targets.':'Do not freeze Market Pulse methodology yet.',
  checks
};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/market-pulse-final-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({status:result.status,decision:result.decision,failed:checks.filter(x=>!x.pass)},null,2));
if(!pass)process.exitCode=2;
