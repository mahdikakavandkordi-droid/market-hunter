import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const BASE='d40d050270b71af502c1024bcc7d4924d3a39973';
function show(path){
  const r=spawnSync('git',['show',BASE+':'+path],{encoding:'utf8'});
  if(r.status!==0)throw new Error('git show '+path+' failed: '+r.stderr);
  return r.stdout;
}
function deferred(){let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej});return{promise,resolve,reject}}
function response(status,body){return{ok:status>=200&&status<300,status,async json(){return body},async text(){return body==null?'':JSON.stringify(body)}}}
class MemoryStorage{
  constructor(initial={}){this.map=new Map(Object.entries(initial).map(([k,v])=>[k,String(v)]))}
  getItem(k){return this.map.has(k)?this.map.get(k):null}
  setItem(k,v){this.map.set(k,String(v))}
  removeItem(k){this.map.delete(k)}
}
const session=id=>({access_token:'token-'+id,refresh_token:'refresh-'+id,expires_at:4102444800,user:{id,email:id+'@example.test'}});
const env=symbol=>({version:3,positions:{[symbol]:{value:{symbol,quantity:1,entryPrice:100,updatedAt:'2026-09-29T00:00:00Z'},deleted:false,updatedAt:'2026-09-29T00:00:00Z'}},watchlist:{}});
function bootBaseline(initial,fetchImpl){
  const source=show('app.js'),cut=source.indexOf('async function load(){');
  assert.ok(cut>0);
  const localStorage=new MemoryStorage(initial);
  const context={
    localStorage,fetch:fetchImpl,console,Date,Number,String,Boolean,Set,Map,Math,JSON,Intl,
    encodeURIComponent,decodeURIComponent,setTimeout,clearTimeout,Promise,
    document:{querySelector(){return null},querySelectorAll(){return[]}},
    window:{open(){},scrollTo(){}}
  };
  context.globalThis=context;
  vm.runInNewContext(source.slice(0,cut)+`
    globalThis.__mh={state,saveCloudSession,switchLocalScope,loadCloudPortfolio,syncCloudSnapshot};
  `,context,{filename:'reviewed-base-app.js'});
  return {h:context.__mh,storage:localStorage};
}
const tick=()=>new Promise(r=>setTimeout(r,0));

// Finding 1 reproduction: delayed account-A cloud response contaminates account B in reviewed base.
{
  const A=session('user-a'),B=session('user-b'),stateWait=deferred(),snapWait=deferred();
  const {h,storage}=bootBaseline({marketHunterCloudSessionV1:JSON.stringify(A)},async url=>{
    const u=String(url);
    if(u.includes('market_hunter_portfolio_state'))return stateWait.promise;
    if(u.includes('market_hunter_portfolio_snapshots'))return snapWait.promise;
    return response(500,{message:'unexpected'});
  });
  const pending=h.loadCloudPortfolio();
  await tick();
  h.saveCloudSession(B);h.switchLocalScope(B);
  stateWait.resolve(response(200,[{payload:env('RY.TO'),revision:1,updated_at:'2026-09-29T00:00:00Z'}]));
  snapWait.resolve(response(200,[]));
  await pending;
  const b=JSON.parse(storage.getItem('marketHunterPortfolioV3:user:user-b')||'{"positions":{}}');
  assert.equal(Boolean(b.positions?.['RY.TO']),true,'reviewed base should reproduce A -> B contamination');
}

// Finding 2 reproduction: reviewed frontend substituted Nasdaq Composite for the Nasdaq-100 card.
{
  const app=show('app.js'),intraday=show('lib/intraday.js');
  assert.match(app,/NASDAQ100:'\^IXIC'/);
  assert.match(intraday,/\['\^IXIC','Nasdaq'\]/);
}

// Finding 3 reproduction: reviewed sync overwrites a better remote same-day snapshot with stale local payload.
{
  const A=session('user-a'),patches=[];
  const daily={
    previousDate:null,previousItems:[],currentDate:'2026-09-28',currentComplete:true,
    currentItems:[{symbol:'RY.TO',price:100,asOf:'2026-09-28'}],
    currentMeta:{complete:true,requestedSymbols:['RY.TO'],capturedAt:'2026-09-29T00:00:00Z',sourceGeneratedAt:'2026-09-29T00:00:00Z'}
  };
  const remote={
    market_as_of:'2026-09-28',revision:7,updated_at:'2026-09-29T01:05:00Z',
    payload:{marketAsOf:'2026-09-28',complete:true,items:[{symbol:'RY.TO',price:120,asOf:'2026-09-28'}],
      meta:{complete:true,requestedSymbols:['RY.TO'],capturedAt:'2026-09-29T01:00:00Z',sourceGeneratedAt:'2026-09-29T01:00:00Z'}}
  };
  const initial={
    marketHunterCloudSessionV1:JSON.stringify(A),
    'marketHunterPortfolioV3:user:user-a':JSON.stringify(env('RY.TO')),
    'marketHunterPortfolioDailyV3:user:user-a':JSON.stringify(daily)
  };
  const {h}=bootBaseline(initial,async(url,opts={})=>{
    const method=opts.method||'GET';
    if(method==='GET')return response(200,[remote]);
    if(method==='PATCH'){patches.push(JSON.parse(opts.body));return response(200,[{revision:8}])}
    return response(500,{message:'unexpected'});
  });
  await h.syncCloudSnapshot(A);
  assert.equal(patches.length,1);
  assert.equal(patches[0].payload.items[0].price,100,'reviewed base should reproduce stale local overwrite');
}

// Finding 4 verification: reviewed regression checked helpers/wiring but never executed the pinned collector script.
{
  const oldTest=show('scripts/test-htp-outcome-retry.mjs');
  assert.doesNotMatch(oldTest,/scripts\/collect-healthy-trend-pullback-forward\.mjs/);
}

console.log('PASS: reviewed production commit reproduces async contamination, Nasdaq mismatch, stale snapshot overwrite, and narrow HTP coverage');
