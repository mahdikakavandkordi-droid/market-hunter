const panel=document.querySelector('#intradayPanel');
let snapshot=null,busy=false;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function savedSymbols(){
  try{return [...new Set([...JSON.parse(localStorage.getItem('marketHunterWatchlist')||'[]'),...JSON.parse(localStorage.getItem('marketHunterPositions')||'[]').map(x=>x.symbol)])];}catch{return [];}
}
function draw(){
  if(!snapshot)return;
  const age=(Date.now()-Date.parse(snapshot.capturedAt))/60000;
  const end=snapshot.quotes['^GSPTSE']?.sessionEnd*1000;
  const open=snapshot.marketOpen&&Date.now()<end;
  const label=open?'Market open · Provisional':'Last available session snapshot';
  const card=symbol=>{
    const q=snapshot.quotes[symbol];if(!q)return `<div class="iq-card"><b>${esc(symbol)}</b><span>Not covered in this snapshot</span></div>`;
    const stale=q.stale||(open&&(Date.now()-Date.parse(q.quoteAt))/60000>90);
    return `<div class="iq-card"><b>${esc(q.name||q.symbol)}</b><strong>${Number(q.price).toLocaleString(undefined,{maximumFractionDigits:2})} <small>${esc(q.currency)}</small></strong><span class="${q.changePct>=0?'up':'down'}">${q.changePct==null?'—':(q.changePct>=0?'+':'')+q.changePct.toFixed(2)+'%'}</span><small>${stale?'Stale · ':''}${esc(new Date(q.quoteAt).toLocaleString())}${q.volume!=null?' · Vol '+Number(q.volume).toLocaleString():''}</small></div>`;
  };
  panel.innerHTML=`<div class="iq-heading"><strong>Hourly market check</strong><span>${label}${open&&age>90?' · Update overdue':''}</span></div><p>${esc(snapshot.commentary)}</p><small>Captured ${esc(new Date(snapshot.capturedAt).toLocaleString())} · ${snapshot.received}/${snapshot.intended} quotes · Scheduled hourly during TSX hours; delivery can be delayed.</small><div class="iq-grid">${['^GSPTSE','^GSPC','^NDX','GC=F','SI=F','BTC-USD','ETH-USD'].map(card).join('')}</div><details><summary>My watchlist and positions (${savedSymbols().length})</summary><div class="iq-grid">${savedSymbols().map(card).join('')||'<p>Add a watchlist item or position to monitor it here.</p>'}</div></details><small>${esc(snapshot.quoteDelayNotice)} Daily scanner prices below remain completed-session prices.</small>`;
}
async function refresh(){
  if(busy||document.hidden)return;busy=true;
  try{const r=await fetch('/api/intraday',{cache:'no-store'});if(!r.ok)throw Error('unavailable');snapshot=await r.json();draw();}
  catch{if(!snapshot)panel.textContent='Hourly market check is not available yet. Daily scanner remains available.';else{draw();panel.insertAdjacentHTML('afterbegin','<p>Could not refresh. Showing the previous snapshot.</p>');}}
  finally{busy=false;}
}
document.querySelector('#refresh')?.addEventListener('click',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
document.addEventListener('click',e=>{if(e.target.closest('[data-watch],[data-position]'))setTimeout(draw,0);});
setInterval(refresh,5*60*1000);refresh();
