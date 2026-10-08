import {test,expect} from '@playwright/test';

async function fixture(page,failed=false){
  if(failed)await page.route('**/data/fundamental-context.json',route=>route.fulfill({status:503,body:'Unavailable'}));
  const date=new Date().toISOString().slice(0,10);
  const stocks=['BHC.TO','MSFT.TO','SIA.TO'].map(symbol=>({symbol,name:symbol,stage:'Early Watch',price:30,currency:'CAD',date,rsi14:55,ret20:3,rs20:2,momentumShift:1}));
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/research-data'){
      const kind=url.searchParams.get('kind');
      return route.fulfill({json:kind==='v2'?{generatedAt:new Date().toISOString(),marketAsOf:date,all:stocks,integratedSurfacePicks:stocks,surfacePicks:{'Early Watch':stocks}}:kind==='pulse'?{markets:[]}:{groups:[],markets:[]}});
    }
    if(url.pathname==='/api/engines')return route.fulfill({json:{version:'engine-dashboard-v1',reports:[]}});
    return route.fulfill({json:{quotes:{},items:[],failures:[],connected:false}});
  });
  await page.goto('/');
  await page.locator('[data-view="shortlist"]:visible').click();
}
for(const width of [390,1440])test(`fundamental disclosure and bilingual evidence at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:850});
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await fixture(page);
  const card=page.locator('#shortlistView .hunter-card').filter({hasText:'BHC'});
  await expect(card).toHaveCount(1);
  await expect(card.locator('.stock-fundamental')).not.toHaveAttribute('open','');
  await card.locator('.stock-fundamental summary').click();
  await expect(card.locator('.fundamental-reading')).toContainText('12.7%');
  await expect(card.locator('.fundamental-source a')).toHaveAttribute('href',/www\.sec\.gov\/Archives\/edgar\/data\/885590\//);
  await expect(card.locator('.technical-monitor').last().locator('li')).toHaveCount(2);
  await expect(card.locator('.fundamental-source')).toContainText('SEC filings checked daily');
  const microsoft=page.locator('#shortlistView .hunter-card').filter({hasText:'MSFT'});
  await microsoft.locator('.stock-fundamental summary').click();
  await expect(microsoft.locator('.fundamental-reading')).toContainText('not Q4-only');
  await expect(microsoft.locator('.stock-fundamental summary')).toContainText('Fiscal year');
  const missing=page.locator('#shortlistView .hunter-card').filter({hasText:'SIA'});
  await expect(missing.locator('.stock-fundamental summary')).toContainText('Not available');
  await page.locator('#languageBtn').click();
  await card.locator('.stock-fundamental summary').click();
  await expect(card.locator('.fundamental-reading')).toContainText('حاشیهٔ سود');
  await expect(card.locator('.fundamental-source a')).toContainText('گزارش مالی اصلی');
  await expect(card.locator('.stock-fundamental summary')).toContainText('2026-06-30');
  await expect(card.locator('.technical-session')).toContainText(new Date().toISOString().slice(0,10));
  await expect(card.locator('.technical-monitor').last().locator('li')).toHaveCount(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});
test('fundamental source failure leaves technical cards usable',async({page})=>{
  await page.setViewportSize({width:390,height:850});await fixture(page,true);
  const card=page.locator('#shortlistView .hunter-card').filter({hasText:'BHC'});
  await expect(card.locator('.technical-session')).toBeVisible();
  await expect(card.locator('.stock-fundamental summary')).toContainText('Not available');
  await card.locator('.stock-fundamental summary').click();
  await expect(card.locator('.stock-fundamental')).toContainText('technical selection is unchanged');
});

test('delayed financial data does not block cards or reset language and disclosures',async({page})=>{
  let release;
  const gate=new Promise(resolve=>release=resolve);
  await page.route('**/data/fundamental-context.json',async route=>{await gate;await route.continue()});
  await fixture(page);
  const card=page.locator('#shortlistView .hunter-card').filter({hasText:'BHC'});
  await expect(card.locator('.technical-session')).toBeVisible();
  await expect(card.locator('.stock-fundamental summary')).toContainText('Loading');
  await page.locator('#languageBtn').click();
  await card.locator('.stock-fundamental summary').click();
  release();
  await expect(card.locator('.fundamental-reading')).toContainText('حاشیهٔ سود');
  await expect(card.locator('.stock-fundamental')).toHaveAttribute('open','');
  await expect(page.locator('#shortlistView')).toBeVisible();
});

test('hanging financial request times out while technical cards stay usable',async({page})=>{
  await page.route('**/data/fundamental-context.json',()=>new Promise(()=>{}));
  await fixture(page);
  const card=page.locator('#shortlistView .hunter-card').filter({hasText:'BHC'});
  await expect(card.locator('.technical-session')).toBeVisible();
  await expect(card.locator('.stock-fundamental summary')).toContainText('Not available',{timeout:8000});
  await expect(card.locator('.technical-session')).toBeVisible();
});
