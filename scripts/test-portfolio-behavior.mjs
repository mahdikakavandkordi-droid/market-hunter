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

console.log('PASS: behavioral auth, account isolation, revision reconciliation, deletion durability, snapshots, and null formatting');
