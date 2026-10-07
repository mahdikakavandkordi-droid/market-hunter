import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createElliottHandler} from '../api/elliott.js';
import {loadSymbolAnalysis} from '../lib/elliott/symbol-analysis.mjs';
import {cryptoFixture,chartFrom,fakeFetcher} from '../tests/fixtures/elliott-symbol.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),rows=cryptoFixture();
const charts={'BTC-USD':chartFrom(rows),'ETH-USD':chartFrom(rows.map(b=>({...b,o:100,h:101,l:99,c:100})),{symbol:'ETH-USD'})};
const handler=createElliottHandler({loader:(s,m)=>loadSymbolAnalysis(s,m,{fetcher:fakeFetcher(charts),nowMs:rows.at(-1).endT+3600000})});
let requests=0;
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/elliott') {
    requests++;let code=200;
    return handler({method:req.method,query:Object.fromEntries(url.searchParams)},
      {setHeader:(k,v)=>res.setHeader(k,v),status(n){code=n;return this},json(data){res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data))}});
  }
  const files={'/elliott.html':'text/html','/elliott.js':'text/javascript','/elliott.css':'text/css'};
  if(!files[url.pathname]){res.writeHead(404);return res.end('Not found')}
  try{res.writeHead(200,{'Content-Type':files[url.pathname]});res.end(await readFile(path.join(root,url.pathname.slice(1))))}
  catch{res.writeHead(404);res.end('Not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  const executablePath=process.argv.find(a=>a.startsWith('--browser-path='))?.slice('--browser-path='.length);
  browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/elliott.html`);
  await page.selectOption('#market','crypto');await page.fill('#symbol','BTC');
  await page.click('#analyze');await page.waitForSelector('#result svg');
  assert.equal(await page.locator('#result h2').innerText(),'BTC-USD USD');
  assert.ok(await page.locator('.wave-point').count()>=9);
  assert.match(await page.locator('#result').innerText(),/تأیید متعلق به گذشته/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.click('#language');assert.equal(await page.getAttribute('html','dir'),'ltr');
  assert.match(await page.locator('.scenario-copy').innerText(),/Historical entry confirmation/);
  const svg=await page.locator('svg').boundingBox();await page.mouse.move(svg.x+svg.width/2,svg.y+svg.height/2);
  assert.match(await page.locator('#chartReadout').innerText(),/O .* H .* L .* C /);
  await mkdir(path.join(root,'tmp'),{recursive:true});
  await page.screenshot({path:path.join(root,'tmp/elliott-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(root,'tmp/elliott-desktop.png'),fullPage:true});
  await page.fill('#symbol','ETH');await page.click('#analyze');
  await page.waitForSelector('.empty');assert.match(await page.locator('.empty').innerText(),/No supported structure/);
  assert.equal(await page.locator('.wave-point').count(),0);
  await page.fill('#symbol','DOGE');await page.click('#analyze');await page.waitForSelector('#message.error');
  assert.equal(await page.locator('#result').isVisible(),false);
  assert.equal(await page.locator('#result svg').count(),0);
  assert.equal(await page.locator('#analyze').isDisabled(),false);
  assert.deepEqual(errors,[]);assert.equal(requests,3);
  console.log('PASS: mobile/desktop form → real handler → fixture provider → shared core → chart; language, hover, no-structure and provider-error states');
}finally {
  await browser?.close();await new Promise(resolve=>server.close(resolve));
}
