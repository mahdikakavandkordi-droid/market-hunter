import {test,expect} from '@playwright/test';
const stock=(symbol,market)=>({symbol,name:market==='US'?'Synthetic US Apple':'Synthetic CAD CDR',sector:'Information Technology',market,currency:market==='US'?'USD':'CAD',exchange:'NASDAQ',benchmark:market==='US'?'^GSPC':'^IXIC',stage:'Early Watch',price:200,date:'2026-10-16',asOf:'2026-10-16',dayChangePct:1.5});
const report=(market)=>{const x=stock(market==='US'?'AAPL':'AAPL.TO',market);return {market,currency:x.currency,marketAsOf:x.date,sourceUsableCount:503,universeCount:503,sessionIntegrity:{referenceSymbol:market==='US'?'^GSPC':'^GSPTSE'},all:[x],integratedSurfacePicks:[x],surfacePicks:{'Early Watch':[x]}}};
async function setup(page,unavailable=false){
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/**',r=>{
    const u=new URL(r.request().url());
    if(u.searchParams.get('kind')==='v2-us')return unavailable?r.fulfill({status:503,json:{error:'unavailable'}}):r.fulfill({json:report('US')});
    const json=u.searchParams.get('kind')==='v2'?report('CA'):{markets:[],reports:[],quotes:{},items:[],failures:[]};
    return r.fulfill({json});
  });
  await page.route('**/data/v2-us-latest-scan.json',r=>r.fulfill({status:404}));
  await page.goto('/');
  await page.locator('[data-view="shortlist"]:visible').click();
}
test('US review keeps currency, chart and CDR identity separate on mobile',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await setup(page);
  await expect(page.locator('.stock-sector').first()).toHaveText('Information Technology');
  await page.locator('[data-hunter-market="US"]').click();
  await expect(page.locator('.us-market-note')).toContainText('has not been validated');
  const card=page.locator('#shortlistView .hunter-card').first();
  await expect(card).toContainText('US · USD');
  await expect(card.locator('.price-line')).toContainText(await page.evaluate(()=>new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2}).format(200)));
  await expect(card.locator('.day-change')).toContainText('+1.5%');
  await page.evaluate(()=>{window.open=(url)=>{window.testChartUrl=url}});
  await card.locator('[data-chart]').first().click();
  expect(await page.evaluate(()=>window.testChartUrl)).toContain('NASDAQ%3AAAPL');
  await card.locator('[data-buy]').click();
  await expect(page.locator('[name="symbol"]')).toHaveValue('AAPL');
  await page.keyboard.press('Escape');
  await page.locator('#languageBtn').click();
  await expect(page.locator('.us-market-note')).toContainText('هنوز اعتبارسنجی نشده');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.locator('[data-hunter-market="CA"]').click();
  await expect(page.locator('#shortlistView .hunter-card').first()).toContainText('Synthetic CAD CDR');
  await page.locator('[data-view="home"]:visible').click();
  await expect(page.locator('.home-pick').first()).toContainText('Synthetic CAD CDR');
  expect(errors).toEqual([]);
});
test('failed US sources never appear as an empty successful scan',async({page})=>{
  await setup(page,true);
  await page.locator('[data-hunter-market="US"]').click();
  await expect(page.locator('#shortlistView .empty')).toContainText('US scan unavailable');
  await expect(page.locator('#shortlistView .hunter-card')).toHaveCount(0);
  await page.locator('[data-hunter-market="CA"]').click();
  await expect(page.locator('#shortlistView .hunter-card').first()).toContainText('Synthetic CAD CDR');
});
