import {test,expect} from '@playwright/test';
const date='2026-10-19';
const base={symbol:'FIXTURE.TO',name:'Synthetic information test',stage:'Recovery',currency:'CAD',benchmark:'^GSPTSE',date,asOf:date,price:200,dayChangePct:1,ret20:-3,rs20:-5,atr14Pct:7,dist20:7,rsi14:76,momentumShift:2,localLow:190,localHigh:210,lowBroken:false,highBroken:false,evidence:['higher low','momentum improving'],riskFlags:['Extended above MA20','High RSI','High ATR']};
async function setup(page,missing=false){
 const stock=missing?{...base,ret20:null,rs20:null,atr14Pct:null,evidence:[],riskFlags:[],dist20:null,rsi14:null}:base;
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/research-data')return route.fulfill({json:url.searchParams.get('kind')==='v2'?{market:'CA',currency:'CAD',marketAsOf:date,all:[stock],integratedSurfacePicks:[stock],surfacePicks:{Recovery:[stock]}}:{markets:[],groups:[]}});
  if(url.pathname==='/api/portfolio')return route.fulfill({json:{items:[stock],failures:[]}});
  if(url.pathname==='/api/intraday'){
   const now=new Date().toISOString();return route.fulfill({json:{capturedAt:now,currentState:{marketOpen:true,snapshotFresh:true,sessionDate:date},quotes:{'FIXTURE.TO':{symbol:'FIXTURE.TO',price:205,currency:'CAD',quoteAt:now,sessionDate:date,changePct:2.5}}}});
  }
  return route.fulfill({json:{reports:[],quotes:{},items:[],failures:[],connected:false}});
 });
 await page.route('**/data/fundamental-context.json',route=>route.fulfill({json:{version:'fundamental-context-v1',items:[]}}));
 await page.goto('/');await expect(page.locator('#refreshBtn')).toBeEnabled();
 await page.locator('[data-view="shortlist"]:visible').click();await page.locator('[data-stage-tab="Recovery"]').click();
 return page.locator('#shortlistView .hunter-card').first();
}
for(const width of [320,390,1440])test(`recorded reasons, weakness and comparable metrics remain readable at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});const card=await setup(page);
 await expect(card.locator('.stock-analysis')).not.toHaveAttribute('open');
 await expect(card.locator('.selection-preview')).toContainText('higher local low');
 const order=await card.evaluate(el=>{
  const y=s=>el.querySelector(s).getBoundingClientRect().top;
  return {lead:y('.stock-summary-lead'),cautions:y('.stock-cautions'),actions:y('.actions'),details:y('.stock-analysis')};
 });
 expect(order.lead).toBeLessThan(order.cautions);expect(order.cautions).toBeLessThan(order.actions);expect(order.actions).toBeLessThan(order.details);
 for(const caution of await card.locator('.stock-cautions li').all())await expect(caution).toBeVisible();
 await card.locator('.stock-analysis>summary').focus();await page.keyboard.press('Enter');
 await expect(card.locator('.stock-analysis')).toHaveAttribute('open','');
 await expect(card.locator('.selection-reasons')).toContainText('higher local low');
 await expect(card.locator('.stock-cautions')).toContainText('ATR');
 await expect(card.locator('.stock-cautions')).toContainText('RSI');
 await expect(card.locator('.stock-cautions li')).toHaveCount(3);
 await expect(card.locator('.stock-key-metrics')).toContainText('-3.0%');
 await expect(card.locator('.stock-key-metrics')).toContainText('-5.0 pp');
 await expect(card.locator('.stock-key-metrics')).toContainText('7.0%');
 await expect(card.locator('.price-line')).toContainText('205.00');
 await expect(card.locator('.technical-session')).toContainText(date);
 await expect(page.locator('#asOf')).toContainText(date);
 await expect(card.locator('.technical-monitor')).toContainText('CA$190.00');
 await page.locator('#languageBtn').click();
 await expect(card.locator('.stock-analysis')).toHaveAttribute('open','');
 await expect(card.locator('.selection-reasons')).toContainText('کف محلی بالاتر');
 await expect(card.locator('.stock-cautions')).toContainText('دامنهٔ معمول');
 await expect(card.locator('.quote-meta')).toContainText('قیمت حین بازار');
 await expect(page.locator('#asOf')).toContainText('جلسهٔ اسکن');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
test('missing metrics and unrecorded selection reasons stay unknown',async({page})=>{
 await page.setViewportSize({width:390,height:844});const card=await setup(page,true);
 await card.locator('.stock-analysis>summary').click();
 await expect(card.locator('.stock-key-metrics b')).toHaveText(['—','—','—']);
 await expect(card.locator('.selection-reasons')).toHaveCount(0);
 await expect(card.locator('.stock-summary')).toContainText('did not include stock-specific selection evidence');
});
