function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b))}
function requiredString(v,name){
  if(typeof v!=='string'||!v.trim())throw new Error('Missing '+name);
  return v;
}
function calendarOf(report){
  const c=report?.validation?.calendar||report?.validation?.validationCalendar||{};
  const developmentStart=c.developmentStart;
  const validationStart=c.validationStart;
  const finalStart=c.finalStart||report?.validation?.finalTestStart;
  if(!developmentStart||!validationStart||!finalStart)throw new Error('Missing fixed validation calendar');
  return {developmentStart,validationStart,finalStart};
}
export function extractValidationIdentity(report){
  if(!report||typeof report!=='object')throw new Error('Validation report must be an object');
  const dataset=report.dataset||{};
  return {
    batchIndex:report.batchIndex,
    batchCount:report.batchCount,
    horizons:[...(report.horizons?Object.keys(report.horizons):[])].map(Number).sort((a,b)=>a-b),
    symbols:[...(report.symbols||[])],
    dataset:{
      mode:dataset.mode,
      snapshotId:dataset.snapshotId,
      dataSha256:dataset.dataSha256,
      structureSha256:dataset.structureSha256,
      normalizationVersion:dataset.normalizationVersion,
      source:dataset.source,
      artifactId:dataset.artifactId||null
    },
    calendar:calendarOf(report),
    finalTestOpened:report?.validation?.finalTestOpened===true
  };
}
export function assertLockedValidationReport(report,label='report'){
  const id=extractValidationIdentity(report);
  if(id.dataset.mode!=='frozen')throw new Error(label+': dataset.mode must be frozen, got '+String(id.dataset.mode));
  requiredString(id.dataset.snapshotId,label+'.dataset.snapshotId');
  requiredString(id.dataset.dataSha256,label+'.dataset.dataSha256');
  requiredString(id.dataset.structureSha256,label+'.dataset.structureSha256');
  requiredString(id.dataset.normalizationVersion,label+'.dataset.normalizationVersion');
  requiredString(id.dataset.artifactId,label+'.dataset.artifactId');
  if(!id.dataset.source||typeof id.dataset.source!=='object')throw new Error(label+': missing dataset.source');
  if(id.finalTestOpened)throw new Error(label+': historical final test must remain closed during controlled comparison');
  if(!Number.isInteger(id.batchIndex)||!Number.isInteger(id.batchCount)||id.batchIndex<0||id.batchCount<1||id.batchIndex>=id.batchCount){
    throw new Error(label+': invalid batch identity');
  }
  if(!id.horizons.length||id.horizons.some(x=>!Number.isFinite(x)||x<=0))throw new Error(label+': invalid horizons');
  if(!id.symbols.length)throw new Error(label+': empty symbol membership');
  for(const h of id.horizons){
    const section=report.horizons?.[String(h)]||report.horizons?.[h];
    if(section?.scope!=='development')throw new Error(label+': horizon '+h+' must have scope=development');
  }
  return id;
}
function collectDiffs(a,b,path=''){
  if(same(a,b))return [];
  if(Array.isArray(a)||Array.isArray(b)||!a||!b||typeof a!=='object'||typeof b!=='object'){
    return [path+': '+JSON.stringify(a)+' != '+JSON.stringify(b)];
  }
  const keys=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();
  return keys.flatMap(k=>collectDiffs(a[k],b[k],path?path+'.'+k:k));
}
export function assertComparableValidationReports(baseline,candidate,{requireSameArtifact=true}={}){
  const a=assertLockedValidationReport(baseline,'baseline');
  const b=assertLockedValidationReport(candidate,'candidate');
  const left=structuredClone(a),right=structuredClone(b);
  if(!requireSameArtifact){
    delete left.dataset.artifactId;
    delete right.dataset.artifactId;
  }
  const diffs=collectDiffs(left,right);
  if(diffs.length)throw new Error('Validation identity mismatch:\n- '+diffs.join('\n- '));
  return {baseline:a,candidate:b};
}
