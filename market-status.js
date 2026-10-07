// Presentation-only freshness policy shared by the site and Telegram.
(function(root){
  function freshness(item,nowMs=Date.now()){
    const f=item?.freshness||item?.current?.freshness||{};
    const asOf=item?.asOf||f.latestCompletedSession||null;
    let status=f.status||'unknown';
    const crypto=item?.group==='Crypto'||['BTC','ETH'].includes(item?.key);
    const expected=crypto?new Date(Math.floor(nowMs/86400000)*86400000-1).toISOString().slice(0,10):f.expectedCompletedSession;
    if(asOf&&expected&&asOf<expected)status='stale';
    if(!asOf)status='missing';
    return {status,asOf,expected:expected||null,usable:status==='fresh'};
  }
  root.MarketHunterStatus={freshness};
})(typeof window==='undefined'?globalThis:window);
