import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {summarizeGrowthReview} from '../lib/hunter-growth-review.js';
const ref=process.argv[2]||'refs/remotes/origin/volume-evidence';
const sourceCommit=execFileSync('git',['rev-parse',ref],{encoding:'utf8'}).trim();
const root='data/research/market-hunter-forward-validation/';
const read=f=>execFileSync('git',['show',sourceCommit+':'+root+f],{encoding:'utf8',maxBuffer:30*1024*1024});
const lines=f=>read(f).trim().split('\n').filter(Boolean).map(x=>JSON.parse(x));
const report={sourceCommit,...summarizeGrowthReview({episodes:lines('episodes.jsonl'),outcomes:lines('outcomes.jsonl'),asOf:JSON.parse(read('status.json')).latestMarketAsOf})};
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
for(const h of [5,10,20]){
  const r=report.retrospective.stage[h];
  for(const [dimension,groups] of Object.entries({baseline:{all:r.baseline},volume:r.volume,extension:r.extension,breakout:r.breakout,sectors:r.sectors,dates:r.decisionDates})){
    for(const [group,s] of Object.entries(groups))if(s.recorded)console.log(JSON.stringify({h,dimension,group,n:s.observations,symbols:s.symbols,dates:s.dates,mean:s.meanExcessPct,median:s.medianExcessPct,review:s.sourceReviewCount,outside:s.outsideActiveStages}));
  }
}
