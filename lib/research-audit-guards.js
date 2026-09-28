export function assertHistoricalFinalSealedReport(report,label='input report'){
  if(report?.validation?.finalTestOpened!==false){
    throw new Error(label+' must declare validation.finalTestOpened === false');
  }
  if(report?.finalEvaluation){
    throw new Error(label+' contains Historical Final evaluation output');
  }
  return true;
}
