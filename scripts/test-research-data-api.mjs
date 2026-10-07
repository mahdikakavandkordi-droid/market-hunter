import assert from 'node:assert/strict';
import handler from '../api/research-data.js';
import {choosePublishedResearch} from '../lib/published-research.js';
const scan=(marketAsOf,generatedAt)=>({marketAsOf,generatedAt,integratedSurfacePicks:[]});
const older=scan('2026-10-02','2026-10-02T20:00:00Z'),newer=scan('2026-10-05','2026-10-06T00:10:00Z');
assert.equal(choosePublishedResearch('v2',older,newer).data,newer);
assert.equal(choosePublishedResearch('v2',older,newer).source,'deployment-snapshot');
assert.equal(choosePublishedResearch('v2',newer,older).data,newer,'newer main data is used without requiring redeployment');
assert.equal(choosePublishedResearch('v2',{...older,generatedAt:'2026-10-06T00:20:00Z'},newer).data,newer,'regenerated older market session must not outrank the latest session');
assert.equal(choosePublishedResearch('v2',newer,null).source,'github-main');
assert.equal(choosePublishedResearch('v2',{generatedAt:newer.generatedAt},newer).data,newer,'invalid CDN snapshot must not hide a separately validated deployment snapshot');
assert.equal(choosePublishedResearch('v2',{generatedAt:newer.generatedAt},newer).warning,'invalid_upstream_snapshot');
assert.throws(()=>choosePublishedResearch('v2',{generatedAt:newer.generatedAt},null),/invalid_research_data/);
const mixed={...newer,all:[{symbol:'ARX.TO',date:'2026-08-11'}]};
assert.equal(choosePublishedResearch('v2',mixed,newer).data,newer,'explicit session cannot mask stale rows');
assert.throws(()=>choosePublishedResearch('v2',mixed,mixed),/invalid_research_data/);
const staleSurface={...newer,integratedSurfacePicks:[{symbol:'ARX.TO',date:'2026-08-11'}]};
assert.throws(()=>choosePublishedResearch('v2',staleSurface,null),/invalid_research_data/);
assert.equal(choosePublishedResearch('daily',{generatedAt:'2026-10-06T00:10:00Z',asOf:{latest:'2026-10-05'},groups:[]},{generatedAt:'2026-10-06T00:20:00Z',asOf:{latest:'2026-10-05'},groups:[]}).source,'deployment-snapshot');

function makeRes(){
  const headers={};let statusCode=200,payload=null;
  return {
    headers,
    setHeader(k,v){headers[k]=v},
    status(code){statusCode=code;return this},
    json(body){payload=body;return this},
    get statusCode(){return statusCode},
    get payload(){return payload}
  };
}

const originalFetch=globalThis.fetch;
try{
  let seenUrl='';
  globalThis.fetch=async url=>{
    seenUrl=String(url);
    return {ok:true,status:200,async json(){return {
      generatedAt:'2099-09-29T14:45:09Z',
      asOf:{latest:'2026-09-28'},
      groups:[]
    }}};
  };
  const ok=makeRes();
  await handler({method:'GET',query:{kind:'daily'}},ok);
  assert.equal(ok.statusCode,200);
  assert.match(seenUrl,/\/main\/data\/daily-market-report\.json\?v=/);
  assert.equal(ok.headers['X-Market-Hunter-Source'],'github-main');
  assert.equal(ok.headers['Cache-Control'],'no-store');

  const bad=makeRes();
  await handler({method:'GET',query:{kind:'nope'}},bad);
  assert.equal(bad.statusCode,400);

  globalThis.fetch=async()=>({ok:false,status:503,async json(){return {}}});
  const fail=makeRes();
  await handler({method:'GET',query:{kind:'daily'}},fail);
  assert.equal(fail.statusCode,503);
  assert.equal(fail.payload.error,'research_data_unavailable');
}finally{
  globalThis.fetch=originalFetch;
}

console.log('PASS: research-data API reads validated main data and fails closed');
