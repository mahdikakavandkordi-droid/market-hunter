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
