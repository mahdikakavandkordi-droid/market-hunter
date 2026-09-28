export function emptyStageContinuity(){
  return {stage:null,age:-1};
}

export function advanceStageContinuity(state,stage){
  const prev=state&&typeof state==='object'?state:emptyStageContinuity();
  if(!stage){
    return {stageAge:null,episodeStart:false,state:emptyStageContinuity()};
  }
  const stageAge=stage===prev.stage?prev.age+1:0;
  return {
    stageAge,
    episodeStart:stage!==prev.stage,
    state:{stage,age:stageAge}
  };
}
