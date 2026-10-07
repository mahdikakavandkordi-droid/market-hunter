export function completedDailyRows(rows,meta,nowMs=Date.now()){
  const list=Array.isArray(rows)?rows:[];
  const regular=meta?.currentTradingPeriod?.regular||{};
  const start=Number(regular.start),end=Number(regular.end),now=Number(nowMs)/1000;
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||!Number.isFinite(now))return list;
  if(now<start||now>=end||!list.length)return list;
  const lastT=Number(list.at(-1)?.t);
  if(!Number.isFinite(lastT))return list;
  if(lastT<start-21600||lastT>end+3600)return list;
  return list.slice(0,-1);
}

// Crypto sessions end at UTC midnight, independent of provider trading-period metadata.
export function completedCryptoDailyRows(rows,nowMs=Date.now()){
  const dayStart=Math.floor(Number(nowMs)/86400000)*86400000;
  return (Array.isArray(rows)?rows:[]).filter(row=>Number.isFinite(row.t)&&row.t*1000<dayStart);
}
