import {test,expect} from '@playwright/test';

const USER_ID='user-smoke';
const SESSION_KEY='marketHunterCloudSessionV1';
const STATE_KEY='marketHunterPortfolioV3:user:'+USER_ID;

function completedItem(symbol){
  return {
    symbol,name:symbol==='RY.TO'?'Royal Bank of Canada':'Enbridge',sector:'Test',price:symbol==='RY.TO'?110:50,
    dayChangePct:symbol==='RY.TO'?0.4:-0.5,currency:'CAD',benchmark:'^GSPTSE',asOf:'2026-09-25',
    stage:'Recovery',ret5:1,ret20:2,ret60:3,momentumShift:1,rs20:2,rs60:3,rsi14:55,atr14Pct:2,
    swingTrend:'Structure improving',lowState:'local_low_held',highState:'local_high_held'
  };
}

test('restores session, edits/removes portfolio, labels quote freshness, and renders mobile portfolio/watchlist',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(({userId,sessionKey,stateKey})=>{
    if(!localStorage.getItem('marketHunterSmokeSeeded')){
      const now='2026-09-28T20:00:00.000Z';
      localStorage.setItem(sessionKey,JSON.stringify({
        access_token:'smoke-access',refresh_token:'smoke-refresh',expires_at:4102444800,
        user:{id:userId,email:'smoke@example.test'}
      }));
      localStorage.setItem(stateKey,JSON.stringify({
        version:3,
        positions:{
          'RY.TO':{value:{symbol:'RY.TO',quantity:10,entryPrice:100,boughtAt:'2026-09-01',source:'manual',updatedAt:now,createdAt:now},deleted:false,updatedAt:now}
        },
        watchlist:{
          'RY.TO':{present:true,updatedAt:now},
          'ENB.TO':{present:true,updatedAt:now}
        }
      }));
      localStorage.setItem('marketHunterSmokeSeeded','1');
    }
  },{userId:USER_ID,sessionKey:SESSION_KEY,stateKey:STATE_KEY});

  await page.route('**/api/intraday',async route=>{
    const now=new Date().toISOString();
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      version:'intraday-v1',capturedAt:now,sessionDate:now.slice(0,10),marketOpen:true,provisional:true,currentState:{marketOpen:true,snapshotFresh:true,sessionDate:now.slice(0,10),status:'live'},
      intended:1,received:1,failures:[],quotes:{
        'RY.TO':{symbol:'RY.TO',name:'Royal Bank of Canada',price:111.25,currency:'CAD',previousClose:109.9,changePct:1.234,quoteAt:now,sessionDate:now.slice(0,10),stale:false},
        '^IXIC':{symbol:'^IXIC',name:'Nasdaq Composite sentinel',price:99999,currency:'USD',previousClose:90000,changePct:11.11,quoteAt:now,sessionDate:now.slice(0,10),stale:false}
      }
    })});
  });
  await page.route('**/api/portfolio?**',async route=>{
    const url=new URL(route.request().url());
    const symbols=(url.searchParams.get('symbols')||'').split(',').filter(Boolean);
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      asOf:'2026-09-25',items:symbols.map(completedItem),failures:[],portfolioAnalytics:null
    })});
  });
  await page.route('https://ivmpzyjxyfcefjyylybr.supabase.co/rest/v1/**',async route=>{
    const req=route.request(),url=req.url(),method=req.method();
    if(url.includes('market_hunter_portfolio_state')){
      if(method==='GET')return route.fulfill({status:200,contentType:'application/json',body:'[]'});
      if(method==='POST'){
        const body=req.postDataJSON();
        return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify([{payload:body.payload,revision:body.revision||1,updated_at:body.updated_at}])});
      }
      if(method==='PATCH'){
        const body=req.postDataJSON();
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{payload:body.payload,revision:body.revision,updated_at:body.updated_at}])});
      }
    }
    if(url.includes('market_hunter_portfolio_snapshots')){
      if(method==='GET')return route.fulfill({status:200,contentType:'application/json',body:'[]'});
      return route.fulfill({status:204,body:''});
    }
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({message:'unhandled smoke route'})});
  });

  const errors=[];
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
  page.on('pageerror',err=>errors.push(String(err)));

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const nasdaq100=page.locator('.market-row').filter({hasText:'Nasdaq-100'}).first();
  await expect(nasdaq100).toBeVisible();
  await expect(nasdaq100).not.toContainText('99,999');
  await expect(nasdaq100).toContainText('Completed session · hourly quote unavailable');
  await expect(page.locator('.outlook-panel')).not.toHaveAttribute('open','');
  const marketRail=page.locator('#homeMarkets');
  expect(await marketRail.evaluate(r=>r.scrollWidth>r.clientWidth)).toBe(true);
  await page.locator('[data-swipe="homeMarkets"][data-step="1"]').click();
  await expect.poll(()=>marketRail.evaluate(r=>r.scrollLeft)).toBeGreaterThan(0);
  await marketRail.evaluate(r=>r.scrollTo({left:0,behavior:'instant'}));
  expect(await page.locator('#homePicks').evaluate(r=>r.scrollWidth>r.clientWidth)).toBe(true);
  await page.locator('.report-details>summary').click();
  await expect(page.locator('.report-title')).toHaveCount(0);
  expect(await page.locator('.report-copy').evaluate(r=>parseFloat(getComputedStyle(r).fontSize))).toBeLessThanOrEqual(14);
  await page.screenshot({path:'test-results/home-open-brief-mobile.png',fullPage:true});
  await page.locator('.report-details>summary').click();
  await page.screenshot({path:'test-results/home-mobile.png',fullPage:true});

  await page.locator('[data-view="portfolio"]:visible').first().click();
  await expect(page.locator('#portfolioView')).toContainText('Backend portfolio');
  await expect(page.locator('#portfolioView .portfolio-slide')).toContainText('RY');
  await expect(page.locator('#portfolioView .portfolio-slide')).toContainText('Intraday quote · current session');
  await expect(page.locator('#portfolioView .portfolio-slide')).toContainText('111.25');
  await expect(page.locator('#portfolioView .portfolio-slide')).toContainText('+1.2%');
  const allocation=page.locator('#portfolioAllocation');
  await expect(allocation.locator('.allocation-item')).toContainText('100.0%');
  await allocation.locator('.allocation-item').click();
  await expect(allocation.locator('.allocation-center')).toContainText('100.0%');
  await allocation.getByRole('button',{name:'Exposure',exact:true}).click();
  await expect(allocation.locator('.allocation-item')).toContainText('Test');
  await expect(allocation.getByRole('button',{name:'Exposure',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.evaluate(()=>{
    state.positions.set('ENB.TO',{symbol:'ENB.TO',quantity:10,entryPrice:40,source:'manual'});
    state.portfolioItems.set('ENB.TO',{symbol:'ENB.TO',name:'Enbridge',sector:'Energy',price:50,dayChangePct:-0.5,currency:'CAD',asOf:'2026-09-25'});
    state.portfolioItems.get('RY.TO').sector='Financials';
    renderView('portfolio');
  });
  await expect(page.locator('#portfolioView .swipe-hint')).toContainText('Swipe to browse');
  expect(await page.locator('#portfolioView .portfolio-carousel').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
  await expect(allocation.locator('.allocation-item')).toHaveCount(2);
  await expect(allocation.locator('.allocation-item').first()).toContainText('69.0%');
  await allocation.locator('.allocation-item').last().click();
  await expect(allocation.locator('.allocation-center')).toContainText('Energy');
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.portfolio-analysis')).not.toHaveAttribute('open','');
  await page.locator('.portfolio-sync-link').click();
  await expect(page.locator('#portfolioAccount')).toHaveAttribute('open','');
  await page.locator('#portfolioAccount>summary').click();
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'test-results/portfolio-mobile.png',fullPage:true});
  await allocation.scrollIntoViewIfNeeded();
  await page.screenshot({path:'/tmp/market-hunter-allocation-dark.png'});
  await page.evaluate(()=>document.documentElement.dataset.theme='light');
  await page.screenshot({path:'/tmp/market-hunter-allocation-light.png'});
  await page.evaluate(()=>document.documentElement.dataset.theme='dark');

  // A reload must restore the persisted session instead of silently falling back to local-only mode.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.locator('[data-view="portfolio"]:visible').first().click();
  await expect(page.locator('#portfolioView')).toContainText('Backend portfolio');
  await expect(page.locator('#portfolioView .portfolio-slide')).toContainText('10 shares');

  // Edit on the mobile portfolio card.
  await page.locator('[data-edit="RY.TO"]').click();
  await page.locator('#position-quantity').fill('12');
  await page.locator('#positionForm button[type="submit"]').click();
  await expect(page.locator('#portfolioView .portfolio-slide')).toContainText('12 shares');

  // Remove and verify a durable tombstone, not a destructive local delete.
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-remove="RY.TO"]').click();
  await expect(page.locator('#portfolioView .portfolio-slide')).toHaveCount(0);
  const deleted=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).positions['RY.TO'],STATE_KEY);
  expect(deleted.deleted).toBe(true);
  expect(deleted.value).toBeNull();

  // Watchlist stays usable at mobile width and explicitly labels symbols missing from the hourly feed.
  await page.locator('[data-view="watchlist"]:visible').first().click();
  await expect(page.locator('#watchlistView')).toContainText('ENB');
  await expect(page.locator('#watchlistView')).toContainText('Completed session · hourly quote unavailable');
  const enbCard=page.locator('#watchlistView .card').filter({hasText:'ENB'}).first();
  await expect(enbCard.locator('.cardprice')).not.toContainText('5D');

  expect(await page.locator('#watchCards').evaluate(r=>r.scrollWidth>r.clientWidth)).toBe(true);
  await page.locator('[data-swipe="watchCards"][data-step="1"]').click();
  await expect.poll(()=>page.locator('#watchCards').evaluate(r=>r.scrollLeft)).toBeGreaterThan(0);
  await page.screenshot({path:'test-results/watchlist-mobile.png',fullPage:true});
  expect(errors).toEqual([]);
});

