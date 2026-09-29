import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('app.js','utf8');
const cut=source.indexOf('async function load(){');
assert.ok(cut>0,'app test seam not found');
const core=source.slice(0,cut)+`
globalThis.__mh={
  state,numeric,fmt,pct,money,loadCloudSession,ensureCloudSession,
  scopeId,stateStorageKey,dailyStorageKey,normalizeEnvelope,mergeEnvelopes,
  visiblePositions,visibleWatch,hasVisibleData,readEnvelopeFor,readDailyFor,
  switchLocalScope,hydrateEnvelope,persistEnvelope,setPositionRecord,
  removePositionRecord,setWatchMembership,guestMigrationAvailable,
  captureSessionContext,contextActive,activateSession,cloudSignOut,loadCloudPortfolio,
  loadPortfolio,syncCloudSnapshot,initializeCloudPortfolio,queueCloudSync,
  inspectSnapshot,dailySnapshotCandidate,cloudSnapshotCandidate,chooseSameDaySnapshot,mergeCloudSnapshots,
  MARKET_PULSE_INTRADAY_SYMBOLS,
  quoteFor,quoteTimeLabel,snapshotAttempt,savePortfolioSnapshot,currentDailyPayload,persistDaily,
  syncPortfolioCloud
};
`;

class MemoryStorage{
  constructor(initial={}){this.map=new Map(Object.entries(initial).map(([k,v])=>[k,String(v)]))}
  getItem(k){return this.map.has(k)?this.map.get(k):null}
  setItem(k,v){this.map.set(k,String(v))}
  removeItem(k){this.map.delete(k)}
  clear(){this.map.clear()}
}

function response(status,body){
  return {
    ok:status>=200&&status<300,status,
    async json(){return body},
    async text(){return body===null||body===undefined?'':JSON.stringify(body)}
  };
}
function deferred(){
  let resolve,reject;
  const promise=new Promise((res,rej)=>{resolve=res;reject=rej});
  return {promise,resolve,reject};
}
const session=(id,extra={})=>({access_token:'access-'+id,refresh_token:'refresh-'+id,expires_at:4102444800,user:{id,email:id+'@example.test'},...extra});
const envelopeFor=(symbol,updatedAt='2026-09-29T00:00:00Z')=>({version:3,positions:{[symbol]:{value:{symbol,quantity:1,entryPrice:100,updatedAt},deleted:false,updatedAt}},watchlist:{}});

function boot(initial={},fetchImpl=async()=>response(500,{message:'unexpected fetch'})){
  const localStorage=new MemoryStorage(initial);
  const context={
    localStorage,fetch:fetchImpl,console,Date,Number,String,Boolean,Set,Map,Math,JSON,Intl,
    encodeURIComponent,decodeURIComponent,setTimeout,clearTimeout,Promise,
    document:{querySelector(){return null},querySelectorAll(){return[]}},
    window:{open(){},scrollTo(){}}
  };
  context.globalThis=context;
  vm.runInNewContext(core,context,{filename:'app-core.js'});
  return {h:context.__mh,storage:localStorage,context};
}
const plain=x=>JSON.parse(JSON.stringify(x));

// Numeric unavailable values must not become zero.
{
  const {h}=boot();
  assert.equal(h.pct(null),'—');
  assert.equal(h.pct(undefined),'—');
  assert.equal(h.pct(''),'—');
  assert.equal(h.pct('   '),'—');
  assert.equal(h.pct('not-a-number'),'—');
  assert.equal(h.pct(0),'0.0%');
  assert.equal(h.fmt(null),'—');
  assert.equal(h.fmt(0),'0');
  assert.equal(h.money(''),'—');
  assert.match(h.money(0,'CAD'),/0/);
}


// Quote presentation must distinguish provisional/stale/hourly coverage from completed-session fallback.
{
  const {h}=boot();
  const now=new Date().toISOString();
  h.state.intraday={marketOpen:true,capturedAt:now,quotes:{
    'RY.TO':{price:111.25,changePct:1.2,currency:'CAD',quoteAt:now,stale:false},
    'TD.TO':{price:170,changePct:-0.4,currency:'CAD',quoteAt:now,stale:true}
  }};
  const provisional=h.quoteFor('RY.TO',{price:110,dayChangePct:0.3,currency:'CAD',asOf:'2026-09-25'});
  assert.equal(provisional.state,'provisional');assert.equal(provisional.price,111.25);assert.equal(provisional.changePct,1.2);
  const stale=h.quoteFor('TD.TO',{price:169,dayChangePct:0.1,currency:'CAD',asOf:'2026-09-25'});
  assert.equal(stale.state,'stale');
  const fallback=h.quoteFor('ENB.TO',{price:50,dayChangePct:-0.5,currency:'CAD',asOf:'2026-09-25'});
  assert.equal(fallback.state,'fallback');assert.match(fallback.label,/Not covered by hourly feed/);assert.match(fallback.label,/completed-session fallback/);
  assert.equal(h.quoteTimeLabel('2026-09-25'),'2026-09-25');
}

// Persisted valid session is restored during script initialization.
{
  const session={access_token:'a',refresh_token:'r',expires_at:4102444800,user:{id:'user-a',email:'a@example.test'}};
  const {h}=boot({marketHunterCloudSessionV1:JSON.stringify(session)});
  assert.equal(h.state.cloud.session.user.id,'user-a');
  assert.equal(h.state.cloud.session.access_token,'a');
}

// Expired persisted session refreshes and remains account-scoped.
{
  const old={access_token:'old',refresh_token:'refresh-old',expires_at:1,user:{id:'user-a'}};
  let called=0;
  const {h,storage}=boot({marketHunterCloudSessionV1:JSON.stringify(old)},async url=>{
    called++;
    assert.match(String(url),/grant_type=refresh_token/);
    return response(200,{access_token:'new',refresh_token:'refresh-new',expires_in:3600,user:{id:'user-a'}});
  });
  const fresh=await h.ensureCloudSession();
  assert.equal(called,1);
  assert.equal(fresh.access_token,'new');
  assert.equal(JSON.parse(storage.getItem('marketHunterCloudSessionV1')).access_token,'new');
}

// Corrupt or unusable sessions fail closed without throwing.
{
  const corrupt=boot({marketHunterCloudSessionV1:'{bad json'});
  assert.equal(corrupt.h.state.cloud.session,null);
  const unusable=boot({marketHunterCloudSessionV1:JSON.stringify({access_token:'old',expires_at:1,user:{id:'user-a'}})});
  assert.equal(await unusable.h.ensureCloudSession(),null);
  assert.equal(unusable.storage.getItem('marketHunterCloudSessionV1'),null);
}

// Envelope reconciliation: independent changes survive; deletions beat stale copies.
{
  const {h}=boot();
  const t1='2026-09-28T10:00:00.000Z',t2='2026-09-28T10:05:00.000Z',t3='2026-09-28T10:10:00.000Z',t4='2026-09-28T10:15:00.000Z';
  const a=h.normalizeEnvelope({positions:[{symbol:'RY.TO',quantity:10,entryPrice:100,updatedAt:t1}],watchlist:['BNS.TO']},t1);
  const b=h.normalizeEnvelope({positions:[{symbol:'ENB.TO',quantity:20,entryPrice:50,updatedAt:t2}],watchlist:['TD.TO']},t2);
  let merged=h.mergeEnvelopes(a,b);
  assert.deepEqual([...h.visiblePositions(merged).keys()].sort(),['ENB.TO','RY.TO']);
  assert.deepEqual([...h.visibleWatch(merged)].sort(),['BNS.TO','TD.TO']);

  const aEdit=plain(merged),bEdit=plain(merged);
  aEdit.positions['RY.TO']={value:{...aEdit.positions['RY.TO'].value,quantity:11,updatedAt:t3},deleted:false,updatedAt:t3};
  bEdit.positions['ENB.TO']={value:{...bEdit.positions['ENB.TO'].value,quantity:21,updatedAt:t4},deleted:false,updatedAt:t4};
  merged=h.mergeEnvelopes(aEdit,bEdit);
  assert.equal(h.visiblePositions(merged).get('RY.TO').quantity,11);
  assert.equal(h.visiblePositions(merged).get('ENB.TO').quantity,21);

  const deleted=plain(merged);
  deleted.positions['RY.TO']={value:null,deleted:true,updatedAt:'2026-09-28T10:20:00.000Z'};
  deleted.watchlist['BNS.TO']={present:false,updatedAt:'2026-09-28T10:20:00.000Z'};
  const stale=plain(merged);
  stale.positions['ENB.TO']={value:{...stale.positions['ENB.TO'].value,notes:'offline edit',updatedAt:'2026-09-28T10:25:00.000Z'},deleted:false,updatedAt:'2026-09-28T10:25:00.000Z'};
  const reconciled=h.mergeEnvelopes(deleted,stale);
  assert.equal(h.visiblePositions(reconciled).has('RY.TO'),false,'stale device must not resurrect deleted holding');
  assert.equal(h.visibleWatch(reconciled).has('BNS.TO'),false,'stale device must not resurrect watchlist deletion');
  assert.equal(h.visiblePositions(reconciled).get('ENB.TO').notes,'offline edit');
}

// Legacy local data becomes guest-scoped and is not silently uploaded into an account.
// Switching account scopes must not mix portfolios.
{
  const legacy=[{symbol:'RY.TO',quantity:1,entryPrice:100,updatedAt:'2026-09-28T10:00:00Z'}];
  const sessionA={access_token:'a',refresh_token:'ra',expires_at:4102444800,user:{id:'user-a'}};
  const initial={
    marketHunterCloudSessionV1:JSON.stringify(sessionA),
    marketHunterPositions:JSON.stringify(legacy),
    marketHunterWatchlist:JSON.stringify(['BNS.TO']),
    'marketHunterPortfolioV3:user:user-b':JSON.stringify({version:3,positions:{'ENB.TO':{value:{symbol:'ENB.TO',quantity:2,entryPrice:50},deleted:false,updatedAt:'2026-09-28T11:00:00Z'}},watchlist:{}})
  };
  const {h}=boot(initial);
  assert.equal(h.state.positions.size,0,'user A must not inherit unclaimed guest positions');
  assert.equal(h.guestMigrationAvailable(),true,'legacy guest data should be offered as an explicit migration');
  h.switchLocalScope({user:{id:'user-b'}});
  assert.deepEqual([...h.state.positions.keys()],['ENB.TO']);
  h.switchLocalScope({user:{id:'user-a'}});
  assert.equal(h.state.positions.size,0);
}

// Snapshot integrity: partial/empty/mixed/older attempts never replace the last complete day.
{
  const {h}=boot();
  const item=(symbol,asOf,price)=>({symbol,asOf,price});
  const symbols=['RY.TO','ENB.TO'];
  assert.equal(h.savePortfolioSnapshot({generatedAt:'2026-09-25T21:00:00Z',items:[item('RY.TO','2026-09-25',100),item('ENB.TO','2026-09-25',50)],failures:[]},symbols),true);
  let d=h.currentDailyPayload();
  assert.equal(d.currentDate,'2026-09-25');assert.equal(d.currentItems.length,2);

  assert.equal(h.savePortfolioSnapshot({items:[],failures:symbols.map(symbol=>({symbol,reason:'timeout'}))},symbols),false);
  d=h.currentDailyPayload();assert.equal(d.currentDate,'2026-09-25');assert.equal(d.currentItems.length,2);assert.equal(d.lastAttempt.status,'partial_empty_response');

  assert.equal(h.savePortfolioSnapshot({items:[item('RY.TO','2026-09-26',101)],failures:[{symbol:'ENB.TO',reason:'timeout'}]},symbols),false);
  d=h.currentDailyPayload();assert.equal(d.currentDate,'2026-09-25');assert.equal(d.lastAttempt.status,'partial');

  assert.equal(h.savePortfolioSnapshot({items:[item('RY.TO','2026-09-26',101),item('ENB.TO','2026-09-25',50)],failures:[]},symbols),false);
  d=h.currentDailyPayload();assert.equal(d.currentDate,'2026-09-25');assert.equal(d.lastAttempt.status,'partial_mixed_dates');

  assert.equal(h.savePortfolioSnapshot({items:[item('RY.TO','2026-09-24',99),item('ENB.TO','2026-09-24',49)],failures:[]},symbols),false);
  d=h.currentDailyPayload();assert.equal(d.currentDate,'2026-09-25');assert.equal(d.lastAttempt.status,'older_complete_response');

  assert.equal(h.savePortfolioSnapshot({generatedAt:'2026-09-25T22:00:00Z',items:[item('RY.TO','2026-09-25',102),item('ENB.TO','2026-09-25',51)],failures:[]},symbols),true);
  d=h.currentDailyPayload();assert.equal(d.currentDate,'2026-09-25');assert.equal(d.currentItems[0].price,102);assert.equal(d.previousDate,null);

  assert.equal(h.savePortfolioSnapshot({generatedAt:'2026-09-28T22:00:00Z',items:[item('RY.TO','2026-09-28',103),item('ENB.TO','2026-09-28',52)],failures:[]},symbols),true);
  d=h.currentDailyPayload();assert.equal(d.previousDate,'2026-09-25');assert.equal(d.currentDate,'2026-09-28');assert.equal(d.previousItems[0].price,102);

  assert.equal(h.savePortfolioSnapshot({items:[],failures:[]},[]),false);
  d=h.currentDailyPayload();assert.equal(d.currentDate,'2026-09-28');assert.equal(d.lastAttempt.status,'empty_portfolio');
}

// Exercise server-revision reconciliation with two device contexts sharing one remote row.
// A forced conflict simulates a third writer between read and conditional PATCH.
{
  const remote={row:null,forceConflict:false};
  const fetchImpl=async (url,options={})=>{
    const u=String(url),method=options.method||'GET';
    if(u.includes('/market_hunter_portfolio_snapshots'))return response(200,[]);
    if(!u.includes('/market_hunter_portfolio_state'))return response(500,{message:'unexpected route'});
    if(method==='GET')return response(200,remote.row?[plain(remote.row)]:[]);
    if(method==='POST'){
      if(remote.row)return response(409,{message:'duplicate'});
      const body=JSON.parse(options.body);remote.row={payload:body.payload,revision:body.revision,updated_at:body.updated_at};
      return response(201,[plain(remote.row)]);
    }
    if(method==='PATCH'){
      const expected=Number((u.match(/revision=eq\.(\d+)/)||[])[1]);
      if(remote.forceConflict){
        remote.forceConflict=false;
        const conflictEnvelope=plain(remote.row.payload);
        conflictEnvelope.positions['BMO.TO']={value:{symbol:'BMO.TO',quantity:3,entryPrice:140,updatedAt:'2026-09-28T12:00:00Z'},deleted:false,updatedAt:'2026-09-28T12:00:00Z'};
        remote.row={payload:conflictEnvelope,revision:remote.row.revision+1,updated_at:'2026-09-28T12:00:00Z'};
        return response(200,[]);
      }
      if(!remote.row||remote.row.revision!==expected)return response(200,[]);
      const body=JSON.parse(options.body);remote.row={payload:body.payload,revision:body.revision,updated_at:body.updated_at};
      return response(200,[plain(remote.row)]);
    }
    return response(405,{message:'bad method'});
  };
  const session={access_token:'a',refresh_token:'r',expires_at:4102444800,user:{id:'shared-user'}};
  const a=boot({marketHunterCloudSessionV1:JSON.stringify(session)},fetchImpl);
  const b=boot({marketHunterCloudSessionV1:JSON.stringify(session)},fetchImpl);
  a.h.state.cloud.ready=false;a.h.setPositionRecord({symbol:'RY.TO',quantity:10,entryPrice:100,updatedAt:'2026-09-28T10:00:00Z'});
  a.h.state.cloud.ready=true;await a.h.syncPortfolioCloud();
  b.h.state.cloud.ready=false;b.h.setPositionRecord({symbol:'ENB.TO',quantity:20,entryPrice:50,updatedAt:'2026-09-28T10:05:00Z'});
  b.h.state.cloud.ready=true;remote.forceConflict=true;await b.h.syncPortfolioCloud();
  let r=b.h.visiblePositions(remote.row.payload);
  assert.deepEqual([...r.keys()].sort(),['BMO.TO','ENB.TO','RY.TO'],'conflict retry must preserve all writers');

  a.h.state.cloud.ready=false;a.h.removePositionRecord('RY.TO');a.h.state.cloud.ready=true;await a.h.syncPortfolioCloud();
  b.h.state.cloud.ready=false;b.h.setPositionRecord({symbol:'ENB.TO',quantity:22,entryPrice:50,updatedAt:new Date(Date.now()+1000).toISOString()});b.h.state.cloud.ready=true;await b.h.syncPortfolioCloud();
  r=b.h.visiblePositions(remote.row.payload);
  assert.equal(r.has('RY.TO'),false,'reconnected stale device must preserve remote deletion');
  assert.equal(r.get('ENB.TO').quantity,22);
  assert.equal(r.has('BMO.TO'),true);
}


// Nasdaq-100 presentation must never consume a Nasdaq Composite (^IXIC) quote.
{
  const {h}=boot();
  assert.equal(h.MARKET_PULSE_INTRADAY_SYMBOLS.NASDAQ100,'^NDX');
  h.state.intraday={marketOpen:true,quotes:{'^IXIC':{price:99999,changePct:9,quoteAt:new Date().toISOString(),currency:'USD',stale:false}}};
  const display=h.quoteFor(h.MARKET_PULSE_INTRADAY_SYMBOLS.NASDAQ100,{price:25000,dayChangePct:-0.2,currency:'USD',asOf:'2026-09-28'});
  assert.equal(display.state,'fallback');
  assert.equal(display.price,25000);
}

// Deferred A -> B initial load: A's response must never enter B's state or local storage.
{
  const a=session('user-a'),b=session('user-b'),stateWait=deferred(),snapWait=deferred();
  const initial={
    marketHunterCloudSessionV1:JSON.stringify(a),
    'marketHunterPortfolioV3:user:user-b':JSON.stringify(envelopeFor('ENB.TO'))
  };
  const {h,storage}=boot(initial,async url=>{
    const u=String(url);
    if(u.includes('market_hunter_portfolio_state'))return stateWait.promise;
    if(u.includes('market_hunter_portfolio_snapshots'))return snapWait.promise;
    return response(500,{message:'unexpected'});
  });
  const pending=h.loadCloudPortfolio();
  h.activateSession(b);
  stateWait.resolve(response(200,[{payload:envelopeFor('RY.TO'),revision:2,updated_at:'2026-09-29T00:00:00Z'}]));
  snapWait.resolve(response(200,[]));
  await assert.rejects(pending,/stale_session_operation/);
  assert.deepEqual([...h.state.positions.keys()],['ENB.TO']);
  const stored=JSON.parse(storage.getItem('marketHunterPortfolioV3:user:user-b'));
  assert.equal(Boolean(stored.positions['RY.TO']),false);
}

// Deferred A -> logout: stale load response cannot repopulate guest/account state.
{
  const a=session('user-a'),stateWait=deferred(),snapWait=deferred();
  const {h,storage}=boot({marketHunterCloudSessionV1:JSON.stringify(a)},async (url,opts={})=>{
    const u=String(url);
    if(u.includes('/auth/v1/logout'))return response(200,{});
    if(u.includes('market_hunter_portfolio_state'))return stateWait.promise;
    if(u.includes('market_hunter_portfolio_snapshots'))return snapWait.promise;
    return response(500,{message:'unexpected'});
  });
  const pending=h.loadCloudPortfolio();
  await h.cloudSignOut();
  stateWait.resolve(response(200,[{payload:envelopeFor('RY.TO'),revision:1,updated_at:'2026-09-29T00:00:00Z'}]));
  snapWait.resolve(response(200,[]));
  await assert.rejects(pending,/stale_session_operation/);
  assert.equal(h.state.cloud.session,null);
  assert.equal(Boolean(JSON.parse(storage.getItem('marketHunterPortfolioV3:guest')||'{"positions":{}}').positions?.['RY.TO']),false);
}

// A -> logout -> A: the first A generation stays invalid even when the same user returns.
{
  const a1=session('user-a'),a2=session('user-a',{access_token:'access-user-a-new'}),stateWait=deferred(),snapWait=deferred();
  const {h,storage}=boot({marketHunterCloudSessionV1:JSON.stringify(a1)},async url=>{
    const u=String(url);
    if(u.includes('/auth/v1/logout'))return response(200,{});
    if(u.includes('market_hunter_portfolio_state'))return stateWait.promise;
    if(u.includes('market_hunter_portfolio_snapshots'))return snapWait.promise;
    return response(500,{message:'unexpected'});
  });
  const pending=h.loadCloudPortfolio();
  await h.cloudSignOut();
  h.activateSession(a2);
  stateWait.resolve(response(200,[{payload:envelopeFor('RY.TO'),revision:1,updated_at:'2026-09-29T00:00:00Z'}]));
  snapWait.resolve(response(200,[]));
  await assert.rejects(pending,/stale_session_operation/);
  assert.equal(h.state.cloud.session.access_token,'access-user-a-new');
  assert.equal(Boolean(JSON.parse(storage.getItem('marketHunterPortfolioV3:user:user-a')||'{"positions":{}}').positions?.['RY.TO']),false);
}

// A refresh response arriving after an account change must not restore A.
{
  const expired=session('user-a',{expires_at:1}),refreshWait=deferred();
  const {h}=boot({marketHunterCloudSessionV1:JSON.stringify(expired)},async url=>{
    if(String(url).includes('grant_type=refresh_token'))return refreshWait.promise;
    return response(500,{message:'unexpected'});
  });
  const pending=h.ensureCloudSession();
  h.activateSession(session('user-b'));
  refreshWait.resolve(response(200,{access_token:'new-a',refresh_token:'new-ra',expires_in:3600,user:{id:'user-a'}}));
  assert.equal(await pending,null);
  assert.equal(h.state.cloud.session.user.id,'user-b');
  assert.equal(h.state.cloud.session.access_token,'access-user-b');
}

// Portfolio API response is scoped to the generation that requested it.
{
  const a=session('user-a'),apiWait=deferred();
  const initial={
    marketHunterCloudSessionV1:JSON.stringify(a),
    'marketHunterPortfolioV3:user:user-a':JSON.stringify(envelopeFor('RY.TO')),
    'marketHunterPortfolioV3:user:user-b':JSON.stringify(envelopeFor('ENB.TO'))
  };
  const {h,storage}=boot(initial,async url=>{
    if(String(url).includes('/api/portfolio?'))return apiWait.promise;
    return response(500,{message:'unexpected'});
  });
  const pending=h.loadPortfolio();
  h.activateSession(session('user-b'));
  apiWait.resolve(response(200,{generatedAt:'2026-09-29T01:00:00Z',items:[{symbol:'RY.TO',price:110,asOf:'2026-09-28'}],failures:[]}));
  await pending;
  assert.deepEqual([...h.state.positions.keys()],['ENB.TO']);
  assert.equal(storage.getItem('marketHunterPortfolioDailyV3:user:user-b'),null);
}

// Account switch during cloud-state reconciliation: stale work may not write or alter new-account status.
{
  const a=session('user-a'),stateWait=deferred(),writes=[];
  const initial={marketHunterCloudSessionV1:JSON.stringify(a),'marketHunterPortfolioV3:user:user-a':JSON.stringify(envelopeFor('RY.TO'))};
  const {h}=boot(initial,async (url,opts={})=>{
    const u=String(url),method=opts.method||'GET';
    if(u.includes('market_hunter_portfolio_state')&&method==='GET')return stateWait.promise;
    if(method!=='GET')writes.push({url:u,method,body:opts.body});
    return response(200,[]);
  });
  h.state.cloud.ready=true;
  const pending=h.syncPortfolioCloud();
  h.activateSession(session('user-b'));h.state.cloud.status='b-active';h.state.cloud.message='b-message';
  stateWait.resolve(response(200,[]));
  await pending;
  assert.equal(writes.length,0);
  assert.equal(h.state.cloud.status,'b-active');
  assert.equal(h.state.cloud.message,'b-message');
}

// Account switch while snapshot reconciliation is pending: no stale snapshot write may continue.
{
  const a=session('user-a'),snapshotWait=deferred(),snapshotStarted=deferred(),writes=[];
  const daily={currentDate:'2026-09-28',currentItems:[{symbol:'RY.TO',price:110,asOf:'2026-09-28'}],currentComplete:true,currentMeta:{requestedSymbols:['RY.TO'],capturedAt:'2026-09-29T00:10:00Z',sourceGeneratedAt:'2026-09-29T00:10:00Z'}};
  const initial={
    marketHunterCloudSessionV1:JSON.stringify(a),
    'marketHunterPortfolioV3:user:user-a':JSON.stringify(envelopeFor('RY.TO')),
    'marketHunterPortfolioDailyV3:user:user-a':JSON.stringify(daily)
  };
  const {h}=boot(initial,async (url,opts={})=>{
    const u=String(url),method=opts.method||'GET';
    if(u.includes('market_hunter_portfolio_state')&&method==='GET')return response(200,[]);
    if(u.includes('market_hunter_portfolio_state')&&method==='POST'){
      const body=JSON.parse(opts.body);writes.push({kind:'state',body});
      return response(201,[{payload:body.payload,revision:1,updated_at:body.updated_at}]);
    }
    if(u.includes('market_hunter_portfolio_snapshots')&&method==='GET'){snapshotStarted.resolve();return snapshotWait.promise}
    if(u.includes('market_hunter_portfolio_snapshots')&&method!=='GET'){writes.push({kind:'snapshot',body:JSON.parse(opts.body)});return response(200,[{revision:2}])}
    return response(500,{message:'unexpected'});
  });
  h.state.cloud.ready=true;
  const pending=h.syncPortfolioCloud();
  await snapshotStarted.promise;
  h.activateSession(session('user-b'));h.state.cloud.status='b-active';
  snapshotWait.resolve(response(200,[]));
  await pending;
  assert.equal(writes.filter(x=>x.kind==='snapshot').length,0);
  assert.equal(h.state.cloud.status,'b-active');
}

// Debounced sync captures an epoch; switching accounts cancels the queued work.
{
  const a=session('user-a'),writes=[];
  const initial={marketHunterCloudSessionV1:JSON.stringify(a),'marketHunterPortfolioV3:user:user-a':JSON.stringify(envelopeFor('RY.TO'))};
  const {h}=boot(initial,async (url,opts={})=>{if((opts.method||'GET')!=='GET')writes.push({url,opts});return response(200,[])});
  h.state.cloud.ready=true;h.queueCloudSync();
  h.activateSession(session('user-b'));
  await new Promise(r=>setTimeout(r,700));
  assert.equal(writes.length,0);
}

// Snapshot validation requires every item date, not just one matching date.
{
  const {h}=boot();
  const a=h.snapshotAttempt({generatedAt:'2026-09-29T01:00:00Z',items:[{symbol:'RY.TO',asOf:'2026-09-28'},{symbol:'ENB.TO'}],failures:[]},['RY.TO','ENB.TO']);
  assert.equal(a.status,'partial_missing_dates');
  assert.equal(a.complete,false);
}

// Better remote same-day snapshot replaces older local only when source freshness is established.
{
  const a=session('user-a');
  const local={currentDate:'2026-09-28',currentItems:[{symbol:'RY.TO',price:100,asOf:'2026-09-28'}],currentComplete:true,currentMeta:{requestedSymbols:['RY.TO'],capturedAt:'2026-09-29T00:00:00Z',sourceGeneratedAt:'2026-09-29T00:00:00Z'}};
  const initial={marketHunterCloudSessionV1:JSON.stringify(a),'marketHunterPortfolioV3:user:user-a':JSON.stringify(envelopeFor('RY.TO')),'marketHunterPortfolioDailyV3:user:user-a':JSON.stringify(local)};
  const {h}=boot(initial);
  const ctx=h.captureSessionContext();
  h.mergeCloudSnapshots([{market_as_of:'2026-09-28',payload:{complete:true,items:[{symbol:'RY.TO',price:105,asOf:'2026-09-28'}],meta:{requestedSymbols:['RY.TO'],capturedAt:'2026-09-29T00:30:00Z',sourceGeneratedAt:'2026-09-29T00:30:00Z'}}}],ctx);
  assert.equal(h.currentDailyPayload().currentItems[0].price,105);
}

// Reconciled portfolio expansion invalidates a formerly complete subset snapshot.
{
  const a=session('user-a');
  const env=envelopeFor('RY.TO');env.positions['ENB.TO']={value:{symbol:'ENB.TO',quantity:1,entryPrice:50,updatedAt:'2026-09-29T01:00:00Z'},deleted:false,updatedAt:'2026-09-29T01:00:00Z'};
  const local={currentDate:'2026-09-28',currentItems:[{symbol:'RY.TO',price:100,asOf:'2026-09-28'}],currentComplete:true,currentMeta:{requestedSymbols:['RY.TO'],capturedAt:'2026-09-29T00:00:00Z'}};
  const {h}=boot({marketHunterCloudSessionV1:JSON.stringify(a),'marketHunterPortfolioV3:user:user-a':JSON.stringify(env),'marketHunterPortfolioDailyV3:user:user-a':JSON.stringify(local)});
  assert.equal(h.dailySnapshotCandidate(h.currentDailyPayload(),['RY.TO','ENB.TO']).valid,false);
}

// Intentional deletion: a valid reduced-context local snapshot may replace an old remote superset.
{
  const a=session('user-a'),patches=[];
  const local={currentDate:'2026-09-28',currentItems:[{symbol:'RY.TO',price:106,asOf:'2026-09-28'}],currentComplete:true,currentMeta:{requestedSymbols:['RY.TO'],capturedAt:'2026-09-29T01:00:00Z',sourceGeneratedAt:'2026-09-29T01:00:00Z'}};
  const remote={market_as_of:'2026-09-28',revision:4,payload:{complete:true,items:[{symbol:'RY.TO',price:104,asOf:'2026-09-28'},{symbol:'ENB.TO',price:50,asOf:'2026-09-28'}],meta:{requestedSymbols:['RY.TO','ENB.TO'],capturedAt:'2026-09-29T00:30:00Z'}}};
  const initial={marketHunterCloudSessionV1:JSON.stringify(a),'marketHunterPortfolioV3:user:user-a':JSON.stringify(envelopeFor('RY.TO')),'marketHunterPortfolioDailyV3:user:user-a':JSON.stringify(local)};
  const {h}=boot(initial,async (url,opts={})=>{
    const method=opts.method||'GET';
    if(method==='GET')return response(200,[remote]);
    if(method==='PATCH'){patches.push(JSON.parse(opts.body));return response(200,[{revision:5}])}
    return response(500,{message:'unexpected'});
  });
  await h.syncCloudSnapshot(a,h.captureSessionContext());
  assert.equal(patches.length,1);
  assert.deepEqual(patches[0].payload.items.map(x=>x.symbol),['RY.TO']);
}

// Revision conflict must re-read; a newly better remote wins instead of being overwritten.
{
  const a=session('user-a'),patches=[];
  const local={currentDate:'2026-09-28',currentItems:[{symbol:'RY.TO',price:106,asOf:'2026-09-28'}],currentComplete:true,currentMeta:{requestedSymbols:['RY.TO'],capturedAt:'2026-09-29T01:00:00Z',sourceGeneratedAt:'2026-09-29T01:00:00Z'}};
  const oldRemote={market_as_of:'2026-09-28',revision:1,payload:{complete:true,items:[{symbol:'RY.TO',price:104,asOf:'2026-09-28'}],meta:{requestedSymbols:['RY.TO'],capturedAt:'2026-09-29T00:30:00Z',sourceGeneratedAt:'2026-09-29T00:30:00Z'}}};
  const betterRemote={market_as_of:'2026-09-28',revision:2,payload:{complete:true,items:[{symbol:'RY.TO',price:108,asOf:'2026-09-28'}],meta:{requestedSymbols:['RY.TO'],capturedAt:'2026-09-29T01:30:00Z',sourceGeneratedAt:'2026-09-29T01:30:00Z'}}};
  let gets=0;
  const initial={marketHunterCloudSessionV1:JSON.stringify(a),'marketHunterPortfolioV3:user:user-a':JSON.stringify(envelopeFor('RY.TO')),'marketHunterPortfolioDailyV3:user:user-a':JSON.stringify(local)};
  const {h}=boot(initial,async (url,opts={})=>{
    const method=opts.method||'GET';
    if(method==='GET')return response(200,[++gets===1?oldRemote:betterRemote]);
    if(method==='PATCH'){patches.push(JSON.parse(opts.body));return response(200,[])}
    return response(500,{message:'unexpected'});
  });
  await h.syncCloudSnapshot(a,h.captureSessionContext());
  assert.equal(patches.length,1);
  assert.equal(gets,2);
  assert.equal(h.currentDailyPayload().currentItems[0].price,108);
}


console.log('PASS: behavioral auth, account isolation, revision reconciliation, deletion durability, snapshots, and async isolation, snapshot policy, Nasdaq identity, and null formatting');
