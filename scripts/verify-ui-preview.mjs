import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fetchWithTimeout,writeLeaseFile,revokeLeaseFile} from '../lib/vercel-bypass-lease.js';

const previewUrl=process.env.PREVIEW_URL;
const previewCommit=process.env.PREVIEW_COMMIT;
const token=process.env.VERCEL_TOKEN;
const projectId=process.env.VERCEL_PROJECT_ID;
const teamId=process.env.VERCEL_TEAM_ID;
const leaseFile=process.env.VERCEL_BYPASS_LEASE_FILE||'.tmp/ui-preview-bypass.json';
const outDir=process.env.UI_ARTIFACT_DIR||'artifacts/ui-verification';
const timeoutMs=Math.max(1000,Number(process.env.VERCEL_HTTP_TIMEOUT_MS||15000));
if(!previewUrl||!token||!projectId||!teamId)throw new Error('UI verification environment is incomplete');
fs.mkdirSync(outDir,{recursive:true});

const secret=crypto.randomBytes(24).toString('hex').slice(0,32);
const runId=process.env.GITHUB_RUN_ID||'local';
const note='MH UI verification '+runId;
const lease={secret,projectId,teamId,runId,note};
writeLeaseFile(leaseFile,lease);

const auth={Authorization:'Bearer '+token,'Content-Type':'application/json'};
const bypassApi='https://api.vercel.com/v1/projects/'+encodeURIComponent(projectId)+'/protection-bypass?teamId='+encodeURIComponent(teamId);
async function api(url,opts={}){
  const r=await fetchWithTimeout(fetch,url,{...opts,headers:{...auth,...(opts.headers||{})}},timeoutMs);
  return {r,text:await r.text()};
}
const generated=await api(bypassApi,{method:'PATCH',redirect:'follow',body:JSON.stringify({generate:{secret,note}})});
if(!generated.r.ok)throw new Error('Cannot create UI verification bypass HTTP '+generated.r.status);

async function preflight(){
  let last=0;
  for(let i=0;i<15;i++){
    const r=await fetchWithTimeout(fetch,previewUrl,{redirect:'manual',headers:{'x-vercel-protection-bypass':secret}},timeoutMs);
    last=r.status;
    if(r.ok)return;
    await new Promise(res=>setTimeout(res,200+100*i));
  }
  throw new Error('Preview bypass did not propagate; last HTTP '+last);
}
await preflight();

const report={
  format:'market-hunter-ui-verification-v1',
  previewUrl,
  previewCommit,
  runId,
  browser:'Chromium / Playwright',
  checks:[],
  screenshots:[],
  pageErrors:[],
  consoleErrors:[],
  network:[],
  fatalError:null,
  limitations:[
    'Headless Chromium cannot summon the native iOS software keyboard; mobile position form is tested with a constrained 390x520 viewport to simulate keyboard-reduced usable height.'
  ]
};
function record(name,pass,detail=''){report.checks.push({name,pass,detail})}
async function check(name,fn){
  try{const detail=await fn();record(name,true,detail??'PASS');return true}
  catch(e){record(name,false,String(e?.message||e));return false}
}
async function ready(page,label){
  await page.waitForLoadState('domcontentloaded');
  try{
    await page.waitForFunction(()=>document.querySelector('#asOf')&&document.querySelector('#asOf').textContent!=='Loading market data…',null,{timeout:60000});
    await page.waitForSelector('#homeView .panel',{timeout:10000});
  }catch(error){
    try{
      fs.writeFileSync(path.join(outDir,label+'-startup.html'),await page.content());
      await page.screenshot({path:path.join(outDir,label+'-startup.png'),fullPage:true});
      report.screenshots.push(label+'-startup.png');
    }catch{}
    const state=await page.evaluate(()=>({
      title:document.title,
      asOf:document.querySelector('#asOf')?.textContent||null,
      homeHtml:document.querySelector('#homeView')?.innerHTML?.slice(0,500)||null,
      scripts:[...document.scripts].map(s=>s.src||'[inline]'),
      theme:document.documentElement.dataset.theme||null
    })).catch(()=>null);
    throw new Error('UI did not finish startup: '+error.message+' state='+JSON.stringify(state));
  }
}
function attachDiagnostics(page,label){
  page.on('pageerror',e=>report.pageErrors.push({label,message:String(e.message||e)}));
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push({label,message:m.text()})});
  page.on('response',res=>{
    try{
      const u=new URL(res.url());
      const base=new URL(previewUrl);
      if(u.origin===base.origin)report.network.push({label,path:u.pathname,status:res.status()});
    }catch{}
  });
}
async function newContext(browser,{width,height,theme,label,isMobile=false}){
  const context=await browser.newContext({
    viewport:{width,height},
    isMobile,
    hasTouch:isMobile,
    deviceScaleFactor:isMobile?2:1,
    serviceWorkers:'allow'
  });
  const previewOrigin=new URL(previewUrl).origin;
  await context.route('**/*',async route=>{
    const request=route.request();
    let sameOrigin=false;
    try{sameOrigin=new URL(request.url()).origin===previewOrigin}catch{}
    if(!sameOrigin)return route.continue();
    await route.continue({headers:{
      ...request.headers(),
      'x-vercel-protection-bypass':secret,
      'x-vercel-set-bypass-cookie':'true'
    }});
  });
  await context.addInitScript(t=>{
    try{localStorage.setItem('marketHunterTheme',t)}catch{}
    window.__openedUrl=null;
    window.open=(url)=>{window.__openedUrl=String(url);return null};
  },theme);
  const page=await context.newPage();
  attachDiagnostics(page,label);
  await page.goto(previewUrl,{waitUntil:'domcontentloaded',timeout:60000});
  await ready(page,label);
  return {context,page};
}
async function overflowDetail(page){
  return page.evaluate(()=>({innerWidth:window.innerWidth,htmlScrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth}));
}
async function screenshot(page,name){
  const p=path.join(outDir,name);
  await page.screenshot({path:p,fullPage:true});
  report.screenshots.push(name);
}

// Baseline visual matrix: desktop/mobile × dark/light.
const browser=await chromium.launch({headless:true});
let fatal=null;
try{
  for(const spec of [
    {width:1440,height:1000,theme:'dark',label:'desktop-dark',isMobile:false},
    {width:1440,height:1000,theme:'light',label:'desktop-light',isMobile:false},
    {width:390,height:844,theme:'dark',label:'mobile-dark',isMobile:true},
    {width:390,height:844,theme:'light',label:'mobile-light',isMobile:true}
  ]){
    const {context,page}=await newContext(browser,spec);
    await check(spec.label+' theme applied',async()=>{
      const theme=await page.evaluate(()=>document.documentElement.dataset.theme);
      assert.equal(theme,spec.theme);return theme;
    });
    await check(spec.label+' no horizontal overflow',async()=>{
      const d=await overflowDetail(page);
      assert.ok(d.htmlScrollWidth<=d.innerWidth+2,'html scrollWidth '+d.htmlScrollWidth+' > '+d.innerWidth);
      assert.ok(d.bodyScrollWidth<=d.innerWidth+2,'body scrollWidth '+d.bodyScrollWidth+' > '+d.innerWidth);
      return JSON.stringify(d);
    });
    await screenshot(page,spec.label+'.png');
    await context.close();
  }

  // Interaction suite on mobile dark.
  const {context,page}=await newContext(browser,{width:390,height:844,theme:'dark',label:'mobile-interactions',isMobile:true});
  await check('mobile bottom nav visible',async()=>{
    const v=await page.locator('.mobile-nav').isVisible();assert.ok(v);return 'visible';
  });
  await page.locator('.mobile-nav [data-view="shortlist"]').click();
  await page.waitForSelector('#shortlistView.active .stage-tabs');

  await check('four stage filters work',async()=>{
    const tabs=page.locator('#shortlistView [data-stage-tab]');
    assert.equal(await tabs.count(),4);
    for(const stage of ['Early Watch','Recovery','Attractive Growth','Established Move']){
      const tab=page.locator('#shortlistView [data-stage-tab="'+stage+'"]');
      await tab.click();
      await page.waitForFunction(s=>document.querySelector('#shortlistView .stage-summary b')?.textContent===s,stage);
      assert.equal(await tab.getAttribute('aria-pressed'),'true');
    }
    return '4 stages';
  });

  // Find a stage with at least one real card, preserving live preview data.
  let stageWithCard=null;
  for(const stage of ['Early Watch','Recovery','Attractive Growth','Established Move']){
    await page.locator('#shortlistView [data-stage-tab="'+stage+'"]').click();
    if(await page.locator('#shortlistView .card').count()){stageWithCard=stage;break}
  }
  await check('real shortlist card available for interaction verification',async()=>{
    assert.ok(stageWithCard,'No current stage had a real card');return stageWithCard;
  });

  if(stageWithCard){
    await check('RSI visible on stock card',async()=>{
      const txt=await page.locator('#shortlistView .card').first().innerText();
      assert.match(txt,/RSI\s+(\d+|—)/);return txt.match(/RSI\s+(\d+|—)/)?.[0]||'RSI';
    });
    await check('TradingView chart URL generated',async()=>{
      await page.locator('#shortlistView .card [data-chart]').first().click();
      const u=await page.evaluate(()=>window.__openedUrl);
      assert.ok(u?.startsWith('https://www.tradingview.com/chart/?symbol='),String(u));return u;
    });

    const watchBtn=page.locator('#shortlistView .card [data-watch]').first();
    const watchSymbol=await watchBtn.getAttribute('data-watch');
    await check('watchlist persists through reload',async()=>{
      await watchBtn.click();
      let saved=await page.evaluate(s=>JSON.parse(localStorage.getItem('marketHunterWatchlist')||'[]').includes(s),watchSymbol);
      assert.ok(saved,'symbol not in localStorage after save');
      await page.reload({waitUntil:'domcontentloaded'});await ready(page,'interaction-reload');
      saved=await page.evaluate(s=>JSON.parse(localStorage.getItem('marketHunterWatchlist')||'[]').includes(s),watchSymbol);
      assert.ok(saved,'symbol missing after reload');
      await page.locator('.mobile-nav [data-view="watchlist"]').click();
      await page.waitForSelector('#watchlistView.active');
      const present=await page.locator('#watchlistView [data-watch="'+watchSymbol+'"]').count();
      assert.ok(present>0,'saved symbol not rendered in Watchlist');
      return watchSymbol;
    });

    // Return to shortlist and open a real Market Hunter position form.
    await page.locator('.mobile-nav [data-view="shortlist"]').click();
    await page.waitForSelector('#shortlistView.active');
    // stage selection may reset rendering but the stored state remains; select known stage.
    await page.locator('#shortlistView [data-stage-tab="'+stageWithCard+'"]').click();
    const buy=page.locator('#shortlistView .card [data-buy]').first();
    const positionSymbol=await buy.getAttribute('data-buy');
    await buy.click();
    await page.waitForSelector('#positionModal.open #positionForm');

    await check('mobile position inputs prevent iOS zoom',async()=>{
      const sizes=await page.locator('#positionForm input,#positionForm select,#positionForm textarea').evaluateAll(els=>els.map(e=>parseFloat(getComputedStyle(e).fontSize)));
      assert.ok(sizes.every(x=>x>=16),'font sizes '+sizes.join(','));return sizes.join(',');
    });
    await page.locator('#position-quantity').fill('1');
    const entry=page.locator('#position-entryPrice');
    if(!(await entry.inputValue()))await entry.fill('10');
    const date=page.locator('#position-boughtAt');
    if(!(await date.inputValue()))await date.fill('2026-09-28');
    await page.locator('#position-quantity').focus();
    await page.setViewportSize({width:390,height:520});
    await page.locator('#positionForm button[type="submit"]').scrollIntoViewIfNeeded();
    await check('position form usable in keyboard-constrained mobile viewport',async()=>{
      const saveVisible=await page.locator('#positionForm button[type="submit"]').isVisible();
      const focused=await page.evaluate(()=>document.activeElement?.id);
      assert.ok(saveVisible,'Save button not visible/reachable');return 'saveVisible='+saveVisible+', focused='+focused;
    });
    await screenshot(page,'mobile-position-keyboard-constrained.png');
    await page.locator('#positionForm button[type="submit"]').click();
    await page.waitForSelector('#portfolioView.active',{timeout:30000});
    await check('position entry persists after save',async()=>{
      const found=await page.evaluate(s=>JSON.parse(localStorage.getItem('marketHunterPositions')||'[]').some(x=>x.symbol===s),positionSymbol);
      assert.ok(found,'saved position missing from localStorage');return positionSymbol;
    });
  }

  // PWA install/update sanity on same origin.
  await page.setViewportSize({width:390,height:844});
  await page.goto(previewUrl,{waitUntil:'domcontentloaded'});await ready(page,'interaction-reload');
  await check('service worker active and current shell cache present',async()=>{
    const pwa=await page.evaluate(async()=>{
      const reg=await navigator.serviceWorker.ready;
      const keys=await caches.keys();
      return {scriptURL:reg.active?.scriptURL||'',keys};
    });
    assert.match(pwa.scriptURL,/service-worker\.js/);
    assert.ok(pwa.keys.includes('market-hunter-shell-v5'),'v5 cache missing: '+pwa.keys.join(','));
    return JSON.stringify(pwa);
  });
  await check('PWA activation removes older shell cache',async()=>{
    const result=await page.evaluate(async()=>{
      await caches.open('market-hunter-shell-v4-verification');
      const reg=await navigator.serviceWorker.register('/service-worker.js?ui-verify='+Date.now(),{scope:'/',updateViaCache:'none'});
      const deadline=Date.now()+15000;
      while(Date.now()<deadline){
        const keys=await caches.keys();
        if(!keys.includes('market-hunter-shell-v4-verification'))return {removed:true,keys,active:reg.active?.scriptURL||''};
        await new Promise(r=>setTimeout(r,250));
      }
      return {removed:false,keys:await caches.keys(),active:reg.active?.scriptURL||''};
    });
    assert.ok(result.removed,'old cache was not removed: '+JSON.stringify(result));return JSON.stringify(result);
  });
  await screenshot(page,'mobile-pwa-final.png');
  await context.close();
} catch(error){
  fatal=error;
  report.fatalError=String(error?.stack||error);
} finally {
  await browser.close();
  try{await revokeLeaseFile({file:leaseFile,token,timeoutMs})}catch(e){report.checks.push({name:'in-process Vercel preview bypass cleanup',pass:false,detail:String(e?.message||e)})}
  record('no uncaught page errors',report.pageErrors.length===0,JSON.stringify(report.pageErrors));
  record('no console errors',report.consoleErrors.length===0,JSON.stringify(report.consoleErrors));
  const failed=report.checks.filter(x=>!x.pass);
  report.summary={passed:report.checks.length-failed.length,failed:failed.length,total:report.checks.length,fatal:Boolean(fatal)};
  fs.writeFileSync(path.join(outDir,'ui-verification-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report.summary));
}
if(fatal||report.checks.some(x=>!x.pass))process.exitCode=1;
