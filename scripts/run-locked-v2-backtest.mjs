import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const manifestFile=process.env.V2_DATASET_LOCK_MANIFEST||'data/frozen/market-hunter-v2-numerical-snapshot/manifest.json';
const batchIndex=Number(process.env.V2_BATCH_INDEX||0);
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
if(manifest.format!=='market-hunter-v2-numerical-snapshot-manifest-v1'){
  throw new Error('Locked runner requires a numerical snapshot manifest v1');
}
const batch=manifest.batches?.find(x=>x.batchIndex===batchIndex);
if(!batch)throw new Error('Dataset manifest has no batch '+batchIndex);

const snapshotDir=process.env.V2_SNAPSHOT_DIR||manifest.localSnapshotDir||'data/frozen/market-hunter-v2-numerical-snapshot/files';
const datasetFile=process.env.V2_DATASET_FILE||path.resolve(snapshotDir,batch.file);
if(!fs.existsSync(datasetFile)){
  throw new Error(
    'Designated numerical snapshot file is missing: '+datasetFile+
    '. Retrieve artifact '+String(manifest.artifact?.id||'unknown')+
    ' and place the immutable snapshot files in '+snapshotDir
  );
}

const p=spawn(process.execPath,['scripts/backtest-market-hunter-v2.mjs'],{
  stdio:'inherit',
  env:{
    ...process.env,
    V2_BATCH_INDEX:String(batchIndex),
    V2_BATCH_COUNT:String(manifest.batchCount),
    V2_RANGE:String(manifest.rangeLabel||'5y'),
    V2_DATASET_FILE:datasetFile,
    V2_EXPECT_SNAPSHOT_ID:String(batch.snapshotId),
    V2_EXPECT_DATA_SHA256:String(batch.dataSha256),
    V2_EXPECT_STRUCTURE_SHA256:String(batch.structureSha256),
    V2_EXPECT_NORMALIZATION_VERSION:String(manifest.normalizationVersion),
    V2_EXPECT_SOURCE_JSON:JSON.stringify(manifest.source),
    V2_FORBID_NETWORK:'1',
    V2_DEVELOPMENT_START:String(manifest.validationCalendar.developmentStart),
    V2_VALIDATION_START:String(manifest.validationCalendar.validationStart),
    V2_FINAL_TEST_START:String(manifest.validationCalendar.finalStart),
    V2_OPEN_FINAL_TEST:process.env.V2_OPEN_FINAL_TEST||'0',
    V2_DATASET_ARTIFACT_ID:String(manifest.artifact?.id||'')
  }
});
p.on('exit',code=>process.exit(code??1));
