import {digest} from './features.mjs';
const DAY=86400000,iso=t=>new Date(t).toISOString();
function config(contract) {
  if(contract.version!=='wave-ml-v2-evaluation-contract-1')throw Error('evaluation_v2_contract_required');
  const s=contract.split,start=Date.parse(s.trainDecisionStart),developmentEnd=Date.parse(s.developmentDecisionEndExclusive),finalStart=Date.parse(s.finalTestStart),finalEnd=Date.parse(s.finalTestEndExclusive);
  const windows=s.validationWindows.map(w=>({...w,start:Date.parse(w.decisionStart),end:Date.parse(w.decisionEndExclusive),cutoff:Date.parse(w.outcomeCutoffExclusive)}));
  if(![start,developmentEnd,finalStart,finalEnd,...windows.flatMap(w=>[w.start,w.end,w.cutoff])].every(Number.isFinite)||windows.length!==2||!(start<windows[0].start&&windows[0].end===windows[1].start&&windows[1].end===developmentEnd&&developmentEnd<finalStart&&finalStart<finalEnd)||windows.some(w=>w.start>=w.end||w.cutoff!==finalStart)||finalStart-developmentEnd!==contract.executionLabel.maxLabelWallDaysIncludingEntry*DAY||s.embargoDays!==75||Date.parse(s.finalFitDecisionEndExclusive)!==developmentEnd||Date.parse(s.maturityGap.start)!==developmentEnd||Date.parse(s.maturityGap.endExclusive)!==finalStart||s.maturityGap.decisionsAllowedInFit||s.maturityGap.decisionsAllowedInValidation||s.maturityGap.decisionsAllowedInFinal)throw Error('invalid_v2_split_configuration');
  return {s,start,developmentEnd,finalStart,finalEnd,windows};
}
export function partitionV2(symbol,availableAt,contract) {
  const c=config(contract),t=Date.parse(availableAt);if(!Number.isFinite(t))throw Error('invalid_decision_time');
  if(c.s.holdoutSymbols.includes(symbol))return t>=c.finalStart&&t<c.finalEnd?'sealed_final':'reserved_symbol';
  if(t<c.start||t>=c.finalEnd)return 'outside';
  if(t>=c.finalStart)return 'development_final_time';
  if(t>=c.developmentEnd)return 'maturity_gap';
  const w=c.windows.find(w=>t>=w.start&&t<w.end);return w?w.name:'train_candidate';
}
export function buildSplitsV2(labels,contract,{asOf}={}) {
  const c=config(contract);if(!Number.isFinite(asOf))throw Error('explicit_observation_cutoff_required');
  const groups=new Map(),seen=new Set();
  for(const r of labels){
    const t=Date.parse(r.availableAt),end=Date.parse(r.informationEnd);
    if(seen.has(r.id))throw Error('duplicate_label_id');seen.add(r.id);
    if(c.s.holdoutSymbols.includes(r.symbol)||t>=c.developmentEnd)throw Error('reserved_gap_or_final_label');
    if(!r.id||!r.symbol||!['us','ca','crypto'].includes(r.market)||![1,-1].includes(r.dir)||!['resolved','unresolved'].includes(r.status)||!Number.isFinite(t)||t<c.start||!Number.isFinite(end)||end<t)throw Error('invalid_information_interval');
    const day=Math.floor(t/DAY)*DAY;if(!groups.has(day))groups.set(day,[]);groups.get(day).push(r);
  }
  const folds=[...c.windows.map(w=>({...w,evaluation:true})),{name:'final_fit_only',start:c.finalStart,end:c.finalStart,cutoff:c.finalStart,evaluation:false}];
  const records=[];
  for(const fold of folds){
    const embargoStart=fold.start-c.s.embargoDays*DAY,ready=asOf>=fold.cutoff;
    for(const [day,rows] of [...groups].sort((a,b)=>a[0]-b[0])){
      const maxEnd=Math.max(...rows.filter(r=>r.status==='resolved').map(r=>Date.parse(r.informationEnd)));
      const before=day+DAY<=Math.min(embargoStart,c.developmentEnd);
      const isEvaluation=fold.evaluation&&day>=fold.start&&day+DAY<=fold.end;
      // Membership is determined by decision time. Unknown outcomes stay in
      // coverage; they cannot turn an evaluation day into a fitting day.
      const cohortRole=isEvaluation?'evaluate':before?'fit_candidate':'excluded';
      const pairs=new Map();for(const r of rows){const key=r.symbol+'|'+r.availableAt;if(!pairs.has(key))pairs.set(key,[]);pairs.get(key).push(r);}
      for(const pair of pairs.values()){
        if(pair.some(r=>r.market!==pair[0].market))throw Error('pair_market_mismatch');
        const complete=pair.length===2&&new Set(pair.map(r=>r.dir)).size===2;
        const resolved=complete&&pair.every(r=>r.status==='resolved');
        const pairEnd=Math.max(...pair.map(r=>Date.parse(r.informationEnd)));
        let role='excluded',reason='outside_window_or_75_day_embargo';
        if(isEvaluation){
          if(!ready)reason='whole_window_not_mature';
          else if(!resolved)reason='unresolved_or_incomplete_pair';
          else if(pairEnd>=fold.cutoff)reason='outcome_not_known_before_deadline';
          else {role='evaluate';reason=null;}
        }else if(before){
          if(!resolved)reason='unresolved_or_incomplete_pair';
          else if(maxEnd>=fold.start)reason='training_information_interval_purge';
          else if(pairEnd>asOf)reason='training_outcome_not_observed';
          else {role='fit';reason=null;}
        }
        for(const r of pair)records.push({id:r.id,fold:fold.name,utcDecisionDay:iso(day).slice(0,10),partition:partitionV2(r.symbol,r.availableAt,contract),cohortRole,role,reason});
      }
    }
  }
  return {version:'wave-ml-development-splits-v2',evaluationContractHash:digest(contract),observationCutoff:iso(asOf),finalLabelsOpened:false,trainingStarted:false,embargoDays:c.s.embargoDays,
    windows:folds.map(w=>({name:w.name,decisionStart:iso(w.start),decisionEndExclusive:iso(w.end),outcomeCutoffExclusive:iso(w.cutoff),fitDecisionEndExclusive:iso(Math.min(w.start-c.s.embargoDays*DAY,c.developmentEnd)),readyForScoring:w.evaluation?asOf>=w.cutoff:false,kind:w.evaluation?'development_validation':'final_fit_candidate_only'})),records};
}
