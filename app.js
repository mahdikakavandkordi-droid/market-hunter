const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString(undefined,{maximumFractionDigits:2}):'—';
const pct=n=>Number.isFinite(Number(n))?`${Number(n)>0?'+':''}${Number(n).toFixed(1)}%`:'—';
const cls=n=>Number(n)>0?'up':Number(n)<0?'down':'flat';
const short=s=>String(s||'').replace(/\.(TO|NE|V)$/,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=(n,c='CAD')=>Number.isFinite(Number(n))?new Intl.NumberFormat(undefined,{style:'currency',currency:c||'CAD',maximumFractionDigits:2}).format(Number(n)):'—';
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const readSet=k=>{try{return new Set(JSON.parse(localStorage.getItem(k)||'[]'))}catch{return new Set()}};
const readPositions=()=>{try{return new Map((JSON.parse(localStorage.getItem('marketHunterPositions')||'[]')).map(x=>[x.symbol,x]))}catch{return new Map()}};
const state={view:'home',daily:null,pulse:null,v2:null,watch:readSet('marketHunterWatchlist'),positions:readPositions(),portfolioItems:new Map(),analytics:null,previous:new Map()};

function saveWatch(){localStorage.setItem('marketHunterWatchlist',JSON.stringify([...state.watch]))}
function savePositions(){localStorage.setItem('marketHunterPositions',JSON.stringify([...state.positions.values()]))}
function toast(msg){const e=q('#toast');e.textContent=msg;e.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.classList.remove('show'),1400)}
async function getJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(url);return r.json()}
function allCandidates(){
  const out=[],seen=new Set();
  for(const x of state.v2?.integratedSurfacePicks||[]){if(!seen.has(x.symbol)){seen.add(x.symbol);out.push(x)}}
  for(const list of Object.values(state.v2?.surfacePicks||{}))for(const x of list||[]){if(!seen.has(x.symbol)){seen.add(x.symbol);out.push(x)}}
  return out;
}
function candidate(symbol){return allCandidates().find(x=>x.symbol===symbol)||null}
function normalizeSymbol(raw){
  let s=String(raw||'').trim().toUpperCase();
  if(!s)return'';
  if(!s.includes('.')){const hit=allCandidates().find(x=>short(x.symbol)===s);s=hit?hit.symbol:s+'.TO'}
  return s;
}
function openChart(symbol){
  const clean=short(symbol),cdr=new Set(['AAPL.TO','MSFT.TO','NVDA.TO','AMZN.TO','GOOG.TO','META.TO','TSLA.TO','AMD.TO','COST.TO']);
  const prefix=symbol.endsWith('.NE')||cdr.has(symbol)?'NEO:':symbol.endsWith('.V')?'TSXV:':'TSX:';
  window.open('https://www.tradingview.com/chart/?symbol='+encodeURIComponent(prefix+clean),'_blank','noopener');
}
function health(x){
  if(!x)return{label:'Data unavailable',tone:'watch',notes:['Current data unavailable']};
  const warning=[],watch=[],good=[];
  if(x.lowState==='local_low_broken')warning.push('Daily local low broken');
  if(x.swingTrend==='Lower highs + lower lows')warning.push('Lower-high / lower-low structure');
  if(Number.isFinite(x.momentumShift)&&x.momentumShift<=-3)watch.push('Momentum weakening');
  if(Number.isFinite(x.rs20)&&x.rs20<0)watch.push('RS below benchmark');
  if(x.swingTrend==='Higher highs + higher lows')good.push('HH / HL structure intact');
  if(x.lowState==='failed_low_break'||x.lowState==='local_low_held')good.push('Local low holding / reclaimed');
  if(warning.length)return{label:'Structure Warning',tone:'warn',notes:[...warning,...watch,...good]};
  if(watch.length)return{label:watch.length>1?'Watch Closely':'Momentum Cooling',tone:'watch',notes:[...watch,...good]};
  return{label:'Trend Healthy',tone:'good',notes:good.length?good:['No material structural warning']};
}
function changeReasons(cur,prev){
  if(!cur||!prev)return[];
  const out=[];
  if(cur.stage&&prev.stage&&cur.stage!==prev.stage)out.push(prev.stage+' → '+cur.stage);
  if(Number.isFinite(cur.momentumShift)&&Number.isFinite(prev.momentumShift)){
    const d=cur.momentumShift-prev.momentumShift;
    if(d>=3)out.push('Momentum improved');else if(d<=-3)out.push('Momentum weakened');
  }
  if(cur.highState!==prev.highState&&cur.highState==='local_high_broken')out.push('Local high broken');
  if(cur.lowState!==prev.lowState&&cur.lowState==='local_low_broken')out.push('Local low broken');
  if(cur.lowState!==prev.lowState&&cur.lowState==='failed_low_break')out.push('Local low reclaimed');
  return out;
}
function savePortfolioSnapshot(items){
  let saved=null;try{saved=JSON.parse(localStorage.getItem('marketHunterPortfolioDaily')||'null')}catch{}
  const date=items.map(x=>x.asOf).filter(Boolean).sort().at(-1)||null;
  if(saved?.currentDate&&saved.currentDate!==date){
    state.previous=new Map((saved.currentItems||[]).map(x=>[x.symbol,x]));
    localStorage.setItem('marketHunterPortfolioDaily',JSON.stringify({previousDate:saved.currentDate,previousItems:saved.currentItems||[],currentDate:date,currentItems:items}));
  }else if(saved?.currentDate===date){
    state.previous=new Map((saved.previousItems||[]).map(x=>[x.symbol,x]));
    localStorage.setItem('marketHunterPortfolioDaily',JSON.stringify({...saved,currentItems:items}));
  }else{
    state.previous=new Map();
    localStorage.setItem('marketHunterPortfolioDaily',JSON.stringify({previousDate:null,previousItems:[],currentDate:date,currentItems:items}));
  }
}
async function loadPortfolio(){
  const positions=[...state.positions.values()].filter(p=>p?.symbol);
  state.portfolioItems=new Map();state.analytics=null;
  if(!positions.length)return;
  const symbols=positions.map(p=>p.symbol).join(',');
  const entries=positions.filter(p=>p.boughtAt&&Number(p.entryPrice)>0).map(p=>[p.symbol,String(p.boughtAt).slice(0,10),Number(p.entryPrice)].join('|')).join(',');
  const quantities=positions.filter(p=>Number(p.quantity)>0).map(p=>[p.symbol,Number(p.quantity)].join('|')).join(',');
  try{
    const data=await getJson('/api/portfolio?symbols='+encodeURIComponent(symbols)+(entries?'&entries='+encodeURIComponent(entries):'')+(quantities?'&positions='+encodeURIComponent(quantities):''));
    state.portfolioItems=new Map((data.items||[]).map(x=>[x.symbol,x]));
    state.analytics=data.portfolioAnalytics||null;
    savePortfolioSnapshot(data.items||[]);
  }catch{}
}
async function load(){
  const b=q('#refreshBtn');b.classList.add('busy');b.disabled=true;
  try{
    const [daily,pulse,v2]=await Promise.allSettled([
      getJson('/data/daily-market-report.json'),
      getJson('/data/market-pulse-report.json'),
      getJson('/data/v2-latest-scan.json')
    ]);
    state.daily=daily.status==='fulfilled'?daily.value:null;
    state.pulse=pulse.status==='fulfilled'?pulse.value:null;
    state.v2=v2.status==='fulfilled'?v2.value:null;
    await loadPortfolio();
    q('#asOf').textContent=state.daily?.asOf?.latest?'Data through '+state.daily.asOf.latest:'Research dashboard';
    renderAll();
  }finally{b.classList.remove('busy');b.disabled=false}
}
function homeHtml(){
  const d=state.daily,p=state.pulse,picks=(state.v2?.integratedSurfacePicks||[]).slice(0,6);
  const s=portfolioSummary();
  const groups=(d?.groups||[]).slice(0,3).map(g=>`<div class="group-card"><small>${esc(g.label)}</small><b>${esc(g.state)}</b><p>${esc(g.detail)}</p></div>`).join('');
  const markets=(p?.markets||[]).map(x=>{
    const tone=/bull|uptrend|risk-on|strength/i.test(x.regime||'')?'metric-good':/bear|downtrend|risk-off|weak/i.test(x.regime||'')?'metric-bad':'metric-flat';
    return `<div class="market-row"><div><b>${esc(x.name)}</b><small>${esc(x.condition||'')}</small></div><div class="market-value">${fmt(x.price)}</div><div class="market-state ${tone}">${esc(x.regime||'Neutral')}</div></div>`;
  }).join('');
  const pulse=(p?.markets||[]).map(x=>{
    const direction=/bull|uptrend|risk-on|strength/i.test(x.regime||'')?'up':/bear|downtrend|risk-off|weak/i.test(x.regime||'')?'down':'flat';
    const tone=direction==='up'?'good':direction==='down'?'bad':'';
    return `<article class="pulse-card"><div class="pulse-top"><div><h4>${esc(x.name)}</h4><span class="badge ${tone}">${esc(x.regime||'Neutral')}</span></div></div><div class="price">${fmt(x.price)}</div><div class="sub">${esc(x.condition||'No short-term condition')}</div><div class="trendline ${direction}"></div></article>`;
  }).join('');
  const rows=picks.map((x,i)=>`<tr><td><span class="rank-dot">${i+1}</span></td><td class="symbol-cell"><b>${short(x.symbol)}</b><small>${esc(x.name||x.symbol)}</small></td><td><span class="stage-pill">${esc(x.stage)}</span></td><td>RSI ${Number.isFinite(x.rsi14)?x.rsi14.toFixed(0):'—'}</td><td><button class="btn ghost" data-chart="${x.symbol}">Chart ↗</button></td></tr>`).join('');
  const devs=(d?.keyDevelopments||[]).slice(0,4).map(x=>`<div class="development"><b>${esc(x.market)}</b><span>${esc(x.text)}</span></div>`).join('');
  const portfolioValue=s.currency?money(s.value,s.currency):s.complete.length?'Mixed currencies':'—';
  const pnl=s.currency?`${money(s.pnl,s.currency)} · ${pct(s.pnlPct)}`:'—';

  return `<div class="stack">
    <div class="grid home-hero">
      <section class="panel"><div class="panel-inner">
        <div class="eyebrow">Daily Market Report</div>
        <div class="report-title">${esc(d?.headline||'Market report unavailable')}</div>
        <div class="report-copy">${esc(d?.summary||d?.keyDevelopments?.[0]?.text||'Trend regime, short-term condition and the daily shortlist are loaded from the research engine.')}</div>
        <div class="report-badges">
          ${(d?.groups||[]).slice(0,3).map(g=>`<span class="badge">${esc(g.label)} · ${esc(g.state)}</span>`).join('')}
        </div>
        <div class="group-grid">${groups}</div>
      </div></section>
      <section class="panel soft">
        <div class="panel-head"><div><h3>Market board</h3><p>Fast read before opening details.</p></div></div>
        <div class="market-list">${markets||'<div class="empty">Market Pulse unavailable.</div>'}</div>
      </section>
    </div>

    <section class="panel soft">
      <div class="panel-head"><div><h2>Market Pulse</h2><p>Trend regime + short-term condition. No prediction layer.</p></div></div>
      <div class="pulse-strip">${pulse||'<div class="empty">Pulse unavailable.</div>'}</div>
    </section>

    <div class="grid home-lower">
      <section class="panel soft">
        <div class="panel-head"><div><h2>Charts to Review Today</h2><p>Final integrated shortlist · quality over count · max six.</p></div><button class="btn ghost" data-open="shortlist">View all</button></div>
        <div class="table-wrap"><table class="review-table"><thead><tr><th>#</th><th>Symbol</th><th>Stage</th><th>Context</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="5">No current shortlist.</td></tr>'}</tbody></table></div>
      </section>

      <section class="panel soft">
        <div class="panel-head"><div><h3>Portfolio Monitor</h3><p>What changed in things you actually own.</p></div><button class="btn ghost" data-open="portfolio">Open</button></div>
        <div class="portfolio-glance">
          <div class="eyebrow">Current value</div>
          <div class="portfolio-value">${portfolioValue}</div>
          <div class="portfolio-pnl ${cls(s.pnl)==='up'?'metric-good':cls(s.pnl)==='down'?'metric-bad':'metric-flat'}">${pnl}</div>
          <div class="glance-grid">
            <div class="glance-stat"><small>Holdings</small><b>${s.rows.length}</b></div>
            <div class="glance-stat"><small>Needs attention</small><b>${s.attention.length}</b></div>
            <div class="glance-stat"><small>Changed today</small><b>${s.changed.length}</b></div>
          </div>
        </div>
      </section>
    </div>

    ${devs?`<section class="panel soft"><div class="panel-head"><div><h3>Today’s context</h3><p>Evidence worth knowing before opening individual charts.</p></div></div><div class="developments">${devs}</div></section>`:''}
  </div>`;
}
function stockCard(x,rank=''){
  const watched=state.watch.has(x.symbol),owned=state.positions.has(x.symbol);
  const why=(x.evidence||[]).slice(0,3).join(' · ')||'Selected by validated stage logic.';
  return `<article class="card">
    <div class="cardtop"><div class="name"><b>${short(x.symbol)}</b><small>${esc(x.name||x.symbol)}</small></div><div class="cardprice">${money(x.price,'CAD')}<small class="${cls(x.ret5)}">5D ${pct(x.ret5)}</small></div></div>
    <div class="tags"><span class="tag">${rank?rank+' · ':''}${esc(x.stage)}</span><span class="tag">RSI ${Number.isFinite(x.rsi14)?x.rsi14.toFixed(0):'—'}</span></div>
    <div class="metrics"><div class="metric"><small>5D</small><b class="${cls(x.ret5)}">${pct(x.ret5)}</b></div><div class="metric"><small>20D</small><b class="${cls(x.ret20)}">${pct(x.ret20)}</b></div><div class="metric"><small>RS20</small><b class="${cls(x.rs20)}">${pct(x.rs20)}</b></div><div class="metric"><small>Momentum</small><b class="${cls(x.momentumShift)}">${Number.isFinite(x.momentumShift)?x.momentumShift.toFixed(1)+'pp':'—'}</b></div></div>
    <div class="why">${esc(why)}</div>
    <details><summary>More evidence</summary><div class="copy">Pullback ${pct(x.pullback60)} · ATR ${pct(x.atr14Pct)} · vs MA20 ${pct(x.dist20)} · vs MA50 ${pct(x.dist50)}${(x.riskFlags||[]).length?'<br><br><strong>Risk context</strong><br>'+esc(x.riskFlags.join(' · ')):''}</div></details>
    <div class="actions"><button class="btn" data-chart="${x.symbol}">Chart ↗</button><button class="btn" data-watch="${x.symbol}">${watched?'♥ Saved':'♡ Watch'}</button><button class="btn ${owned?'':'primary'}" data-buy="${x.symbol}">${owned?'Edit':'Bought'}</button></div>
  </article>`;
}
function shortlistHtml(){
  const picks=state.v2?.integratedSurfacePicks||[];
  return `<div class="stack"><section class="panel soft"><div class="sectionhead"><div><h2>Final Shortlist</h2><p>Quality over count. No global raw-score ranking.</p></div><span class="tag">${picks.length}/6</span></div><div class="cards">${picks.length?picks.map((x,i)=>stockCard(x,i+1)).join(''):'<div class="empty">No current shortlist.</div>'}</div></section></div>`;
}
function portfolioSummary(){
  const rows=[...state.positions.values()].map(p=>({p,x:state.portfolioItems.get(p.symbol)}));
  const complete=rows.filter(({p,x})=>Number(p.quantity)>0&&Number(p.entryPrice)>0&&x&&Number.isFinite(x.price));
  const currencies=new Set(complete.map(({x})=>x.currency||'UNKNOWN'));
  const single=currencies.size===1&&!currencies.has('UNKNOWN'),currency=single?[...currencies][0]:null;
  const value=single?complete.reduce((sum,{p,x})=>sum+Number(p.quantity)*x.price,0):null;
  const cost=single?complete.reduce((sum,{p})=>sum+Number(p.quantity)*Number(p.entryPrice),0):null;
  const pnl=single?value-cost:null,pnlPct=single&&cost>0?pnl/cost*100:null;
  const attention=rows.filter(({x})=>health(x).tone!=='good');
  const changed=[];
  for(const {p,x} of rows){const reasons=changeReasons(x,state.previous.get(p.symbol));if(reasons.length)changed.push({symbol:p.symbol,reasons})}
  return {rows,complete,currency,value,cost,pnl,pnlPct,attention,changed};
}
function allocationHtml(s){
  if(!s.complete.length)return'';
  if(!s.currency||!Number.isFinite(s.value))return '<div class="notice">Combined weights are hidden because holdings use multiple or unknown currencies. Individual positions are still monitored.</div>';
  const holdings=s.complete.map(({p,x})=>({name:short(p.symbol),value:Number(p.quantity)*x.price})).sort((a,b)=>b.value-a.value);
  const lines=holdings.map(h=>{const w=h.value/s.value*100;return `<div class="allocrow"><span>${esc(h.name)}</span><div class="bar"><span style="width:${Math.max(2,w)}%"></span></div><b>${w.toFixed(1)}%</b></div>`}).join('');
  return `<section class="panel soft"><div class="sectionhead"><div><h3>Allocation & concentration</h3><p>Current market-value weights.</p></div></div><details><summary>Open weights</summary><div class="allocation">${lines}</div></details></section>`;
}
function riskHtml(){
  const a=state.analytics;if(!a)return'';
  return `<section class="panel soft"><details><summary>Advanced risk & diversification</summary><div class="metrics"><div class="metric"><small>Volatility</small><b>${pct(a.annualizedVolPct)}</b></div><div class="metric"><small>Beta vs TSX</small><b>${Number.isFinite(a.betaVsTsx)?a.betaVsTsx.toFixed(2):'—'}</b></div><div class="metric"><small>Max drawdown</small><b>${pct(a.maxDrawdownPct)}</b></div><div class="metric"><small>Avg correlation</small><b>${Number.isFinite(a.avgPairwiseCorrelation)?a.avgPairwiseCorrelation.toFixed(2):'—'}</b></div></div><div class="copy">${a.diversificationRead?'<strong>Diversification</strong><br>'+esc(a.diversificationRead):''}${a.note?'<br><br>'+esc(a.note):''}</div></details></section>`;
}
function positionCard(p,x,total){
  const h=health(x),qty=Number(p.quantity)||0,value=x&&qty>0?qty*x.price:null,ret=x&&Number(p.entryPrice)>0?(x.price/Number(p.entryPrice)-1)*100:null;
  const weight=Number.isFinite(total)&&Number.isFinite(value)&&total>0?value/total*100:null,e=x?.entryStats;
  return `<article class="card">
    <div class="cardtop"><div class="name"><b>${short(p.symbol)}</b><small>${esc(x?.name||p.symbol)}</small></div><span class="health ${h.tone}">${h.label}</span></div>
    <div class="tags"><span class="tag">${p.source==='market-hunter'?'Market Hunter':'Manual / External'}</span><span class="tag">${qty||'—'} shares</span></div>
    <div class="metrics"><div class="metric"><small>Value</small><b>${x?money(value,x.currency):'—'}</b></div><div class="metric"><small>Weight</small><b>${Number.isFinite(weight)?weight.toFixed(1)+'%':'—'}</b></div><div class="metric"><small>Since entry</small><b class="${cls(ret)}">${pct(ret)}</b></div><div class="metric"><small>RSI</small><b>${Number.isFinite(x?.rsi14)?x.rsi14.toFixed(0):'—'}</b></div></div>
    <div class="why">${esc(h.notes.slice(0,3).join(' · '))}</div>
    <details><summary>Position details</summary><div class="copy">Purchased ${esc(p.boughtAt||'—')} · Avg cost ${x?money(p.entryPrice,x.currency):fmt(p.entryPrice)}<br>Entry stage ${esc(p.entryStage||'Not captured')} · Current stage ${esc(x?.stage||'Outside active stages')}<br>RS20 ${pct(x?.rs20)} · Momentum ${Number.isFinite(x?.momentumShift)?x.momentumShift.toFixed(1)+'pp':'—'}${e?'<br><br><strong>Since entry</strong><br>Max gain '+pct(e.maxGainPct)+' · Max drawdown '+pct(e.maxDrawdownPct)+' · Benchmark '+pct(e.benchmarkReturnPct)+' · Excess '+pct(e.excessVsBenchmarkPct):''}${p.notes?'<br><br><strong>Entry note</strong><br>'+esc(p.notes):''}</div></details>
    <div class="actions"><button class="btn" data-chart="${p.symbol}">Chart ↗</button><button class="btn" data-edit="${p.symbol}">Edit</button><button class="btn danger" data-remove="${p.symbol}">Remove</button></div>
  </article>`;
}
function portfolioHtml(){
  const s=portfolioSummary();
  const changeBlock=s.changed.length?`<section class="panel soft"><div class="sectionhead"><div><h3>What changed today</h3><p>Versus prior saved market-day snapshot.</p></div></div><div class="devs">${s.changed.map(x=>`<div class="dev"><b>${short(x.symbol)}</b><span>${esc(x.reasons.join(' · '))}</span></div>`).join('')}</div></section>`:'';
  const attentionBlock=s.attention.length?`<section class="panel soft"><div class="sectionhead"><div><h3>Current attention</h3><p>Context to inspect, not trade instructions.</p></div></div><div class="devs">${s.attention.map(({p,x})=>{const h=health(x);return`<div class="dev"><b>${short(p.symbol)}</b><span>${esc(h.label+' · '+h.notes[0])}</span></div>`}).join('')}</div></section>`:'';
  return `<div class="stack">
    <section class="panel"><div class="sectionhead"><div><h2>Portfolio Monitor</h2><p>What you actually own — Hunter or external.</p></div><button class="btn primary" data-add>+ Add</button></div>
      <div class="summarygrid"><div class="sum"><small>Value</small><b>${s.currency?money(s.value,s.currency):s.complete.length?'Mixed currencies':'—'}</b></div><div class="sum"><small>Cost basis</small><b>${s.currency?money(s.cost,s.currency):'—'}</b></div><div class="sum"><small>Total P/L</small><b class="${cls(s.pnl)}">${s.currency?money(s.pnl,s.currency)+' · '+pct(s.pnlPct):'—'}</b></div><div class="sum"><small>Holdings</small><b>${s.rows.length}</b></div><div class="sum"><small>Attention</small><b>${s.attention.length}</b></div></div>
      <div class="read">${s.attention.length?s.attention.length+' holding(s) deserve closer review.':'No material structural warning across covered holdings.'}</div>
    </section>
    ${changeBlock}${attentionBlock}${allocationHtml(s)}${riskHtml()}
    <section class="panel soft"><div class="sectionhead"><div><h3>Holdings</h3><p>Health first. Details stay collapsed.</p></div></div><div class="cards">${s.rows.length?s.rows.map(({p,x})=>positionCard(p,x,s.value)).join(''):'<div class="empty">No positions yet.</div>'}</div></section>
  </div>`;
}
function watchlistHtml(){
  const by=new Map(allCandidates().map(x=>[x.symbol,x])),items=[...state.watch];
  return `<div class="stack"><section class="panel soft"><div class="sectionhead"><div><h2>Watchlist</h2><p>Saved charts remain even after leaving the shortlist.</p></div><span class="tag">${items.length}</span></div><div class="cards">${items.length?items.map(symbol=>by.get(symbol)?stockCard(by.get(symbol)):`<article class="card"><div class="name"><b>${short(symbol)}</b><small>Outside current Hunter surface</small></div><div class="actions"><button class="btn" data-chart="${symbol}">Chart ↗</button><button class="btn danger" data-watch="${symbol}">Remove</button></div></article>`).join(''):'<div class="empty">Save a chart from the shortlist.</div>'}</div></section></div>`;
}
function renderView(view){
  if(view==='home')q('#homeView').innerHTML=homeHtml();
  if(view==='shortlist')q('#shortlistView').innerHTML=shortlistHtml();
  if(view==='portfolio')q('#portfolioView').innerHTML=portfolioHtml();
  if(view==='watchlist')q('#watchlistView').innerHTML=watchlistHtml();
}
function renderAll(){['home','shortlist','portfolio','watchlist'].forEach(renderView)}
function setView(view){
  state.view=view;
  qa('.view').forEach(el=>el.classList.toggle('active',el.id===view+'View'));
  qa('.navbtn').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
  const titles={home:'Home',shortlist:'Charts to Review',portfolio:'Portfolio Monitor',watchlist:'Watchlist'};
  const title=q('#pageTitle');if(title)title.textContent=titles[view]||'Market Hunter';
  renderView(view);window.scrollTo({top:0,behavior:'smooth'});
}
function closeModal(){q('#positionModal').classList.remove('open');q('#positionModal').setAttribute('aria-hidden','true')}
function openPosition(symbol='',source='manual'){
  const modal=q('#positionModal'),sym=normalizeSymbol(symbol),old=state.positions.get(sym),x=candidate(sym)||state.portfolioItems.get(sym),p=old||{},src=p.source||source;
  const entry=Number(p.entryPrice)>0?p.entryPrice:(src==='market-hunter'&&x?.price?x.price:'');
  modal.innerHTML=`<div class="sheet"><div class="sheethead"><div><h2>${old?'Edit position':'Add position'}</h2><p>Use the real purchase details.</p></div><button class="close" data-close>×</button></div>
    <form class="form" id="positionForm">
      <div class="field"><label>Symbol</label><input name="symbol" required value="${esc(p.symbol||sym)}" ${old?'readonly':''} placeholder="RY.TO"></div>
      <div class="field"><label>Source</label><select name="source"><option value="market-hunter" ${src==='market-hunter'?'selected':''}>Market Hunter</option><option value="manual" ${src!=='market-hunter'?'selected':''}>Manual / External</option></select></div>
      <div class="field"><label>Quantity</label><input name="quantity" type="number" step="any" min=".000001" required value="${Number(p.quantity)>0?p.quantity:''}"></div>
      <div class="field"><label>Average purchase price</label><input name="entryPrice" type="number" step="any" min=".000001" required value="${entry}"></div>
      <div class="field"><label>Purchase date</label><input name="boughtAt" type="date" required value="${String(p.boughtAt||today()).slice(0,10)}"></div>
      <div class="field full"><label>Entry note (optional)</label><textarea name="notes">${esc(p.notes||'')}</textarea></div>
      <div class="formactions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div>
    </form></div>`;
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');
  q('#positionForm').onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(e.currentTarget),s=normalizeSymbol(fd.get('symbol')),qty=Number(fd.get('quantity')),price=Number(fd.get('entryPrice')),date=String(fd.get('boughtAt')||''),chosen=fd.get('source')==='market-hunter'?'market-hunter':'manual',cur=candidate(s)||state.portfolioItems.get(s),prev=state.positions.get(s);
    if(!s||!(qty>0)||!(price>0)||!date)return;
    const rec={...(prev||{}),symbol:s,quantity:qty,entryPrice:price,boughtAt:date,source:chosen,notes:String(fd.get('notes')||'').trim(),updatedAt:new Date().toISOString(),createdAt:prev?.createdAt||new Date().toISOString()};
    if(chosen==='market-hunter'&&cur&&!rec.entryStage){rec.entryStage=cur.stage||'Unstaged';rec.entrySnapshotAt=new Date().toISOString()}
    if(chosen!=='market-hunter')rec.entryStage=null;
    state.positions.set(s,rec);savePositions();closeModal();await loadPortfolio();renderAll();setView('portfolio');toast('Position saved');
  };
}
document.addEventListener('click',async e=>{
  const nav=e.target.closest('[data-view]');if(nav){setView(nav.dataset.view);return}
  const open=e.target.closest('[data-open]');if(open){setView(open.dataset.open);return}
  const chart=e.target.closest('[data-chart]');if(chart){openChart(chart.dataset.chart);return}
  const watch=e.target.closest('[data-watch]');if(watch){const s=watch.dataset.watch;state.watch.has(s)?state.watch.delete(s):state.watch.add(s);saveWatch();renderAll();toast(state.watch.has(s)?'Saved':'Removed');return}
  const buy=e.target.closest('[data-buy]');if(buy){openPosition(buy.dataset.buy,'market-hunter');return}
  if(e.target.closest('[data-add]')){openPosition('','manual');return}
  const edit=e.target.closest('[data-edit]');if(edit){openPosition(edit.dataset.edit,state.positions.get(edit.dataset.edit)?.source||'manual');return}
  const remove=e.target.closest('[data-remove]');if(remove&&confirm('Remove '+remove.dataset.remove+' from Portfolio Monitor?')){state.positions.delete(remove.dataset.remove);savePositions();await loadPortfolio();renderAll();toast('Removed');return}
  if(e.target.closest('[data-close]')||e.target===q('#positionModal'))closeModal();
});
q('#refreshBtn').addEventListener('click',load);
load();
