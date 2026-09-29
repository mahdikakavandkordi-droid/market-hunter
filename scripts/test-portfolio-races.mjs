import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('app.js','utf8');
const cut=source.indexOf('async function load(){');
assert.ok(cut>0,'app test seam not found');
const core=source.slice(0,cut)+`
globalThis.__mh={
  state,saveCloudSession,ensureCloudSession,scopeId,stateStorageKey,dailyStorageKey,
  readEnvelopeFor,readDailyFor,switchLocalScope,persistDaily,loadCloudPortfolio,
  syncCloudSnapshot,syncPortfolioCloud,queueCloudSync,loadPortfolio,snapshotAttempt,savePortfolioSnapshot,currentDailyPayload
};
`;

class MemoryStorage{
  constructor(initial={}){this.map=new Map(Object.entries(initial).map(([k,v])=>[k,String(v)]))}
  getItem(k){return this.map.has(k)?this.map.get(k):null}
  setItem(k,v){this.map.set(k,String(v))}
  removeItem(k){this.map.delete(k)}
}
function response(status,body){
  return {ok:status>=200&&status<300,status,
    async json(){return body},
    async text(){return body===null||body===undefined?'':JSON.stringify(body)}};
}
function deferred(){
  let resolve,reject;
  const promise=new Promise((res,rej)=>{resolve=res;reject=rej});
  return {promise,resolve,reject};
}
function session(id,token=id+'-token',expires_at=4102444800){
  return {access_token:token,refresh_token:id+'-refresh',expires_at,user:{id,email:id+'@example.test'}};
}
function envFor(symbol,at='2026-09-29T01:00:00.000Z'){
  return {version:3,positions:{[symbol]:{value:{symbol,quantity:1,entryPrice:100,updatedAt:at},deleted:false,updatedAt:at}},watchlist:{}};
}
function dailyFor(symbol,{capturedAt='2026-09-29T01:00:00.000Z',sourceGeneratedAt=capturedAt,date='2026-09-28'}={}){
  return {
    previousDate:null,previousItems:[],currentDate:date,currentComplete:true,
    currentItems:[{symbol,price:100,asOf:date}],
    currentMeta:{complete:true,requestedSymbols:[symbol],capturedAt,sourceGeneratedAt}
  };
}
function boot(initial={},fetchImpl=async()=>response(500,{message:'unexpected fetch'})){
  const localStorage=new MemoryStorage(initial);
  const context={
    localStorage,fetch:fetchImpl,console,Date,Number,String,Boolean,Set,Map,Math,JSON,Intl,
    encodeURIComponent,decodeURIComponent,setTimeout,clearTimeout,Promise,
    document:{querySelector(){return null},querySelectorAll(){return[]}},
    window:{open(){},scrollTo(){}}
  };
  context.globalThis=context;
  vm.runInNewContext(core,context,{filename:'app-race-core.js'});
  return {h:context.__mh,storage:localStorage};
}
const parse=(storage,key)=>JSON.parse(storage.getItem(key)||'null');
const tick=()=>new Promise(r=>setTimeout(r,0));
async function settleStale(promise){
  try{return await promise}catch(e){assert.equal(e?.code,'STALE_SESSION_OPERATION','only session-generation invalidation may abort this operation');return null}
}

// A -> B while A's initial cloud load is pending.
{
  const A=session('user-a'),B=session('user-b');
  const stateReq=deferred(),snapReq=deferred();
  const {h,storage}=boot({marketHunterCloudSessionV1:JSON.stringify(A)},async url=>{
    const u=String(url);
    if(u.includes('market_hunter_portfolio_state'))return stateReq.promise;
    if(u.includes('market_hunter_portfolio_snapshots'))return snapReq.promise;
    return response(500,{message:'unexpected '+u});
  });
  const pending=h.loadCloudPortfolio();
  h.saveCloudSession(B);h.switchLocalScope(B);
  stateReq.resolve(response(200,[{payload:envFor('RY.TO'),revision:4,updated_at:'2026-09-29T01:00:00Z'}]));
  snapReq.resolve(response(200,[]));
  await settleStale(pending);
  const b=parse(storage,'marketHunterPortfolioV3:user:user-b');
  assert.equal(Boolean(b?.positions?.['RY.TO']),false,'A response must not be persisted into B local scope');
}

// A -> logout while A load is pending.
{
  const A=session('user-a');
  const stateReq=deferred(),snapReq=deferred();
  const {h,storage}=boot({marketHunterCloudSessionV1:JSON.stringify(A)},async url=>{
    if(String(url).includes('market_hunter_portfolio_state'))return stateReq.promise;
    if(String(url).includes('market_hunter_portfolio_snapshots'))return snapReq.promise;
    return response(500,{});
  });
  const pending=h.loadCloudPortfolio();
  h.saveCloudSession(null);h.switchLocalScope(null);
  stateReq.resolve(response(200,[{payload:envFor('RY.TO'),revision:2,updated_at:'2026-09-29T01:00:00Z'}]));
  snapReq.resolve(response(200,[]));
  await settleStale(pending);
  const guest=parse(storage,'marketHunterPortfolioV3:guest');
  assert.equal(Boolean(guest?.positions?.['RY.TO']),false,'signed-out guest scope must not receive A response');
}

// A -> logout -> A: old generation must remain invalid even with same account id.
{
  const A1=session('user-a','old-token'),A2=session('user-a','new-token');
  const stateReq=deferred(),snapReq=deferred();
  const initial={
    marketHunterCloudSessionV1:JSON.stringify(A1),
    'marketHunterPortfolioV3:user:user-a':JSON.stringify(envFor('ENB.TO','2026-09-29T02:00:00Z'))
  };
  const {h,storage}=boot(initial,async url=>{
    if(String(url).includes('market_hunter_portfolio_state'))return stateReq.promise;
    if(String(url).includes('market_hunter_portfolio_snapshots'))return snapReq.promise;
    return response(500,{});
  });
  const pending=h.loadCloudPortfolio();
  h.saveCloudSession(null);h.switchLocalScope(null);
  h.saveCloudSession(A2);h.switchLocalScope(A2);
  stateReq.resolve(response(200,[{payload:envFor('RY.TO','2026-09-29T00:30:00Z'),revision:1,updated_at:'2026-09-29T00:30:00Z'}]));
  snapReq.resolve(response(200,[]));
  await settleStale(pending);
  const current=parse(storage,'marketHunterPortfolioV3:user:user-a');
  assert.equal(Boolean(current?.positions?.['RY.TO']),false,'old A generation must not mutate later A generation');
  assert.equal(Boolean(current?.positions?.['ENB.TO']),true);
}

// Account changes while token refresh is pending.
{
  const A=session('user-a','expired',1),B=session('user-b','b-token');
  const refresh=deferred();
  const {h,storage}=boot({marketHunterCloudSessionV1:JSON.stringify(A)},async url=>{
    assert.match(String(url),/grant_type=refresh_token/);
    return refresh.promise;
  });
  const pending=h.ensureCloudSession();
  h.saveCloudSession(B);h.switchLocalScope(B);
  refresh.resolve(response(200,{access_token:'a-new',refresh_token:'a-r2',expires_in:3600,user:A.user}));
  await pending;
  assert.equal(h.state.cloud.session.user.id,'user-b','stale refresh must not restore A');
  assert.equal(parse(storage,'marketHunterCloudSessionV1').user.id,'user-b');
}


// Debounced sync scheduled by A must be invalidated when the active account changes.
{
  const A=session('user-a'),B=session('user-b');let requests=0;
  const {h}=boot({marketHunterCloudSessionV1:JSON.stringify(A)},async()=>{requests++;return response(200,[])});
  h.state.cloud.ready=true;
  h.queueCloudSync();
  h.saveCloudSession(B);h.switchLocalScope(B);
  await new Promise(r=>setTimeout(r,700));
  assert.equal(requests,0,'account change must cancel A queued synchronization work');
}

// Portfolio API response must not apply after account change.
{
  const A=session('user-a'),B=session('user-b');
  const req=deferred();
  const initial={
    marketHunterCloudSessionV1:JSON.stringify(A),
    'marketHunterPortfolioV3:user:user-a':JSON.stringify(envFor('RY.TO')),
    'marketHunterPortfolioV3:user:user-b':JSON.stringify(envFor('ENB.TO'))
  };
  const {h,storage}=boot(initial,async url=>{
    if(String(url).startsWith('/api/portfolio?'))return req.promise;
    return response(500,{});
  });
  const pending=h.loadPortfolio();
  h.saveCloudSession(B);h.switchLocalScope(B);
  req.resolve(response(200,{generatedAt:'2026-09-29T02:00:00Z',items:[{symbol:'RY.TO',price:110,asOf:'2026-09-28'}],failures:[]}));
  await pending;
  assert.equal(h.state.portfolioItems.has('RY.TO'),false,'A portfolio response must not enter B UI state');
  const bDaily=parse(storage,'marketHunterPortfolioDailyV3:user:user-b');
  assert.equal(Boolean(bDaily?.currentItems?.some(x=>x.symbol==='RY.TO')),false,'A snapshot must not persist under B');
}

// Account change during snapshot synchronization: stale operation must not issue a write.
{
  const A=session('user-a'),B=session('user-b'),get=deferred();
  const writes=[];
  const initial={
    marketHunterCloudSessionV1:JSON.stringify(A),
    'marketHunterPortfolioV3:user:user-a':JSON.stringify(envFor('RY.TO')),
    'marketHunterPortfolioDailyV3:user:user-a':JSON.stringify(dailyFor('RY.TO'))
  };
  const {h}=boot(initial,async(url,opts={})=>{
    const method=opts.method||'GET';
    if(method==='GET'&&String(url).includes('market_hunter_portfolio_snapshots'))return get.promise;
    if(method!=='GET'){writes.push({url:String(url),method,body:opts.body});return response(200,[])}
    return response(500,{});
  });
  const pending=h.syncCloudSnapshot(A);
  h.saveCloudSession(B);h.switchLocalScope(B);
  get.resolve(response(200,[]));
  await settleStale(pending);
  assert.equal(writes.length,0,'stale snapshot operation must not continue into cloud writes');
}

// Missing per-item dates must not qualify as complete.
{
  const {h}=boot();
  const attempt=h.snapshotAttempt({items:[
    {symbol:'RY.TO',price:100,asOf:'2026-09-28'},
    {symbol:'ENB.TO',price:50}
  ],failures:[]},['RY.TO','ENB.TO']);
  assert.equal(attempt.complete,false,'all required items must carry the session date');
}

// A newer same-day server snapshot must not be overwritten by a stale local snapshot.
{
  const A=session('user-a'),patches=[];
  const local=dailyFor('RY.TO',{capturedAt:'2026-09-29T01:00:00Z',sourceGeneratedAt:'2026-09-29T01:00:00Z'});
  const remote={marketAsOf:'2026-09-28',items:[{symbol:'RY.TO',price:111,asOf:'2026-09-28'}],complete:true,
    meta:{complete:true,requestedSymbols:['RY.TO'],capturedAt:'2026-09-29T02:00:00Z',sourceGeneratedAt:'2026-09-29T02:00:00Z'}};
  const initial={
    marketHunterCloudSessionV1:JSON.stringify(A),
    'marketHunterPortfolioV3:user:user-a':JSON.stringify(envFor('RY.TO')),
    'marketHunterPortfolioDailyV3:user:user-a':JSON.stringify(local)
  };
  const {h}=boot(initial,async(url,opts={})=>{
    const method=opts.method||'GET';
    if(method==='GET')return response(200,[{payload:remote,revision:8,updated_at:'2026-09-29T02:05:00Z'}]);
    patches.push(JSON.parse(opts.body||'{}'));return response(200,[{revision:9}]);
  });
  await h.syncCloudSnapshot(A);
  assert.equal(patches.length,0,'stale local same-day snapshot must not replace fresher remote');
}

// Old subset cannot be uploaded after reconciled portfolio adds another holding.
{
  const A=session('user-a'),writes=[];
  const envelope=envFor('RY.TO');envelope.positions['ENB.TO']={value:{symbol:'ENB.TO',quantity:1,entryPrice:50,updatedAt:'2026-09-29T02:00:00Z'},deleted:false,updatedAt:'2026-09-29T02:00:00Z'};
  const initial={
    marketHunterCloudSessionV1:JSON.stringify(A),
    'marketHunterPortfolioV3:user:user-a':JSON.stringify(envelope),
    'marketHunterPortfolioDailyV3:user:user-a':JSON.stringify(dailyFor('RY.TO'))
  };
  const {h}=boot(initial,async(url,opts={})=>{
    if((opts.method||'GET')==='GET')return response(200,[]);
    writes.push({url:String(url),body:opts.body});return response(204,null);
  });
  await h.syncCloudSnapshot(A);
  assert.equal(writes.length,0,'snapshot for old portfolio subset must not be uploaded as complete');
}

// Intentional deletion: current smaller composition may replace an old larger-composition snapshot.
{
  const A=session('user-a'),writes=[];
  const local=dailyFor('RY.TO',{capturedAt:'2026-09-29T03:00:00Z',sourceGeneratedAt:'2026-09-29T03:00:00Z'});
  const remote={marketAsOf:'2026-09-28',items:[
    {symbol:'RY.TO',price:105,asOf:'2026-09-28'},{symbol:'ENB.TO',price:60,asOf:'2026-09-28'}
  ],complete:true,meta:{complete:true,requestedSymbols:['RY.TO','ENB.TO'],capturedAt:'2026-09-29T02:00:00Z',sourceGeneratedAt:'2026-09-29T02:00:00Z'}};
  const initial={
    marketHunterCloudSessionV1:JSON.stringify(A),
    'marketHunterPortfolioV3:user:user-a':JSON.stringify(envFor('RY.TO')),
    'marketHunterPortfolioDailyV3:user:user-a':JSON.stringify(local)
  };
  const {h}=boot(initial,async(url,opts={})=>{
    const method=opts.method||'GET';
    if(method==='GET')return response(200,[{payload:remote,revision:3,updated_at:'2026-09-29T02:05:00Z'}]);
    writes.push(JSON.parse(opts.body||'{}'));return response(200,[{revision:4}]);
  });
  await h.syncCloudSnapshot(A);
  assert.equal(writes.length,1,'current composition after intentional deletion should be allowed to replace old context');
}


// Deleting the final holding creates an explicit empty context for the existing session date.
{
  const A=session('user-a');
  const initial={
    marketHunterCloudSessionV1:JSON.stringify(A),
    'marketHunterPortfolioV3:user:user-a':JSON.stringify({version:3,positions:{},watchlist:{}}),
    'marketHunterPortfolioDailyV3:user:user-a':JSON.stringify(dailyFor('RY.TO',{capturedAt:'2026-09-29T01:00:00Z'}))
  };
  const {h,storage}=boot(initial);
  const changed=h.savePortfolioSnapshot({items:[],failures:[]},[]);
  assert.equal(changed,true);
  const daily=parse(storage,'marketHunterPortfolioDailyV3:user:user-a');
  assert.equal(daily.currentDate,'2026-09-28');
  assert.deepEqual(daily.currentItems,[]);
  assert.equal(daily.currentMeta.portfolioEmpty,true);
  assert.deepEqual(daily.currentMeta.portfolioSymbols,[]);
}

// Revision conflict must re-read and retain a better remote snapshot.
{
  const A=session('user-a'),patches=[];
  const local=dailyFor('RY.TO',{capturedAt:'2026-09-29T02:00:00Z',sourceGeneratedAt:'2026-09-29T02:00:00Z'});
  const oldRemote={marketAsOf:'2026-09-28',items:[{symbol:'RY.TO',price:99,asOf:'2026-09-28'}],complete:true,
    meta:{complete:true,requestedSymbols:['RY.TO'],capturedAt:'2026-09-29T01:00:00Z',sourceGeneratedAt:'2026-09-29T01:00:00Z'}};
  const betterRemote={marketAsOf:'2026-09-28',items:[{symbol:'RY.TO',price:120,asOf:'2026-09-28'}],complete:true,
    meta:{complete:true,requestedSymbols:['RY.TO'],capturedAt:'2026-09-29T03:00:00Z',sourceGeneratedAt:'2026-09-29T03:00:00Z'}};
  let gets=0;
  const initial={
    marketHunterCloudSessionV1:JSON.stringify(A),
    'marketHunterPortfolioV3:user:user-a':JSON.stringify(envFor('RY.TO')),
    'marketHunterPortfolioDailyV3:user:user-a':JSON.stringify(local)
  };
  const {h}=boot(initial,async(url,opts={})=>{
    const method=opts.method||'GET';
    if(method==='GET'){gets++;return response(200,[{payload:gets===1?oldRemote:betterRemote,revision:gets===1?5:6,updated_at:'2026-09-29T03:01:00Z'}])}
    patches.push(JSON.parse(opts.body||'{}'));
    if(patches.length===1)return response(200,[]); // CAS conflict
    return response(200,[{revision:7}]);
  });
  await h.syncCloudSnapshot(A);
  assert.equal(patches.length,1,'after conflict, better remote must stop stale retry overwrite');
}

console.log('PASS: async account isolation and deterministic same-day snapshot replacement');
