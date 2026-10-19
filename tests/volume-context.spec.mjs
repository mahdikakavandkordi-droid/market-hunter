import {test,expect} from '@playwright/test';
test('mobile volume labels use completed data, not intraday quotes',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const stock={symbol:'MSFT.TO',name:'Synthetic fixture',sector:'CDR',stage:'Early Watch',price:20,date:'2026-10-16',avgDollar20:4000000,maxRvol5:2};
  const stocks=[stock,{...stock,symbol:'TEST.TO',sector:'Industrials'},{...stock,symbol:'UNKNOWN.TO',sector:null}];
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url());
    const json=url.pathname==='/api/research-data'&&url.searchParams.get('kind')==='v2'?{marketAsOf:stock.date,all:stocks,integratedSurfacePicks:stocks,surfacePicks:{'Early Watch':stocks}}:{markets:[],reports:[],quotes:{},items:[],failures:[]};
    return route.fulfill({json});
  });
  await page.goto('/');
  await page.locator('[data-view="shortlist"]:visible').click();
  const card=page.locator('.stock-volume').first();
  await expect(card).toContainText('Recent volume spike');
  await expect(page.locator('#shortlistView .stock-sector').first()).toContainText('Technology · CDR');
  await expect(page.locator('#shortlistView .stock-sector').nth(1)).toContainText('Industrials');
  await expect(page.locator('#shortlistView .stock-sector').nth(2)).toContainText('Unavailable');
  await card.locator('summary').click();
  await expect(card).toContainText('last 5 completed sessions');
  await expect(card).toContainText('2026-10-16');
  await page.locator('#languageBtn').click();
  await expect(page.locator('.stock-volume').first()).toContainText('جهش حجم در جلسات اخیر');
  await expect(page.locator('#shortlistView .stock-sector').first()).toContainText('فناوری');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
