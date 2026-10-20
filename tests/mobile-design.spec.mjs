import {test,expect} from '@playwright/test';

// Public research fixtures only; never connect layout checks to a real portfolio.
async function isolate(page){
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='127.0.0.1')return route.abort();
    if(['/api/engines','/api/portfolio','/api/intraday','/api/hunter-monitor'].includes(url.pathname))return route.fulfill({json:{reports:[],items:[],quotes:{},rows:[],summary:{},failures:[]}});
    return route.continue();
  });
}
for(const width of [320,390,768,1440]){
 test(`navigation, card layout and forms fit ${width}px in both languages and themes`,async({page})=>{
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width,height:844});await isolate(page);await page.goto('/');
  await expect(page.locator('#refreshBtn')).toBeEnabled();
  for(const theme of ['dark','light']){
   if(theme==='light')await page.locator('#themeBtn').click();
   for(const language of ['en','fa']){
    if(language==='fa')await page.locator('#languageBtn').click();
    for(const view of ['home','shortlist','portfolio','watchlist','engines']){
     await page.locator(`[data-view="${view}"]:visible`).click();
     expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
     const nav=page.locator(`[data-view="${view}"]:visible`);
     await expect(nav).toHaveAttribute('aria-current','page');
     const bounds=await nav.boundingBox();expect(bounds.height).toBeGreaterThanOrEqual(44);
     if(width<=700){
      const bottomNav=await page.locator('.mobile-nav').boundingBox();
      expect(bottomNav.y+bottomNav.height).toBeLessThanOrEqual(845);
      expect(bottomNav.y).toBeGreaterThan(700);
     }
     if(view==='shortlist'){
      const card=page.locator('#reviewCards .hunter-card').first();
      await expect(card).toBeVisible();
      const link=card.locator('.symbol-link'),symbol=link.locator('bdi');
      const a=await link.boundingBox(),b=await symbol.boundingBox();
      expect(a.height-b.height).toBeLessThan(12); // the chart arrow must not wrap below the symbol
      const price=await card.locator('.price-line').boundingBox();
      const name=await card.locator('.name').boundingBox();
      if(width<=700||width>=1000)expect(price.x).toBeGreaterThanOrEqual(name.x+name.width-1);
      else expect(price.y).toBeGreaterThanOrEqual(name.y+name.height-1);
      await card.locator('[data-buy]').click();
      const sheet=page.locator('.sheet');await expect(sheet).toBeVisible();
      const sheetBox=await sheet.boundingBox();expect(sheetBox.width).toBeLessThanOrEqual(width);
      await page.keyboard.press('Escape');await expect(sheet).not.toBeVisible();
     }
    }
    if(language==='fa')await page.locator('#languageBtn').click();
   }
  }
  expect(errors).toEqual([]);
 });
}

test('review arrows move between cards without moving the mobile page sideways',async({page})=>{
 await page.setViewportSize({width:390,height:844});await isolate(page);await page.goto('/');
 await expect(page.locator('#refreshBtn')).toBeEnabled();await page.locator('[data-view="shortlist"]:visible').click();
 await page.locator('[data-stage-tab="Established Move"]').click();
 const cards=page.locator('#reviewCards');expect(await cards.locator('.hunter-card').count()).toBeGreaterThan(1);
 await page.locator('[data-swipe="reviewCards"][data-step="1"]').click();
 await expect.poll(()=>cards.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
