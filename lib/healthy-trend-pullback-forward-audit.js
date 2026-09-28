import {HTP_VERSION,HTP_PARAMS} from './healthy-trend-pullback.js';
import {VERSION as EW_VERSION} from './market-hunter-v2-engine.js';
import {HTP_FORWARD_COLLECTOR_VERSION,sha256Json,coverageStatus,pickObservationId,observationId,matureForwardPick} from './healthy-trend-pullback-forward.js';
import {loadSnapshot,canonicalObservations} from './healthy-trend-pullback-forward-store.js';
import {evaluateForwardModels} from './healthy-trend-pullback-forward-models.js';

export function auditForwardStore({root,inputs,observations,outcomes,runs}){
  const checks=[];
  const check=(name,pass,detail={})=>checks.push({name,pass,detail});
  const equal=(a,b)=>sha256Json(JSON.parse(JSON.stringify(a)))===sha256Json(JSON.parse(JSON.stringify(b)));
  const unique=(rows,key)=>new Set(rows.map(x=>x[key])).size===rows.length;
  for(const [rows,key] of [[inputs,'inputId'],[observations,'observationId'],[outcomes,'outcomeId'],[runs,'runId']])
    check(key+' is unique',unique(rows,key));
  const versions={core:HTP_VERSION,trend_rs:HTP_VERSION,early_watch:EW_VERSION};
  try{check('canonical observations equal first complete journal attempts',equal(observations,canonicalObservations(inputs)));}
  catch(e){check('canonical observations equal first complete journal attempts',false,{error:e.message});}
  for(const input of inputs){
    const prefix=input.inputId;
    try{
      check(prefix+': prospective capture date',input.marketAsOf>='2026-09-28'&&input.capturedAt.slice(0,10)===input.marketAsOf);
      check(prefix+': collector version',input.collectorVersion===HTP_FORWARD_COLLECTOR_VERSION);
      check(prefix+': universe hash',sha256Json(input.universeDefinition)===input.universeVersion);
      const {marketAsOf,provider,range,universeVersion,benchmark,symbolSnapshots,failures,snapshot}=input;
      check(prefix+': manifest hash',sha256Json({marketAsOf,provider,range,universeVersion,benchmark,symbolSnapshots,failures,snapshot})===input.inputManifestHash);
      const {data}=loadSnapshot(root,snapshot);
      const replay=evaluateForwardModels({data,marketAsOf,universeDefinition:input.universeDefinition});
      const intended=input.universeDefinition.symbols.length;
      check(prefix+': exactly three models',input.observations.length===3&&new Set(input.observations.map(x=>x.model)).size===3);
      check(prefix+': benchmark source link',data[benchmark.symbol].sourceHash===benchmark.sourceHash);
      check(prefix+': symbol source links',symbolSnapshots.length===replay.evaluated.size&&symbolSnapshots.every(x=>data[x.symbol]?.sourceHash===x.sourceHash));
      for(const spec of replay.modelSpecs){
        const o=input.observations.find(x=>x.model===spec.model);
        const status=coverageStatus({intended,evaluated:replay.evaluated.size,pickCount:spec.picks.length});
        const picks=spec.picks.map(x=>({...x,pickObservationId:pickObservationId(spec.modelVersion,marketAsOf,spec.model,x.symbol)}));
        check(prefix+': offline '+spec.model+' replay',!!o&&o.modelVersion===versions[spec.model]&&
          o.observationId===observationId(spec.modelVersion,marketAsOf,spec.model)&&o.inputId===input.inputId&&
          o.inputManifestHash===input.inputManifestHash&&o.universeVersion===universeVersion&&
          o.marketAsOf===marketAsOf&&o.capturedAt===input.capturedAt&&
          o.collectorVersion===HTP_FORWARD_COLLECTOR_VERSION&&
          o.intendedUniverseCount===intended&&o.evaluatedUniverseCount===replay.evaluated.size&&
          o.status===status&&o.zeroPick===(status==='complete_zero_pick')&&
          o.naturalEligibleCount===spec.naturalEligibleCount&&o.maxVisible===HTP_PARAMS.maxVisible&&equal(o.picks,picks));
      }
    }catch(e){check(prefix+': snapshot and replay',false,{error:e.message});}
  }
  const picks=new Map(observations.flatMap(o=>(o.picks||[]).map(p=>[p.pickObservationId,{o,p}])));
  for(const result of outcomes){
    try{
      const recorded=picks.get(result.pickObservationId);
      if(!recorded)throw new Error('orphan_outcome');
      const {o,p}=recorded,{data}=loadSnapshot(root,result.outcomeSnapshot);
      const pack=data[p.symbol],benchmark=data['^GSPTSE'];
      const replay=matureForwardPick({pack,decisionDate:o.marketAsOf,decisionAtr14:p.decisionAtr14,
        decisionPriceAnchor:p.decisionPriceAnchor,decisionHistory:p.decisionHistory,
        benchmarkRows:benchmark.rows,maturedAt:result.outcomeInputMarketAsOf});
      check(result.outcomeId+': offline outcome replay',!!replay&&
        result.outcomeId===p.pickObservationId&&result.observationId===o.observationId&&
        result.symbol===p.symbol&&result.model===o.model&&result.modelVersion===o.modelVersion&&
        result.outcomeSourceHash===pack.sourceHash&&result.benchmarkSourceHash===benchmark.sourceHash&&
        result.outcomeInputMarketAsOf>=replay.finalDate&&
        Object.keys(replay).every(k=>equal(result[k],replay[k])));
    }catch(e){check(result.outcomeId+': snapshot and replay',false,{error:e.message});}
  }
  const allowedRuns=['market_not_completed','no_new_completed_market_session','collected','collector_failure'];
  check('explicit run states',runs.every(x=>allowedRuns.includes(x.status)));
  return {format:'market-hunter-healthy-trend-pullback-forward-audit-v2',generatedAt:new Date().toISOString(),
    collectorVersion:HTP_FORWARD_COLLECTOR_VERSION,activationState:inputs.length?'data_present':'implemented_not_yet_collected',
    inputRecords:inputs.length,observationRecords:observations.length,outcomeRecords:outcomes.length,runRecords:runs.length,
    checks,totalChecks:checks.length,passedChecks:checks.filter(x=>x.pass).length,
    failedChecks:checks.filter(x=>!x.pass).length,differences:checks.filter(x=>!x.pass)};
}
