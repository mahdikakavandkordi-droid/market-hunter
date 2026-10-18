import '../volume-context.js';
export const volumeReading=globalThis.MHVolume.read;
export function volumeMetrics(rows){
  const unavailable={version:globalThis.MHVolume.version,relativeVolume:null,recentVsPrior:null,elevatedSessions:null,dailyChangePct:null,closeLocation:null};
  if(rows.length<25)return unavailable;
  const window=rows.slice(-25);
  if(window.some(r=>!Number.isFinite(r.volume)||r.volume<0))return unavailable;
  const mean=a=>a.reduce((s,r)=>s+r.volume,0)/a.length;
  const latest=window.at(-1),prior=mean(window.slice(-21,-1)),baseline=mean(window.slice(0,20));
  if(!(prior>0&&baseline>0))return unavailable;
  const previous=window.at(-2);
  return {version:globalThis.MHVolume.version,relativeVolume:latest.volume/prior,
    recentVsPrior:mean(window.slice(-5))/baseline,
    elevatedSessions:window.slice(-5).filter(r=>r.volume>=baseline*1.3).length,
    dailyChangePct:Number.isFinite(latest.close)&&previous.close>0?(latest.close/previous.close-1)*100:null,
    closeLocation:Number.isFinite(latest.close)&&Number.isFinite(latest.high)&&Number.isFinite(latest.low)&&latest.high>latest.low&&latest.close>=latest.low&&latest.close<=latest.high?(latest.close-latest.low)/(latest.high-latest.low):null};
}
