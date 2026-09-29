import assert from 'node:assert/strict';
import handler from '../api/research-data.js';

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
      generatedAt:'2026-09-29T14:45:09Z',
      asOf:{latest:'2026-09-28'},
      groups:[]
    }}};
  };
  const ok=makeRes();
  await handler({method:'GET',query:{kind:'daily'}},ok);
  assert.equal(ok.statusCode,200);
  assert.match(seenUrl,/\/main\/data\/daily-market-report\.json\?v=/);
  assert.equal(ok.headers['X-Market-Hunter-Source'],'github-main');
  assert.match(ok.headers['Cache-Control'],/s-maxage=60/);

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
