import {test,expect} from '@playwright/test';
test('mobile volume labels use completed data, not intraday quotes',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const stock={symbol:'TEST.TO',name:'Synthetic fixture',stage:'Early Watch',price:20,date:'2026-10-16',avgDollar20:4000000,maxRvol5:2};
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url());
    const json=url.pathname==='/api/research-data'&&url.searchParams.get('kind')==='v2'?{marketAsOf:stock.date,all:[stock],integratedSurfacePicks:[stock],surfacePicks:{'Early Watch':[stock]}}:{markets:[],reports:[],quotes:{},items:[],failures:[]};
    return route.fulfill({json});
  });
  await page.goto('/');
  await page.locator('[data-view="shortlist"]:visible').click();
  const card=page.locator('.stock-volume').first();
  await expect(card).toContainText('Recent volume spike');
  await card.locator('summary').click();
  await expect(card).toContainText('last 5 completed sessions');
  await expect(card).toContainText('2026-10-16');
  await page.locator('#languageBtn').click();
  await expect(page.locator('.stock-volume').first()).toContainText('جهش حجم در جلسات اخیر');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
