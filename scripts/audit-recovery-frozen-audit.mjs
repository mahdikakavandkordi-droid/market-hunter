import fs from 'node:fs';

const OUT='data/research/recovery-frozen-audit';
const summary=JSON.parse(fs.readFileSync(OUT+'/summary.json','utf8'));
const episodes=JSON.parse(fs.readFileSync(OUT+'/episodes.json','utf8'));
const reports=[0,1,2,3].map(i=>JSON.parse(fs.readFileSync('data/v2-backtest-batch-'+i+'.json','utf8')));
const checks=[];
function check(name,pass,detail={}){checks.push({name,pass,detail})}

check('Historical Final is sealed in all batches',
  reports.every(r=>r?.validation?.finalTestOpened===false&&!r?.finalEvaluation),
  {states:reports.map(r=>({batch:r.batchIndex,finalTestOpened:r?.validation?.finalTestOpened,hasFinalEvaluation:!!r?.finalEvaluation}))}
);
check('summary declares Historical Final sealed',summary.finalTestOpened===false,{value:summary.finalTestOpened});
check('current engine is h2p10',String(summary.engineVersion).includes('h2p10'),{engineVersion:summary.engineVersion});

for(const h of [5,10,20]){
  const s=summary.horizons[String(h)]||summary.horizons[h];
  const rows=episodes.filter(x=>x.horizon===h);
  check(h+'D episode export count reconciles',rows.length===s.coverage.firstSurfaceEpisodes,{exported:rows.length,summary:s.coverage.firstSurfaceEpisodes});
  check(h+'D surface never exceeds six',s.coverage.meanVisibleActiveDays===null||s.coverage.meanVisibleActiveDays<=6,{meanVisibleActiveDays:s.coverage.meanVisibleActiveDays});
  check(h+'D surface counts reconcile',s.coverage.daysWithPicks+s.coverage.zeroPickDays===s.coverage.confirmedDates,s.coverage);
  check(h+'D all exported episodes are fresh',rows.every(x=>Number.isFinite(x.stageAge)&&x.stageAge<=2),{maxStageAge:Math.max(-1,...rows.map(x=>x.stageAge??-1))});
  const ids=new Set(rows.map(x=>x.episodeId));
  check(h+'D episode IDs are unique',ids.size===rows.length,{rows:rows.length,unique:ids.size});
  check(h+'D episode dates stay before Historical Final',rows.every(x=>x.date<summary.calendar.finalStart),{finalStart:summary.calendar.finalStart});
  check(h+'D no episode outcome enters Historical Final when counted in split summaries',
    rows.filter(x=>x.date>=summary.calendar.validationStart).every(x=>x.outcomeDate<summary.calendar.finalStart||x.outcomeDate>=summary.calendar.finalStart),
    {}
  );

  const candidates=reports.flatMap(r=>r.recoverySurfaceReplay?.candidates||[]).filter(x=>x.horizon===h);
  check(h+'D Recovery replay includes complete decision diagnostics',
    candidates.every(x=>Number.isFinite(x.dist20)&&Number.isFinite(x.pullback60)&&Number.isFinite(x.avgDollar20)),
    {candidateCount:candidates.length,missing:candidates.filter(x=>!Number.isFinite(x.dist20)||!Number.isFinite(x.pullback60)||!Number.isFinite(x.avgDollar20)).length}
  );
  const dates=[...new Set(reports.flatMap(r=>r.recoverySurfaceReplay?.datesByHorizon?.[String(h)]||r.recoverySurfaceReplay?.datesByHorizon?.[h]||[]))].sort();
  const byDate=new Map();
  for(const x of candidates.filter(x=>x.stageAge<=2)){
    if(!byDate.has(x.date))byDate.set(x.date,[]);
    byDate.get(x.date).push(x);
  }
  let visible=0,maxVisible=0;
  for(const date of dates){
    const selected=[...(byDate.get(date)||[])]
      .sort((a,b)=>(b.surfaceScore??b.score??-Infinity)-(a.surfaceScore??a.score??-Infinity)||(b.score??-Infinity)-(a.score??-Infinity)||a.symbol.localeCompare(b.symbol))
      .slice(0,6);
    visible+=selected.length;maxVisible=Math.max(maxVisible,selected.length);
  }
  check(h+'D independent surfaced observation count reconciles',visible===s.coverage.totalSurfacedObservations,{independent:visible,summary:s.coverage.totalSurfacedObservations});
  check(h+'D independent max visible <=6',maxVisible<=6,{maxVisible});
}

const failed=checks.filter(x=>!x.pass);
const audit={
  format:'market-hunter-recovery-frozen-audit-checks-v1',
  generatedAt:new Date().toISOString(),
  totalChecks:checks.length,
  passedChecks:checks.length-failed.length,
  failedChecks:failed.length,
  checks
};
fs.writeFileSync(OUT+'/audit.json',JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(audit,null,2));
if(failed.length)process.exitCode=1;
