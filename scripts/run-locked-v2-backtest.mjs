import fs from 'node:fs';
import {spawn} from 'node:child_process';

const manifestFile=process.env.V2_DATASET_LOCK_MANIFEST||'data/frozen/market-hunter-v2-lock-2026-09-27/manifest.json';
const batchIndex=Number(process.env.V2_BATCH_INDEX||0);
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
const batch=manifest.batches?.find(x=>x.batchIndex===batchIndex);
if(!batch)throw new Error('Dataset lock has no batch '+batchIndex);

const p=spawn(process.execPath,['scripts/backtest-market-hunter-v2.mjs'],{
  stdio:'inherit',
  env:{
    ...process.env,
    V2_BATCH_INDEX:String(batchIndex),
    V2_BATCH_COUNT:String(manifest.batchCount),
    V2_RANGE:'5y',
    V2_PERIOD1:String(manifest.source.period1),
    V2_PERIOD2:String(manifest.source.period2),
    V2_EXPECT_STRUCTURE_SHA256:String(batch.structureSha256),
    V2_FINAL_TEST_START:process.env.V2_FINAL_TEST_START||'2026-01-01',
    V2_OPEN_FINAL_TEST:process.env.V2_OPEN_FINAL_TEST||'0'
  }
});
p.on('exit',code=>process.exit(code??1));
