import {test,expect} from '@playwright/test';
test.use({viewport:{width:390,height:844}});
test('a secure pairing link restores a saved portfolio in an empty browser without uploading an empty one',async({page})=>{
 const calls=[],stamp=new Date().toISOString();
 const payload={version:3,positions:{'FIXTURE.TO':{value:{symbol:'FIXTURE.TO',quantity:2,entryPrice:100,boughtAt:'2026-10-01',source:'manual'},deleted:false,updatedAt:stamp}},watchlist:{}};
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/portfolio-bridge'){const body=route.request().postDataJSON();calls.push(body);return route.fulfill({json:{ok:true,connected:true,payload,dailyPayload:null,revision:7,updatedAt:stamp}})}
  if(url.pathname==='/api/portfolio')return route.fulfill({json:{items:[{symbol:'FIXTURE.TO',name:'Synthetic holding',price:105,currency:'CAD',asOf:stamp.slice(0,10),rsi14:55,dayChangePct:1}],failures:[]}});
  if(url.pathname==='/api/engines')return route.fulfill({json:{version:'engine-dashboard-v1',reports:[]}});
  return route.fulfill({json:{groups:[],markets:[],asOf:{latest:stamp.slice(0,10)},integratedSurfacePicks:[],surfacePicks:{},quotes:{}}});
 });
 await page.goto('/?portfolioBridge=1&user_id=12345&sig=synthetic-test#portfolio');
 await expect(page.locator('#portfolioView')).toBeVisible();
 await expect(page.locator('#portfolioView .portfolio-slide')).toContainText('FIXTURE');
 expect(calls[0].action).toBe('restore');expect(calls.some(x=>x&&'payload' in x&&Object.keys(x.payload.positions||{}).length===0)).toBe(false);
 await expect(page).not.toHaveURL(/sig=/);
 await page.screenshot({path:'test-results/portfolio-restored-mobile.png',fullPage:true});
});
test('an unpaired empty browser shows reconnection before asking for new holdings',async({page})=>{
 await page.route('**/api/**',route=>route.fulfill({json:{ok:true,connected:false,version:'engine-dashboard-v1',reports:[],groups:[],markets:[],items:[],integratedSurfacePicks:[],surfacePicks:{}}}));
 await page.goto('/');await page.locator('[data-view="portfolio"]:visible').click();
 await expect(page.locator('.portfolio-reconnect')).toContainText('Already have a portfolio?');
 await expect(page.locator('.portfolio-reconnect')).toContainText('private Telegram');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
