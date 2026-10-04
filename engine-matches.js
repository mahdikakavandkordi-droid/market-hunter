// Read-only overlap policy: canonical daily picks, funded positions and recorded pending signals.
// This presentation layer never changes a scanner or engine decision.
(function(root){
  'use strict';
  const names=Object.freeze({smc:'SMC',trend:'Trend Breakout',mean:'Mean Reversion'});
  const stages=['Early Watch','Recovery','Attractive Growth','Established Move'];
  const equityCohorts=['tsx-core','tsx-extra','us-75'];
  const validTime=t=>typeof t==='string'&&Number.isFinite(Date.parse(t));
  function selected(scan){
    const rows=Array.isArray(scan?.integratedSurfacePicks)?scan.integratedSurfacePicks
      :scan?.surfacePicks?stages.flatMap(s=>scan.surfacePicks[s]||[]):[];
    const seen=new Set();
    return rows.filter(x=>x?.symbol&&!seen.has(x.symbol)&&seen.add(x.symbol));
  }
  function usable(r,now){
    return r?.status==='available'&&validTime(r.generatedAt)&&!r.reportOverdue
      &&now-Date.parse(r.generatedAt)<=6*3600000&&Date.parse(r.generatedAt)<=now+5*60000;
  }
  function scanReady(scan,now){
    // Last completed equity session remains valid across a weekend/holiday.
    return validTime(scan?.generatedAt)&&now-Date.parse(scan.generatedAt)<=5*86400000
      &&Date.parse(scan.generatedAt)<=now+5*60000&&validTime(scan?.marketAsOf);
  }
  function expectedCohorts(symbol){return /\.(TO|V|NE)$/.test(symbol)?['tsx-core','tsx-extra']:['us-75'];}
  function coverage(scan,data,engine='all',now=Date.now()){
    const symbols=selected(scan).map(x=>x.symbol);
    const cohorts=symbols.length?[...new Set(symbols.flatMap(expectedCohorts))]:equityCohorts;
    const ids=engine==='all'?Object.keys(names):[engine];
    return scanReady(scan,now)&&ids.every(id=>cohorts.every(c=>{
      const r=data?.reports?.find(r=>r.engine===id&&r.cohort===c);
      return usable(r,now)&&!(r.failures||[]).some(f=>symbols.includes(f.symbol));
    }));
  }
  function matches(scan,data,engine='all',now=Date.now()){
    if(!scanReady(scan,now))return [];
    const picks=selected(scan),bySymbol=new Map(picks.map(x=>[x.symbol,x]));
    const out=[],seen=new Set();
    for(const r of data?.reports||[]){
      if(!equityCohorts.includes(r.cohort)||!usable(r,now)||(engine!=='all'&&r.engine!==engine)||!names[r.engine])continue;
      for(const p of [...(r.account?.open||[]),...(r.pending||[])]){
        if(p.status==='pending_entry'&&(!validTime(p.availableAt||p.signalT)||Date.parse(p.availableAt||p.signalT)>now))continue;
        if(!bySymbol.has(p.symbol)||![1,-1].includes(p.dir)||(p.status!=='pending_entry'&&(p.status!=='open'||!validTime(p.entryT)||Date.parse(p.entryT)>now||!(p.notional>0)))||(r.failures||[]).some(f=>f.symbol===p.symbol))continue;
        const key=r.engine+'|'+r.cohort+'|'+p.symbol+'|'+p.entryT;
        if(seen.has(key))continue;seen.add(key);
        out.push({symbol:p.symbol,pick:bySymbol.get(p.symbol),engine:r.engine,engineName:names[r.engine],cohort:r.cohort,
          generatedAt:r.generatedAt,position:p});
      }
    }
    return out.sort((a,b)=>picks.findIndex(x=>x.symbol===a.symbol)-picks.findIndex(x=>x.symbol===b.symbol)||a.engine.localeCompare(b.engine));
  }
  root.MarketHunterEngineMatches=Object.freeze({names,selected,matches,coverage});
})(typeof window!=='undefined'?window:globalThis);
