// Presentation-only rules. Keep unchanged during the prospective observation period.
(function(root){
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  const version='volume-context-v1';
  function read(x={}){
    if(!finite(x.avgDollar20)||x.avgDollar20<3000000)return {version,kind:'unavailable'};
    const v=x.volumeContext;
    if(v?.version===version&&finite(v.relativeVolume)){
      if(v.relativeVolume>=1.5&&finite(v.dailyChangePct)&&finite(v.closeLocation)){
        if(v.dailyChangePct<0||v.closeLocation<0.35)return {...v,kind:'warning'};
        if(v.dailyChangePct>0&&v.closeLocation>=0.75&&x.freshHighBreakAge===0)return {...v,kind:'breakout'};
      }
      if(finite(v.recentVsPrior)&&v.recentVsPrior>=1.3&&v.elevatedSessions>=3)return {...v,kind:'building'};
    }
    if(finite(x.maxRvol5)&&x.maxRvol5>=1.5)return {version,kind:'spike',maxRvol5:x.maxRvol5};
    return {version,kind:finite(x.maxRvol5)?'normal':'unavailable'};
  }
  root.MHVolume={version,read};
})(globalThis);
