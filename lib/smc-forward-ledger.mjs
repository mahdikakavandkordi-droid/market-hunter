import fs from 'node:fs';

export const IMMUTABLE_DECISION_FIELDS=[
  'symbol','dir','signalT','entryT','entry','stop','target','risk','momentumShadow'
];

export function tradeKey(x){
  return [x?.symbol,x?.entryT,x?.dir].join('|');
}
function anchorKey(x){
  return [x?.symbol,x?.signalT,x?.dir].join('|');
}
function deepEqual(a,b){
  if(Object.is(a,b))return true;
  if(a==null||b==null)return false;
  if(typeof a!=='object'||typeof b!=='object')return false;
  return JSON.stringify(a)===JSON.stringify(b);
}
function changedFields(a,b,fields=IMMUTABLE_DECISION_FIELDS){
  return fields.filter(f=>!deepEqual(a?.[f],b?.[f]));
}
function runInfo(){
  return {
    workflow:process.env.GITHUB_WORKFLOW||null,
    runId:process.env.GITHUB_RUN_ID||null,
    runAttempt:process.env.GITHUB_RUN_ATTEMPT||null,
    sha:process.env.GITHUB_SHA||null,
    ref:process.env.GITHUB_REF||null
  };
}
export function defaultObservationProvenance(extra={}){
  return {
    source:{
      provider:'Yahoo Finance chart',
      daily:{range:'2y',interval:'1d'},
      intraday:{range:'60d',interval:'1h'},
      ...(extra.source||{})
    },
    run:{...runInfo(),...(extra.run||{})}
  };
}
export function readLedgerStrict(path){
  if(!fs.existsSync(path))return {exists:false,ledger:{trades:[]}};
  let parsed;
  try{parsed=JSON.parse(fs.readFileSync(path,'utf8'))}
  catch(e){throw new Error(path+': corrupt ledger JSON; refusing to continue: '+e.message)}
  if(!parsed||!Array.isArray(parsed.trades)){
    throw new Error(path+': invalid ledger shape; refusing to continue');
  }
  return {exists:true,ledger:parsed};
}
export function writeJsonAtomic(path,value){
  const tmp=path+'.tmp-'+process.pid;
  fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');
  fs.renameSync(tmp,path);
}
function classifyObservation(entryT,observedAt){
  const e=Date.parse(entryT),o=Date.parse(observedAt);
  if(!Number.isFinite(e)||!Number.isFinite(o))return 'unknown';
  return o<=e?'prospective':'reconstructed';
}
function newEvidence(observedAt,provenance){
  return {
    firstObservedAt:observedAt,
    observationClass:null,
    provenance
  };
}
function discrepancy(type,prior,candidate,details={}){
  return {
    type,
    key:tradeKey(prior||candidate),
    symbol:(prior||candidate)?.symbol??null,
    prior:prior?{
      signalT:prior.signalT,entryT:prior.entryT,dir:prior.dir,status:prior.status,R:prior.R,exitT:prior.exitT
    }:null,
    candidate:candidate?{
      signalT:candidate.signalT,entryT:candidate.entryT,dir:candidate.dir,status:candidate.status,R:candidate.R,exitT:candidate.exitT
    }:null,
    ...details
  };
}
export function mergeForwardLedger({priorTrades=[],candidates=[],observedAt,provenance}){
  if(!observedAt)throw new Error('observedAt is required');
  const priorByKey=new Map();
  const priorByAnchor=new Map();
  for(const tr of priorTrades){
    const k=tradeKey(tr);
    if(priorByKey.has(k))throw new Error('duplicate prior trade identity '+k);
    priorByKey.set(k,tr);
    priorByAnchor.set(anchorKey(tr),tr);
  }

  const result=priorTrades.map(x=>structuredClone(x));
  const resultIndex=new Map(result.map((x,i)=>[tradeKey(x),i]));
  const discrepancies=[];
  const seenCandidateKeys=new Set();
  let added=0,lifecycleUpdated=0,preserved=0;

  for(const raw of candidates){
    const candidate=structuredClone(raw);
    const k=tradeKey(candidate);
    if(seenCandidateKeys.has(k)){
      discrepancies.push(discrepancy('duplicate_candidate',null,candidate));
      continue;
    }
    seenCandidateKeys.add(k);

    let prior=priorByKey.get(k);
    if(!prior){
      const anchored=priorByAnchor.get(anchorKey(candidate));
      if(anchored){
        discrepancies.push(discrepancy('decision_identity_conflict',anchored,candidate,{
          immutableChanged:changedFields(anchored,candidate)
        }));
        preserved++;
        continue;
      }

      const record=structuredClone(candidate);
      const ev=newEvidence(observedAt,provenance);
      ev.observationClass=classifyObservation(record.entryT,observedAt);
      record.evidence=ev;
      resultIndex.set(k,result.length);
      result.push(record);
      priorByKey.set(k,record);
      priorByAnchor.set(anchorKey(record),record);
      added++;
      continue;
    }

    const imm=changedFields(prior,candidate);
    if(imm.length){
      discrepancies.push(discrepancy('immutable_decision_conflict',prior,candidate,{immutableChanged:imm}));
      preserved++;
      continue;
    }

    const idx=resultIndex.get(k);
    const next=structuredClone(prior);

    if(prior.status==='closed'){
      if(candidate.status!=='closed'||!deepEqual(prior.R,candidate.R)||!deepEqual(prior.exitT,candidate.exitT)){
        discrepancies.push(discrepancy('closed_outcome_conflict',prior,candidate));
      }
      preserved++;
      result[idx]=next;
      continue;
    }

    if(prior.status==='open'&&candidate.status==='closed'){
      next.status='closed';
      next.R=candidate.R;
      next.exitT=candidate.exitT;
      next.lifecycleEvidence={
        ...(next.lifecycleEvidence||{}),
        closedFirstObservedAt:next.lifecycleEvidence?.closedFirstObservedAt||observedAt,
        closedProvenance:next.lifecycleEvidence?.closedProvenance||provenance
      };
      result[idx]=next;
      lifecycleUpdated++;
      continue;
    }

    if(prior.status!==candidate.status||!deepEqual(prior.R,candidate.R)||!deepEqual(prior.exitT,candidate.exitT)){
      discrepancies.push(discrepancy('unsupported_lifecycle_change',prior,candidate));
    }
    preserved++;
    result[idx]=next;
  }

  result.sort((a,b)=>(a.entryT||'').localeCompare(b.entryT||'')||(a.symbol||'').localeCompare(b.symbol||''));
  const legacyWithoutProvenance=result.filter(x=>!x.evidence?.firstObservedAt).length;
  const observationCounts=result.reduce((m,x)=>{
    const k=x.evidence?.observationClass||'legacy_unknown';
    m[k]=(m[k]||0)+1;return m;
  },{});
  return {
    trades:result,
    audit:{observedAt,added,lifecycleUpdated,preserved,discrepancies,legacyWithoutProvenance,observationCounts}
  };
}
