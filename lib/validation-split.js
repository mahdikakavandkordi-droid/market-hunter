export function purgedChronSplit(rows,trainFraction=.7){
  const safe=Array.isArray(rows)?rows:[];
  const dates=[...new Set(safe.map(x=>x?.date).filter(Boolean))].sort();
  const cut=dates[Math.floor(dates.length*trainFraction)]||null;
  if(!cut)return {
    cut:null,train:[],test:[],prePurgeTrainCount:0,purgedTrainCount:0,missingOutcomeCount:0
  };
  const preTrain=safe.filter(x=>x?.date<cut);
  const test=safe.filter(x=>x?.date>=cut);
  const missingOutcomeCount=preTrain.filter(x=>!x?.outcomeDate).length;
  const train=preTrain.filter(x=>x?.outcomeDate&&x.outcomeDate<cut);
  return {
    cut,train,test,
    prePurgeTrainCount:preTrain.length,
    purgedTrainCount:preTrain.length-train.length,
    missingOutcomeCount
  };
}


export function sealedChronSplit(rows,{trainFraction=.7,finalStart}={}){
  if(!finalStart)throw new Error('sealedChronSplit requires finalStart');
  const safe=Array.isArray(rows)?rows:[];
  const final=safe.filter(x=>x?.date>=finalStart);
  const preFinal=safe.filter(x=>x?.date<finalStart);
  const missingOutcomeBeforeFinal=preFinal.filter(x=>!x?.outcomeDate).length;
  const finalBoundaryPurged=preFinal.filter(x=>!x?.outcomeDate||x.outcomeDate>=finalStart);
  const development=preFinal.filter(x=>x?.outcomeDate&&x.outcomeDate<finalStart);

  const dates=[...new Set(development.map(x=>x?.date).filter(Boolean))].sort();
  const cut=dates[Math.floor(dates.length*trainFraction)]||null;
  if(!cut)return {
    cut:null,finalStart,
    train:[],test:[],final,
    developmentCount:development.length,
    preFinalCount:preFinal.length,
    finalBoundaryPurgedCount:finalBoundaryPurged.length,
    missingOutcomeBeforeFinal,
    prePurgeTrainCount:0,
    purgedTrainCount:0
  };

  const preTrain=development.filter(x=>x.date<cut);
  const test=development.filter(x=>x.date>=cut);
  const train=preTrain.filter(x=>x.outcomeDate&&x.outcomeDate<cut);

  return {
    cut,finalStart,train,test,final,
    developmentCount:development.length,
    preFinalCount:preFinal.length,
    finalBoundaryPurgedCount:finalBoundaryPurged.length,
    missingOutcomeBeforeFinal,
    prePurgeTrainCount:preTrain.length,
    purgedTrainCount:preTrain.length-train.length
  };
}


function isIsoDay(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}

export function validateFixedCalendar(calendar){
  const developmentStart=calendar?.developmentStart;
  const validationStart=calendar?.validationStart;
  const finalStart=calendar?.finalStart;
  for(const [name,value] of Object.entries({developmentStart,validationStart,finalStart})){
    if(!isIsoDay(value))throw new Error('Invalid validation calendar '+name+': '+value);
  }
  if(!(developmentStart<validationStart&&validationStart<finalStart)){
    throw new Error('Validation calendar must satisfy developmentStart < validationStart < finalStart');
  }
  return {developmentStart,validationStart,finalStart};
}

export function fixedCalendarSplit(rows,calendar){
  const cal=validateFixedCalendar(calendar);
  const safe=Array.isArray(rows)?rows:[];
  const trainCandidates=[],validation=[],outside=[],invalid=[];
  let invalidDateCount=0,invalidOutcomeDateCount=0,invalidOrderCount=0;
  let validationBoundaryPurgedCount=0,finalBoundaryPurgedCount=0;

  for(const row of safe){
    if(!isIsoDay(row?.date)){invalid.push(row);invalidDateCount++;continue}
    if(!isIsoDay(row?.outcomeDate)){invalid.push(row);invalidOutcomeDateCount++;continue}
    if(row.outcomeDate<row.date){invalid.push(row);invalidOrderCount++;continue}
    if(row.date<cal.developmentStart||row.date>=cal.finalStart){outside.push(row);continue}
    if(row.date<cal.validationStart){
      if(row.outcomeDate>=cal.validationStart){validationBoundaryPurgedCount++;continue}
      trainCandidates.push(row);
      continue;
    }
    if(row.outcomeDate>=cal.finalStart){finalBoundaryPurgedCount++;continue}
    validation.push(row);
  }

  const status=trainCandidates.length&&validation.length?'ok':'insufficient_data';
  const insufficientReason=status==='ok'?null:
    !trainCandidates.length&&!validation.length?'empty_train_and_validation':
    !trainCandidates.length?'empty_train':'empty_validation';

  return {
    mode:'fixed_calendar',
    status,
    insufficientReason,
    calendar:cal,
    train:trainCandidates,
    test:validation,
    counts:{
      inputCount:safe.length,
      trainCount:trainCandidates.length,
      validationCount:validation.length,
      validationBoundaryPurgedCount,
      finalBoundaryPurgedCount,
      invalidCount:invalid.length,
      invalidDateCount,
      invalidOutcomeDateCount,
      invalidOrderCount,
      outsideCalendarCount:outside.length
    }
  };
}
