/* Separate, read-only research surface; account values are nominal paper units. */
window.MarketHunterEngines=(()=>{
  const engines=[{id:'smc',name:'SMC',icon:'◇',description:'Weekly / Daily structure · 4H CHoCH'},
    {id:'trend',name:'Trend Breakout',icon:'↗',description:'Follow a trend after a confirmed breakout'},
    {id:'mean',name:'Mean Reversion',icon:'↶',description:'Look for a return after a price stretch'}];
  const markets=[['tsx-core','Canada · Core'],['tsx-extra','Canada · Extended'],['us-75','US stocks'],['crypto-15','Crypto'],['metals-5','Metals']];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-CA',{maximumFractionDigits:2}):'—';
  const pct=v=>typeof v==='number'&&Number.isFinite(v)?(v>0?'+':'')+(v*100).toFixed(2)+'%':'—';
  const tone=v=>Number.isFinite(v)?v>0?'up':v<0?'down':'flat':'flat';
  const date=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('en-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
  const report=(data,e,c)=>data?.reports?.find(r=>r.engine===e&&r.cohort===c);
  function badges(data,symbol){
    const matches=(data?.reports||[]).filter(r=>r.status==='available'&&r.account.open.some(p=>p.symbol===symbol));
    return matches.length?'<div class="engine-badges">'+matches.map(r=>`<button type="button" class="engine-badge" data-engine-open="${esc(r.engine)}" data-engine-cohort="${esc(r.cohort)}" title="Recorded paper position · ${esc(date(r.generatedAt))}">${esc(engines.find(e=>e.id===r.engine)?.name)} · paper ${r.reportOverdue?'snapshot':'open'}</button>`).join('')+'</div>':'';
  }
  function metric(label,value,cls=''){return `<div class="engine-metric"><small>${esc(label)}</small><strong class="${cls}">${value}</strong></div>`;}
  function overview(r,e,selected){
    const a=r?.account;
    return `<button type="button" class="engine-overview ${selected?'selected':''}" data-engine-tab="${e.id}" aria-pressed="${selected}">
      <span class="engine-card-heading"><span class="engine-icon">${e.icon}</span><span>${e.name}</span><span class="engine-status">${a?r.reportOverdue?'Update overdue':r.failures.length?'Partial coverage':'Recorded':'Unavailable'}</span></span>
      <span class="engine-equity">${num(a?.markedEquity)} <small>paper units</small></span>
      <span class="engine-return ${tone(a?.markedReturn)}">${pct(a?.markedReturn)} <small>including open P/L</small></span>
      <span class="engine-counts">${a?`${a.openCount} open · ${a.closedCount} closed`:'Evidence could not be loaded'}</span>
      <span class="engine-description">${e.description}</span>
    </button>`;
  }
  function tradeCard(t,closed,e){
    return `<article class="engine-position">
      <div class="engine-position-head"><button class="symbol-link" data-chart="${esc(t.symbol)}">${esc(t.symbol)} ↗</button><span class="tag">${t.dir===1?'Long':t.dir===-1?'Short':'Direction unavailable'} · ${closed?'Closed':'Paper open'}</span></div>
      <p class="engine-position-time">Entered ${esc(date(t.entryT))}${closed?' · Exited '+esc(date(t.exitT)):''}</p>
      <div class="engine-position-metrics">${metric('Entry',num(t.entry))}${metric('Stop',num(t.stop))}${metric('Target',num(t.target))}${metric(closed?'Settled P/L':'Open P/L',num(closed?t.pnl:t.unrealizedPnl),tone(closed?t.pnl:t.unrealizedPnl))}</div>
      ${closed?`<p class="engine-position-time">Outcome ${num(t.R)}R · Position ${num(t.notional)} paper units</p>`:`<p class="engine-position-time">Last mark ${num(t.markPrice)} · ${esc(date(t.markT))} · ${esc(t.markStatus)}<br>Position ${num(t.notional)} · Initial risk ${num(t.riskAmount)} paper units</p>`}
      <p class="engine-position-reason">${e.id==='smc'?`${t.dir===1?'Bullish':'Bearish'} CHoCH under the frozen Weekly / Daily / 4H rules.`:e.description+'.'}</p>
    </article>`;
  }
  function comparison(r){
    const c=r?.comparison;
    if(!c)return '<div class="engine-notice">Common-window comparison is unavailable. Full-period results below have different start dates.</div>';
    return `<section class="panel engine-comparison"><div class="sectionhead"><div><h2>Same starting window</h2><p>New entries since ${esc(date(c.start))} · This market only</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Engine</th><th>Return incl. open P/L</th><th>Open / closed</th><th>Source snapshot</th></tr></thead><tbody>${c.rows.map(row=>`<tr><td>${esc(engines.find(e=>e.id===row.engine)?.name)}</td><td class="${tone(row.account?.markedReturn)}">${pct(row.account?.markedReturn)}</td><td>${row.account?row.account.openCount+' / '+row.account.closedCount:'—'}</td><td>${esc(date(row.sourceAsOf))}${row.stale?' · Update overdue':''}</td></tr>`).join('')}</tbody></table></div>
      <p class="engine-footnote">Early results; no winner yet. Prices are observed independently. Earlier positions are excluded; holding periods and gap rules differ. Returns use each source account’s latest valuation, not a synchronized price snapshot.</p></section>`;
  }
  function html(data,{engine='smc',cohort='tsx-core',mode='open',loading=false,error=false}={}){
    const e=engines.find(e=>e.id===engine)||engines[0];
    const r=report(data,e.id,cohort),a=r?.account;
    const refresh=`<button class="btn" type="button" data-engine-refresh ${loading?'disabled':''}>${loading?'Refreshing…':'Refresh evidence ↻'}</button>`;
    const header=`<section class="panel engine-intro"><div class="engine-intro-top"><div><span class="eyebrow">PAPER EXPERIMENT</span><h2>Three engines. One research desk.</h2><p>Track independent strategies and their recorded positions.</p></div>${refresh}</div><div class="engine-market-tabs" role="group" aria-label="Research market">${markets.map(([id,name])=>`<button type="button" data-engine-market="${id}" aria-pressed="${id===cohort}" class="${id===cohort?'active':''}">${name}</button>`).join('')}</div></section>`;
    if(!data)return header+`<div class="engine-notice" role="status">${error?'Evidence is unavailable. Try refreshing.':'Loading recorded engine evidence…'}</div>`;
    const cards=`<div class="engine-overviews">${engines.map(x=>overview(report(data,x.id,cohort),x,x.id===e.id)).join('')}</div>`;
    const compare=comparison(report(data,'mean',cohort));
    if(!a)return header+cards+compare+'<div class="engine-notice">This engine’s evidence is unavailable. Missing results are not treated as zero.</div>';
    const trades=mode==='closed'?a.closed:a.open;
    const warnings=[r.reportOverdue?'The report is over six hours old. Positions reflect the last snapshot.':'',
      error?'Refresh failed. Showing the previous snapshot.':'',
      r.failures.length?`${r.failures.length} instrument(s) could not be evaluated in this run.`:'',
      r.legacyCount?`${r.legacyCount} SMC records have unknown original provenance. Full-period results include those records.`:'',
      a.markQuality!=='fresh'?`Valuation quality: ${a.markQuality}. Missing valuations stay unavailable.`:''].filter(Boolean);
    return header+cards+compare+`<section class="panel engine-account"><div class="sectionhead"><div><h2>${e.name} · Full period</h2><p>Started ${esc(date(r.forwardStart))} · Snapshot ${esc(date(r.generatedAt))}</p></div></div>
      <div class="engine-account-metrics">${metric('Starting capital',num(a.startingCapital))}${metric('Settled equity',num(a.realizedEquity))}${metric('Settled return',pct(a.realizedReturn),tone(a.realizedReturn))}${metric('Cash',num(a.cash))}${metric('Initial open risk',num(a.openRiskAmount))}${metric('Closed trades',num(a.closedCount))}</div>
      <p class="engine-footnote">Account amounts use nominal paper units. Each market has a separate account. Open P/L uses recorded completed-bar marks; ${num(a.costR)}R cost is charged on settlement.</p>
      ${warnings.length?'<div class="engine-notice">'+warnings.map(esc).join('<br>')+'</div>':''}
      <div class="engine-trade-tabs" role="group" aria-label="Position status"><button type="button" data-engine-mode="open" aria-pressed="${mode==='open'}">Open (${a.openCount})</button><button type="button" data-engine-mode="closed" aria-pressed="${mode==='closed'}">Closed (${a.closedCount})</button><span>${r.pendingCount??'—'} signals pending · ${a.skippedCount??'—'} skipped</span></div>
      <div class="engine-positions">${trades.length?trades.map(t=>tradeCard(t,mode==='closed',e)).join(''):`<div class="engine-empty">${mode==='closed'?'No settled paper trades in this account yet.':'No recorded open position. Waiting for this engine’s own entry conditions.'}</div>`}</div>
      <details class="engine-source"><summary>Evidence and coverage</summary><p><a href="${esc(r.source.url)}" target="_blank" rel="noopener">Open source snapshot ↗</a> · ${r.diagnosticCount} data diagnostics</p>${r.failures.length?'<p>'+r.failures.map(f=>esc(f.symbol)+' · '+esc(f.error)).join('<br>')+'</p>':''}${r.provenance?'<p>'+Object.entries(r.provenance).map(([key,v])=>`${esc(key)}: ${v.closed??'—'} closed`).join(' · ')+'</p>':''}</details></section>`;
  }
  return {html,badges};
})();
