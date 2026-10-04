import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import handler from '../api/portfolio-bridge.js';
import {derivePortfolioBridgeToken} from '../lib/portfolio-bridge.js';
const oldEnv={token:process.env.TELEGRAM_BOT_TOKEN,id:process.env.TELEGRAM_ALLOWED_USER_ID},oldFetch=globalThis.fetch;
const envelope={version:3,positions:{'FIXTURE.TO':{value:{symbol:'FIXTURE.TO',quantity:2,entryPrice:100},deleted:false,updatedAt:'2026-10-04T00:00:00Z'}},watchlist:{}};
try{
 process.env.TELEGRAM_BOT_TOKEN='synthetic-test-token';process.env.TELEGRAM_ALLOWED_USER_ID='12345';
 const sig=derivePortfolioBridgeToken('12345'),ops=[];
 globalThis.fetch=async(_url,args)=>{const body=JSON.parse(args.body);ops.push(body.op);assert.ok(['pair','get'].includes(body.op),'restoration must never write a portfolio');return {ok:true,json:async()=>body.op==='get'?{ok:true,payload:envelope,revision:7,updatedAt:'2026-10-04T00:00:00Z'}:{ok:true}}};
 const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(b){this.body=b;return this}});
 let r=response();await handler({method:'POST',headers:{},body:{action:'restore',user_id:'12345',sig}},r);
 assert.equal(r.code,200);assert.equal(r.body.payload.positions['FIXTURE.TO'].value.quantity,2);assert.equal(r.body.revision,7);assert.deepEqual(ops,['pair','get']);assert.match(r.headers['Set-Cookie'][0],/HttpOnly; Secure; SameSite=Lax/);
 ops.length=0;r=response();await handler({method:'POST',headers:{},body:{action:'restore',user_id:'54321',sig}},r);assert.equal(r.code,401);assert.deepEqual(ops,[]);
 r=response();await handler({method:'POST',headers:{},body:{action:'restore',user_id:'12345',sig:'bad'}},r);assert.equal(r.code,401);assert.deepEqual(ops,[]);
 const src=fs.readFileSync('app.js','utf8'),cut=src.indexOf('async function load(){');
 const mem=new Map(),requests=[];
 const context={localStorage:{getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)},console,URLSearchParams,URL,Date,Math,JSON,Intl,Map,Set,Promise,setTimeout,clearTimeout,AbortController,
  location:{search:'?portfolioBridge=1&user_id=12345&sig=synthetic',hostname:'fixture.test'},window:{},document:{querySelector:()=>null,querySelectorAll:()=>[]},
  fetch:async(_url,args)=>{requests.push(JSON.parse(args.body));return {ok:true,json:async()=>({ok:true,connected:true,payload:envelope,revision:7})}}};
 vm.createContext(context);vm.runInContext(src.slice(0,cut)+'\nfunction renderAll(){} function setView(){}; globalThis.fixture={state,restoreTelegramBackendPortfolio};',context);
 assert.equal(await context.fixture.restoreTelegramBackendPortfolio(),true);assert.equal(context.fixture.state.positions.get('FIXTURE.TO').quantity,2);assert.equal(requests.length,1);assert.equal(requests[0].action,'restore');assert.equal('payload' in requests[0],false);
 console.log('Portfolio restore: signed authentication, cookie connection, read-only backend restoration and empty-device recovery passed.');
}finally{globalThis.fetch=oldFetch;for(const [key,v] of [['TELEGRAM_BOT_TOKEN',oldEnv.token],['TELEGRAM_ALLOWED_USER_ID',oldEnv.id]]){if(v===undefined)delete process.env[key];else process.env[key]=v}}
