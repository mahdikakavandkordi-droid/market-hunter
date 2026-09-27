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
