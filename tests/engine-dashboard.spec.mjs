import {test,expect} from '@playwright/test';
import {ENGINES,COHORTS,normalizeEvidence,commonComparison} from '../lib/engine-dashboard.js';
test.use({timezoneId:'America/St_Johns'});

function paperAccount(open=false){
  const position={symbol:'TEST.TO',dir:1,status:'open',portfolioStatus:'open',entryT:'2026-10-04T18:00:00Z',entry:100,stop:95,target:110,notional:250,riskAmount:12.5,markPrice:null,unrealizedPnl:null,markStatus:'missing'};
  return {startingCapital:1000,cash:open?750:1000,realizedCurrentEquity:1000,realizedReturnPct:0,markedCurrentEquity:open?null:1000,markedReturnPct:open?null:0,markedObservation:{quality:open?'missing':'fresh'},open:open?[position]:[],entered:open?[position]:[],skippedCount:0,rules:{costR:.05}};
}
function fixture(){
  const now=new Date().toISOString(),reports=[];
  for(const e of ENGINES)for(const cohort of COHORTS){
    const d={version:e.id==='smc'?'smc-wd4h-forward-paper-evidence-v2':e.id==='trend'?'trend-breakout-v1':'mean-reversion-v1',mode:'forward_shadow',cohort,generatedAt:now,forwardStart:e.id==='smc'?'2026-10-01':'2026-10-04T17:00:00Z',trades:[],portfolio:paperAccount(e.id==='smc'&&cohort==='tsx-core'),summary:{pending:0},failures:[]};
    if(e.id==='smc'&&cohort==='crypto-15'){d.portfolio=paperAccount(true);d.portfolio.open[0]={...d.portfolio.open[0],symbol:'BTC-USD',dir:-1,markPrice:98,markT:now,markStatus:'fresh',unrealizedPnl:5};d.portfolio.entered=d.portfolio.open;d.trades=[{symbol:'ADA-USD',dir:1,status:'pending_entry',firstObservedAt:now,signalT:now}];}
    if(e.id==='mean')d.comparison={commonStart:'2026-10-04T17:00:00Z',smcLedgerAsOf:now,trendLedgerAsOf:now,smc:{commonWindowPaperAccount:paperAccount()},trend:{commonWindowPaperAccount:paperAccount()}};
    reports.push({...normalizeEvidence(e,cohort,d),source:{url:'https://github.com/example/evidence'},comparison:e.id==='mean'?commonComparison(d):null});
  }
  return {version:'engine-dashboard-v1',fetchedAt:now,reports};
}
for(const width of [390,1440])test(`paper engine navigation and evidence states at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const data=fixture();
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/engines')return route.fulfill({json:data});
    if(url.pathname==='/api/research-data'){
      const kind=url.searchParams.get('kind');
      return route.fulfill({json:kind==='v2'?{generatedAt:new Date().toISOString(),marketAsOf:new Date().toISOString().slice(0,10),integratedSurfacePicks:[{symbol:'TEST.TO',name:'Synthetic fixture',stage:'Recovery',price:100,rsi14:55}],surfacePicks:{Recovery:[{symbol:'TEST.TO',name:'Synthetic fixture',stage:'Recovery',price:100,rsi14:55}]} }:kind==='pulse'?{markets:[]}:{groups:[],markets:[],asOf:{latest:'2026-10-04'}}});
    }
    if(url.pathname==='/api/portfolio')return route.fulfill({json:{items:[],failures:[]}});
    return route.fulfill({json:{quotes:{},connected:false}});
  });
  await page.goto('/');
  await page.locator('[data-view="engines"]:visible').click();
  const view=page.locator('#enginesView');
  await expect(view.getByText('Paper engines',{exact:true})).toBeVisible();
  await expect(view.locator('.engine-position').filter({hasText:'TEST.TO'})).toContainText('TEST.TO');
  await expect(view.locator('.engine-position').filter({hasText:'BTC-USD'})).toContainText('Short');
  await expect(view.locator('.engine-position').filter({hasText:'BTC-USD'}).locator('.tag')).toHaveClass(/short/);
  await view.locator('[data-engine-mode="pending"]').click();
  await expect(view.locator('.engine-position')).toContainText('ADA-USD');
  await expect(view).toContainText('no position has opened');
  await view.locator('[data-engine-mode="open"]').click();
  await expect(view).toContainText('Started Oct 1');
  await expect(view.locator('.engine-overview').first().locator('.engine-equity')).toContainText('—');
  await expect(view).toContainText('Same starting window');
  await view.locator('[data-engine-tab="trend"]:visible').click();
  await expect(view).toContainText('No recorded open position');
  await view.locator('.engine-account-details>summary').click();
  await view.locator('[data-engine-market="crypto-15"]').click();
  await expect(view.locator('[data-engine-market="crypto-15"]')).toHaveAttribute('aria-pressed','true');
  await view.locator('[data-engine-mode="closed"]').click();
  await expect(view).toContainText('No settled paper trades');
  await page.locator('[data-view="shortlist"]:visible').click();
  await page.locator('[data-stage-tab="Recovery"]').click();
  await expect(page.locator('#shortlistView .engine-confirmation')).toHaveCount(0);
  await expect(page.locator('#shortlistView')).not.toContainText('What would trigger an entry');
  await page.screenshot({path:`test-results/review-${width}-english.png`,fullPage:true});
  await page.locator('[data-engine-open="smc"]').click();
  await expect(view.locator('.engine-position').filter({hasText:'TEST.TO'})).toContainText('TEST.TO');
  await expect(view.locator('[data-engine-market="tsx-core"]')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`test-results/engines-${width}-dark.png`,fullPage:true});
  await page.locator('#themeBtn').click();
  await page.screenshot({path:`test-results/engines-${width}-light.png`,fullPage:true});
  await page.locator('#languageBtn').click();
  await expect(view).toContainText('پوزیشن‌ها · همهٔ بازارها');
  await page.screenshot({path:`test-results/engines-${width}-persian.png`,fullPage:true});
  await page.locator('[data-view="shortlist"]:visible').click();
  await expect(page.locator('#shortlistView .analysis-copy').first()).toContainText('بازسازی');
  await expect(page.locator('#shortlistView .stock-summary')).toHaveCount(1);
  await expect(page.locator('#shortlistView .stock-summary')).toHaveCSS('direction','rtl');
  await page.screenshot({path:`test-results/review-${width}-persian.png`,fullPage:true});
  await page.reload();
  await page.locator('[data-view="shortlist"]:visible').click();
  await page.locator('[data-stage-tab="Recovery"]').click();
  await expect(page.locator('#shortlistView .analysis-copy').first()).toContainText('بازسازی');
  await page.locator('#installBtn').click();
  await expect(page.locator('.install-dialog')).toBeVisible();
  await page.locator('.install-dialog button').click();
  await page.locator('#languageBtn').click();
  await page.locator('[data-view="engines"]:visible').click();
  await page.route('**/api/engines',route=>route.fulfill({status:503,json:{error:'unavailable'}}));
  await view.locator('[data-engine-refresh]').click();
  await expect(view).toContainText('Refresh failed. Showing the previous snapshot.');
  expect(errors).toEqual([]);
});

