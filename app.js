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
const state={view:'home',reviewStage:'Early Watch',daily:null,pulse:null,v2:null,watch:readSet('marketHunterWatchlist'),positions:readPositions(),portfolioItems:new Map(),liveItems:new Map(),analytics:null,previous:new Map(),cloud:{session:loadCloudSession(),status:'local',message:'',showAuth:false,ready:false}};


const CLOUD_SESSION_KEY='marketHunterCloudSessionV1';
const SUPABASE_URL='https://ivmpzyjxyfcefjyylybr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_yy1QKQRcgf2ny3aWhhHSkw_Z7Y0Fa55';
let cloudSyncTimer=0,cloudSyncBusy=false,cloudSyncQueued=false;

function loadCloudSession(){try{return JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY)||'null')}catch{return null}}
function saveCloudSession(session){
  if(session){localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(session));state.cloud.session=session}
  else{localStorage.removeItem(CLOUD_SESSION_KEY);state.cloud.session=null}
}
async function cloudAuthRequest(path,body,token){
  const headers={'apikey':SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'};
  if(token)headers.Authorization='Bearer '+token;
  const r=await fetch(SUPABASE_URL+'/auth/v1/'+path,{method:'POST',headers,body:JSON.stringify(body||{})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.msg||data.message||data.error_description||'Cloud authentication failed');
  return data;
}
async function ensureCloudSession(){
  let session=state.cloud.session;if(!session)return null;
  if(Number(session.expires_at||0)>Math.floor(Date.now()/1000)+90)return session;
  if(!session.refresh_token){saveCloudSession(null);return null}
  try{
    const data=await cloudAuthRequest('token?grant_type=refresh_token',{refresh_token:session.refresh_token});
    session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600),user:data.user||session.user};
    saveCloudSession(session);return session;
  }catch{
    saveCloudSession(null);state.cloud.status='local';state.cloud.message='Cloud session expired. Sign in again.';return null;
  }
}
async function cloudRest(table,{method='GET',query='',body=null,prefer=''}={}){
  const session=await ensureCloudSession();if(!session)throw new Error('Sign in to use cloud sync');
  const headers={'apikey':SUPABASE_PUBLISHABLE_KEY,'Authorization':'Bearer '+session.access_token,'Content-Type':'application/json'};
  if(prefer)headers.Prefer=prefer;
  const r=await fetch(SUPABASE_URL+'/rest/v1/'+table+(query?'?'+query:''),{method,headers,body:body===null?undefined:JSON.stringify(body),cache:'no-store'});
  if(!r.ok){const data=await r.json().catch(()=>({}));throw new Error(data.message||data.hint||'Cloud data request failed')}
  if(r.status===204)return null;
  const text=await r.text();return text?JSON.parse(text):null;
}
function positionStamp(p){return Date.parse(p?.updatedAt||p?.createdAt||0)||0}
function mergeCloudState(remote){
  const local=[...state.positions.values()],remotePositions=Array.isArray(remote?.positions)?remote.positions:[];
  const by=new Map();
  for(const p of [...remotePositions,...local]){
    if(!p?.symbol)continue;
    const old=by.get(p.symbol);
    if(!old||positionStamp(p)>=positionStamp(old))by.set(p.symbol,p);
  }
  state.positions=by;
  state.watch=new Set([...(Array.isArray(remote?.watchlist)?remote.watchlist:[]),...state.watch]);
  localStorage.setItem('marketHunterPositions',JSON.stringify([...state.positions.values()]));
  localStorage.setItem('marketHunterWatchlist',JSON.stringify([...state.watch]));
}
function currentDailyPayload(){
  try{return JSON.parse(localStorage.getItem('marketHunterPortfolioDaily')||'null')}catch{return null}
}
async function loadCloudPortfolio(){
  const [rows,snaps]=await Promise.all([
    cloudRest('market_hunter_portfolio_state',{query:'select=payload,updated_at&limit=1'}),
    cloudRest('market_hunter_portfolio_snapshots',{query:'select=market_as_of,payload,updated_at&order=market_as_of.desc&limit=2'})
  ]);
  mergeCloudState(rows?.[0]?.payload||{});
  const local=currentDailyPayload(),cloudRows=snaps||[];
  const cloudLatest=cloudRows[0],localDate=local?.currentDate||'';
  if(cloudLatest?.market_as_of&&cloudLatest.market_as_of>=localDate){
    const prev=cloudRows[1];
    localStorage.setItem('marketHunterPortfolioDaily',JSON.stringify({
      previousDate:prev?.market_as_of||null,previousItems:prev?.payload?.items||[],
      currentDate:cloudLatest.market_as_of,currentItems:cloudLatest.payload?.items||[]
    }));
  }
}
async function syncPortfolioCloud(){
  if(cloudSyncBusy){cloudSyncQueued=true;return}
  const session=await ensureCloudSession();if(!session||!state.cloud.ready)return;
  cloudSyncBusy=true;state.cloud.status='syncing';state.cloud.message='Saving cloud copy...';
  try{
    const now=new Date().toISOString(),payload={positions:[...state.positions.values()],watchlist:[...state.watch]};
    await cloudRest('market_hunter_portfolio_state',{method:'POST',query:'on_conflict=user_id',prefer:'resolution=merge-duplicates,return=minimal',body:{user_id:session.user.id,version:2,payload,updated_at:now}});
    const daily=currentDailyPayload();
    if(daily?.currentDate){
      await cloudRest('market_hunter_portfolio_snapshots',{method:'POST',query:'on_conflict=user_id,market_as_of',prefer:'resolution=merge-duplicates,return=minimal',body:{user_id:session.user.id,market_as_of:daily.currentDate,payload:{marketAsOf:daily.currentDate,items:daily.currentItems||[]},updated_at:now}});
    }
    state.cloud.status='synced';state.cloud.message='Cloud copy is up to date.';
  }catch(e){state.cloud.status='error';state.cloud.message=e.message||'Cloud sync failed'}
  finally{
    cloudSyncBusy=false;
    if(cloudSyncQueued){cloudSyncQueued=false;queueCloudSync()}
    if(state.view==='portfolio')renderView('portfolio');
  }
}
function queueCloudSync(){
  if(!state?.cloud?.session||!state.cloud.ready)return;
  clearTimeout(cloudSyncTimer);cloudSyncTimer=setTimeout(()=>syncPortfolioCloud(),600);
}
async function initializeCloudPortfolio(){
  state.cloud.ready=false;
  if(!state.cloud.session){state.cloud.ready=true;return}
  state.cloud.status='syncing';state.cloud.message='Loading cloud portfolio...';
  try{await loadCloudPortfolio();state.cloud.ready=true;await syncPortfolioCloud()}
  catch(e){state.cloud.ready=true;state.cloud.status='error';state.cloud.message=e.message||'Cloud load failed'}
}
async function cloudSignIn(email,password){
  state.cloud.status='syncing';state.cloud.message='Signing in...';renderView('portfolio');
  try{
    const data=await cloudAuthRequest('token?grant_type=password',{email,password});
    saveCloudSession({access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600),user:data.user});
    state.cloud.showAuth=false;await initializeCloudPortfolio();await loadPortfolio();renderAll();setView('portfolio');
  }catch(e){state.cloud.status='error';state.cloud.message=e.message;renderView('portfolio')}
}
async function cloudSignUp(email,password){
  state.cloud.status='syncing';state.cloud.message='Creating account...';renderView('portfolio');
  try{
    const data=await cloudAuthRequest('signup',{email,password});
    if(data.access_token){
      saveCloudSession({access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600),user:data.user});
      state.cloud.showAuth=false;await initializeCloudPortfolio();await loadPortfolio();renderAll();setView('portfolio');
    }else{state.cloud.status='local';state.cloud.message='Account created. Confirm the email, then sign in.';renderView('portfolio')}
  }catch(e){state.cloud.status='error';state.cloud.message=e.message;renderView('portfolio')}
}
async function cloudSignOut(){
  const session=await ensureCloudSession();if(session){try{await cloudAuthRequest('logout',{},session.access_token)}catch{}}
  saveCloudSession(null);state.cloud.ready=true;state.cloud.status='local';state.cloud.message='Local copy remains on this device.';state.cloud.showAuth=false;renderView('portfolio');
}

function applyTheme(theme){
  const next=theme==='light'?'light':'dark';
  document.documentElement.dataset.theme=next;
  try{localStorage.setItem('marketHunterTheme',next)}catch{}
  const b=q('#themeBtn');
  if(b){
    b.textContent=next==='dark'?'☼':'☾';
    b.title=next==='dark'?'Switch to light theme':'Switch to dark theme';
    b.setAttribute('aria-label',b.title);
  }
  const meta=q('#themeColor');
  if(meta)meta.setAttribute('content',next==='light'?'#f4f6f8':'#08111d');
}
function saveWatch(){localStorage.setItem('marketHunterWatchlist',JSON.stringify([...state.watch]));queueCloudSync()}
function savePositions(){localStorage.setItem('marketHunterPositions',JSON.stringify([...state.positions.values()]));queueCloudSync()}
function toast(msg){const e=q('#toast');e.textContent=msg;e.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.classList.remove('show'),1400)}
async function getJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(url);return r.json()}
function enrichCandidate(x){
  const live=state.liveItems.get(x?.symbol);if(!live)return x;
  return {...x,price:Number.isFinite(live.price)?live.price:x.price,dayChangePct:live.dayChangePct};
}
function allCandidates(){
  const out=[],seen=new Set();
  for(const x of state.v2?.integratedSurfacePicks||[]){if(!seen.has(x.symbol)){seen.add(x.symbol);out.push(enrichCandidate(x))}}
  for(const list of Object.values(state.v2?.surfacePicks||{}))for(const x of list||[]){if(!seen.has(x.symbol)){seen.add(x.symbol);out.push(enrichCandidate(x))}}
  return out;
}
async function loadCandidateLiveData(){
  state.liveItems=new Map();
  const raw=[...(state.v2?.integratedSurfacePicks||[]),...Object.values(state.v2?.surfacePicks||{}).flat()];
  const symbols=[...new Set([
    ...raw.map(x=>x?.symbol),
    ...state.watch,
    ...[...state.positions.values()].map(x=>x?.symbol)
  ].filter(Boolean))].slice(0,30);
  if(!symbols.length)return;
  try{
    const data=await getJson('/api/portfolio?symbols='+encodeURIComponent(symbols.join(',')));
    state.liveItems=new Map((data.items||[]).map(x=>[x.symbol,x]));
  }catch{}
}
const REVIEW_STAGES=['Early Watch','Recovery','Attractive Growth','Established Move'];
function stageEligiblePicks(stage){
  const rows=state.v2?.reviewFirst?.[stage]||state.v2?.surfacePicks?.[stage]||[];
  const policy=state.v2?.surfacePolicy?.[stage]||{};
  return [...rows].filter(x=>{
    if(Number.isFinite(policy.minScore)&&(!Number.isFinite(x?.score)||x.score<policy.minScore))return false;
    if(Number.isFinite(policy.maxStageAge)&&(!Number.isFinite(x?.stageAge)||x.stageAge>policy.maxStageAge))return false;
    return true;
  }).sort((x,y)=>(y?.surfaceScore??y?.score??-Infinity)-(x?.surfaceScore??x?.score??-Infinity)||String(x?.symbol||'').localeCompare(String(y?.symbol||'')));
}
function stageLeaders(){return REVIEW_STAGES.map(stage=>stageEligiblePicks(stage)[0]).filter(Boolean)}
function toneClass(value){
  return /constructive|favorable|strong|bull/i.test(value||'')?'metric-good':/cautious|weaker|risk|bear/i.test(value||'')?'metric-bad':'metric-flat';
}
function stripMarketPrefix(text){
  return String(text||'').replace(/^[^:]+:\s*/,'');
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
function stockNarrative(x){
  if(!x)return 'Current market data is unavailable, so the chart cannot be assessed reliably right now.';
  const parts=[];
  if(x.stage==='Early Watch'){
    parts.push('Selling pressure is starting to ease near the recent low, but this is still an early setup rather than a confirmed reversal.');
  }else if(x.stage==='Recovery'){
    parts.push('The chart is rebuilding after prior weakness, with signs that momentum and structure are improving.');
  }else if(x.stage==='Attractive Growth'){
    parts.push('The broader trend is constructive and price is participating in a stronger growth phase.');
  }else if(x.stage==='Established Move'){
    parts.push('The longer-term uptrend is mature and still broadly intact, so the main question is whether the move can keep advancing without becoming too extended.');
  }else{
    parts.push('The chart is outside the active Hunter stages, so the current read is based on structure, momentum and relative strength rather than a stage label.');
  }
  const detail=[];
  if(x.swingTrend==='Higher highs + higher lows')detail.push('higher highs and higher lows are intact');
  else if(x.swingTrend==='Structure improving')detail.push('swing structure is improving');
  else if(x.swingTrend==='Lower highs + lower lows')detail.push('the swing structure is still weak');
  else if(x.swingTrend==='Structure weakening')detail.push('the swing structure has started to weaken');
  if(Number.isFinite(x.momentumShift)){
    if(x.momentumShift>=4)detail.push('momentum has improved clearly');
    else if(x.momentumShift>=1)detail.push('momentum is improving');
    else if(x.momentumShift<=-4)detail.push('momentum has cooled noticeably');
    else if(x.momentumShift<0)detail.push('momentum is slightly softer');
  }
  if(Number.isFinite(x.rs20)){
    if(x.rs20>=8)detail.push('20-day relative strength is well ahead of the TSX');
    else if(x.rs20>=3)detail.push('20-day relative strength is ahead of the TSX');
    else if(x.rs20<=-8)detail.push('20-day relative strength is materially lagging the TSX');
    else if(x.rs20<=-3)detail.push('20-day relative strength is lagging the TSX');
  }
  if(detail.length)parts.push(detail.slice(0,3).join(', ')+'.');
  const caution=[];
  if(x.lowBroken===true)caution.push('the recent local low has been broken');
  if(Number.isFinite(x.dist20)&&x.dist20>=10)caution.push('price is very extended above its 20-day average');
  else if(Number.isFinite(x.dist20)&&x.dist20>=6)caution.push('price is extended above its 20-day average');
  if(Number.isFinite(x.rsi14)&&x.rsi14>=80)caution.push('RSI is extremely elevated');
  else if(Number.isFinite(x.rsi14)&&x.rsi14>=72)caution.push('RSI is elevated');
  if(caution.length)parts.push('The main thing to watch is that '+caution.slice(0,2).join(' and ')+'.');
  return parts.join(' ');
}
function positionNarrative(p,x,weight){
  const parts=[stockNarrative(x)];
  const e=x?.entryStats;
  if(e&&Number.isFinite(e.sinceEntryReturn)){
    let sentence='Since your entry, the position is '+pct(e.sinceEntryReturn);
    if(Number.isFinite(e.excessVsBenchmarkPct)){
      sentence+=' and is '+Math.abs(e.excessVsBenchmarkPct).toFixed(1)+' percentage points '+(e.excessVsBenchmarkPct>=0?'ahead of':'behind')+' its benchmark';
    }
    parts.push(sentence+'.');
  }
  if(Number.isFinite(weight)){
    if(weight>=30)parts.push('At '+weight.toFixed(1)+'% of portfolio value, this position has a large influence on total portfolio movement.');
    else if(weight>=15)parts.push('At '+weight.toFixed(1)+'% of portfolio value, this position has a meaningful influence on the portfolio.');
  }
  return parts.join(' ');
}
function positionQuickRead(p,x,weight){
  if(!x)return {now:'Fresh market data is unavailable.',since:'Entry comparison is unavailable.',impact:'Portfolio impact unavailable.'};
  const now=[];
  if(x.swingTrend==='Higher highs + higher lows')now.push('Trend structure is healthy');
  else if(x.swingTrend==='Structure improving')now.push('Structure is improving');
  else if(x.swingTrend==='Lower highs + lower lows')now.push('Structure is still weak');
  else if(x.swingTrend==='Structure weakening')now.push('Structure is weakening');
  if(Number.isFinite(x.momentumShift)&&x.momentumShift>=3)now.push('momentum is improving');
  else if(Number.isFinite(x.momentumShift)&&x.momentumShift<=-3)now.push('momentum is cooling');
  if(Number.isFinite(x.rs20)&&x.rs20>=3)now.push('RS is ahead of TSX');
  else if(Number.isFinite(x.rs20)&&x.rs20<=-3)now.push('RS is lagging TSX');

  const e=x.entryStats;
  let since='Entry comparison unavailable.';
  if(e&&Number.isFinite(e.sinceEntryReturn)){
    since=pct(e.sinceEntryReturn);
    if(Number.isFinite(e.excessVsBenchmarkPct))since+=' · '+Math.abs(e.excessVsBenchmarkPct).toFixed(1)+'pp '+(e.excessVsBenchmarkPct>=0?'ahead of':'behind')+' benchmark';
  }

  let impact='Portfolio weight unavailable.';
  if(Number.isFinite(weight)){
    impact=weight.toFixed(1)+'% of portfolio value';
    if(weight>=30)impact+=' · large influence';
    else if(weight>=15)impact+=' · meaningful influence';
  }
  return {now:now.length?now.slice(0,3).join(' · '):'No major structural change stands out.',since,impact};
}
function holdingInsights(x){
  if(!x)return {
    strength:'No reliable strength read — current market data is unavailable.',
    weakness:'No reliable weakness read — current market data is unavailable.',
    watch:'Wait for fresh market data before interpreting the chart.',
    change:'The view cannot be updated until fresh price and trend data are available.'
  };

  const strengths=[],weaknesses=[],watch=[];
  if(x.swingTrend==='Higher highs + higher lows')strengths.push('Trend structure is intact with higher highs and higher lows');
  else if(x.swingTrend==='Structure improving')strengths.push('Swing structure is improving');
  if(Number.isFinite(x.momentumShift)&&x.momentumShift>=4)strengths.push('Momentum is improving clearly');
  else if(Number.isFinite(x.momentumShift)&&x.momentumShift>=1)strengths.push('Momentum is improving');
  if(Number.isFinite(x.rs20)&&x.rs20>=8)strengths.push('Relative strength is well ahead of the TSX');
  else if(Number.isFinite(x.rs20)&&x.rs20>=3)strengths.push('Relative strength is ahead of the TSX');
  if(x.lowState==='failed_low_break')strengths.push('A recent low break was reclaimed');
  else if(x.lowState==='local_low_held')strengths.push('The recent local low is still holding');
  if(x.highBroken===true)strengths.push('A recent local high has been broken');

  if(x.swingTrend==='Lower highs + lower lows')weaknesses.push('Swing structure is still weak with lower highs and lower lows');
  else if(x.swingTrend==='Structure weakening')weaknesses.push('Swing structure is starting to weaken');
  if(Number.isFinite(x.momentumShift)&&x.momentumShift<=-4)weaknesses.push('Momentum has cooled noticeably');
  else if(Number.isFinite(x.momentumShift)&&x.momentumShift<0)weaknesses.push('Momentum is slightly softer');
  if(Number.isFinite(x.rs20)&&x.rs20<=-8)weaknesses.push('Relative strength is materially lagging the TSX');
  else if(Number.isFinite(x.rs20)&&x.rs20<=-3)weaknesses.push('Relative strength is lagging the TSX');
  if(x.lowBroken===true)weaknesses.push('The recent local low has been broken');

  if(Number.isFinite(x.rsi14)&&x.rsi14>=80)watch.push('RSI is extremely elevated, so watch for momentum loss');
  else if(Number.isFinite(x.rsi14)&&x.rsi14>=72)watch.push('RSI is elevated, so watch for momentum loss');
  if(Number.isFinite(x.localLow))watch.push('Keep the recent support area near '+money(x.localLow,x.currency||'CAD')+' on the radar');
  else if(Number.isFinite(x.support))watch.push('Keep support near '+money(x.support,x.currency||'CAD')+' on the radar');
  if(Number.isFinite(x.localHigh)&&x.highBroken!==true)watch.push('A move through the recent high near '+money(x.localHigh,x.currency||'CAD')+' would improve the structure');
  else if(Number.isFinite(x.resistance)&&x.highBroken!==true)watch.push('Watch resistance near '+money(x.resistance,x.currency||'CAD'));
  if(!x.stage)watch.push('A return to an active Hunter stage would require stronger structure or momentum');

  const currentlyWeak=
    x.lowBroken===true ||
    x.swingTrend==='Lower highs + lower lows' ||
    x.swingTrend==='Structure weakening' ||
    (Number.isFinite(x.momentumShift)&&x.momentumShift<0) ||
    (Number.isFinite(x.rs20)&&x.rs20<0);

  let change;
  if(currentlyWeak){
    const improve=[];
    const high=Number.isFinite(x.localHigh)?x.localHigh:(Number.isFinite(x.resistance)?x.resistance:null);
    if(Number.isFinite(high)&&x.highBroken!==true)improve.push('price clears the recent high near '+money(high,x.currency||'CAD'));
    improve.push('momentum turns positive');
    improve.push('20-day relative strength recovers toward or above the TSX');
    change='The read would turn more constructive if '+improve.slice(0,3).join(', and ')+'.';
  }else{
    const weaken=[];
    const low=Number.isFinite(x.localLow)?x.localLow:(Number.isFinite(x.support)?x.support:null);
    if(Number.isFinite(low))weaken.push('price breaks the recent support near '+money(low,x.currency||'CAD'));
    weaken.push('momentum turns clearly negative');
    weaken.push('relative strength falls below the TSX');
    change='The constructive read would weaken if '+weaken.slice(0,3).join(', or ')+'.';
  }

  return {
    strength:strengths[0]||'No clear positive edge is standing out yet',
    weakness:weaknesses[0]||'No material technical weakness is currently flagged',
    watch:watch[0]||'Watch for a meaningful change in structure, momentum or relative strength',
    change
  };
}
function insightRowsHtml(x){
  const r=holdingInsights(x);
  return `<div class="insight-rows">
    <div class="insight-row strength"><span>Strength</span><p>${esc(r.strength)}</p></div>
    <div class="insight-row weakness"><span>Weakness</span><p>${esc(r.weakness)}</p></div>
    <div class="insight-row watch"><span>Watch</span><p>${esc(r.watch)}</p></div>
    <div class="insight-row change"><span>View changes if</span><p>${esc(r.change)}</p></div>
  </div>`;
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
  queueCloudSync();
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
    await initializeCloudPortfolio();
    await loadCandidateLiveData();
    await loadPortfolio();
    q('#asOf').textContent=state.daily?.asOf?.latest?'Data through '+state.daily.asOf.latest:'Research dashboard';
    renderAll();
  }finally{b.classList.remove('busy');b.disabled=false}
}
function homeHtml(){
  const d=state.daily,p=state.pulse,picks=stageLeaders();
  const s=portfolioSummary();
  const changes=(d?.keyDevelopments||[]).slice(0,3).map(x=>`<div class="change-item"><span class="change-market">${esc(x.market)}</span><span>${esc(stripMarketPrefix(x.text))}</span></div>`).join('');
  const groups=(d?.groups||[]).slice(0,3).map(g=>`<div class="group-card"><small>${esc(g.label)}</small><b>${esc(g.state)}</b><p>${esc(g.detail)}</p></div>`).join('');
  const developmentByMarket=new Map((d?.keyDevelopments||[]).map(x=>[x.market,x]));
  const marketKeyByName={'TSX Composite':'TSX','S&P 500':'SP500','Nasdaq-100':'NASDAQ100','Gold':'GOLD','Silver':'SILVER','Bitcoin':'BTC','Ethereum':'ETH'};
  const markets=(p?.markets||[]).map(x=>{
    const tone=/bull|uptrend|risk-on|strength/i.test(x.regime||'')?'metric-good':/bear|downtrend|risk-off|weak/i.test(x.regime||'')?'metric-bad':'metric-flat';
    const key=x.key||marketKeyByName[x.name]||'';
    const context=developmentByMarket.get(key)?.text||'';
    return `<div class="market-row">
      <div><b>${esc(x.name)}</b><small>${esc(x.condition||'')}</small></div>
      <div class="market-value">${fmt(x.price)}</div>
      <div class="market-state ${tone}">${esc(x.regime||'Neutral')}</div>
      ${context?`<div class="market-context">${esc(stripMarketPrefix(context))}</div>`:''}
    </div>`;
  }).join('');
  const rows=picks.map((x,i)=>`<tr><td><span class="rank-dot">${i+1}</span></td><td class="symbol-cell"><b>${short(x.symbol)}</b><small>${esc(x.name||x.symbol)}</small></td><td><span class="stage-pill">${esc(x.stage)}</span></td><td>RSI ${Number.isFinite(x.rsi14)?x.rsi14.toFixed(0):'—'}</td><td><button class="btn ghost" data-chart="${x.symbol}">Chart ↗</button></td></tr>`).join('');
  const outlook=(d?.markets||[]).map(m=>{
    const h5=m?.evidence?.horizons?.['5'];
    const h20=m?.evidence?.horizons?.['20'];
    return `<article class="outlook-card">
      <div class="outlook-head"><div><b>${esc(m.name)}</b><small>${esc(m.regime||'—')} · ${esc(m.condition||'—')}</small></div><span>${esc(m.asOf||'')}</span></div>
      <div class="outlook-grid">
        <div><small>Short term (~1 week)</small><b class="${toneClass(h5?.tone||h5?.label)}">${esc(h5?.label||h5?.tone||'—')}</b><em>${esc(h5?.confidence||'')} confidence</em></div>
        <div><small>Medium term (~1 month)</small><b class="${toneClass(h20?.tone||h20?.label)}">${esc(h20?.label||h20?.tone||'—')}</b><em>${esc(h20?.confidence||'')} confidence</em></div>
      </div>
      <p>${esc(m.outlook||m.framing||'')}</p>
      ${m.watchNext?`<details><summary>What changes the view</summary><div class="outlook-watch">${esc(m.watchNext)}</div></details>`:''}
    </article>`;
  }).join('');
  const portfolioValue=s.currency?money(s.value,s.currency):s.complete.length?'Mixed currencies':'—';
  const pnl=s.currency?`${money(s.pnl,s.currency)} · ${pct(s.pnlPct)}`:'—';

  return `<div class="stack">
    <div class="grid home-hero">
      <section class="panel report-panel"><div class="panel-inner report-shell">
        <div class="report-topline">
          <div>
            <div class="eyebrow">What Changed Today</div>
            <div class="report-tone">${esc(String(d?.headline||'Daily market brief').split(':')[0])}</div>
          </div>
          <span class="report-date">${esc(d?.asOf?.latest||'')}</span>
        </div>
        <div class="change-list">${changes||'<div class="change-empty">No material market-state change flagged today.</div>'}</div>
        <div class="report-badges">
          ${(d?.groups||[]).slice(0,3).map(g=>`<span class="badge"><b>${esc(g.label)}</b> · ${esc(g.state)}</span>`).join('')}
        </div>
        <details class="report-details">
          <summary>Read full market brief</summary>
          <div class="report-title">${esc(d?.headline||'Market report unavailable')}</div>
          <div class="report-copy">${esc(d?.executiveSummary?.[0]||d?.summary||d?.headline||'')}</div>
        </details>
      </div></section>
      <section class="panel soft">
        <div class="panel-head"><div><h3>Markets</h3><p>Price · regime · condition · today’s context.</p></div></div>
        <div class="market-list">${markets||'<div class="empty">Market Pulse unavailable.</div>'}</div>
      </section>
    </div>


    <div class="grid home-lower">
      <section class="panel soft">
        <div class="panel-head"><div><h2>Charts to Review Today</h2><p>One stage leader each · open Review for every qualified chart.</p></div><button class="btn ghost" data-open="shortlist">View all</button></div>
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

    ${outlook?`<section class="panel soft outlook-panel"><div class="panel-head"><div><h3>Model Outlook</h3><p>Based on historical analogs · short vs medium-term context · no price targets.</p></div></div><div class="outlook-track">${outlook}</div></section>`:''}
  </div>`;
}
function stockCard(x,rank=''){
  const watched=state.watch.has(x.symbol),owned=state.positions.has(x.symbol);
  const why=stockNarrative(x);
  return `<article class="card">
    <div class="cardtop"><div class="name"><button class="symbol-link" data-chart="${esc(x.symbol)}" aria-label="Open ${esc(x.symbol)} chart">${short(x.symbol)} ↗</button><small>${esc(x.name||x.symbol)}</small></div><div class="cardprice">${money(x.price,'CAD')}<small class="${cls(x.ret5)}">5D ${pct(x.ret5)}</small></div></div>
    <div class="tags"><span class="tag">${rank?rank+' · ':''}${esc(x.stage)}</span><span class="tag">RSI ${Number.isFinite(x.rsi14)?x.rsi14.toFixed(0):'—'}</span></div>
    <div class="metrics"><div class="metric"><small>5D</small><b class="${cls(x.ret5)}">${pct(x.ret5)}</b></div><div class="metric"><small>20D</small><b class="${cls(x.ret20)}">${pct(x.ret20)}</b></div><div class="metric"><small>RS20</small><b class="${cls(x.rs20)}">${pct(x.rs20)}</b></div><div class="metric"><small>Momentum</small><b class="${cls(x.momentumShift)}">${Number.isFinite(x.momentumShift)?x.momentumShift.toFixed(1)+'pp':'—'}</b></div></div>
    <div class="why analysis-copy">${esc(why)}</div>
    <details><summary>Technical details</summary><div class="copy"><strong>Why it qualified</strong><br>${esc((x.evidence||[]).join(' · ')||'Stage-specific review criteria passed.')}<br><br><strong>Positioning</strong><br>Pullback from 60-day high ${pct(x.pullback60)} · ATR ${pct(x.atr14Pct)} · vs MA20 ${pct(x.dist20)} · vs MA50 ${pct(x.dist50)}${(x.riskFlags||[]).length?'<br><br><strong>Risk context</strong><br>'+esc(x.riskFlags.join(' · ')):''}</div></details>
    <div class="actions"><button class="btn" data-chart="${x.symbol}">Chart ↗</button><button class="btn" data-watch="${x.symbol}" aria-pressed="${watched}">${watched?'♥ Saved':'♡ Watch'}</button><button class="btn ${owned?'':'primary'}" data-buy="${x.symbol}">${owned?'Edit':'Bought'}</button></div>
  </article>`;
}
function shortlistHtml(){
  const stage=REVIEW_STAGES.includes(state.reviewStage)?state.reviewStage:REVIEW_STAGES[0];
  const counts=Object.fromEntries(REVIEW_STAGES.map(s=>[s,stageEligiblePicks(s).length]));
  const picks=stageEligiblePicks(stage);
  const tabs=REVIEW_STAGES.map(s=>`<button class="stage-tab ${s===stage?'active':''}" data-stage-tab="${esc(s)}" aria-pressed="${s===stage}"><span>${esc(s)}</span><b>${counts[s]}</b></button>`).join('');
  return `<div class="stack"><section class="panel soft">
    <div class="sectionhead"><div><h2>Charts to Review</h2><p>Explore qualified charts by stage.</p></div><span class="tag">${Object.values(counts).reduce((x,y)=>x+y,0)} qualified</span></div>
    <div class="stage-tabs">${tabs}</div>
    <div class="stage-summary"><b>${esc(stage)}</b><span>${picks.length} chart${picks.length===1?'':'s'} meet the criteria for this stage.</span></div>
    <div class="cards">${picks.length?picks.map((x,i)=>stockCard(x,i+1)).join(''):'<div class="empty">No charts meet the criteria for this stage.</div>'}</div>
  </section></div>`;
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
  let breadth=null,top1=null,top3=null;
  if(single&&Number.isFinite(value)&&value>0){
    const weighted=complete.map(({p,x})=>{
      const positionValue=Number(p.quantity)*x.price;
      return {symbol:p.symbol,value:positionValue,weight:positionValue/value*100,tone:health(x).tone};
    }).sort((a,b)=>b.value-a.value);
    const healthy=weighted.filter(x=>x.tone==='good').reduce((sum,x)=>sum+x.weight,0);
    const cooling=weighted.filter(x=>x.tone==='watch').reduce((sum,x)=>sum+x.weight,0);
    const warning=weighted.filter(x=>x.tone==='warn').reduce((sum,x)=>sum+x.weight,0);
    breadth={healthy,cooling,warning,attention:cooling+warning};
    top1=weighted[0]||null;
    top3=weighted.slice(0,3).reduce((sum,x)=>sum+x.weight,0);
  }
  return {rows,complete,currency,value,cost,pnl,pnlPct,attention,changed,breadth,top1,top3};
}
function portfolioReadHtml(s){
  if(!s.rows.length)return '';
  const a=state.analytics;
  const breadth=s.breadth;
  const healthCopy=breadth
    ?`${breadth.healthy.toFixed(0)}% of portfolio value is structurally healthy, ${breadth.cooling.toFixed(0)}% is cooling or needs watching, and ${breadth.warning.toFixed(0)}% carries a structural warning.`
    :'Weighted health is unavailable until holdings can be combined in one currency.';
  const concentration=s.top1
    ?`Largest holding: ${short(s.top1.symbol)} at ${s.top1.weight.toFixed(1)}%. Top three holdings account for ${s.top3.toFixed(1)}%.`
    :'Concentration cannot be combined safely for the current holdings.';
  let performance='Recent portfolio-vs-TSX comparison is not available yet.';
  if(a&&Number.isFinite(a.portfolioReturnPct)&&Number.isFinite(a.benchmarkReturnPct)){
    const excess=Number.isFinite(a.excessReturnPct)?` (${Math.abs(a.excessReturnPct).toFixed(1)}pp ${a.excessReturnPct>=0?'ahead':'behind'})`:'';
    performance=`Over the last ${a.windowSessions||'recent'} common sessions, the portfolio returned ${pct(a.portfolioReturnPct)} versus ${pct(a.benchmarkReturnPct)} for the TSX${excess}.`;
  }
  let risk='Detailed risk metrics need more common history.';
  if(a&&Number.isFinite(a.betaVsTsx)){
    risk=a.betaVsTsx>=1.2
      ?`Recent sensitivity to TSX moves has been higher than the index (beta ${a.betaVsTsx.toFixed(2)}).`
      :a.betaVsTsx<=0.8
        ?`Recent sensitivity to TSX moves has been lower than the index (beta ${a.betaVsTsx.toFixed(2)}).`
        :`Recent sensitivity to TSX moves has been close to the index (beta ${a.betaVsTsx.toFixed(2)}).`;
  }
  const topRisk=a?.topRiskContributor;
  let diversification=a?.diversificationRead||'Diversification analytics need more common history.';
  if(topRisk&&Number.isFinite(topRisk.riskContributionPct))diversification+=`; ${short(topRisk.symbol)} is currently the largest modeled risk contributor at ${topRisk.riskContributionPct.toFixed(1)}% of portfolio variance`;
  if(!diversification.endsWith('.'))diversification+='.';
  return `<section class="panel soft portfolio-read-panel">
    <div class="sectionhead"><div><h3>Portfolio Read</h3><p>Whole-portfolio context, weighted by what you actually own.</p></div></div>
    ${breadth?`<div class="health-breadth">
      <div class="health-segments"><span class="healthy" style="width:${Math.max(0,breadth.healthy)}%"></span><span class="cooling" style="width:${Math.max(0,breadth.cooling)}%"></span><span class="warning" style="width:${Math.max(0,breadth.warning)}%"></span></div>
      <div class="health-legend"><span><i class="healthy"></i>Healthy <b>${breadth.healthy.toFixed(0)}%</b></span><span><i class="cooling"></i>Cooling / Watch <b>${breadth.cooling.toFixed(0)}%</b></span><span><i class="warning"></i>Warning <b>${breadth.warning.toFixed(0)}%</b></span></div>
    </div>`:''}
    <div class="portfolio-read-copy">
      <p><strong>Health</strong> ${esc(healthCopy)}</p>
      <p><strong>Concentration</strong> ${esc(concentration)}</p>
      <p><strong>Recent performance</strong> ${esc(performance)}</p>
      <p><strong>Risk</strong> ${esc(risk)}</p>
      <p><strong>Diversification</strong> ${esc(diversification)}</p>
    </div>
  </section>`;
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
  const volValue=Number.isFinite(a.annualizedVolPct)?pct(a.annualizedVolPct):'—';
  const betaValue=Number.isFinite(a.betaVsTsx)?a.betaVsTsx.toFixed(2):'—';
  const drawdownValue=Number.isFinite(a.maxDrawdownPct)?pct(a.maxDrawdownPct):'—';
  const corrValue=Number.isFinite(a.avgPairwiseCorrelation)?a.avgPairwiseCorrelation.toFixed(2):'—';

  const volRead=!Number.isFinite(a.volatilityRatio)?'Needs more history'
    :a.volatilityRatio>=1.25?'More volatile than TSX recently'
    :a.volatilityRatio<=0.8?'Less volatile than TSX recently'
    :'Similar volatility to TSX';
  const betaRead=!Number.isFinite(a.betaVsTsx)?'Needs more history'
    :a.betaVsTsx>=1.2?'Higher market sensitivity'
    :a.betaVsTsx<=0.8?'Lower market sensitivity'
    :'Market sensitivity near TSX';
  const drawdownRead=!Number.isFinite(a.maxDrawdownPct)?'Needs more history'
    :Math.abs(a.maxDrawdownPct)>=15?'A deeper recent peak-to-trough decline'
    :Math.abs(a.maxDrawdownPct)>=8?'A moderate recent peak-to-trough decline'
    :'A relatively contained recent peak-to-trough decline';
  const corrRead=!Number.isFinite(a.avgPairwiseCorrelation)?'Needs more pair history'
    :a.avgPairwiseCorrelation>=0.75?'Holdings moved very similarly'
    :a.avgPairwiseCorrelation>=0.5?'Fairly high co-movement'
    :a.avgPairwiseCorrelation>=0.25?'Moderate co-movement'
    :'Low average co-movement';

  const cards=[
    {
      label:'Volatility',value:volValue,read:volRead,
      info:'Annualized volatility estimates how widely daily portfolio returns have varied recently. It does not mean the portfolio is expected to gain or lose this percentage in a year.'
    },
    {
      label:'Beta vs TSX',value:betaValue,read:betaRead,
      info:'Beta measures how sensitive the portfolio has been to TSX moves in the recent sample. A beta of 1 means similar sensitivity; above 1 means larger moves on average. It is historical, not a forecast.'
    },
    {
      label:'Max drawdown',value:drawdownValue,read:drawdownRead,
      info:'Max drawdown is the largest fall from a portfolio peak to a later trough inside the recent analysis window. It describes what happened, not the worst loss that could happen in the future.'
    },
    {
      label:'Avg correlation',value:corrValue,read:corrRead,
      info:'Average correlation summarizes how similarly the holdings moved. Near 1 means they moved together more often; near 0 means their day-to-day movements were less related.'
    }
  ];
  const metricCards=cards.map((m,i)=>`<article class="risk-card">
    <div class="risk-card-top"><span>${esc(m.label)}</span><details class="risk-info"><summary aria-label="About ${esc(m.label)}">i</summary><div class="risk-popover">${esc(m.info)}</div></details></div>
    <strong>${m.value}</strong>
    <small>${esc(m.read)}</small>
  </article>`).join('');

  const stress=(a.stressLens||[]).find(x=>x.marketShockPct===-5);
  const stressHtml=stress&&Number.isFinite(stress.estimatedPortfolioMovePct)
    ?`<div class="risk-lens"><div><span>Stress lens</span><b>TSX -5% → Portfolio ~${stress.estimatedPortfolioMovePct.toFixed(1)}%</b></div><small>Simple beta-based sensitivity check — not a forecast.</small></div>`
    :'';
  const top=a.topRiskContributor;
  const topRiskHtml=top&&Number.isFinite(top.riskContributionPct)
    ?`<div class="risk-lens"><div><span>Largest modeled risk contributor</span><b>${short(top.symbol)} · ${top.riskContributionPct.toFixed(1)}% of variance</b></div><small>${Number.isFinite(top.weightPct)?top.weightPct.toFixed(1)+'% of portfolio value · ':''}Risk contribution reflects weight, volatility and co-movement with the rest of the portfolio.</small></div>`
    :'';

  return `<section class="panel soft risk-snapshot">
    <div class="sectionhead"><div><h3>Risk snapshot</h3><p>Recent ${a.windowSessions||'common'}-session behavior · historical, not a forecast.</p></div></div>
    <div class="risk-grid">${metricCards}</div>
    <div class="risk-lenses">${stressHtml}${topRiskHtml}</div>
    ${a.diversificationRead?`<div class="risk-footer"><strong>Diversification</strong><span>${esc(a.diversificationRead)}</span></div>`:''}
    ${a.note?`<details class="risk-method"><summary>Method & coverage</summary><div class="copy">${esc(a.note)}</div></details>`:''}
  </section>`;
}
function positionCard(p,x,total){
  const h=health(x),qty=Number(p.quantity)||0,value=x&&qty>0?qty*x.price:null,ret=x&&Number(p.entryPrice)>0?(x.price/Number(p.entryPrice)-1)*100:null;
  const weight=Number.isFinite(total)&&Number.isFinite(value)&&total>0?value/total*100:null,e=x?.entryStats;
  const read=positionNarrative(p,x,weight);
  return `<article class="card">
    <div class="cardtop"><div class="name"><b>${short(p.symbol)}</b><small>${esc(x?.name||p.symbol)}</small></div><span class="health ${h.tone}">${h.label}</span></div>
    <div class="tags"><span class="tag">${p.source==='market-hunter'?'Market Hunter':'Manual / External'}</span><span class="tag">${qty||'—'} shares</span></div>
    <div class="metrics"><div class="metric"><small>Value</small><b>${x?money(value,x.currency):'—'}</b></div><div class="metric"><small>Weight</small><b>${Number.isFinite(weight)?weight.toFixed(1)+'%':'—'}</b></div><div class="metric"><small>Since entry</small><b class="${cls(ret)}">${pct(ret)}</b></div><div class="metric"><small>RSI</small><b>${Number.isFinite(x?.rsi14)?x.rsi14.toFixed(0):'—'}</b></div></div>
    ${insightRowsHtml(x)}
    <details><summary>Position details</summary><div class="copy">${(()=>{const q=positionQuickRead(p,x,weight);return '<div class="quick-read-rows"><div><span>Now</span><b>'+esc(q.now)+'</b></div><div><span>Since entry</span><b>'+esc(q.since)+'</b></div><div><span>Portfolio impact</span><b>'+esc(q.impact)+'</b></div></div>';})()}<strong>Your entry</strong><br>Purchased ${esc(p.boughtAt||'—')} · Avg cost ${x?money(p.entryPrice,x.currency):fmt(p.entryPrice)} · Source ${p.source==='market-hunter'?'Market Hunter':'Manual / External'}<br><br><strong>Current chart</strong><br>Entry stage ${esc(p.entryStage||'Not captured')} · Current stage ${esc(x?.stage||'Outside active stages')} · RS vs benchmark ${pct(x?.rs20)} · Momentum shift ${Number.isFinite(x?.momentumShift)?x.momentumShift.toFixed(1)+'pp':'—'}${e?'<br><br><strong>Since entry details</strong><br>Best move '+pct(e.maxGainPct)+' · Max drawdown '+pct(e.maxDrawdownPct)+' · Benchmark '+pct(e.benchmarkReturnPct)+' · Excess '+pct(e.excessVsBenchmarkPct):''}${p.notes?'<br><br><strong>Your note</strong><br>'+esc(p.notes):''}</div></details>
    <div class="actions"><button class="btn" data-chart="${p.symbol}">Chart ↗</button><button class="btn" data-edit="${p.symbol}">Edit</button><button class="btn danger" data-remove="${p.symbol}">Remove</button></div>
  </article>`;
}
function exportBackup(){
  const payload={
    kind:'market-hunter-backup',
    version:1,
    exportedAt:new Date().toISOString(),
    positions:[...state.positions.values()],
    watchlist:[...state.watch],
    portfolioDaily:(()=>{try{return JSON.parse(localStorage.getItem('marketHunterPortfolioDaily')||'null')}catch{return null}})()
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='market-hunter-backup-'+today()+'.json';
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  toast('Backup exported');
}
async function importBackupFile(file){
  if(!file)return;
  let data;
  try{data=JSON.parse(await file.text())}catch{toast('Invalid backup file');return}
  if(data?.kind!=='market-hunter-backup'||!Array.isArray(data.positions)||!Array.isArray(data.watchlist)){
    toast('Backup format not recognized');return;
  }
  const valid=data.positions.filter(p=>p&&typeof p.symbol==='string'&&Number(p.quantity)>0&&Number(p.entryPrice)>0);
  if(!confirm('Restore '+valid.length+' position(s) and '+data.watchlist.length+' watchlist item(s)? Current local data will be replaced.'))return;
  state.positions=new Map(valid.map(p=>[p.symbol,p]));
  state.watch=new Set(data.watchlist.filter(Boolean));
  savePositions();saveWatch();
  if(data.portfolioDaily)localStorage.setItem('marketHunterPortfolioDaily',JSON.stringify(data.portfolioDaily));
  else localStorage.removeItem('marketHunterPortfolioDaily');
  await loadPortfolio();renderAll();setView('portfolio');toast('Backup restored');
}
function portfolioHtml(){
  const s=portfolioSummary();
  const changeBlock=s.changed.length?`<section class="panel soft"><div class="sectionhead"><div><h3>What changed today</h3><p>Versus prior saved market-day snapshot.</p></div></div><div class="devs">${s.changed.map(x=>`<div class="dev"><b>${short(x.symbol)}</b><span>${esc(x.reasons.join(' · '))}</span></div>`).join('')}</div></section>`:'';
  const attentionBlock=s.attention.length?`<section class="panel soft attention-panel"><div class="sectionhead"><div><h3>Current attention</h3><p>Strength, weakness, what to watch, and what would change the current read.</p></div></div><div class="attention-cards">${s.attention.map(({p,x})=>`<article class="attention-card"><div class="attention-head"><b>${short(p.symbol)}</b><span class="health ${health(x).tone}">${esc(health(x).label)}</span></div>${insightRowsHtml(x)}<button class="btn ghost" data-chart="${p.symbol}">Chart ↗</button></article>`).join('')}</div></section>`:'';
  return `<div class="stack">
    <section class="panel"><div class="sectionhead"><div><h2>Portfolio Monitor</h2><p>What you actually own — Hunter or external.</p></div><div class="section-actions"><button class="btn" data-backup>Backup</button><button class="btn" data-restore>Restore</button><button class="btn primary" data-add>+ Add</button></div></div>
      <div class="summarygrid"><div class="sum"><small>Value</small><b>${s.currency?money(s.value,s.currency):s.complete.length?'Mixed currencies':'—'}</b></div><div class="sum"><small>Cost basis</small><b>${s.currency?money(s.cost,s.currency):'—'}</b></div><div class="sum"><small>Total P/L</small><b class="${cls(s.pnl)}">${s.currency?money(s.pnl,s.currency)+' · '+pct(s.pnlPct):'—'}</b></div><div class="sum"><small>Holdings</small><b>${s.rows.length}</b></div><div class="sum"><small>Attention weight</small><b>${s.breadth?s.breadth.attention.toFixed(0)+'%':'—'}</b></div></div>
      <div class="read">${s.breadth?s.breadth.attention.toFixed(0)+'% of portfolio value is currently in cooling/watch or warning conditions.':(s.attention.length?s.attention.length+' holding(s) deserve closer review.':'No material structural warning across covered holdings.')}</div>
    </section>
    ${portfolioReadHtml(s)}${changeBlock}${attentionBlock}${allocationHtml(s)}${riskHtml()}
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
  qa('.navbtn').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
  const titles={home:'Home',shortlist:'Charts to Review',portfolio:'Portfolio Monitor',watchlist:'Watchlist'};
  const title=q('#pageTitle');if(title)title.textContent=titles[view]||'Market Hunter';
  renderView(view);window.scrollTo({top:0,behavior:'smooth'});
}
let modalTrigger=null;
function closeModal(){
  q('#positionModal').classList.remove('open');q('#positionModal').setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open');
  qa('.app-shell,.mobile-nav').forEach(el=>el.inert=false);
  if(modalTrigger?.isConnected)modalTrigger.focus();
}
document.addEventListener('keydown',e=>{
  const modal=q('#positionModal');if(!modal.classList.contains('open'))return;
  if(e.key==='Escape'){e.preventDefault();closeModal();return}
  if(e.key!=='Tab')return;
  const focusable=[...modal.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);
  const first=focusable[0],last=focusable[focusable.length-1];
  if(e.shiftKey&&(document.activeElement===first||document.activeElement===modal.querySelector('.sheet'))){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
});
function openPosition(symbol='',source='manual'){
  const modal=q('#positionModal'),sym=normalizeSymbol(symbol),old=state.positions.get(sym),x=candidate(sym)||state.portfolioItems.get(sym),p=old||{},src=p.source||source;
  const entry=Number(p.entryPrice)>0?p.entryPrice:(src==='market-hunter'&&x?.price?x.price:'');
  modalTrigger=document.activeElement;
  modal.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="positionTitle" tabindex="-1"><div class="sheethead"><div><h2 id="positionTitle">${old?'Edit position':'Add position'}</h2><p>Use the real purchase details.</p></div><button class="close" aria-label="Close position form" data-close>×</button></div>
    <form class="form" id="positionForm">
      <div class="field"><label for="position-symbol">Symbol</label><input id="position-symbol" name="symbol" required value="${esc(p.symbol||sym)}" ${old?'readonly':''} placeholder="RY.TO"></div>
      <div class="field"><label for="position-source">Source</label><select id="position-source" name="source"><option value="market-hunter" ${src==='market-hunter'?'selected':''}>Market Hunter</option><option value="manual" ${src!=='market-hunter'?'selected':''}>Manual / External</option></select></div>
      <div class="field"><label for="position-quantity">Quantity</label><input id="position-quantity" name="quantity" type="number" step="any" min=".000001" required value="${Number(p.quantity)>0?p.quantity:''}"></div>
      <div class="field"><label for="position-entryPrice">Average purchase price</label><input id="position-entryPrice" name="entryPrice" type="number" step="any" min=".000001" required value="${entry}"></div>
      <div class="field"><label for="position-boughtAt">Purchase date</label><input id="position-boughtAt" name="boughtAt" type="date" required value="${String(p.boughtAt||today()).slice(0,10)}"></div>
      <div class="field full"><label for="position-notes">Entry note (optional)</label><textarea id="position-notes" name="notes">${esc(p.notes||'')}</textarea></div>
      <div class="formactions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div>
    </form></div>`;
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');qa('.app-shell,.mobile-nav').forEach(el=>el.inert=true);
  modal.querySelector('.sheet').focus();
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
function closeRiskInfo(except=null){
  qa('.risk-info[open]').forEach(d=>{if(d!==except)d.open=false});
}
document.addEventListener('click',async e=>{
  const riskInfo=e.target.closest('.risk-info');
  if(riskInfo){
    if(e.target.closest('summary')){
      setTimeout(()=>{
        if(riskInfo.open)closeRiskInfo(riskInfo);
      },0);
    }
  }else{
    closeRiskInfo();
  }
  const nav=e.target.closest('[data-view]');if(nav){setView(nav.dataset.view);return}
  const stageTab=e.target.closest('[data-stage-tab]');if(stageTab){state.reviewStage=stageTab.dataset.stageTab;renderView('shortlist');qa('[data-stage-tab]').find(el=>el.dataset.stageTab===state.reviewStage)?.focus({preventScroll:true});return}
  const open=e.target.closest('[data-open]');if(open){setView(open.dataset.open);return}
  const chart=e.target.closest('[data-chart]');if(chart){openChart(chart.dataset.chart);return}
  const watch=e.target.closest('[data-watch]');if(watch){const s=watch.dataset.watch;state.watch.has(s)?state.watch.delete(s):state.watch.add(s);saveWatch();renderAll();toast(state.watch.has(s)?'Saved':'Removed');return}
  const buy=e.target.closest('[data-buy]');if(buy){openPosition(buy.dataset.buy,'market-hunter');return}
  if(e.target.closest('[data-backup]')){exportBackup();return}
  if(e.target.closest('[data-restore]')){q('#backupFile')?.click();return}
  if(e.target.closest('[data-add]')){openPosition('','manual');return}
  const edit=e.target.closest('[data-edit]');if(edit){openPosition(edit.dataset.edit,state.positions.get(edit.dataset.edit)?.source||'manual');return}
  const remove=e.target.closest('[data-remove]');if(remove&&confirm('Remove '+remove.dataset.remove+' from Portfolio Monitor?')){state.positions.delete(remove.dataset.remove);savePositions();await loadPortfolio();renderAll();toast('Removed');return}
  if(e.target.closest('[data-close]')||e.target===q('#positionModal'))closeModal();
});
q('#themeBtn')?.addEventListener('click',()=>{
  const current=document.documentElement.dataset.theme||'dark';
  applyTheme(current==='dark'?'light':'dark');
});
applyTheme(document.documentElement.dataset.theme||'dark');
q('#refreshBtn').addEventListener('click',load);
q('#backupFile')?.addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';
  await importBackupFile(file);
});
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));
}
window.addEventListener('scroll',()=>closeRiskInfo(),{passive:true});
load();

