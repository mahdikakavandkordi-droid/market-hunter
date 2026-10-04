import {test,expect} from '@playwright/test';
import {ENGINES,COHORTS,normalizeEvidence,commonComparison} from '../lib/engine-dashboard.js';

function paperAccount(open=false){
  const position={symbol:'TEST.TO',dir:1,status:'open',portfolioStatus:'open',entryT:'2026-10-04T18:00:00Z',entry:100,stop:95,target:110,notional:250,riskAmount:12.5,markPrice:null,unrealizedPnl:null,markStatus:'missing'};
  return {startingCapital:1000,cash:open?750:1000,realizedCurrentEquity:1000,realizedReturnPct:0,markedCurrentEquity:open?null:1000,markedReturnPct:open?null:0,markedObservation:{quality:open?'missing':'fresh'},open:open?[position]:[],entered:open?[position]:[],skippedCount:0,rules:{costR:.05}};
}
function fixture(){
  const now=new Date().toISOString(),reports=[];
  for(const e of ENGINES)for(const cohort of COHORTS){
    const d={version:e.id==='smc'?'smc-wd4h-forward-paper-evidence-v2':e.id==='trend'?'trend-breakout-v1':'mean-reversion-v1',mode:'forward_shadow',cohort,generatedAt:now,forwardStart:'2026-10-04T17:00:00Z',trades:[],portfolio:paperAccount(e.id==='smc'&&cohort==='tsx-core'),summary:{pending:0},failures:[]};
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
      return route.fulfill({json:kind==='v2'?{integratedSurfacePicks:[{symbol:'TEST.TO',name:'Synthetic fixture',stage:'Recovery',price:100,rsi14:55}],surfacePicks:{Recovery:[{symbol:'TEST.TO',name:'Synthetic fixture',stage:'Recovery',price:100,rsi14:55}]} }:kind==='pulse'?{markets:[]}:{groups:[],markets:[],asOf:{latest:'2026-10-04'}}});
    }
    if(url.pathname==='/api/portfolio')return route.fulfill({json:{items:[],failures:[]}});
    return route.fulfill({json:{quotes:{},connected:false}});
  });
  await page.goto('/');
  await page.locator('[data-view="engines"]:visible').click();
  const view=page.locator('#enginesView');
  await expect(view.getByText('Three engines. One research desk.')).toBeVisible();
  await expect(view.locator('.engine-position')).toContainText('TEST.TO');
  await expect(view.locator('.engine-overview').first().locator('.engine-equity')).toContainText('—');
  await expect(view).toContainText('Same starting window');
  await view.locator('[data-engine-tab="trend"]').click();
  await expect(view).toContainText('No recorded open position');
  await view.locator('[data-engine-market="crypto-15"]').click();
  await expect(view.locator('[data-engine-market="crypto-15"]')).toHaveAttribute('aria-pressed','true');
  await view.locator('[data-engine-mode="closed"]').click();
  await expect(view).toContainText('No settled paper trades');
  await page.locator('[data-view="shortlist"]:visible').click();
  await page.locator('[data-stage-tab="Recovery"]').click();
  await page.locator('[data-engine-open="smc"]').click();
  await expect(view.locator('.engine-position')).toContainText('TEST.TO');
  await expect(view.locator('[data-engine-market="tsx-core"]')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`test-results/engines-${width}-dark.png`,fullPage:true});
  await page.locator('#themeBtn').click();
  await page.screenshot({path:`test-results/engines-${width}-light.png`,fullPage:true});
  await page.route('**/api/engines',route=>route.fulfill({status:503,json:{error:'unavailable'}}));
  await view.locator('[data-engine-refresh]').click();
  await expect(view).toContainText('Refresh failed. Showing the previous snapshot.');
  expect(errors).toEqual([]);
});
