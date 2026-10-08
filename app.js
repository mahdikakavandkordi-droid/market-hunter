const ui=(en,fa)=>window.MHI18n?.t(en,fa)||en;
const swipeTools=(id,count)=>count>1?`<div class="swipe-tools"><span>${ui('Swipe to browse','برای دیدن بقیه ورق بزن')} ↔ <bdi>${count}</bdi></span><div><button type="button" data-swipe="${id}" data-step="-1" aria-label="${ui('Previous card','کارت قبلی')}">←</button><button type="button" data-swipe="${id}" data-step="1" aria-label="${ui('Next card','کارت بعدی')}">→</button></div></div>`:'';
const stageLabel=s=>window.MHI18n?.stageLabel(s)||s;
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const pendingRailTargets=new WeakMap();
function stepRail(rail,step){
  const base=pendingRailTargets.get(rail)??rail.scrollLeft;
  const target=Math.max(0,Math.min(rail.scrollWidth-rail.clientWidth,base+step*rail.clientWidth*.9));
  pendingRailTargets.set(rail,target);
  rail.addEventListener('scrollend',()=>pendingRailTargets.delete(rail),{once:true});
  rail.scrollTo({left:target,behavior:'smooth'});
}
const numeric=n=>n!==null&&n!==undefined&&!(typeof n==='string'&&n.trim()==='')&&Number.isFinite(Number(n));
const fmt=n=>numeric(n)?Number(n).toLocaleString(undefined,{maximumFractionDigits:2}):'—';
const pct=n=>numeric(n)?((Number(n)>0?'+':'')+Number(n).toFixed(1)+'%'):'—';
const cls=n=>numeric(n)?(Number(n)>0?'up':Number(n)<0?'down':'flat'):'flat';
const short=s=>String(s||'').replace(/\.(TO|NE|V)$/,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=(n,c='CAD')=>numeric(n)?new Intl.NumberFormat(undefined,{style:'currency',currency:c||'CAD',maximumFractionDigits:2}).format(Number(n)):'—';
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};

const CLOUD_SESSION_KEY='marketHunterCloudSessionV1';
const SUPABASE_URL='https://ivmpzyjxyfcefjyylybr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_yy1QKQRcgf2ny3aWhhHSkw_Z7Y0Fa55';
const LOCAL_STATE_PREFIX='marketHunterPortfolioV3:';
const LOCAL_DAILY_PREFIX='marketHunterPortfolioDailyV3:';
const LEGACY_POSITIONS_KEY='marketHunterPositions';
const LEGACY_WATCH_KEY='marketHunterWatchlist';
const LEGACY_DAILY_KEY='marketHunterPortfolioDaily';
const LEGACY_GUEST_MIGRATION_KEY='marketHunterLegacyGuestMigrationV3';
const TELEGRAM_BRIDGE_MARKER='marketHunterTelegramBridgeV1';
const MARKET_PULSE_INTRADAY_SYMBOLS=Object.freeze({TSX:'^GSPTSE',SP500:'^GSPC',NASDAQ100:'^NDX',GOLD:'GC=F',SILVER:'SI=F',BTC:'BTC-USD',ETH:'ETH-USD'});
let cloudSyncTimer=0,telegramBridgeTimer=0,telegramBridgeRevision=null,telegramBridgeUpdatedAt=null,authAttempt=0,portfolioLoadSequence=0;
const cloudSyncBusyEpochs=new Set(),cloudSyncQueuedEpochs=new Set();

function loadCloudSession(){try{return JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY)||'null')}catch{return null}}
function saveCloudSessionRaw(session){
  if(session)localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(session));
  else localStorage.removeItem(CLOUD_SESSION_KEY);
  state.cloud.session=session||null;
}
function saveCloudSession(session){
  if(session)return activateSession(session);
  const ctx=captureSessionContext();clearActiveSession(ctx);return captureSessionContext();
}
function sessionUserId(session){return session?.user?.id||null}
function scopeId(session){return sessionUserId(session)?'user:'+sessionUserId(session):'guest'}
function stateStorageKey(session){return LOCAL_STATE_PREFIX+scopeId(session)}
function dailyStorageKey(session){return LOCAL_DAILY_PREFIX+scopeId(session)}
function contextSession(ctx){return ctx?.userId?{user:{id:ctx.userId}}:null}
function captureSessionContext(){return {epoch:state.cloud.epoch,userId:sessionUserId(state.cloud.session)}}
function contextActive(ctx){return Boolean(ctx)&&ctx.epoch===state.cloud.epoch&&ctx.userId===sessionUserId(state.cloud.session)}
function staleSessionError(){const e=new Error('stale_session_operation');e.code='STALE_SESSION_OPERATION';return e}
function assertSessionContext(ctx){if(!contextActive(ctx))throw staleSessionError()}
function advanceSessionEpoch(){
  state.cloud.epoch=(state.cloud.epoch||0)+1;
  clearTimeout(cloudSyncTimer);cloudSyncTimer=0;
  cloudSyncQueuedEpochs.clear();
  return state.cloud.epoch;
}
function emptyEnvelope(){return {version:3,positions:{},watchlist:{}}}
function isoOr(value,fallback){
  const t=Date.parse(value||'');
  return Number.isFinite(t)?new Date(t).toISOString():fallback;
}
function normalizeEnvelope(raw,fallbackIso='1970-01-01T00:00:00.000Z'){
  const out=emptyEnvelope(),src=raw&&typeof raw==='object'?raw:{};
  const positionEntries=Array.isArray(src.positions)
    ?src.positions.map(p=>[p?.symbol,p])
    :Object.entries(src.positions||{});
  for(const [key,value] of positionEntries){
    const symbol=String(key||value?.symbol||'').trim().toUpperCase();if(!symbol)continue;
    if(value&&typeof value==='object'&&('deleted' in value||'value' in value)){
      const updatedAt=isoOr(value.updatedAt,value?.value?.updatedAt||fallbackIso);
      out.positions[symbol]={value:value.deleted?null:{...(value.value||{}),symbol},deleted:Boolean(value.deleted),updatedAt};
    }else if(value&&typeof value==='object'){
      const updatedAt=isoOr(value.updatedAt||value.createdAt,fallbackIso);
      out.positions[symbol]={value:{...value,symbol},deleted:false,updatedAt};
    }
  }
  if(Array.isArray(src.positionTombstones)){
    for(const x of src.positionTombstones){const symbol=String(x?.symbol||'').toUpperCase();if(symbol)out.positions[symbol]={value:null,deleted:true,updatedAt:isoOr(x?.deletedAt,fallbackIso)}}
  }else if(src.positionTombstones&&typeof src.positionTombstones==='object'){
    for(const [symbol,deletedAt] of Object.entries(src.positionTombstones))out.positions[String(symbol).toUpperCase()]={value:null,deleted:true,updatedAt:isoOr(deletedAt,fallbackIso)};
  }
  if(src.watchlist&&typeof src.watchlist==='object'&&!Array.isArray(src.watchlist)){
    for(const [symbol,value] of Object.entries(src.watchlist)){
      if(value&&typeof value==='object'&&('present' in value||'updatedAt' in value)){
        out.watchlist[String(symbol).toUpperCase()]={present:Boolean(value.present),updatedAt:isoOr(value.updatedAt,fallbackIso)};
      }else if(value){
        out.watchlist[String(symbol).toUpperCase()]={present:true,updatedAt:fallbackIso};
      }
    }
  }else{
    for(const symbol of Array.isArray(src.watchlist)?src.watchlist:[])if(symbol)out.watchlist[String(symbol).toUpperCase()]={present:true,updatedAt:fallbackIso};
  }
  if(src.watchlistRecords&&typeof src.watchlistRecords==='object'){
    for(const [symbol,value] of Object.entries(src.watchlistRecords||{})){
      out.watchlist[String(symbol).toUpperCase()]={present:Boolean(value?.present),updatedAt:isoOr(value?.updatedAt,fallbackIso)};
    }
  }
  return out;
}
function chooseRecord(a,b,deleteKey='deleted'){
  if(!a)return b;if(!b)return a;
  const at=Date.parse(a.updatedAt||0)||0,bt=Date.parse(b.updatedAt||0)||0;
  if(at!==bt)return at>bt?a:b;
  const ad=deleteKey==='present'?!a.present:Boolean(a.deleted),bd=deleteKey==='present'?!b.present:Boolean(b.deleted);
  if(ad!==bd)return ad?a:b;
  return JSON.stringify(a)>=JSON.stringify(b)?a:b;
}
function mergeEnvelopes(local,remote){
  const a=normalizeEnvelope(local),b=normalizeEnvelope(remote),out=emptyEnvelope();
  for(const symbol of new Set([...Object.keys(a.positions),...Object.keys(b.positions)]))out.positions[symbol]=chooseRecord(a.positions[symbol],b.positions[symbol],'deleted');
  for(const symbol of new Set([...Object.keys(a.watchlist),...Object.keys(b.watchlist)]))out.watchlist[symbol]=chooseRecord(a.watchlist[symbol],b.watchlist[symbol],'present');
  return out;
}
function visiblePositions(env){
  return new Map(Object.entries(normalizeEnvelope(env).positions).filter(([,r])=>!r.deleted&&r.value?.symbol).map(([symbol,r])=>[symbol,r.value]));
}
function visibleWatch(env){
  return new Set(Object.entries(normalizeEnvelope(env).watchlist).filter(([,r])=>r.present).map(([symbol])=>symbol));
}
function hasVisibleData(env){return visiblePositions(env).size>0||visibleWatch(env).size>0}
function readEnvelopeFor(session){
  try{return normalizeEnvelope(JSON.parse(localStorage.getItem(stateStorageKey(session))||'null'))}catch{return emptyEnvelope()}
}
function readDailyFor(session){
  try{return JSON.parse(localStorage.getItem(dailyStorageKey(session))||'null')}catch{return null}
}
function ensureLegacyGuestMigration(){
  if(localStorage.getItem(LEGACY_GUEST_MIGRATION_KEY))return;
  const migratedAt=new Date().toISOString();
  let positions=[],watchlist=[],daily=null;
  try{positions=JSON.parse(localStorage.getItem(LEGACY_POSITIONS_KEY)||'[]')}catch{}
  try{watchlist=JSON.parse(localStorage.getItem(LEGACY_WATCH_KEY)||'[]')}catch{}
  try{daily=JSON.parse(localStorage.getItem(LEGACY_DAILY_KEY)||'null')}catch{}
  const guest=normalizeEnvelope({positions:Array.isArray(positions)?positions:[],watchlist:Array.isArray(watchlist)?watchlist:[]},migratedAt);
  localStorage.setItem(stateStorageKey(null),JSON.stringify(guest));
  if(daily)localStorage.setItem(dailyStorageKey(null),JSON.stringify(daily));
  localStorage.setItem(LEGACY_GUEST_MIGRATION_KEY,migratedAt);
}
function inferredComplete(daily){return Boolean(daily?.currentDate&&Array.isArray(daily?.currentItems)&&daily.currentComplete!==false)}
function previousMapFromDaily(daily){return new Map((daily?.previousItems||[]).map(x=>[x.symbol,x]))}

ensureLegacyGuestMigration();
const initialSession=loadCloudSession();
const initialEnvelope=readEnvelopeFor(initialSession);
const initialDaily=readDailyFor(initialSession);
const state={
  engines:null,engineSelection:{engine:'all',cohort:'tsx-core',mode:'open',loading:false,error:false},
  view:'home',reviewStage:'Early Watch',daily:null,pulse:null,v2:null,hunterMonitor:null,fundamentals:null,
  envelope:initialEnvelope,watch:visibleWatch(initialEnvelope),positions:visiblePositions(initialEnvelope),
  portfolioItems:new Map(),liveItems:new Map(),intraday:null,intradayStatus:'loading',analytics:null,previous:previousMapFromDaily(initialDaily),
  cloud:{session:initialSession,epoch:1,status:'local',message:'',showAuth:false,ready:false,reconciled:false,revision:0}
};

function persistEnvelopeFor(session,envelope=state.envelope){
  localStorage.setItem(stateStorageKey(session),JSON.stringify(envelope));
  if(!session){
    const positions=visiblePositions(envelope),watch=visibleWatch(envelope);
    localStorage.setItem(LEGACY_POSITIONS_KEY,JSON.stringify([...positions.values()]));
    localStorage.setItem(LEGACY_WATCH_KEY,JSON.stringify([...watch]));
  }
}
function persistEnvelope(){persistEnvelopeFor(state.cloud.session,state.envelope);queueTelegramBridgeSync()}
function hydrateEnvelope(){
  state.positions=visiblePositions(state.envelope);
  state.watch=visibleWatch(state.envelope);
}

function telegramBridgeParams(){
  try{
    const qs=new URLSearchParams(location.search);
    return {
      requested:qs.get('portfolioBridge')==='1',
      userId:String(qs.get('user_id')||''),
      sig:String(qs.get('sig')||'')
    };
  }catch{return {requested:false,userId:'',sig:''}}
}
function telegramBridgeRequested(){return telegramBridgeParams().requested}
function telegramBridgeEnabled(){
  try{return localStorage.getItem(TELEGRAM_BRIDGE_MARKER)==='connected'}catch{return false}
}
function setTelegramBridgeEnabled(enabled){
  try{
    if(enabled)localStorage.setItem(TELEGRAM_BRIDGE_MARKER,'connected');
    else localStorage.removeItem(TELEGRAM_BRIDGE_MARKER);
  }catch{}
}
function mergeBackendDaily(local,remote){
  if(!local)return remote||null;
  if(!remote)return local;
  const ld=String(local.currentDate||''),rd=String(remote.currentDate||'');
  if(rd>ld)return remote;
  if(ld>rd)return local;
  return local;
}
function applyTelegramBackendBundle(data){
  const remotePayload=data?.payload&&typeof data.payload==='object'?normalizeEnvelope(data.payload):emptyEnvelope();
  const localPayload=normalizeEnvelope(state.envelope);
  const remoteHasData=hasVisibleData(remotePayload);
  const localHasData=hasVisibleData(localPayload);
  telegramBridgeRevision=Number.isFinite(Number(data?.revision))?Number(data.revision):0;
  telegramBridgeUpdatedAt=data?.updatedAt||null;
  setTelegramBridgeEnabled(true);

  // Migration guard: an empty newly-created backend must never erase an existing
  // device portfolio. The first device upload wins that bootstrap step.
  if(!remoteHasData&&localHasData)return {needsBootstrap:true};

  state.envelope=remotePayload;
  hydrateEnvelope();
  persistEnvelopeFor(state.cloud.session,state.envelope);

  if(Object.prototype.hasOwnProperty.call(data||{},'dailyPayload')){
    persistDailyFor(state.cloud.session,data.dailyPayload||null);
    state.previous=previousMapFromDaily(data.dailyPayload||null);
  }
  return {needsBootstrap:false};
}
async function requestTelegramBackendBundle(){
  const response=await fetch('/api/portfolio-bridge',{
    method:'GET',
    credentials:'same-origin',
    cache:'no-store'
  });
  if(response.status===401)return null;
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok!==true)throw new Error(data.error||'backend_portfolio_load_failed');
  if(data.connected!==true)return null;
  return data;
}
async function loadTelegramBackendPortfolio(){
  const data=await requestTelegramBackendBundle();
  if(!data)return false;
  const applied=applyTelegramBackendBundle(data);
  if(applied.needsBootstrap){
    await syncTelegramBridgeNow({force:true});
  }
  return true;
}
async function restoreTelegramBackendPortfolio(){
  const pairing=telegramBridgeParams(),ctx=captureSessionContext();
  if(!pairing.requested||!pairing.userId||!pairing.sig||hasVisibleData(state.envelope))return false;
  const response=await fetch('/api/portfolio-bridge',{
    method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'restore',user_id:pairing.userId,sig:pairing.sig})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok!==true||data.connected!==true||!contextActive(ctx)||hasVisibleData(state.envelope))return false;
  applyTelegramBackendBundle(data);
  return true;
}
async function writeTelegramBackendBundle({announce=false,force=false}={}){
  const pairing=telegramBridgeParams();
  const body={
    payload:normalizeEnvelope(state.envelope),
    dailyPayload:currentDailyPayload(),
    expectedRevision:force?null:(Number.isInteger(telegramBridgeRevision)?telegramBridgeRevision:null),
    ...(pairing.requested&&pairing.userId&&pairing.sig?{user_id:pairing.userId,sig:pairing.sig}:{})
  };
  const response=await fetch('/api/portfolio-bridge',{
    method:'POST',
    credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>({}));
  if(response.status===401){
    setTelegramBridgeEnabled(false);
    telegramBridgeRevision=null;
    if(announce)toast('Telegram pairing is not active in this browser.');
    return {ok:false,unauthorized:true};
  }
  if(response.status===409&&data.error==='backend_revision_conflict'&&!force){
    return {ok:false,conflict:true};
  }
  if(!response.ok||data.ok!==true){
    if(announce)toast('Backend portfolio sync failed. Your local cache is still intact.');
    return {ok:false};
  }
  telegramBridgeRevision=Number.isFinite(Number(data.revision))?Number(data.revision):telegramBridgeRevision;
  telegramBridgeUpdatedAt=data.updatedAt||telegramBridgeUpdatedAt;
  setTelegramBridgeEnabled(true);
  if(announce)toast('Portfolio saved on backend');
  return {ok:true};
}
async function syncTelegramBridgeNow({announce=false,force=false}={}){
  const firstConnect=!telegramBridgeEnabled();
  if(firstConnect&&!hasVisibleData(state.envelope)){
    if(announce)toast('No local portfolio was found in this browser. Open the pairing link in Safari where your portfolio is saved.');
    return false;
  }

  const localEnvelope=normalizeEnvelope(state.envelope);
  const localDaily=currentDailyPayload();
  let saved=await writeTelegramBackendBundle({announce,force});
  if(saved.ok)return true;

  if(saved.conflict){
    const remote=await requestTelegramBackendBundle().catch(()=>null);
    if(!remote)return false;
    const mergedEnvelope=mergeEnvelopes(remote.payload||emptyEnvelope(),localEnvelope);
    const mergedDaily=mergeBackendDaily(localDaily,remote.dailyPayload||null);
    telegramBridgeRevision=Number(remote.revision||0);
    state.envelope=mergedEnvelope;hydrateEnvelope();persistEnvelopeFor(state.cloud.session,state.envelope);
    persistDailyFor(state.cloud.session,mergedDaily);
    state.previous=previousMapFromDaily(mergedDaily);
    saved=await writeTelegramBackendBundle({announce,force:false});
    return Boolean(saved.ok);
  }
  return false;
}
function queueTelegramBridgeSync(){
  if(!telegramBridgeEnabled())return;
  clearTimeout(telegramBridgeTimer);
  telegramBridgeTimer=setTimeout(()=>{
    telegramBridgeTimer=0;
    syncTelegramBridgeNow().catch(()=>{});
  },600);
}
function currentDailyPayloadFor(session){return readDailyFor(session)}
function currentDailyPayload(){return currentDailyPayloadFor(state.cloud.session)}
function persistDailyFor(session,payload){
  const key=dailyStorageKey(session);
  if(payload)localStorage.setItem(key,JSON.stringify(payload));else localStorage.removeItem(key);
  if(!session){
    if(payload)localStorage.setItem(LEGACY_DAILY_KEY,JSON.stringify(payload));else localStorage.removeItem(LEGACY_DAILY_KEY);
  }
}
function persistDaily(payload){persistDailyFor(state.cloud.session,payload);queueTelegramBridgeSync()}
function switchLocalScope(session){
  state.envelope=readEnvelopeFor(session);hydrateEnvelope();
  state.previous=previousMapFromDaily(readDailyFor(session));
  state.portfolioItems=new Map();state.liveItems=new Map();state.analytics=null;
}
function activateSession(session){
  advanceSessionEpoch();
  saveCloudSessionRaw(session);
  switchLocalScope(session);
  state.cloud.ready=false;state.cloud.reconciled=false;state.cloud.revision=0;
  return captureSessionContext();
}
function clearActiveSession(ctx,message='Cloud session expired. Sign in again.'){
  if(ctx&&!contextActive(ctx))return false;
  advanceSessionEpoch();
  saveCloudSessionRaw(null);switchLocalScope(null);
  state.cloud.ready=true;state.cloud.reconciled=false;state.cloud.revision=0;
  state.cloud.status='local';state.cloud.message=message;state.cloud.showAuth=false;
  return true;
}
function setPositionRecord(rec){
  const symbol=String(rec?.symbol||'').toUpperCase();if(!symbol)return;
  const updatedAt=isoOr(rec.updatedAt||new Date().toISOString(),new Date().toISOString());
  state.envelope=normalizeEnvelope(state.envelope);
  state.envelope.positions[symbol]={value:{...rec,symbol,updatedAt},deleted:false,updatedAt};
  hydrateEnvelope();persistEnvelope();queueCloudSync();
}
function removePositionRecord(symbol){
  const s=String(symbol||'').toUpperCase();if(!s)return;
  const updatedAt=new Date().toISOString();state.envelope=normalizeEnvelope(state.envelope);
  state.envelope.positions[s]={value:null,deleted:true,updatedAt};hydrateEnvelope();persistEnvelope();queueCloudSync();
}
function setWatchMembership(symbol,present){
  const s=String(symbol||'').toUpperCase();if(!s)return;
  state.envelope=normalizeEnvelope(state.envelope);
  state.envelope.watchlist[s]={present:Boolean(present),updatedAt:new Date().toISOString()};
  hydrateEnvelope();persistEnvelope();queueCloudSync();
}
function guestImportMarker(userId){return 'marketHunterGuestImportedV3:'+userId}
function guestMigrationAvailable(){
  const id=state.cloud.session?.user?.id;
  return Boolean(id&&!localStorage.getItem(guestImportMarker(id))&&hasVisibleData(readEnvelopeFor(null)));
}
async function importGuestPortfolio(){
  const ctx=captureSessionContext(),id=ctx.userId;if(!id)return;
  state.envelope=mergeEnvelopes(state.envelope,readEnvelopeFor(null));hydrateEnvelope();persistEnvelopeFor(contextSession(ctx),state.envelope);
  const accountDaily=currentDailyPayloadFor(contextSession(ctx)),guestDaily=readDailyFor(null);
  if(!accountDaily&&guestDaily)persistDailyFor(contextSession(ctx),guestDaily);
  localStorage.setItem(guestImportMarker(id),new Date().toISOString());
  if(!contextActive(ctx))return;
  state.cloud.message='Local device data imported into this account.';
  await syncPortfolioCloud(ctx);if(!contextActive(ctx))return;
  await loadPortfolio(ctx);if(!contextActive(ctx))return;
  renderAll();
}

async function cloudAuthRequest(path,body,token){
  const headers={'apikey':SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'};
  if(token)headers.Authorization='Bearer '+token;
  const r=await fetch(SUPABASE_URL+'/auth/v1/'+path,{method:'POST',headers,body:JSON.stringify(body||{})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.msg||data.message||data.error_description||'Cloud authentication failed');
  return data;
}
async function ensureCloudSession(ctx=captureSessionContext()){
  if(!contextActive(ctx))return null;
  let session=state.cloud.session;if(!session)return null;
  if(Number(session.expires_at||0)>Math.floor(Date.now()/1000)+90)return session;
  if(!session.refresh_token){clearActiveSession(ctx);return null}
  try{
    const refreshToken=session.refresh_token;
    const data=await cloudAuthRequest('token?grant_type=refresh_token',{refresh_token:refreshToken});
    if(!contextActive(ctx))return null;
    const next={access_token:data.access_token,refresh_token:data.refresh_token||refreshToken,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600),user:data.user||session.user};
    if(sessionUserId(next)!==ctx.userId){clearActiveSession(ctx,'Cloud session identity changed unexpectedly. Sign in again.');return null}
    saveCloudSessionRaw(next);return next;
  }catch{
    if(contextActive(ctx))clearActiveSession(ctx);
    return null;
  }
}
async function cloudRest(table,{method='GET',query='',body=null,prefer=''}={},ctx=captureSessionContext()){
  assertSessionContext(ctx);
  const session=await ensureCloudSession(ctx);
  if(!session){if(!contextActive(ctx))throw staleSessionError();throw new Error('Sign in to use cloud sync')}
  assertSessionContext(ctx);
  const headers={'apikey':SUPABASE_PUBLISHABLE_KEY,'Authorization':'Bearer '+session.access_token,'Content-Type':'application/json'};
  if(prefer)headers.Prefer=prefer;
  const r=await fetch(SUPABASE_URL+'/rest/v1/'+table+(query?'?'+query:''),{method,headers,body:body===null?undefined:JSON.stringify(body),cache:'no-store'});
  assertSessionContext(ctx);
  if(!r.ok){
    const data=await r.json().catch(()=>({}));assertSessionContext(ctx);
    const error=new Error(data.message||data.hint||'Cloud data request failed');error.status=r.status;throw error;
  }
  if(r.status===204)return null;
  const text=await r.text();assertSessionContext(ctx);
  return text?JSON.parse(text):null;
}
async function fetchCloudStateRow(ctx){
  const rows=await cloudRest('market_hunter_portfolio_state',{query:'select=payload,revision,updated_at&limit=1'},ctx);
  return rows?.[0]||null;
}
async function writeCloudStateCas(session,row,payload,ctx){
  assertSessionContext(ctx);
  const now=new Date().toISOString();
  if(!row){
    try{
      const created=await cloudRest('market_hunter_portfolio_state',{method:'POST',query:'select=payload,revision,updated_at',prefer:'return=representation',body:{user_id:session.user.id,version:3,revision:1,payload,updated_at:now}},ctx);
      return created?.[0]||null;
    }catch(e){if(e.status===409&&contextActive(ctx))return null;throw e}
  }
  const rev=Number(row.revision||0);
  const updated=await cloudRest('market_hunter_portfolio_state',{
    method:'PATCH',
    query:'user_id=eq.'+encodeURIComponent(session.user.id)+'&revision=eq.'+rev+'&select=payload,revision,updated_at',
    prefer:'return=representation',
    body:{version:3,revision:rev+1,payload,updated_at:now}
  },ctx);
  return updated?.[0]||null;
}
function sortedSymbols(values){return [...new Set((values||[]).filter(Boolean).map(x=>String(x).toUpperCase()))].sort()}
function sameSymbols(a,b){const aa=sortedSymbols(a),bb=sortedSymbols(b);return aa.length===bb.length&&aa.every((x,i)=>x===bb[i])}
function validSessionDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''))}
function portfolioSymbols(){return [...state.positions.keys()].sort()}
function snapshotSourceMs(meta){
  for(const value of [meta?.sourceGeneratedAt,meta?.capturedAt]){
    const t=Date.parse(value||'');if(Number.isFinite(t))return t;
  }
  return null;
}
function declaredSnapshotSymbols(meta,items){
  if(Array.isArray(meta?.portfolioSymbols))return sortedSymbols(meta.portfolioSymbols);
  if(Array.isArray(meta?.requestedSymbols))return sortedSymbols(meta.requestedSymbols);
  return sortedSymbols((items||[]).map(x=>x?.symbol));
}
function inspectSnapshot(date,items,complete,meta,expectedSymbols){
  const expected=sortedSymbols(expectedSymbols),list=Array.isArray(items)?items:[],symbols=sortedSymbols(list.map(x=>x?.symbol));
  const declared=declaredSnapshotSymbols(meta,list);
  const uniqueSymbols=symbols.length===list.length;
  const exactCoverage=list.length===expected.length&&sameSymbols(symbols,expected);
  const contextMatches=sameSymbols(declared,expected);
  const dated=expected.length===0
    ?list.length===0
    :list.length>0&&list.every(x=>validSessionDate(x?.asOf)&&x.asOf===date);
  const explicitEmpty=expected.length===0&&list.length===0&&
    (meta?.portfolioEmpty===true||Array.isArray(meta?.portfolioSymbols)||Array.isArray(meta?.requestedSymbols));
  return {
    date:date||null,items:list,meta:meta||null,complete:Boolean(complete),expected,declared,
    valid:Boolean(validSessionDate(date))&&Boolean(complete)&&uniqueSymbols&&exactCoverage&&contextMatches&&dated&&
      (expected.length>0||explicitEmpty),
    sourceMs:snapshotSourceMs(meta),exactCoverage,contextMatches,dated
  };
}
function dailySnapshotCandidate(daily,expectedSymbols){
  return inspectSnapshot(daily?.currentDate,daily?.currentItems,inferredComplete(daily),daily?.currentMeta,expectedSymbols);
}
function cloudSnapshotCandidate(row,expectedSymbols){
  const date=row?.market_as_of||row?.payload?.marketAsOf||null;
  return inspectSnapshot(date,row?.payload?.items,row?.payload?.complete!==false,row?.payload?.meta,expectedSymbols);
}
function chooseSameDaySnapshot(local,remote,incumbent='local'){
  if(local.valid&&!remote.valid)return 'local';
  if(remote.valid&&!local.valid)return 'remote';
  if(!local.valid&&!remote.valid)return incumbent;
  if(local.date!==remote.date)return local.date>remote.date?'local':'remote';
  if(Number.isFinite(local.sourceMs)&&Number.isFinite(remote.sourceMs)){
    if(local.sourceMs>remote.sourceMs)return 'local';
    if(remote.sourceMs>local.sourceMs)return 'remote';
  }
  // Unknown/equal source freshness never displaces the incumbent.
  return incumbent;
}
function applyRemoteSnapshot(row,ctx,cloudRows=[]){
  assertSessionContext(ctx);
  const session=contextSession(ctx),local=currentDailyPayloadFor(session)||{previousDate:null,previousItems:[],currentDate:null,currentItems:[],currentComplete:false};
  const date=row.market_as_of||row?.payload?.marketAsOf,payload=row.payload||{};
  if(local.currentDate&&date<local.currentDate)return false;
  let next;
  if(local.currentDate===date){
    next={...local,currentDate:date,currentItems:payload.items||[],currentComplete:true,currentMeta:payload.meta||null};
  }else{
    const prevRemote=cloudRows.find(r=>r?.market_as_of&&r.market_as_of<date&&r?.payload?.complete!==false);
    next={
      ...local,
      previousDate:local.currentDate||prevRemote?.market_as_of||local.previousDate||null,
      previousItems:local.currentDate?(local.currentItems||[]):(prevRemote?.payload?.items||local.previousItems||[]),
      currentDate:date,currentItems:payload.items||[],currentComplete:true,currentMeta:payload.meta||null
    };
  }
  assertSessionContext(ctx);persistDailyFor(session,next);state.previous=previousMapFromDaily(next);return true;
}
function mergeCloudSnapshots(rows,ctx=captureSessionContext()){
  assertSessionContext(ctx);
  const expected=portfolioSymbols(),session=contextSession(ctx),localDaily=currentDailyPayloadFor(session);
  const local=dailySnapshotCandidate(localDaily,expected);
  const remotes=(rows||[]).map(row=>({row,candidate:cloudSnapshotCandidate(row,expected)}))
    .filter(x=>x.candidate.valid).sort((a,b)=>String(b.candidate.date).localeCompare(String(a.candidate.date)));
  const best=remotes[0];if(!best)return;
  if(local.date&&best.candidate.date<local.date)return;
  if(!local.valid||best.candidate.date>local.date||chooseSameDaySnapshot(local,best.candidate,'local')==='remote')applyRemoteSnapshot(best.row,ctx,rows);
}
async function loadCloudPortfolio(ctx=captureSessionContext()){
  assertSessionContext(ctx);const session=state.cloud.session;if(!session)return null;
  const [row,snaps]=await Promise.all([
    fetchCloudStateRow(ctx),
    cloudRest('market_hunter_portfolio_snapshots',{query:'select=market_as_of,payload,revision,updated_at&order=market_as_of.desc&limit=3'},ctx)
  ]);
  assertSessionContext(ctx);
  state.envelope=mergeEnvelopes(state.envelope,normalizeEnvelope(row?.payload,row?.updated_at||undefined));
  hydrateEnvelope();assertSessionContext(ctx);persistEnvelopeFor(session,state.envelope);
  state.cloud.revision=Number(row?.revision||0);mergeCloudSnapshots(snaps,ctx);
  return row;
}
async function syncCloudSnapshot(session,ctx=captureSessionContext()){
  assertSessionContext(ctx);
  for(let attempt=0;attempt<3;attempt++){
    assertSessionContext(ctx);
    const expected=portfolioSymbols();
    const daily=currentDailyPayloadFor(contextSession(ctx)),local=dailySnapshotCandidate(daily,expected);
    if(!local.valid)return;
    const date=local.date,payload={marketAsOf:date,items:local.items,complete:true,meta:local.meta||null};
    const rows=await cloudRest('market_hunter_portfolio_snapshots',{query:'market_as_of=eq.'+date+'&select=market_as_of,payload,revision,updated_at&limit=1'},ctx);
    assertSessionContext(ctx);
    // Same-account edits and newer local captures can arrive during the GET too.
    if(!sameSymbols(expected,portfolioSymbols())||JSON.stringify(daily)!==JSON.stringify(currentDailyPayloadFor(contextSession(ctx))))continue;
    const row=rows?.[0]||null;
    if(row){
      const remote=cloudSnapshotCandidate(row,expected),choice=chooseSameDaySnapshot(local,remote,'remote');
      if(choice==='remote'){if(remote.valid)applyRemoteSnapshot(row,ctx,rows);return}
      if(remote.valid&&JSON.stringify(remote.items)===JSON.stringify(local.items)&&JSON.stringify(remote.meta||null)===JSON.stringify(local.meta||null))return;
    }
    const now=new Date().toISOString();
    if(!row){
      try{
        await cloudRest('market_hunter_portfolio_snapshots',{method:'POST',prefer:'return=minimal',body:{user_id:session.user.id,market_as_of:date,revision:1,payload,updated_at:now}},ctx);
        return;
      }catch(e){if(e.status===409&&contextActive(ctx))continue;throw e}
    }
    const rev=Number(row.revision||0);
    const updated=await cloudRest('market_hunter_portfolio_snapshots',{
      method:'PATCH',query:'user_id=eq.'+encodeURIComponent(session.user.id)+'&market_as_of=eq.'+date+'&revision=eq.'+rev+'&select=revision',
      prefer:'return=representation',body:{revision:rev+1,payload,updated_at:now}
    },ctx);
    if(updated?.length)return;
  }
  assertSessionContext(ctx);throw new Error('Snapshot sync conflict; retry later.');
}
async function syncPortfolioCloud(ctx=captureSessionContext()){
  if(!contextActive(ctx))return;
  if(cloudSyncBusyEpochs.has(ctx.epoch)){cloudSyncQueuedEpochs.add(ctx.epoch);return}
  const session=await ensureCloudSession(ctx);if(!session||!contextActive(ctx)||!state.cloud.ready)return;
  cloudSyncBusyEpochs.add(ctx.epoch);
  state.cloud.status='syncing';state.cloud.message='Reconciling cloud copy...';
  try{
    let saved=null;
    for(let attempt=0;attempt<3&&!saved;attempt++){
      assertSessionContext(ctx);
      const row=await fetchCloudStateRow(ctx);assertSessionContext(ctx);
      state.envelope=mergeEnvelopes(state.envelope,normalizeEnvelope(row?.payload,row?.updated_at||undefined));
      hydrateEnvelope();persistEnvelopeFor(session,state.envelope);
      saved=await writeCloudStateCas(session,row,state.envelope,ctx);
    }
    if(!saved)throw new Error('Cloud sync conflict; retry later.');
    assertSessionContext(ctx);
    state.cloud.revision=Number(saved.revision||0);state.cloud.reconciled=true;
    await syncCloudSnapshot(session,ctx);assertSessionContext(ctx);
    state.cloud.status='synced';state.cloud.message='Cloud copy is up to date.';
  }catch(e){
    if(contextActive(ctx)&&e?.code!=='STALE_SESSION_OPERATION'){state.cloud.status='error';state.cloud.message=e.message||'Cloud sync failed'}
  }finally{
    cloudSyncBusyEpochs.delete(ctx.epoch);
    const queued=cloudSyncQueuedEpochs.delete(ctx.epoch);
    if(queued&&contextActive(ctx))queueCloudSync(ctx);
    if(contextActive(ctx)&&state.view==='portfolio')renderView('portfolio');
  }
}
function queueCloudSync(ctx=captureSessionContext()){
  if(!contextActive(ctx)||!state?.cloud?.session||!state.cloud.ready)return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer=setTimeout(()=>{cloudSyncTimer=0;if(contextActive(ctx))syncPortfolioCloud(ctx)},600);
}
async function initializeCloudPortfolio(ctx=captureSessionContext()){
  if(!contextActive(ctx))return;
  state.cloud.ready=false;state.cloud.reconciled=false;
  if(!state.cloud.session){state.cloud.ready=true;return}
  state.cloud.status='syncing';state.cloud.message='Loading cloud portfolio...';
  try{
    await loadCloudPortfolio(ctx);assertSessionContext(ctx);
    state.cloud.ready=true;state.cloud.reconciled=true;
    await syncPortfolioCloud(ctx);
  }catch(e){
    if(contextActive(ctx)&&e?.code!=='STALE_SESSION_OPERATION'){
      state.cloud.ready=true;state.cloud.reconciled=false;state.cloud.status='error';
      state.cloud.message=(e.message||'Cloud load failed')+' Local changes will not overwrite cloud data without a fresh reconciliation.';
    }
  }
}
async function cloudSignIn(email,password){
  const attempt=++authAttempt;
  state.cloud.status='syncing';state.cloud.message='Signing in...';renderView('portfolio');
  try{
    const data=await cloudAuthRequest('token?grant_type=password',{email,password});
    if(attempt!==authAttempt)return;
    const session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600),user:data.user};
    const ctx=activateSession(session);state.cloud.showAuth=false;
    await initializeCloudPortfolio(ctx);if(!contextActive(ctx))return;
    await loadPortfolio(ctx);if(!contextActive(ctx))return;
    renderAll();setView('portfolio');
  }catch(e){if(attempt===authAttempt){state.cloud.status='error';state.cloud.message=e.message;renderView('portfolio')}}
}
async function cloudSignUp(email,password){
  const attempt=++authAttempt;
  state.cloud.status='syncing';state.cloud.message='Creating account...';renderView('portfolio');
  try{
    const data=await cloudAuthRequest('signup',{email,password});
    if(attempt!==authAttempt)return;
    if(data.access_token){
      const session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600),user:data.user};
      const ctx=activateSession(session);state.cloud.showAuth=false;
      await initializeCloudPortfolio(ctx);if(!contextActive(ctx))return;
      await loadPortfolio(ctx);if(!contextActive(ctx))return;
      renderAll();setView('portfolio');
    }else{state.cloud.status='local';state.cloud.message='Account created. Confirm the email, then sign in.';renderView('portfolio')}
  }catch(e){if(attempt===authAttempt){state.cloud.status='error';state.cloud.message=e.message;renderView('portfolio')}}
}
async function cloudSignOut(){
  ++authAttempt;
  const session=state.cloud.session,token=session?.access_token||null;
  advanceSessionEpoch();saveCloudSessionRaw(null);switchLocalScope(null);
  state.cloud.ready=true;state.cloud.reconciled=false;state.cloud.revision=0;state.cloud.status='local';
  state.cloud.message='Signed out. Guest data on this device is kept separate from account data.';state.cloud.showAuth=false;
  const ctx=captureSessionContext();
  const logoutPromise=token?cloudAuthRequest('logout',{},token).catch(()=>null):Promise.resolve(null);
  await loadPortfolio(ctx);if(contextActive(ctx)){renderAll();setView('portfolio')}
  await logoutPromise;
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
function toast(msg){const e=q('#toast');e.textContent=msg;e.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.classList.remove('show'),1400)}
async function getJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(url);return r.json()}
async function getJsonFallback(primary,fallback){try{return await getJson(primary)}catch{return getJson(fallback)}}
function quoteTimeLabel(value){
  const raw=String(value||'');if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
  const t=Date.parse(raw);if(!Number.isFinite(t))return '';
  return new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}
function quoteFor(symbol,fallback=null){
  return globalThis.MarketHunterQuotePolicy.selectQuote({
    symbol,
    intradaySnapshot:state.intraday,
    completed:fallback,
    now:new Date()
  });
}
function quoteMetaHtml(display){
  const when=display?.quoteAt?quoteTimeLabel(display.quoteAt):'';
  return '<small class="quote-meta '+esc(display?.state||'unavailable')+'">'+esc(display?.label||'Quote unavailable')+(when?' · '+esc(when):'')+'</small>';
}
function enrichCandidate(x){
  const completed=state.liveItems.get(x?.symbol)||x;
  const display=quoteFor(x?.symbol,completed);
  return {...x,price:numeric(display.price)?display.price:x.price,dayChangePct:display.changePct,displayQuote:display};
}
function allCandidates(){
  const out=[],seen=new Set();
  for(const x of state.v2?.integratedSurfacePicks||[]){if(!seen.has(x.symbol)){seen.add(x.symbol);out.push(enrichCandidate(x))}}
  for(const list of Object.values(state.v2?.surfacePicks||{}))for(const x of list||[]){if(!seen.has(x.symbol)){seen.add(x.symbol);out.push(enrichCandidate(x))}}
  return out;
}
async function loadCandidateLiveData(ctx=captureSessionContext()){
  if(!contextActive(ctx))return;
  const raw=[...(state.v2?.integratedSurfacePicks||[]),...Object.values(state.v2?.surfacePicks||{}).flat()];
  const symbols=[...new Set([
    ...raw.map(x=>x?.symbol),
    ...state.watch,
    ...[...state.positions.values()].map(x=>x?.symbol)
  ].filter(Boolean))].slice(0,30);
  if(!symbols.length){if(contextActive(ctx))state.liveItems=new Map();return}
  try{
    const data=await getJson('/api/portfolio?symbols='+encodeURIComponent(symbols.join(',')));
    if(!contextActive(ctx))return;
    state.liveItems=new Map((data.items||[]).map(x=>[x.symbol,x]));
  }catch(e){if(contextActive(ctx))state.liveItems=new Map()}
}
const REVIEW_STAGES=['Early Watch','Recovery','Attractive Growth','Established Move'];
function stageEligiblePicks(stage){
  const rows=state.v2?.reviewFirst?.[stage]||state.v2?.surfacePicks?.[stage]||[];
  const policy=state.v2?.surfacePolicy?.[stage]||{};
  return [...rows].filter(x=>{
    if(Number.isFinite(policy.minScore)&&(!Number.isFinite(x?.score)||x.score<policy.minScore))return false;
    if(Number.isFinite(policy.maxStageAge)&&(!Number.isFinite(x?.stageAge)||x.stageAge>policy.maxStageAge))return false;
    return true;
  }).sort((x,y)=>(y?.surfaceScore??y?.score??-Infinity)-(x?.surfaceScore??x?.score??-Infinity)||String(x?.symbol||'').localeCompare(String(y?.symbol||''))).map(enrichCandidate);
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
  if(window.MHI18n?.language()==='fa')return window.MHI18n.stockFa(x);
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
function snapshotAttempt(data,requestedSymbols){
  const items=Array.isArray(data?.items)?data.items:[],failures=Array.isArray(data?.failures)?data.failures:[];
  const expected=sortedSymbols(requestedSymbols),returned=sortedSymbols(items.map(x=>x?.symbol));
  const missingDates=items.some(x=>!validSessionDate(x?.asOf)),dates=[...new Set(items.map(x=>x?.asOf).filter(validSessionDate))].sort();
  const capturedAt=new Date().toISOString(),sourceGeneratedAt=Number.isFinite(Date.parse(data?.generatedAt||''))?new Date(Date.parse(data.generatedAt)).toISOString():capturedAt;
  if(expected.length===0)return {status:'empty_portfolio',complete:false,date:null,items:[],failures:[],requestedSymbols:[],capturedAt,sourceGeneratedAt};
  if(!items.length)return {status:'partial_empty_response',complete:false,date:null,items,failures,requestedSymbols:expected,capturedAt,sourceGeneratedAt};
  if(missingDates)return {status:'partial_missing_dates',complete:false,date:null,items,failures,requestedSymbols:expected,capturedAt,sourceGeneratedAt,dates};
  if(dates.length!==1)return {status:'partial_mixed_dates',complete:false,date:null,items,failures,requestedSymbols:expected,capturedAt,sourceGeneratedAt,dates};
  const complete=failures.length===0&&items.length===expected.length&&sameSymbols(returned,expected);
  return {status:complete?'complete':'partial',complete,date:dates[0],items,failures,requestedSymbols:expected,capturedAt,sourceGeneratedAt};
}
function savePortfolioSnapshot(data,requestedSymbols,ctx=captureSessionContext()){
  if(!contextActive(ctx))return false;
  const session=contextSession(ctx),saved=currentDailyPayloadFor(session)||{previousDate:null,previousItems:[],currentDate:null,currentItems:[],currentComplete:false};
  const attempt=snapshotAttempt(data,requestedSymbols);
  let next={...saved,lastAttempt:{status:attempt.status,complete:attempt.complete,date:attempt.date,requestedSymbols:attempt.requestedSymbols,returnedSymbols:attempt.items.map(x=>x.symbol),failures:attempt.failures,dates:attempt.dates||undefined,capturedAt:attempt.capturedAt,sourceGeneratedAt:attempt.sourceGeneratedAt}};
  if(attempt.status==='empty_portfolio'){
    if(saved.currentDate&&validSessionDate(saved.currentDate)){
      const emptyMeta={
        complete:true,requestedSymbols:[],portfolioSymbols:[],portfolioEmpty:true,portfolioContextKey:'',
        capturedAt:attempt.capturedAt,sourceGeneratedAt:attempt.sourceGeneratedAt
      };
      next={...next,currentDate:saved.currentDate,currentItems:[],currentComplete:true,currentMeta:emptyMeta};
      assertSessionContext(ctx);persistDailyFor(session,next);state.previous=previousMapFromDaily(next);queueCloudSync(ctx);return true;
    }
    assertSessionContext(ctx);persistDailyFor(session,next);state.previous=previousMapFromDaily(next);return false;
  }
  if(!attempt.complete||!attempt.date){
    assertSessionContext(ctx);persistDailyFor(session,next);state.previous=previousMapFromDaily(next);return false;
  }
  if(saved.currentDate&&attempt.date<saved.currentDate){
    next.lastAttempt={...next.lastAttempt,status:'older_complete_response'};assertSessionContext(ctx);persistDailyFor(session,next);state.previous=previousMapFromDaily(next);return false;
  }
  const meta={complete:true,requestedSymbols:attempt.requestedSymbols,portfolioSymbols:attempt.requestedSymbols,portfolioEmpty:attempt.requestedSymbols.length===0,portfolioContextKey:attempt.requestedSymbols.join('|'),capturedAt:attempt.capturedAt,sourceGeneratedAt:attempt.sourceGeneratedAt};
  const incoming=inspectSnapshot(attempt.date,attempt.items,true,meta,attempt.requestedSymbols);
  if(saved.currentDate===attempt.date){
    const current=dailySnapshotCandidate(saved,attempt.requestedSymbols);
    if(current.valid&&chooseSameDaySnapshot(current,incoming,'local')!=='remote'){
      next.lastAttempt={...next.lastAttempt,status:'same_day_not_newer'};assertSessionContext(ctx);persistDailyFor(session,next);state.previous=previousMapFromDaily(next);return false;
    }
    next={...next,currentItems:attempt.items,currentComplete:true,currentMeta:meta};
  }else if(saved.currentDate&&attempt.date>saved.currentDate){
    next={...next,previousDate:saved.currentDate,previousItems:saved.currentItems||[],currentDate:attempt.date,currentItems:attempt.items,currentComplete:true,currentMeta:meta};
  }else{
    next={...next,previousDate:null,previousItems:[],currentDate:attempt.date,currentItems:attempt.items,currentComplete:true,currentMeta:meta};
  }
  assertSessionContext(ctx);persistDailyFor(session,next);state.previous=previousMapFromDaily(next);queueCloudSync(ctx);return true;
}
async function loadPortfolio(ctx=captureSessionContext()){
  if(!contextActive(ctx))return;
  const positions=[...state.positions.values()].filter(p=>p?.symbol),requested=positions.map(p=>p.symbol);
  const sequence=++portfolioLoadSequence,signature=JSON.stringify(positions);
  const requestActive=()=>contextActive(ctx)&&sequence===portfolioLoadSequence&&signature===JSON.stringify([...state.positions.values()].filter(p=>p?.symbol));
  state.portfolioItems=new Map();state.analytics=null;
  if(!positions.length){savePortfolioSnapshot({items:[],failures:[]},[],ctx);return}
  const symbols=requested.join(',');
  const entries=positions.filter(p=>p.boughtAt&&Number(p.entryPrice)>0).map(p=>[p.symbol,String(p.boughtAt).slice(0,10),Number(p.entryPrice)].join('|')).join(',');
  const quantities=positions.filter(p=>Number(p.quantity)>0).map(p=>[p.symbol,Number(p.quantity)].join('|')).join(',');
  try{
    const data=await getJson('/api/portfolio?symbols='+encodeURIComponent(symbols)+(entries?'&entries='+encodeURIComponent(entries):'')+(quantities?'&positions='+encodeURIComponent(quantities):''));
    if(!requestActive())return;
    state.portfolioItems=new Map((data.items||[]).map(x=>[x.symbol,x]));
    state.analytics=data.portfolioAnalytics||null;
    savePortfolioSnapshot(data,requested,ctx);
  }catch(e){
    if(requestActive())savePortfolioSnapshot({items:[],failures:requested.map(symbol=>({symbol,reason:'request_failed'}))},requested,ctx);
  }
}
let fundamentalRequestId=0;
async function loadFundamentals(){
  const requestId=++fundamentalRequestId;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),5000);
  state.fundamentalStatus='loading';
  try{
    const response=await fetch('/data/fundamental-context.json',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('Financial source unavailable');
    const data=await response.json();
    if(requestId!==fundamentalRequestId)return;
    state.fundamentals=data;
    state.fundamentalStatus='available';
  }catch{
    if(requestId!==fundamentalRequestId)return;
    state.fundamentalStatus=state.fundamentals?'retained':'unavailable';
  }finally{
    clearTimeout(timer);
    if(requestId===fundamentalRequestId)updateFundamentalDisclosures();
  }
}
function updateFundamentalDisclosures(){
  document.querySelectorAll('.stock-fundamental[data-fundamental-symbol]').forEach(element=>{
    const template=document.createElement('template');
    template.innerHTML=fundamentalHtml({symbol:element.dataset.fundamentalSymbol});
    const replacement=template.content.firstElementChild;
    replacement.open=element.open;
    element.replaceWith(replacement);
  });
}
async function load(){
  loadEngines();
  void loadFundamentals();
  const b=q('#refreshBtn');b.classList.add('busy');b.disabled=true;
  try{
    const [daily,pulse,v2,intraday,monitor]=await Promise.allSettled([
      getJsonFallback('/api/research-data?kind=daily','/data/daily-market-report.json'),
      getJsonFallback('/api/research-data?kind=pulse','/data/market-pulse-report.json'),
      getJsonFallback('/api/research-data?kind=v2','/data/v2-latest-scan.json'),
      getJson('/api/intraday'),
      getJson('/api/hunter-monitor')
    ]);
    state.hunterMonitor=monitor.status==='fulfilled'&&monitor.value?.version==='hunter-monitor-v1'?monitor.value:null;
    state.daily=daily.status==='fulfilled'?daily.value:null;
    state.pulse=pulse.status==='fulfilled'?pulse.value:null;
    state.v2=v2.status==='fulfilled'?v2.value:null;
    state.intraday=intraday.status==='fulfilled'?intraday.value:null;
    state.intradayStatus=intraday.status==='fulfilled'?'available':'unavailable';
    const accountCtx=captureSessionContext();
    await initializeCloudPortfolio(accountCtx);

    const bridgeRequested=telegramBridgeRequested();
    if(bridgeRequested){
      const bridgeSynced=await (hasVisibleData(state.envelope)?syncTelegramBridgeNow({announce:true,force:true}):restoreTelegramBackendPortfolio()).catch(()=>false);
      state.view='portfolio';
      if(bridgeSynced){
        try{
          const url=new URL(location.href);
          url.searchParams.delete('portfolioBridge');
          url.searchParams.delete('user_id');
          url.searchParams.delete('sig');
          history.replaceState({},'',url.pathname+(url.search||'')+url.hash);
        }catch{}
      }
    }else{
      // Backend is the source of truth once paired. This call also restores the
      // portfolio if browser Local Storage was cleared.
      await loadTelegramBackendPortfolio().catch(()=>false);
    }

    if(contextActive(accountCtx))await loadCandidateLiveData(accountCtx);
    if(contextActive(accountCtx))await loadPortfolio(accountCtx);
    const asOf=state.daily?.asOf;
    q('#asOf').textContent=asOf?.mixedDates&&asOf?.earliest&&asOf?.latest
      ?'Completed markets through '+asOf.earliest+' · 24/7 through '+asOf.latest
      :asOf?.latest?'Completed-session data through '+asOf.latest:'Research dashboard';
    renderAll();
    if(bridgeRequested)setView('portfolio');
  }finally{b.classList.remove('busy');b.disabled=false}
}
function marketLevelsHtml(levels){
  const rows=[['bullishTrigger',ui('Above this level','بالای این سطح'),ui('Bullish continuation to watch','ادامهٔ صعود را بررسی کن')],['warningLevel',ui('Trend warning','سطح هشدار روند'),ui('Watch the reaction near this level','واکنش قیمت به این سطح مهم است')],['bearishTrigger',ui('Below this level','پایین این سطح'),ui('Risk of structural weakness','خطر ضعیف‌شدن ساختار')]].filter(([key])=>Number.isFinite(levels?.[key]));
  if(!rows.length)return '';
  return `<div class="market-levels reading-copy">${rows.map(([key,label,note])=>`<div><span>${label}<small>${note}</small></span><b><bdi>${fmt(levels[key])}</bdi></b></div>`).join('')}</div>`;
}
function homeHtml(){
  const d=state.daily,p=state.pulse,picks=stageLeaders();
  const briefFresh=(p?.markets||[]).length>0&&(p.markets||[]).every(m=>window.MarketHunterStatus.freshness(m).usable);
  const s=portfolioSummary();
  const words=value=>window.MHI18n?.text(value)||value||'—';
  const marketRead=value=>window.MHI18n?.marketRead(value)||value?.outlook||'';
  const marketKeyByName={'TSX Composite':'TSX','S&P 500':'SP500','Nasdaq-100':'NASDAQ100','Gold':'GOLD','Silver':'SILVER','Bitcoin':'BTC','Ethereum':'ETH'};
  const intradaySymbolByKey=MARKET_PULSE_INTRADAY_SYMBOLS;
  const changes=(d?.keyDevelopments||[]).slice(0,3).map(x=>{
    const m=(d?.markets||[]).find(m=>m.key===x.market);
    return `<div class="change-item"><span class="change-market"><bdi>${esc(m?.name||x.market)}</bdi></span><span>${esc(m?window.MHI18n.outlook(m.outlook):stripMarketPrefix(x.text))}</span></div>`;
  }).join('');
  const markets=(p?.markets||[]).map(x=>{
    const fresh=window.MarketHunterStatus.freshness(x);
    const tone=!fresh.usable?'metric-flat':/bull|uptrend|risk-on|strength/i.test(x.regime||'')?'metric-good':/bear|downtrend|risk-off|weak/i.test(x.regime||'')?'metric-bad':'metric-flat';
    const key=x.key||marketKeyByName[x.name]||'';
    const view=(d?.markets||[]).find(m=>m.key===key&&m.asOf===x.asOf)||x;
    const completed={price:x.price,dayChangePct:x.current?.returns?.d1??x.returns?.d1,currency:x.currency||null,asOf:x.asOf||d?.asOf?.latest||null};
    const display=quoteFor(intradaySymbolByKey[key],completed);
    return `<div class="market-row">
      <div><b>${esc(x.name)}</b><small>${esc(words(x.condition))}</small></div>
      <div class="market-value"><div class="price-line">${fmt(display.price)}<small class="day-change ${cls(display.changePct)}">${pct(display.changePct)}</small></div>${quoteMetaHtml(display)}</div>
      <div class="market-state ${tone}">${fresh.usable?esc(words(x.regime)):ui('Update required','نیازمند بروزرسانی')}</div>
      <p class="market-read reading-copy">${esc(marketRead(x))}</p>${!fresh.usable?`<small class="setup-caution">${ui("Last recorded assessment","آخرین ارزیابی ثبت‌شده")}: ${esc(words(x.regime))} · ${esc(x.asOf||"—")}</small>`:""}
      <details class="market-context reading-copy"><summary>${ui("What to watch","چه چیزی را دنبال کنم؟")}</summary><p>${fresh.usable?esc(window.MHI18n.outlook(view.outlook)):ui("These levels belong to the last recorded session; current assessment is unavailable.","این سطوح مربوط به آخرین جلسهٔ ثبت‌شده‌اند؛ ارزیابی فعلی در دسترس نیست.")}</p>${marketLevelsHtml(view.levels||x.levels)}</details>
    </div>`;
  }).join('');
  const rows=picks.map(x=>`<button class="home-pick" data-chart="${esc(x.symbol)}"><span><b><bdi>${short(x.symbol)}</bdi></b><small>${esc(x.name||x.symbol)}</small><em>${esc(stageLabel(x.stage))}</em></span><span class="home-pick-quote"><b><bdi>${money(x.price,x.displayQuote?.currency||'CAD')}</bdi></b><small class="day-change ${cls(x.dayChangePct)}"><bdi>${pct(x.dayChangePct)}</bdi></small>${quoteMetaHtml(x.displayQuote)}</span><span class="home-pick-arrow" aria-hidden="true">↗</span></button>`).join('');
  const outlook=(d?.markets||[]).map(m=>{
    const fresh=window.MarketHunterStatus.freshness(m);
    const h5=m?.evidence?.horizons?.['5'];
    const h20=m?.evidence?.horizons?.['20'];
    return `<article class="outlook-card">
      <div class="outlook-head"><div><b>${esc(m.name)}</b><small>${esc(words(m.regime))} · ${esc(words(m.condition))}</small></div><span>${esc(m.asOf||'')}</span></div>
      <p class="reading-copy outlook-summary">${fresh.usable?esc(window.MHI18n.outlook(m.outlook||m.framing)):ui("Update required; this outlook is based on an older completed session.","نیازمند بروزرسانی؛ این چشم‌انداز مربوط به جلسهٔ قبلی است.")}</p>
      <details class="analog-details reading-copy"><summary>${ui('Historical comparison','مقایسه با گذشته')}</summary>
        <p class="explanation-note">${ui('Compared with this market’s usual returns. These are historical observations, not a probability of profit.','مقایسه با بازده معمول همین بازار است؛ این نتایج تاریخی‌اند و احتمال سود را نشان نمی‌دهند.')}</p>
        <div class="outlook-grid">
          ${[[5,h5],[20,h20]].map(([days,h])=>`<div><small>${ui(days+' sessions',days+' جلسهٔ معاملاتی')}</small><b class="${toneClass(h?.tone||h?.label)}">${esc(words(h?.label||h?.tone))}</b><em>${ui('Evidence confidence','اطمینان به شواهد')}: ${esc(words(h?.confidence))}</em><em>${esc(words(h?.analogLevel))} · ${ui('Samples','نمونه‌ها')}: <bdi>${Number.isFinite(h?.sample?.overall)?h.sample.overall:'—'}</bdi></em></div>`).join('')}
        </div>
      </details>
      ${marketLevelsHtml(m.levels)}
      ${m.specificSetupWarning?.warning?`<p class="setup-caution reading-copy">${ui('The exact current setup has weaker recent follow-through than its broader group.','وضعیت دقیق فعلی در نمونه‌های اخیر، ادامهٔ حرکت ضعیف‌تری از گروه کلی خود داشته است.')}</p>`:''}
    </article>`;
  }).join('');
  const portfolioValue=s.currency?money(s.value,s.currency):s.complete.length?'Mixed currencies':'—';
  const pnl=s.currency?`${money(s.pnl,s.currency)} · ${pct(s.pnlPct)}`:'—';

  return `<div class="stack dashboard-layout">
    <div class="grid home-hero">
      <section class="panel report-panel" id="homeBrief"><div class="panel-inner report-shell">
        <div class="report-topline">
          <div>
            <div class="eyebrow">${ui("Today’s brief","خلاصهٔ امروز")}</div>
            <div class="report-tone">${ui('Market at a glance','بازار در یک نگاه')}</div>
          </div>
          <span class="report-date">${esc(d?.asOf?.latest||'')}</span>
        </div>

        ${swipeTools("homeBriefGroups",d?.groups?.length||0)}
        <div class="report-badges" id="homeBriefGroups" tabindex="0" aria-label="Market brief groups">
          ${(d?.groups||[]).slice(0,3).map(g=>`<div class="brief-group reading-copy"><small>${esc(words(g.label))}</small><b>${(p?.markets||[]).filter(m=>g.markets?.some(x=>x.key===m.key)).every(m=>window.MarketHunterStatus.freshness(m).usable)?esc(words(g.state)):ui("Update required","نیازمند بروزرسانی")}</b><p>${(p?.markets||[]).filter(m=>g.markets?.some(x=>x.key===m.key)).every(m=>window.MarketHunterStatus.freshness(m).usable)?esc(words(g.detail)):ui("Current assessment unavailable; last recorded data is retained.","ارزیابی فعلی در دسترس نیست؛ آخرین دادهٔ ثبت‌شده حفظ شده است.")}</p></div>`).join('')}
        </div>
        <details class="report-details">
          <summary>${ui("Read the full brief","گزارش کامل")}</summary>
          <div class="report-copy reading-copy">${briefFresh?esc(window.MHI18n.headline(d?.executiveSummary?.[0]||d?.summary||d?.headline)):ui("Current cross-market assessment is incomplete; some inputs require an update.","ارزیابی فعلی بازار کامل نیست؛ بعضی داده‌ها نیاز به بروزرسانی دارند.")}</div>
          ${changes?`<div class="brief-focus reading-copy"><h4>${ui('Worth watching','موارد قابل پیگیری')}</h4><div class="change-list">${changes}</div></div>`:''}
        </details>
      </div></section>
      <section class="panel soft">
        <div class="panel-head"><div><h3>${ui("Markets","بازارها")}</h3><p>${ui("Latest available prices and daily change.","آخرین قیمت موجود و تغییر روزانه")}</p></div></div>
        ${swipeTools("homeMarkets",p?.markets?.length||0)}<div class="market-list mobile-rail" id="homeMarkets" tabindex="0" aria-label="Markets">${markets||'<div class="empty">Market Pulse unavailable.</div>'}</div>
      </section>
    </div>


    <div class="grid home-lower">
      <section class="panel soft">
        <div class="panel-head"><div><h2>${ui("Today’s shortlist","سهم‌های منتخب امروز")}</h2><p>${ui("One leader from each stage.","یک سهم منتخب از هر مرحله")}</p></div><button class="btn ghost" data-open="shortlist">${ui("View all ↗","مشاهدهٔ همه ↗")}</button></div>
        ${swipeTools("homePicks",picks.length)}<div class="home-picks mobile-rail" id="homePicks" tabindex="0" aria-label="Selected stocks">${rows||'<div class="empty">'+ui('No current shortlist.','فهرست منتخب فعلاً خالی است.')+'</div>'}</div>
      </section>

      <section class="panel soft">
        <div class="panel-head"><div><h3>${ui("Your portfolio","پورتفولیوی تو")}</h3><p>${ui("Holdings and performance.","سهم‌ها و عملکرد")}</p></div><button class="btn ghost" data-open="portfolio">${ui("Open ↗","مشاهده ↗")}</button></div>
        <div class="portfolio-glance">
          <div class="eyebrow">${ui("Current value","ارزش فعلی")}</div>
          <div class="portfolio-value">${portfolioValue}</div>
          <div class="portfolio-pnl ${cls(s.pnl)==='up'?'metric-good':cls(s.pnl)==='down'?'metric-bad':'metric-flat'}">${pnl}</div>
          <div class="glance-grid">
            <div class="glance-stat"><small>${ui("Holdings","سهم‌ها")}</small><b>${s.rows.length}</b></div>
            <div class="glance-stat"><small>${ui("Needs attention","نیازمند بررسی")}</small><b>${s.attention.length}</b></div>
            <div class="glance-stat"><small>${ui("Changed today","تغییر امروز")}</small><b>${s.changed.length}</b></div>
          </div>
        </div>
      </section>
    </div>

    ${hunterMonitorHtml()}
    ${outlook?`<details class="panel soft outlook-panel dashboard-disclosure"><summary>${ui("Market outlook","چشم‌انداز بازار")}<span>${ui("Historical analogs · weekly and monthly","الگوهای تاریخی · هفتگی و ماهانه")}</span></summary>${swipeTools("marketOutlook",d?.markets?.length||0)}<div class="outlook-track mobile-rail" id="marketOutlook" tabindex="0" aria-label="Market outlook">${outlook}</div></details>`:''}
  </div>`;
}

function hunterMonitorHtml(){
  const d=state.hunterMonitor;
  const heading=ui('Market Hunter follow-up','پیگیری سهم‌های مارکت هانتر');
  if(!d)return `<details class="panel soft dashboard-disclosure"><summary>${heading}</summary><p class="reading-copy">${ui('Tracking data is unavailable. Refresh to retry.','دادهٔ پیگیری فعلاً در دسترس نیست؛ بروزرسانی را امتحان کن.')}</p></details>`;
  const labels={progress:['🟢 Progress','🟢 پیشرفت'],cooling:['🟡 Cooling','🟡 تضعیف'],support_broken:['🔴 Support broken','🔴 شکست حمایت'],watch:['🟡 Watch','🟡 نیازمند پیگیری'],new:['🆕 New','🆕 تازه‌وارد'],unavailable:['⚪ Quote unavailable','⚪ قیمت ناموجود']};
  const reasons={quote_unavailable:['Completed-session quote unavailable','قیمت جلسهٔ کامل در دسترس نیست'],no_post_selection_session:['No session after selection yet','هنوز جلسه‌ای پس از معرفی نداریم'],support_broken:['Below the first selection support or latest local low','زیر حمایت هنگام معرفی یا کف محلی اخیر'],momentum_fading:['Momentum fading','شتاب حرکت کمتر شده'],below_ma20:['Below MA20','زیر میانگین ۲۰روزه'],above_first_selection:['Above first selection price','بالاتر از قیمت اولین معرفی'],no_positive_follow_through:['No positive follow-through yet','هنوز پیشرفت قیمتی ندارد']};
  const overdue=state.v2?.marketAsOf&&d.marketAsOf<state.v2.marketAsOf;
  return `<details class="panel soft dashboard-disclosure hunter-monitor"><summary>${heading}<span>${d.rows.length} ${ui('stocks · through','سهم · تا')} ${esc(d.marketAsOf)}</span></summary>
    <p class="reading-copy">${ui('Tracked since','شروع ثبت')} ${esc(d.firstRecordedDate)} · ${d.summary.up} ${ui('up','مثبت')} · ${d.summary.down} ${ui('down','منفی')} · ${d.summary.new} ${ui('new','تازه‌وارد')} · ${d.summary.missing} ${ui('missing quotes','قیمت ناموجود')}. ${ui('Returns start at each stock’s first recorded selection; holding periods differ.','بازده از اولین معرفی ثبت‌شدهٔ هر سهم است؛ مدت پیگیری یکسان نیست.')}</p>
    ${overdue?`<p class="setup-caution">${ui('Monitor is behind the latest scan.','مانیتور از آخرین اسکن عقب‌تر است.')}</p>`:''}
    <div class="hunter-monitor-scroll"><table><thead><tr><th>${ui('Stock / first selection','سهم / اولین معرفی')}</th><th>${ui('Since selection','از معرفی')}</th><th>${ui('Follow-up','وضعیت پیگیری')}</th></tr></thead><tbody>${d.rows.map(r=>`<tr><td><button class="symbol-link" data-chart="${esc(r.symbol)}"><bdi>${esc(short(r.symbol))}</bdi> ↗</button><small>${esc(r.firstDate)} · ${esc(stageLabel(r.entryStage))}</small></td><td class="${cls(r.sinceSelectionPct)}"><bdi>${pct(r.sinceSelectionPct)}</bdi></td><td><b>${ui(...(labels[r.status]||labels.unavailable))}</b><small>${r.reasons.map(x=>ui(...(reasons[x]||[x,x]))).map(esc).join(' · ')}</small><small>${r.surfaced?ui('Still selected','هنوز منتخب'):ui('Outside current shortlist; tracking continues','خارج از فهرست منتخب؛ پیگیری ادامه دارد')}${r.currentStage?' · '+esc(stageLabel(r.currentStage)):''}</small></td></tr>`).join('')}</tbody></table></div>
    <p class="reading-copy">${ui('Descriptive follow-up, not trades or portfolio profit. Leaving the shortlist is not automatically a failed setup.','پیگیری توصیفی است، نه معامله یا سود پورتفولیو. خروج از فهرست به‌تنهایی شکست نیست.')}</p></details>`;
}

function stockSummaryHtml(x){
  const r=window.MHI18n?.technical(x);
  if(!r)return `<p class="analysis-copy">${esc(stockNarrative(x))}</p>`;
  return `<div class="stock-summary analysis-copy"><small class="explanation-eyebrow">${ui('Technical','تکنیکال')}</small><p class="stock-summary-lead">${esc(r.summary.join(' '))}</p><small class="technical-session">${ui('Completed session','جلسهٔ کامل ثبت‌شده')}: <bdi>${esc(r.completedSession||ui('Unavailable','ناموجود'))}</bdi></small><div class="technical-monitor"><h4>${ui('What to watch','موارد قابل پیگیری')}</h4>${r.monitor.length?'<ul>'+r.monitor.map(v=>'<li>'+esc(v.text)+(v.level!==null?' <bdi class="technical-level">'+fmt(v.level)+'</bdi>':'')+'</li>').join('')+'</ul>':'<p>'+ui('Insufficient data for stock-specific monitoring conditions.','دادهٔ کافی برای تعیین موارد پیگیری اختصاصی این سهم موجود نیست.')+'</p>'}</div></div>`;
}
function fundamentalHtml(x){
  const r=window.MHFundamentals?.reading(state.fundamentals,x.symbol,window.MHI18n?.language()||'en');
  const title=ui('Fundamental','فاندامنتال');
  if(!r||r.status==='unavailable')return `<details class="stock-fundamental unavailable" data-fundamental-symbol="${esc(x.symbol)}"><summary><span>${title}</span><small>${state.fundamentalStatus==='loading'?ui('Loading','در حال دریافت'):ui('Not available','ناموجود')}</small></summary><p class="reading-copy">${ui('Verified financial context is not available for this stock. Its technical selection is unchanged.','توضیح مالی تأییدشده برای این سهم موجود نیست. انتخاب تکنیکال آن تغییری نمی‌کند.')}</p></details>`;
  const retained=state.fundamentalStatus==='retained'?'<small class="setup-caution">'+ui('Refresh failed · showing the previous financial snapshot.','به‌روزرسانی ناموفق بود؛ آخرین تصویر مالی موجود نمایش داده می‌شود.')+'</small>':'';
  const basis=r.period.basis==='fiscal-year'?ui('Fiscal year','سال مالی'):ui('Quarter','سه‌ماهه');
  return `<details class="stock-fundamental" data-fundamental-symbol="${esc(x.symbol)}"><summary><span>${title}</span><small>${basis} · <bdi>${esc(r.period.end)}</bdi></small></summary><div class="fundamental-reading analysis-copy"><p class="reading-copy">${esc(r.context)}</p><p class="stock-summary-lead">${esc(r.summary)}</p><p class="reading-copy">${esc(r.uncertainty)}</p>${r.instrumentNote?'<p class="explanation-note">'+esc(r.instrumentNote)+'</p>':''}<div class="technical-monitor"><h4>${ui('What to watch','موارد قابل پیگیری')}</h4><ul>${r.monitoring.map(s=>'<li>'+esc(s)+'</li>').join('')}</ul></div><div class="fundamental-source">${retained}<a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${ui('Original financial filing','گزارش مالی اصلی')} ↗</a><small>${ui('Filed','تاریخ ثبت')}: <bdi>${esc(r.filed)}</bdi> · ${ui('Snapshot reviewed','بازبینی تصویر مالی')}: <bdi>${esc(r.reviewedAt.slice(0,10))}</bdi></small><small>${ui('Limited coverage · financial filings are not refreshed automatically yet.','پوشش محدود · گزارش‌های مالی هنوز به‌صورت خودکار به‌روز نمی‌شوند.')}</small>${r.status==='older-period'?'<small class="setup-caution">'+ui('Older financial period; check for a newer filing.','دورهٔ مالی قدیمی است؛ گزارش جدیدتر را بررسی کن.')+'</small>':''}</div></div></details>`;
}
function stockCard(x,rank=''){
  const watched=state.watch.has(x.symbol),owned=state.positions.has(x.symbol);
  return `<article class="card hunter-card">
    <div class="cardtop"><div class="name"><button class="symbol-link" data-chart="${esc(x.symbol)}" aria-label="Open ${esc(x.symbol)} chart"><bdi>${short(x.symbol)}</bdi> ↗</button><small><bdi>${esc(x.name||x.symbol)}</bdi></small></div><div class="cardprice"><div class="price-line"><bdi>${money(x.price,x.displayQuote?.currency||'CAD')}</bdi><small class="day-change ${cls(x.dayChangePct)}"><bdi>${pct(x.dayChangePct)}</bdi></small></div>${quoteMetaHtml(x.displayQuote||quoteFor(x.symbol,state.liveItems.get(x.symbol)||x))}</div></div>
    <div class="tags"><span class="tag">${rank?'<bdi>'+rank+'</bdi> · ':''}${esc(stageLabel(x.stage))}</span><span class="tag"><bdi>RSI ${Number.isFinite(x.rsi14)?x.rsi14.toFixed(0):'—'}</bdi></span></div>
    ${window.MarketHunterEngines?.confirmation(state.engines,x.symbol,state.v2)||''}
    ${stockSummaryHtml(x)}
    ${fundamentalHtml(x)}
    <details class="stock-technical"><summary>${ui('Technical details','جزئیات تکنیکال')}</summary><div class="metrics"><div class="metric"><small>${ui('20-day move','تغییر ۲۰روزه')}</small><b class="${cls(x.ret20)}"><bdi>${pct(x.ret20)}</bdi></b></div><div class="metric"><small>${ui('Vs benchmark · 20D','نسبت به شاخص · ۲۰روز')}</small><b class="${cls(x.rs20)}"><bdi>${Number.isFinite(x.rs20)?(x.rs20>=0?'+':'')+x.rs20.toFixed(1)+' pp':'—'}</bdi></b></div><div class="metric"><small>${ui('Momentum shift','تغییر شتاب')}</small><b class="${cls(x.momentumShift)}"><bdi>${Number.isFinite(x.momentumShift)?x.momentumShift.toFixed(1)+'pp':'—'}</bdi></b></div></div><p class="explanation-note reading-copy">${ui('Relative strength compares 20-day returns with the benchmark. Momentum shift shows how much the pace changed. Both use percentage points (pp), not your portfolio return.','قدرت نسبی، اختلاف بازده ۲۰روزه با شاخص مبناست. تغییر شتاب می‌گوید سرعت حرکت چقدر تغییر کرده. واحد هر دو «واحد درصد» (pp) است؛ این اعداد سود پورتفولیوی تو نیستند.')}</p><div class="technical-grid"><div><small>${ui('Benchmark','شاخص مبنا')}</small><b><bdi>${esc(x.benchmark||'—')}</bdi></b></div><div><small>${ui('From 60-day high','فاصله از سقف ۶۰روزه')}</small><b><bdi>${pct(x.pullback60)}</bdi></b></div><div><small>${ui('ATR','نوسان (ATR)')}</small><b><bdi>${pct(x.atr14Pct)}</bdi></b></div><div><small>${ui('Above / below MA20','فاصله از میانگین ۲۰روزه')}</small><b><bdi>${pct(x.dist20)}</bdi></b></div><div><small>${ui('Above / below MA50','فاصله از میانگین ۵۰روزه')}</small><b><bdi>${pct(x.dist50)}</bdi></b></div></div>${(()=>{const r=window.MHI18n?.read(x);return r&&(r.now.length||r.watch.length)?'<div class="copy"><strong>'+ui('Supporting observations','مشاهدات پشتیبان')+'</strong><p>'+esc([...r.now,...r.watch].join(' '))+'</p></div>':''})()}</details>
    <div class="actions"><button class="btn" data-chart="${x.symbol}">${ui('Chart ↗','نمودار ↗')}</button><button class="btn" data-watch="${x.symbol}" aria-pressed="${watched}">${watched?ui('♥ Saved','♥ ذخیره شد'):ui('♡ Watch','♡ دیده‌بان')}</button><button class="btn ${owned?'':'primary'}" data-buy="${x.symbol}">${owned?ui('Edit','ویرایش'):ui('Bought','خریده‌ام')}</button></div>
  </article>`;
}
function shortlistHtml(){
  const stage=REVIEW_STAGES.includes(state.reviewStage)?state.reviewStage:REVIEW_STAGES[0];
  const counts=Object.fromEntries(REVIEW_STAGES.map(s=>[s,stageEligiblePicks(s).length]));
  const picks=stageEligiblePicks(stage);
  const tabs=REVIEW_STAGES.map(s=>`<button class="stage-tab ${s===stage?'active':''}" data-stage-tab="${esc(s)}" aria-pressed="${s===stage}"><span>${esc(stageLabel(s))}</span><bdi>${counts[s]}</bdi></button>`).join('');
  return `<div class="stack"><section class="panel soft">
    <div class="sectionhead"><div><h2>${ui('Choose a stage','انتخاب مرحله')}</h2><p>${ui('Choose a stage, then review each chart.','مرحله را انتخاب کن و سهم‌ها را بررسی کن.')}</p></div><span class="tag"><bdi>${Object.values(counts).reduce((x,y)=>x+y,0)}</bdi> <span>${ui(Object.values(counts).reduce((x,y)=>x+y,0)===1?'chart':'charts','سهم')}</span></span></div>
    <div class="stage-tabs">${tabs}</div>
    <div class="stage-summary"><b>${esc(stageLabel(stage))}</b><span><bdi>${picks.length}</bdi> ${ui(picks.length===1?'chart to review':'charts to review','سهم برای بررسی')} <small class="review-swipe-hint">· ${ui('Swipe ↔','ورق بزن ↔')}</small></span></div>
    <div class="cards">${picks.length?picks.map((x,i)=>stockCard(x,i+1)).join(''):'<div class="empty">'+ui('No charts meet this stage’s criteria.','سهمی با معیارهای این مرحله پیدا نشده.')+'</div>'}</div>
  </section></div>`;
}
function portfolioSummary(){
  const rows=[...state.positions.values()].map(p=>{const x=state.portfolioItems.get(p.symbol);return {p,x,display:quoteFor(p.symbol,x)}});
  const complete=rows.filter(({p,display})=>Number(p.quantity)>0&&Number(p.entryPrice)>0&&numeric(display?.price));
  const currencies=new Set(complete.map(({x,display})=>display?.currency||x?.currency||'UNKNOWN'));
  const single=currencies.size===1&&!currencies.has('UNKNOWN'),currency=single?[...currencies][0]:null;
  const value=single?complete.reduce((sum,{p,display})=>sum+Number(p.quantity)*Number(display.price),0):null;
  const cost=single?complete.reduce((sum,{p})=>sum+Number(p.quantity)*Number(p.entryPrice),0):null;
  const pnl=single?value-cost:null,pnlPct=single&&cost>0?pnl/cost*100:null;
  const attention=rows.filter(({x})=>health(x).tone!=='good');
  const changed=[];
  for(const {p,x} of rows){const reasons=changeReasons(x,state.previous.get(p.symbol));if(reasons.length)changed.push({symbol:p.symbol,reasons})}
  let breadth=null,top1=null,top3=null;
  if(single&&Number.isFinite(value)&&value>0){
    const weighted=complete.map(({p,x,display})=>{
      const positionValue=Number(p.quantity)*Number(display.price);
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
    <details class="portfolio-narrative"><summary>Full portfolio assessment</summary><div class="portfolio-read-copy">
      <p><strong>Health</strong> ${esc(healthCopy)}</p>
      <p><strong>Concentration</strong> ${esc(concentration)}</p>
      <p><strong>Recent performance</strong> ${esc(performance)}</p>
      <p><strong>Risk</strong> ${esc(risk)}</p>
      <p><strong>Diversification</strong> ${esc(diversification)}</p>
    </div></details>
  </section>`;
}
let allocationMode='holdings',allocationSelected=null;
const ALLOCATION_COLORS=['#35cfa0','#42bfea','#658cf5','#ad86ee','#edac65','#e77fa9','#76bdb3','#b6bc69'];
function holdingSector(x){
  if(typeof x?.exposure?.group==='string'&&x.exposure.group.trim())return x.exposure.group.trim();
  const sector=typeof x?.sector==='string'?x.sector.trim():'';
  return !sector||/^(cdr|unknown|other|n\/a)$/i.test(sector)?'Unknown':sector;
}
function allocationData(s,mode){
  // Do not normalize a partially priced portfolio to a misleading 100%.
  if(!s.rows.length)return {items:[],reason:'Add a holding to see your allocation.'};
  if(s.complete.length!==s.rows.length)return {items:[],reason:'Allocation is unavailable until every holding has a valid quantity, cost and price.'};
  if(!s.currency||!Number.isFinite(s.value))return {items:[],reason:'Combined weights are hidden because holdings use multiple or unknown currencies. Individual positions are still monitored.'};
  if(s.value<=0||s.complete.some(({display})=>Number(display.price)<=0))return {items:[],reason:'Allocation needs positive market values for every holding.'};
  const groups=new Map();
  for(const {p,x,display} of s.complete){
    const key=mode==='sectors'?holdingSector(x):p.symbol;
    const item=groups.get(key)||{key,name:mode==='sectors'?key:short(p.symbol),value:0,members:[]};
    item.value+=Number(p.quantity)*Number(display.price);item.members.push(short(p.symbol));groups.set(key,item);
  }
  const items=[...groups.values()].sort((a,b)=>b.value-a.value||a.key.localeCompare(b.key));
  items.forEach((item,i)=>{item.weight=item.value/s.value*100;item.color=item.key==='Unknown'?'#94a3b8':ALLOCATION_COLORS[i%ALLOCATION_COLORS.length]});
  return {items,reason:null};
}
function allocationHtml(s){
  const {items,reason}=allocationData(s,allocationMode);
  const tabs=`<div class="allocation-tabs" role="group" aria-label="Allocation breakdown"><button type="button" data-allocation-mode="holdings" aria-pressed="${allocationMode==='holdings'}">Holdings</button><button type="button" data-allocation-mode="sectors" aria-pressed="${allocationMode==='sectors'}">Exposure</button></div>`;
  const heading='<div class="sectionhead"><div><h3>Your allocation</h3><p>See how your portfolio fits together.</p></div></div>';
  if(reason)return `<section class="panel soft allocation-panel" id="portfolioAllocation">${heading}${tabs}<p class="read">${esc(reason)}</p></section>`;
  const selected=items.find(item=>item.key===allocationSelected);
  let angle=-Math.PI/2;
  const arcs=items.map((item,i)=>{
    const end=angle+item.weight/100*Math.PI*2,mid=(angle+end)/2;
    const point=a=>`${100+76*Math.cos(a)},${100+76*Math.sin(a)}`;
    const d=`M ${point(angle)} A 76 76 0 0 1 ${point(mid)} A 76 76 0 0 1 ${point(end)}`;angle=end;
    return `<path d="${d}" fill="none" stroke="${item.color}" stroke-width="${selected?.key===item.key?24:19}" data-allocation-item="${i}" class="allocation-arc"><title>${esc(item.name)}: ${item.weight.toFixed(1)}%</title></path>`;
  }).join('');
  const legend=items.map((item,i)=>`<button type="button" class="allocation-item" data-allocation-item="${i}" aria-pressed="${selected?.key===item.key}"><i style="background:${item.color}" aria-hidden="true"></i><span>${esc(item.name)}<small>${money(item.value,s.currency)}${allocationMode==='sectors'?' · '+esc(item.members.join(', ')):''}</small></span><b>${item.weight.toFixed(1)}%</b></button>`).join('');
  return `<section class="panel soft allocation-panel" id="portfolioAllocation">${heading}${tabs}<div class="allocation-body"><div class="allocation-chart"><svg viewBox="0 0 200 200" aria-hidden="true">${arcs}</svg><div class="allocation-center" aria-live="polite"><strong>${selected?selected.weight.toFixed(1)+'%':items.length}</strong><span>${selected?esc(selected.name):allocationMode==='sectors'?'exposures':'holdings'}</span>${selected?`<small>${money(selected.value,s.currency)}</small>`:''}</div></div><div class="allocation-legend">${legend}</div></div><p class="allocation-caption">${esc(s.currency)} · Market value · Tap to explore</p><div class="allocation-summary">Largest ${allocationMode==='sectors'?'exposure':'holding'}: <strong>${esc(items[0].name)} · ${items[0].weight.toFixed(1)}%</strong></div><details class="allocation-method"><summary>About this breakdown</summary><p>Exposure groups describe the underlying asset: company sectors, gold or silver. CDRs follow the underlying company. Funds use verified mandates; this is not a full look-through of every fund holding. Mixed gold-and-silver funds remain a separate group.</p><p>Weights use current holding values, not leverage-adjusted risk exposure. Quotes can have different timestamps. Unverified classifications remain Unknown.</p></details></section>`;
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
  const display=quoteFor(p.symbol,x),h=health(x),qty=Number(p.quantity)||0,value=numeric(display.price)&&qty>0?qty*Number(display.price):null,ret=numeric(display.price)&&Number(p.entryPrice)>0?(Number(display.price)/Number(p.entryPrice)-1)*100:null;
  const weight=Number.isFinite(total)&&Number.isFinite(value)&&total>0?value/total*100:null,e=x?.entryStats;
  const read=positionNarrative(p,x,weight);
  return `<article class="card portfolio-slide">
    <div class="cardtop"><div class="name"><button class="symbol-link" data-chart="${esc(p.symbol)}" aria-label="Open ${esc(p.symbol)} chart">${esc(short(p.symbol))} <span aria-hidden="true">↗</span></button><small>${esc(x?.name||p.symbol)}</small></div><span class="health ${h.tone}">${h.label}</span></div>
    <div class="holding-quote"><div class="holding-price">${money(display.price,display.currency||x?.currency||'CAD')}</div><div class="holding-change ${cls(display.changePct)}">${pct(display.changePct)}<small>Daily change</small></div></div>${quoteMetaHtml(display)}
    <div class="tags"><span class="tag">${p.source==='market-hunter'?'Market Hunter':'Manual / External'}</span><span class="tag">${qty||'—'} shares</span><span class="tag exposure-tag">${esc(holdingSector(x))}${x?.exposure?.instrument&&x.exposure.instrument!=='Unknown'?' · '+esc(x.exposure.instrument):''}</span></div>
    <div class="metrics"><div class="metric"><small>Value</small><b>${x?money(value,x.currency):'—'}</b></div><div class="metric"><small>Weight</small><b>${Number.isFinite(weight)?weight.toFixed(1)+'%':'—'}</b></div><div class="metric"><small>Since entry</small><b class="${cls(ret)}">${pct(ret)}</b></div><div class="metric"><small>RSI</small><b>${Number.isFinite(x?.rsi14)?x.rsi14.toFixed(0):'—'}</b></div></div>
    <p class="holding-status">${esc(h.notes[0])}</p>
    <details class="holding-analysis"><summary>Chart read <span>Strength, risks & levels</span></summary>${insightRowsHtml(x)}</details>
    <details><summary>Position details</summary><div class="copy">${(()=>{const q=positionQuickRead(p,x,weight);return '<div class="quick-read-rows"><div><span>Now</span><b>'+esc(q.now)+'</b></div><div><span>Since entry</span><b>'+esc(q.since)+'</b></div><div><span>Portfolio impact</span><b>'+esc(q.impact)+'</b></div></div>';})()}${x?.exposure?`<strong>Exposure</strong><br>${esc(x.exposure.assetClass)} · ${esc(x.exposure.group)}<br>${esc(x.exposure.detail)}${x.exposure.source&&x.exposure.source.startsWith('https://')?`<br><a href="${esc(x.exposure.source)}" target="_blank" rel="noopener noreferrer">Issuer details ↗</a>`:''}<br><br>`:''}<strong>Your entry</strong><br>Purchased ${esc(p.boughtAt||'—')} · Avg cost ${x?money(p.entryPrice,x.currency):fmt(p.entryPrice)} · Source ${p.source==='market-hunter'?'Market Hunter':'Manual / External'}<br><br><strong>Current chart</strong><br>Entry stage ${esc(p.entryStage||'Not captured')} · Current stage ${esc(x?.stage||'Outside active stages')} · RS vs benchmark ${pct(x?.rs20)} · Momentum shift ${Number.isFinite(x?.momentumShift)?x.momentumShift.toFixed(1)+'pp':'—'}${e?'<br><br><strong>Since entry details</strong><br>Best move '+pct(e.maxGainPct)+' · Max drawdown '+pct(e.maxDrawdownPct)+' · Benchmark '+pct(e.benchmarkReturnPct)+' · Excess '+pct(e.excessVsBenchmarkPct):''}${p.notes?'<br><br><strong>Your note</strong><br>'+esc(p.notes):''}</div></details>
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
    portfolioDaily:currentDailyPayload()
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
  const now=new Date().toISOString(),next=normalizeEnvelope(state.envelope);
  for(const symbol of Object.keys(next.positions))next.positions[symbol]={value:null,deleted:true,updatedAt:now};
  for(const symbol of Object.keys(next.watchlist))next.watchlist[symbol]={present:false,updatedAt:now};
  for(const p of valid){const symbol=String(p.symbol).toUpperCase();next.positions[symbol]={value:{...p,symbol,updatedAt:now},deleted:false,updatedAt:now}}
  for(const symbol of data.watchlist.filter(Boolean)){next.watchlist[String(symbol).toUpperCase()]={present:true,updatedAt:now}}
  state.envelope=next;hydrateEnvelope();persistEnvelope();queueCloudSync();
  persistDaily(data.portfolioDaily||null);
  await loadPortfolio();renderAll();setView('portfolio');toast('Backup restored');
}
function telegramBridgeNoticeHtml(){
  if(!telegramBridgeRequested()||hasVisibleData(state.envelope))return '';
  return `<section class="panel soft"><div class="sectionhead"><div><h3>اتصال پورتفولیو به تلگرام</h3><p>این مرورگر پورتفولیوی ذخیره‌شده‌ی تو را ندارد.</p></div></div><div class="read">اگر این صفحه داخل مرورگر خود Telegram باز شده، از منوی مرورگر Telegram گزینه <b>Open in Safari</b> را بزن. باید همین لینک کامل در Safari باز شود؛ آنجا پورتفولیوی اصلی تو خوانده و یک‌بار Sync می‌شود.</div><div class="portfolio-tools"><button class="btn primary" data-copy-bridge-link>کپی لینک امن اتصال</button></div></section>`;
}

function cloudPanelHtml(){
  const connected=telegramBridgeEnabled();
  const updated=telegramBridgeUpdatedAt?quoteTimeLabel(telegramBridgeUpdatedAt):'';
  if(connected){
    return `<div class="cloud-panel"><div class="cloud-row"><div><b>Backend portfolio</b><small>Supabase is the source of truth. This browser keeps only a local cache.</small></div><span class="cloud-badge synced">Connected</span></div><div class="cloud-message">Your holdings can be restored from the backend even if browser storage is cleared.${updated?' Last backend update: '+esc(updated)+'.':''}</div><div class="cloud-actions"><button class="btn ghost" data-backend-sync>Sync now</button></div></div>`;
  }
  return `<div class="cloud-panel"><div class="cloud-row"><div><b>Backend portfolio</b><small>This browser is not paired yet. Pair it from the private Telegram bot; no email/password account is required.</small></div><span class="cloud-badge">Not paired</span></div><div class="cloud-message">Open Telegram → Portfolio → اتصال پورتفولیوی سایت, then open the signed link in the browser that currently contains your portfolio.</div></div>`;
}
function portfolioReconnectHtml(){
  if(state.positions.size||telegramBridgeEnabled()||state.cloud.session)return '';
  const preview=location.hostname!=='market-hunter-five.vercel.app'&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1';
  return `<section class="panel portfolio-reconnect"><h2>${ui('Already have a portfolio?','پورتفولیو داری اما اینجا نمی‌بینی؟')}</h2><p>${preview?ui('This preview has a separate browser connection. Your usual app’s saved portfolio is not loaded here automatically.','این نسخهٔ آزمایشی اتصال جداگانه‌ای دارد و پورتفولیوی مرورگر اصلی را خودکار نمی‌خواند.'):ui('Connect this browser to your saved portfolio using your private Telegram bot.','این مرورگر را از طریق بات خصوصی تلگرام به پورتفولیوی ذخیره‌شده وصل کن.')}</p><ol><li>${ui('In your private Telegram bot, open Portfolio → اتصال پورتفولیوی سایت.','در بات خصوصی تلگرام، «پورتفولیو ← اتصال پورتفولیوی سایت» را باز کن.')}</li><li>${ui('Open the secure link in Safari. It restores saved holdings in a new browser.','لینک امن را در Safari باز کن؛ پورتفولیوی ذخیره‌شده در مرورگر تازه بازیابی می‌شود.')}</li></ol><div class="reconnect-actions">${preview?'<a class="btn primary" href="https://market-hunter-five.vercel.app/">'+ui('Open your usual app ↗','بازکردن سایت اصلی ↗')+'</a>':''}<button class="btn" data-restore>${ui('Restore a backup','بازیابی فایل پشتیبان')}</button></div></section>`;
}
function portfolioHtml(){
  const s=portfolioSummary();
  if(!s.rows.length)return `<div class="stack portfolio-layout">${portfolioReconnectHtml()}${telegramBridgeNoticeHtml()}<section class="panel soft"><div class="empty portfolio-empty"><strong>${ui(telegramBridgeEnabled()?'No saved holdings':'No holdings in this browser',telegramBridgeEnabled()?'پوزیشن ذخیره‌شده‌ای نیست':'این مرورگر هنوز پوزیشنی ندارد')}</strong><p>${ui('If you are starting a new portfolio, add a holding with your purchase price and date.','اگر می‌خواهی پورتفولیوی تازه بسازی، سهم را با قیمت و تاریخ خرید ثبت کن.')}</p><button class="btn primary" data-add>${ui('Add holding','افزودن سهم')}</button></div></section><section class="panel soft portfolio-account" id="portfolioAccount">${cloudPanelHtml()}</section></div>`;
  const syncLabel=telegramBridgeEnabled()
    ?'Backend portfolio'
    :state.cloud.session?(state.cloud.status==='error'?'Sync issue':state.cloud.status==='synced'?'Cloud synced':state.cloud.status==='syncing'?'Syncing…':'Cloud connected'):'Local cache';
  const changeBlock=s.changed.length?`<section class="panel soft"><div class="sectionhead"><div><h3>What changed today</h3><p>Versus prior saved market-day snapshot.</p></div></div><div class="devs">${s.changed.map(x=>`<div class="dev"><b>${short(x.symbol)}</b><span>${esc(x.reasons.join(' · '))}</span></div>`).join('')}</div></section>`:'';
  const attentionBlock=s.attention.length?`<details class="panel soft attention-panel portfolio-disclosure"><summary>Current attention <span>${s.attention.length} holding(s) to review</span></summary><div class="attention-cards">${s.attention.map(({p,x})=>{const display=quoteFor(p.symbol,x);return `<article class="attention-card"><div class="attention-head"><b>${short(p.symbol)}</b><span class="day-change ${cls(display.changePct)}">${pct(display.changePct)}</span><span class="health ${health(x).tone}">${esc(health(x).label)}</span></div>${quoteMetaHtml(display)}${insightRowsHtml(x)}<button class="btn ghost" data-chart="${p.symbol}">Chart ↗</button></article>`}).join('')}</div></details>`:'';
  return `<div class="stack portfolio-layout">
    ${portfolioReconnectHtml()}
    ${telegramBridgeNoticeHtml()}
    <section class="panel portfolio-overview"><div class="sectionhead"><div><div class="eyebrow">YOUR ACCOUNT</div><h2>At a glance</h2><p>Your holdings, in perspective.</p></div><button class="btn primary" data-add>+ Add holding</button></div>
      <div class="portfolio-hero"><div><span class="hero-label">Portfolio value</span><strong class="hero-value">${s.currency?money(s.value,s.currency):s.complete.length?'Mixed currencies':'—'}</strong></div><div class="hero-return"><span class="hero-label">Total P/L</span><strong class="${cls(s.pnl)}">${s.currency?money(s.pnl,s.currency):'—'}</strong><span class="return-percent ${cls(s.pnlPct)}">${s.currency?pct(s.pnlPct):'—'}</span></div></div>
      <div class="portfolio-stats"><div><span>Cost basis</span><b>${s.currency?money(s.cost,s.currency):'—'}</b></div><div><span>Holdings</span><b>${s.rows.length}</b></div><div><span>Attention weight</span><b>${s.breadth?s.breadth.attention.toFixed(0)+'%':'—'}</b></div></div>
      <div class="read">${s.breadth?s.breadth.attention.toFixed(0)+'% of portfolio value is currently in cooling/watch or warning conditions.':(s.attention.length?s.attention.length+' holding(s) deserve closer review.':s.rows.length?'Waiting for enough data to assess your holdings.':'Add your first holding to start monitoring your portfolio.')}</div>


    </section>
    <a class="portfolio-sync-link" href="#portfolioAccount">${esc(syncLabel)} <span>Backend & backup ↗</span></a>
    ${allocationHtml(s)}
    <section class="panel soft holdings-panel"><div class="sectionhead"><div><h3>Your holdings <span class="holdings-count">${s.rows.length}</span></h3><p>Price, performance and the next thing to watch.</p></div><span class="swipe-hint">${s.rows.length>1?'Swipe to browse ↔':''}</span></div><div class="portfolio-carousel">${s.rows.length?s.rows.map(({p,x})=>positionCard(p,x,s.value)).join(''):'<div class="empty portfolio-empty"><span aria-hidden="true">＋</span><strong>Your portfolio starts here</strong><p>Add a holding with your purchase price and date to see its progress.</p><button class="btn primary" data-add>Add your first holding</button></div>'}</div></section>
    ${changeBlock}${attentionBlock}
    <details class="panel dashboard-disclosure portfolio-analysis"><summary>${ui("Portfolio analysis","تحلیل پورتفولیو")}<span>${ui("Breadth, concentration and risk","وضعیت سهم‌ها، تمرکز و ریسک")}</span></summary><div class="portfolio-context">${portfolioReadHtml(s)}${riskHtml()}</div></details>
    <details class="panel soft portfolio-account dashboard-disclosure" id="portfolioAccount"><summary>${ui("Connection & backup","اتصال و پشتیبان")}<span>${esc(syncLabel)}</span></summary>${cloudPanelHtml()}<details><summary>Backup & restore</summary><div class="portfolio-tools"><button class="btn" data-backup>Export backup</button><button class="btn" data-restore>Restore backup</button></div></details></details>
  </div>`;
}

function watchlistHtml(){
  const by=new Map(allCandidates().map(x=>[x.symbol,x])),items=[...state.watch];
  return `<div class="stack"><section class="panel soft"><div class="sectionhead"><div><h2>${ui("Saved charts","سهم‌های ذخیره‌شده")}</h2><p>${ui("Your watchlist stays here as the shortlist changes.","با تغییر فهرست منتخب، سهم‌های ذخیره‌شده اینجا می‌مانند.")}</p></div><span class="tag">${items.length}</span></div>${swipeTools("watchCards",items.length)}<div class="cards mobile-rail" id="watchCards" tabindex="0" aria-label="Saved stocks">${items.length?items.map(symbol=>{
    const current=by.get(symbol),live=state.liveItems.get(symbol),display=quoteFor(symbol,live);
    if(current)return stockCard(current);
    return `<article class="card"><div class="cardtop"><div class="name"><b>${short(symbol)}</b><small>Outside current Hunter surface</small></div><div class="cardprice"><div class="price-line">${money(display.price,display.currency||'CAD')}<small class="day-change ${cls(display.changePct)}">${pct(display.changePct)}</small></div>${quoteMetaHtml(display)}</div></div><div class="actions"><button class="btn" data-chart="${symbol}">Chart ↗</button><button class="btn danger" data-watch="${symbol}">Remove</button></div></article>`;
  }).join(''):'<div class="empty"><strong>'+ui('Your watchlist is empty','دیده‌بان خالی است')+'</strong><p>'+ui('Save a stock from Review to follow it here.','در صفحهٔ بررسی، سهمی را ذخیره کن تا اینجا دنبال کنی.')+'</p><button class="btn primary" data-open="shortlist">'+ui('Explore stocks','بررسی سهم‌ها')+'</button></div>'}</div></section></div>`;
}
let engineLoadSequence=0;
async function loadEngines(){
  const sequence=++engineLoadSequence;
  state.engineSelection.loading=true;state.engineSelection.error=false;
  renderView('engines');
  try{
    const data=await getJson('/api/engines');
    if(sequence!==engineLoadSequence)return;
    if(data?.version!=='engine-dashboard-v1'||!Array.isArray(data.reports))throw new Error('invalid_engine_dashboard');
    state.engines=data;
  }catch{if(sequence===engineLoadSequence)state.engineSelection.error=true;}
  finally{
    if(sequence===engineLoadSequence){state.engineSelection.loading=false;renderView('engines');renderView('shortlist');renderView('watchlist');}
  }
}
function renderView(view){
  if(view==='engines')q('#enginesView').innerHTML=window.MarketHunterEngines?.html(state.engines,state.engineSelection)||'';
  if(view==='home')q('#homeView').innerHTML=homeHtml();
  if(view==='shortlist')q('#shortlistView').innerHTML=shortlistHtml();
  if(view==='portfolio')q('#portfolioView').innerHTML=portfolioHtml();
  if(view==='watchlist')q('#watchlistView').innerHTML=watchlistHtml();
}
function renderAll(){['home','shortlist','portfolio','watchlist','engines'].forEach(renderView)}
function setView(view){
  state.view=view;
  qa('.view').forEach(el=>el.classList.toggle('active',el.id===view+'View'));
  qa('.navbtn').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
  const titles={home:'Market overview',shortlist:'Review',portfolio:'Portfolio',watchlist:'Watchlist',engines:'Engines'};
  const title=q('#pageTitle');if(title)title.textContent=window.MHI18n?.t(titles[view]||'Market Hunter',({home:'خانه',shortlist:'بررسی سهم‌ها',portfolio:'پورتفولیو',watchlist:'دیده‌بان',engines:'موتورها'})[view]||'مارکت هانتر')||titles[view];
  renderView(view);window.scrollTo({top:0,behavior:'smooth'});
  document.querySelector('.app-shell')?.scrollTo({top:0,behavior:'instant'});
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
    setPositionRecord(rec);closeModal();await loadPortfolio();renderAll();setView('portfolio');toast('Position saved');
  };
}
function closeRiskInfo(except=null){
  qa('.risk-info[open]').forEach(d=>{if(d!==except)d.open=false});
}
for(const event of ['pointerdown','wheel'])document.addEventListener(event,e=>{const rail=e.target.closest?.('.mobile-rail');if(rail)pendingRailTargets.delete(rail)},{passive:true});
document.addEventListener('click',async e=>{
  const swipe=e.target.closest('[data-swipe]');if(swipe){const rail=document.getElementById(swipe.dataset.swipe);if(rail)stepRail(rail,Number(swipe.dataset.step));return}
  if(e.target.closest('.portfolio-sync-link')){const account=q('#portfolioAccount');if(account?.tagName==='DETAILS')account.open=true;}
  const allocationControl=e.target.closest('[data-allocation-mode],[data-allocation-item]');
  if(allocationControl){
    const mode=allocationControl.dataset.allocationMode;
    if(mode){allocationMode=mode==='sectors'?'sectors':'holdings';allocationSelected=null}
    else {const item=allocationData(portfolioSummary(),allocationMode).items[Number(allocationControl.dataset.allocationItem)];allocationSelected=item?.key===allocationSelected?null:item?.key}
    q('#portfolioAllocation').outerHTML=allocationHtml(portfolioSummary());
    const selector=mode?`[data-allocation-mode="${allocationMode}"]`:`button[data-allocation-item="${allocationControl.dataset.allocationItem}"]`;
    q('#portfolioAllocation').querySelector(selector)?.focus({preventScroll:true});return;
  }
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
  if(e.target.closest('#languageBtn')){window.MHI18n.toggle();renderAll();setView(state.view);return}
  if(e.target.closest('[data-engine-refresh]')){loadEngines();return}
  const engineTab=e.target.closest('[data-engine-tab]');if(engineTab){state.engineSelection.engine=engineTab.dataset.engineTab;renderView('engines');return}
  const engineMarket=e.target.closest('[data-engine-market]');if(engineMarket){state.engineSelection.cohort=engineMarket.dataset.engineMarket;renderView('engines');return}
  const engineMode=e.target.closest('[data-engine-mode]');if(engineMode){state.engineSelection.mode=engineMode.dataset.engineMode;renderView('engines');return}
  const engineOpen=e.target.closest('[data-engine-open]');if(engineOpen){state.engineSelection.engine=engineOpen.dataset.engineOpen;state.engineSelection.cohort=engineOpen.dataset.engineCohort;state.engineSelection.mode=engineOpen.dataset.enginePending==='true'?'pending':'open';setView('engines');return}
  const stageTab=e.target.closest('[data-stage-tab]');if(stageTab){state.reviewStage=stageTab.dataset.stageTab;renderView('shortlist');qa('[data-stage-tab]').find(el=>el.dataset.stageTab===state.reviewStage)?.focus({preventScroll:true});return}
  const open=e.target.closest('[data-open]');if(open){setView(open.dataset.open);return}
  const engineChart=e.target.closest('[data-engine-chart]');if(engineChart){const symbol=engineChart.dataset.engineChart;if(/\.(TO|V|NE)$/.test(symbol))openChart(symbol);else window.open('https://www.tradingview.com/chart/?symbol='+encodeURIComponent(symbol.replace('-USD','USD')),'_blank','noopener,noreferrer');return}
  const chart=e.target.closest('[data-chart]');if(chart){openChart(chart.dataset.chart);return}
  const watch=e.target.closest('[data-watch]');if(watch){const s=watch.dataset.watch,present=!state.watch.has(s);setWatchMembership(s,present);renderAll();toast(present?'Saved':'Removed');return}
  if(e.target.closest('[data-cloud-toggle]')){state.cloud.showAuth=!state.cloud.showAuth;state.cloud.message='';renderView('portfolio');return}
  if(e.target.closest('[data-backend-sync]')){await syncTelegramBridgeNow({announce:true}).catch(()=>false);renderView('portfolio');return}
  if(e.target.closest('[data-cloud-sync]')){await syncPortfolioCloud();return}
  if(e.target.closest('[data-cloud-import-local]')){await importGuestPortfolio();return}
  if(e.target.closest('[data-cloud-signout]')){await cloudSignOut();return}
  if(e.target.closest('[data-cloud-signin]')||e.target.closest('[data-cloud-signup]')){
    const email=q('[data-cloud-email]')?.value.trim()||'',password=q('[data-cloud-password]')?.value||'';
    if(!email||password.length<6){state.cloud.status='error';state.cloud.message='Enter a valid email and a password with at least 6 characters.';renderView('portfolio');return}
    if(e.target.closest('[data-cloud-signin]'))await cloudSignIn(email,password);else await cloudSignUp(email,password);
    return;
  }
  const buy=e.target.closest('[data-buy]');if(buy){openPosition(buy.dataset.buy,'market-hunter');return}
  if(e.target.closest('[data-copy-bridge-link]')){
    try{
      await navigator.clipboard.writeText(location.href);
      toast('لینک اتصال کپی شد؛ آن را در Safari باز کن');
    }catch{toast('از منوی مرورگر Telegram گزینه Open in Safari را بزن')}
    return;
  }
  if(e.target.closest('[data-backup]')){exportBackup();return}
  if(e.target.closest('[data-restore]')){q('#backupFile')?.click();return}
  if(e.target.closest('[data-add]')){openPosition('','manual');return}
  const edit=e.target.closest('[data-edit]');if(edit){openPosition(edit.dataset.edit,state.positions.get(edit.dataset.edit)?.source||'manual');return}
  const remove=e.target.closest('[data-remove]');if(remove&&confirm('Remove '+remove.dataset.remove+' from Portfolio Monitor?')){removePositionRecord(remove.dataset.remove);await loadPortfolio();renderAll();toast('Removed');return}
  if(e.target.closest('[data-close]')||e.target===q('#positionModal'))closeModal();
});
q('#themeBtn')?.addEventListener('click',()=>{
  const current=document.documentElement.dataset.theme||'dark';
  applyTheme(current==='dark'?'light':'dark');
});
applyTheme(document.documentElement.dataset.theme||'dark');
q('#refreshBtn')?.addEventListener('click',load);
q('#backupFile')?.addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';
  await importBackupFile(file);
});
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));
}
window.addEventListener('scroll',()=>closeRiskInfo(),{passive:true});
load();
