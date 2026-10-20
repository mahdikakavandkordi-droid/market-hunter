/* Presentation model only: preserve reported regimes, conditions and prices. */
(function(root){
  const GROUPS=[
    {key:'equities',label:'Equities',keys:['TSX','SP500','NASDAQ100']},
    {key:'metals',label:'Metals',keys:['GOLD','SILVER']},
    {key:'crypto',label:'Crypto',keys:['BTC','ETH']}
  ];
  const NAMES={TSX:'TSX Composite',SP500:'S&P 500',NASDAQ100:'Nasdaq-100',GOLD:'Gold',SILVER:'Silver',BTC:'Bitcoin',ETH:'Ethereum'};
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  function build(pulse,daily,freshness){
    const source=Array.isArray(pulse?.markets)?pulse.markets:[];
    const byKey=new Map();
    for(const x of source){const key=x?.key||Object.keys(NAMES).find(k=>NAMES[k]===x?.name);if(NAMES[key])byKey.set(key,[...(byKey.get(key)||[]),x]);}
    const markets=GROUPS.flatMap(group=>group.keys.map(key=>{
      const copies=byKey.get(key)||[],record=copies.length===1?copies[0]:null;
      const fresh=record&&typeof freshness==='function'?freshness(record):{usable:false,status:'missing'};
      const date=record?.asOf;
      const validDate=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
      const current=Boolean(record&&fresh.usable&&validDate&&record.regime&&record.condition);
      const report=(daily?.markets||[]).find(x=>x.key===key&&record&&x.asOf===record.asOf)||null;
      const returns=record?.current?.returns||record?.returns||{};
      return {key,name:record?.name||NAMES[key],group:group.key,record,report,current,status:fresh.status,asOf:record?.asOf||null,
        regime:current?record.regime:null,condition:current?record.condition:null,
        d5:finite(returns.d5)?returns.d5:null,d20:finite(returns.d20)?returns.d20:null};
    }));
    const current=markets.filter(m=>m.current);
    const groups=GROUPS.map(group=>{
      const rows=markets.filter(m=>m.group===group.key),usable=rows.filter(m=>m.current);
      const reported=(daily?.groups||[]).find(g=>g.label===group.label);
      return {...group,current:usable.length,total:group.keys.length,complete:usable.length===group.keys.length,
        state:usable.length===group.keys.length&&usable.every(m=>m.report&&freshness(m.report).usable)?reported?.state||null:null,
        detail:usable.length===group.keys.length?reported?.detail||null:null};
    });
    const byMarket=new Map(markets.map(m=>[m.key,m]));
    const attention=[...new Set([...(daily?.highestAttention||[]),...(daily?.watchNext||[]).map(x=>x.market)])]
      .map(key=>byMarket.get(key)).filter(m=>m?.current&&m.report&&freshness(m.report).usable)
      .filter(m=>[m.report.levels?.bullishTrigger,m.report.levels?.bearishTrigger].some(finite)).slice(0,3);
    const equities=markets.filter(m=>m.group==='equities');
    const alignedEquities=equities.length===3&&equities.every(m=>m.current&&finite(m.d20))&&new Set(equities.map(m=>m.asOf)).size===1;
    return {markets,groups,current:current.length,total:markets.length,hasData:source.length>0,
      weakening:current.filter(m=>m.condition==='Weakening').length,
      nearHigh:current.filter(m=>m.condition==='Breakout / Near High').length,
      attention,equityComparison:alignedEquities?equities:[],
      dates:[...new Set(current.map(m=>m.asOf).filter(Boolean))].sort()};
  }
  root.MarketHunterOverview={build};
})(typeof window==='undefined'?globalThis:window);
