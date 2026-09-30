const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
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
let cloudSyncTimer=0,telegramBridgeTimer=0,authAttempt=0,portfolioLoadSequence=0;
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
  view:'home',reviewStage:'Early Watch',daily:null,pulse:null,v2:null,
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
async function syncTelegramBridgeNow({announce=false}={}){
  const firstConnect=!telegramBridgeEnabled();
  if(firstConnect&&!hasVisibleData(state.envelope)){
    if(announce)toast('No local portfolio was found in this browser. Open the pairing link in the browser where your portfolio is saved.');
    return false;
  }
  const pairing=telegramBridgeParams();
  const response=await fetch('/api/portfolio-bridge',{
    method:'POST',
    credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      payload:normalizeEnvelope(state.envelope),
      ...(pairing.requested&&pairing.userId&&pairing.sig?{user_id:pairing.userId,sig:pairing.sig}:{})
    })
  });
  if(response.status===401){
    try{localStorage.removeItem(TELEGRAM_BRIDGE_MARKER)}catch{}
    if(announce)toast('Telegram pairing is not active in this browser.');
    return false;
  }
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok!==true){
    if(announce)toast('Telegram portfolio sync failed. Try the pairing button again.');
    return false;
  }
  try{localStorage.setItem(TELEGRAM_BRIDGE_MARKER,'connected')}catch{}
  if(announce)toast('Portfolio connected to Telegram');
  return true;
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
function persistDaily(payload){persistDailyFor(state.cloud.session,payload)}
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
  const qv=state.intraday?.quotes?.[symbol];
  if(qv&&numeric(qv.price)){
    const quoteAt=qv.quoteAt||state.intraday?.capturedAt||null;
    const age=Number.isFinite(Date.parse(quoteAt||''))?(Date.now()-Date.parse(quoteAt))/60000:Infinity;
    const stale=Boolean(qv.stale)||age>90;
    const provisional=Boolean(state.intraday?.marketOpen)&&!stale;
    return {
      symbol,price:Number(qv.price),changePct:numeric(qv.changePct)?Number(qv.changePct):null,
      currency:qv.currency||fallback?.currency||null,quoteAt,covered:true,
      state:stale?'stale':provisional?'provisional':'hourly',
      label:stale?'Hourly quote · stale':provisional?'Hourly quote · provisional':'Hourly quote'
    };
  }
  if(fallback&&numeric(fallback.price)){
    const reason=state.intraday?'Not covered by hourly feed':'Hourly feed unavailable';
    return {
      symbol,price:Number(fallback.price),changePct:numeric(fallback.dayChangePct)?Number(fallback.dayChangePct):null,
      currency:fallback.currency||null,quoteAt:fallback.asOf||null,covered:false,state:'fallback',
      label:reason+' · completed-session fallback'
    };
  }
  return {symbol,price:null,changePct:null,currency:fallback?.currency||null,quoteAt:null,covered:false,state:'unavailable',label:state.intraday?'Not covered by hourly feed · unavailable':'Hourly feed unavailable'};
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
async function load(){
  const b=q('#refreshBtn');b.classList.add('busy');b.disabled=true;
  try{
    const [daily,pulse,v2,intraday]=await Promise.allSettled([
      getJsonFallback('/api/research-data?kind=daily','/data/daily-market-report.json'),
      getJsonFallback('/api/research-data?kind=pulse','/data/market-pulse-report.json'),
      getJsonFallback('/api/research-data?kind=v2','/data/v2-latest-scan.json'),
      getJson('/api/intraday')
    ]);
    state.daily=daily.status==='fulfilled'?daily.value:null;
    state.pulse=pulse.status==='fulfilled'?pulse.value:null;
    state.v2=v2.status==='fulfilled'?v2.value:null;
    state.intraday=intraday.status==='fulfilled'?intraday.value:null;
    state.intradayStatus=intraday.status==='fulfilled'?'available':'unavailable';
    const accountCtx=captureSessionContext();
    await initializeCloudPortfolio(accountCtx);
    if(contextActive(accountCtx))await loadCandidateLiveData(accountCtx);
    if(contextActive(accountCtx))await loadPortfolio(accountCtx);
    const bridgeRequested=telegramBridgeRequested();
    if(bridgeRequested||telegramBridgeEnabled()){
      const bridgeSynced=await syncTelegramBridgeNow({announce:bridgeRequested}).catch(()=>false);
      if(bridgeRequested){
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
      }
    }
    const asOf=state.daily?.asOf;
    q('#asOf').textContent=asOf?.mixedDates&&asOf?.earliest&&asOf?.latest
      ?'Completed markets through '+asOf.earliest+' · 24/7 through '+asOf.latest
      :asOf?.latest?'Completed-session data through '+asOf.latest:'Research dashboard';
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
  const intradaySymbolByKey=MARKET_PULSE_INTRADAY_SYMBOLS;
  const markets=(p?.markets||[]).map(x=>{
    const tone=/bull|uptrend|risk-on|strength/i.test(x.regime||'')?'metric-good':/bear|downtrend|risk-off|weak/i.test(x.regime||'')?'metric-bad':'metric-flat';
    const key=x.key||marketKeyByName[x.name]||'';
    const context=developmentByMarket.get(key)?.text||'';
    const completed={price:x.price,dayChangePct:x.current?.returns?.d1??x.returns?.d1,currency:x.currency||null,asOf:x.asOf||d?.asOf?.latest||null};
    const display=quoteFor(intradaySymbolByKey[key],completed);
    return `<div class="market-row">
      <div><b>${esc(x.name)}</b><small>${esc(x.condition||'')}</small></div>
      <div class="market-value"><div class="price-line">${fmt(display.price)}<small class="day-change ${cls(display.changePct)}">${pct(display.changePct)}</small></div>${quoteMetaHtml(display)}</div>
      <div class="market-state ${tone}">${esc(x.regime||'Neutral')}</div>
      ${context?`<div class="market-context">${esc(stripMarketPrefix(context))}</div>`:''}
    </div>`;
  }).join('');
  const rows=picks.map((x,i)=>`<tr><td><span class="rank-dot">${i+1}</span></td><td class="symbol-cell"><b>${short(x.symbol)}</b><small>${esc(x.name||x.symbol)}</small><small class="inline-quote">${money(x.price,x.displayQuote?.currency||'CAD')} <span class="day-change ${cls(x.dayChangePct)}">${pct(x.dayChangePct)}</span></small>${quoteMetaHtml(x.displayQuote)}</td><td><span class="stage-pill">${esc(x.stage)}</span></td><td>RSI ${Number.isFinite(x.rsi14)?x.rsi14.toFixed(0):'—'}</td><td><button class="btn ghost" data-chart="${x.symbol}">Chart ↗</button></td></tr>`).join('');
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
    <div class="cardtop"><div class="name"><button class="symbol-link" data-chart="${esc(x.symbol)}" aria-label="Open ${esc(x.symbol)} chart">${short(x.symbol)} ↗</button><small>${esc(x.name||x.symbol)}</small></div><div class="cardprice"><div class="price-line">${money(x.price,x.displayQuote?.currency||'CAD')}<small class="day-change ${cls(x.dayChangePct)}">${pct(x.dayChangePct)}</small></div>${quoteMetaHtml(x.displayQuote||quoteFor(x.symbol,state.liveItems.get(x.symbol)||x))}</div></div>
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
  const session=state.cloud.session,status=state.cloud.status||'local';
  const badgeClass=status==='synced'?'synced':status==='syncing'?'syncing':status==='error'?'error':'';
  const badgeText=session?(status==='synced'?'Cloud synced':status==='syncing'?'Syncing…':status==='error'?'Sync issue':'Cloud connected'):'Local only';
  const message=state.cloud.message?`<div class="cloud-message">${esc(state.cloud.message)}</div>`:'';
  if(session){
    const migration=guestMigrationAvailable()?'<div class="cloud-message">Local data from before account-scoped sync is still on this device.</div><div class="cloud-actions"><button class="btn primary" data-cloud-import-local>Import local data into this account</button></div>':'';
    return `<div class="cloud-panel"><div class="cloud-row"><div><b>Cloud portfolio</b><small>${esc(session.user?.email||'Signed in')}</small></div><span class="cloud-badge ${badgeClass}">${badgeText}</span></div><div class="cloud-actions"><button class="btn ghost" data-cloud-sync>Sync now</button><button class="btn" data-cloud-signout>Sign out</button></div>${migration}${message}</div>`;
  }
  if(!state.cloud.showAuth){
    return `<div class="cloud-panel"><div class="cloud-row"><div><b>Protect this portfolio</b><small>Keep a private cloud copy and restore it on another device.</small></div><button class="btn primary" data-cloud-toggle>Connect cloud</button></div>${message}</div>`;
  }
  return `<div class="cloud-panel"><div class="cloud-row"><div><b>Market Hunter cloud</b><small>Account data stays isolated. Existing guest data is imported only if you explicitly choose to import it after sign-in.</small></div><button class="btn" data-cloud-toggle>Cancel</button></div><div class="cloud-form"><input type="email" autocomplete="email" placeholder="Email" data-cloud-email><input type="password" autocomplete="current-password" minlength="6" placeholder="Password (6+ chars)" data-cloud-password><button class="btn primary" data-cloud-signin>Sign in</button><button class="btn" data-cloud-signup>Create account</button></div>${message}</div>`;
}
function portfolioHtml(){
  const s=portfolioSummary();
  const syncLabel=state.cloud.session?(state.cloud.status==='error'?'Sync issue':state.cloud.status==='synced'?'Cloud synced':state.cloud.status==='syncing'?'Syncing…':'Cloud connected'):'Local only';
  const changeBlock=s.changed.length?`<section class="panel soft"><div class="sectionhead"><div><h3>What changed today</h3><p>Versus prior saved market-day snapshot.</p></div></div><div class="devs">${s.changed.map(x=>`<div class="dev"><b>${short(x.symbol)}</b><span>${esc(x.reasons.join(' · '))}</span></div>`).join('')}</div></section>`:'';
  const attentionBlock=s.attention.length?`<details class="panel soft attention-panel portfolio-disclosure"><summary>Current attention <span>${s.attention.length} holding(s) to review</span></summary><div class="attention-cards">${s.attention.map(({p,x})=>{const display=quoteFor(p.symbol,x);return `<article class="attention-card"><div class="attention-head"><b>${short(p.symbol)}</b><span class="day-change ${cls(display.changePct)}">${pct(display.changePct)}</span><span class="health ${health(x).tone}">${esc(health(x).label)}</span></div>${quoteMetaHtml(display)}${insightRowsHtml(x)}<button class="btn ghost" data-chart="${p.symbol}">Chart ↗</button></article>`}).join('')}</div></details>`:'';
  return `<div class="stack portfolio-layout">
    ${telegramBridgeNoticeHtml()}
    <section class="panel portfolio-overview"><div class="sectionhead"><div><div class="eyebrow">YOUR ACCOUNT</div><h2>At a glance</h2><p>Your holdings, in perspective.</p></div><button class="btn primary" data-add>+ Add holding</button></div>
      <div class="portfolio-hero"><div><span class="hero-label">Portfolio value</span><strong class="hero-value">${s.currency?money(s.value,s.currency):s.complete.length?'Mixed currencies':'—'}</strong></div><div class="hero-return"><span class="hero-label">Total P/L</span><strong class="${cls(s.pnl)}">${s.currency?money(s.pnl,s.currency):'—'}</strong><span class="return-percent ${cls(s.pnlPct)}">${s.currency?pct(s.pnlPct):'—'}</span></div></div>
      <div class="portfolio-stats"><div><span>Cost basis</span><b>${s.currency?money(s.cost,s.currency):'—'}</b></div><div><span>Holdings</span><b>${s.rows.length}</b></div><div><span>Attention weight</span><b>${s.breadth?s.breadth.attention.toFixed(0)+'%':'—'}</b></div></div>
      <div class="read">${s.breadth?s.breadth.attention.toFixed(0)+'% of portfolio value is currently in cooling/watch or warning conditions.':(s.attention.length?s.attention.length+' holding(s) deserve closer review.':s.rows.length?'Waiting for enough data to assess your holdings.':'Add your first holding to start monitoring your portfolio.')}</div>


    </section>
    <a class="portfolio-sync-link" href="#portfolioAccount">${esc(syncLabel)} <span>Manage account ↗</span></a>
    ${allocationHtml(s)}
    <section class="panel soft holdings-panel"><div class="sectionhead"><div><h3>Your holdings <span class="holdings-count">${s.rows.length}</span></h3><p>Price, performance and the next thing to watch.</p></div><span class="swipe-hint">${s.rows.length>1?'Swipe to browse ↔':''}</span></div><div class="portfolio-carousel">${s.rows.length?s.rows.map(({p,x})=>positionCard(p,x,s.value)).join(''):'<div class="empty portfolio-empty"><span aria-hidden="true">＋</span><strong>Your portfolio starts here</strong><p>Add a holding with your purchase price and date to see its progress.</p><button class="btn primary" data-add>Add your first holding</button></div>'}</div></section>
    ${changeBlock}${attentionBlock}
    <div class="portfolio-context">${portfolioReadHtml(s)}${riskHtml()}</div>
    <section class="panel soft portfolio-account" id="portfolioAccount"><div class="sectionhead"><div><h3>Account & backup</h3><p>Manage sync and keep a copy.</p></div></div>${cloudPanelHtml()}<details><summary>Backup & restore</summary><div class="portfolio-tools"><button class="btn" data-backup>Export backup</button><button class="btn" data-restore>Restore backup</button></div></details></section>
  </div>`;
}

function watchlistHtml(){
  const by=new Map(allCandidates().map(x=>[x.symbol,x])),items=[...state.watch];
  return `<div class="stack"><section class="panel soft"><div class="sectionhead"><div><h2>Watchlist</h2><p>Saved charts remain even after leaving the shortlist.</p></div><span class="tag">${items.length}</span></div><div class="cards">${items.length?items.map(symbol=>{
    const current=by.get(symbol),live=state.liveItems.get(symbol),display=quoteFor(symbol,live);
    if(current)return stockCard(current);
    return `<article class="card"><div class="cardtop"><div class="name"><b>${short(symbol)}</b><small>Outside current Hunter surface</small></div><div class="cardprice"><div class="price-line">${money(display.price,display.currency||'CAD')}<small class="day-change ${cls(display.changePct)}">${pct(display.changePct)}</small></div>${quoteMetaHtml(display)}</div></div><div class="actions"><button class="btn" data-chart="${symbol}">Chart ↗</button><button class="btn danger" data-watch="${symbol}">Remove</button></div></article>`;
  }).join(''):'<div class="empty">Save a chart from the shortlist.</div>'}</div></section></div>`;
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
    setPositionRecord(rec);closeModal();await loadPortfolio();renderAll();setView('portfolio');toast('Position saved');
  };
}
function closeRiskInfo(except=null){
  qa('.risk-info[open]').forEach(d=>{if(d!==except)d.open=false});
}
document.addEventListener('click',async e=>{
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
  const stageTab=e.target.closest('[data-stage-tab]');if(stageTab){state.reviewStage=stageTab.dataset.stageTab;renderView('shortlist');qa('[data-stage-tab]').find(el=>el.dataset.stageTab===state.reviewStage)?.focus({preventScroll:true});return}
  const open=e.target.closest('[data-open]');if(open){setView(open.dataset.open);return}
  const chart=e.target.closest('[data-chart]');if(chart){openChart(chart.dataset.chart);return}
  const watch=e.target.closest('[data-watch]');if(watch){const s=watch.dataset.watch,present=!state.watch.has(s);setWatchMembership(s,present);renderAll();toast(present?'Saved':'Removed');return}
  if(e.target.closest('[data-cloud-toggle]')){state.cloud.showAuth=!state.cloud.showAuth;state.cloud.message='';renderView('portfolio');return}
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
