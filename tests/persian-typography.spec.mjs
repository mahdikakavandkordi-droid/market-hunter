import {test,expect} from '@playwright/test';
const fontUrl='/fonts/vazirmatn-nl-v33.003.woff2';
async function setup(page){
 await page.addInitScript(()=>localStorage.setItem('mh-language','fa'));
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
  if(['/api/engines','/api/portfolio','/api/intraday','/api/hunter-monitor'].includes(u.pathname))return route.fulfill({json:{reports:[],items:[],quotes:{},rows:[],summary:{},failures:[]}});
  return route.continue();
 });
 await page.goto('/');await expect(page.locator('#refreshBtn')).toBeEnabled();
}
async function renderedFonts(page,selector){
 const session=await page.context().newCDPSession(page);
 await session.send('DOM.enable');await session.send('CSS.enable');
 const {root}=await session.send('DOM.getDocument');
 const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector});
 const {fonts}=await session.send('CSS.getPlatformFontsForNode',{nodeId});await session.detach();return fonts;
}
for(const width of [320,390,768,1440])test(`Persian glyphs use the bundled font at ${width}px while Latin prices keep their font`,async({page})=>{
 await page.setViewportSize({width,height:844});await setup(page);
 await page.evaluate(()=>document.fonts.ready);
 expect(await page.evaluate(()=>document.fonts.check('400 14px Vazirmatn','بررسی سهم‌ها'))).toBeTruthy();
 const titleFonts=await renderedFonts(page,'#pageTitle');
 expect(titleFonts.some(f=>f.isCustomFont&&/Vazirmatn/i.test(f.familyName)&&f.glyphCount>0)).toBeTruthy();
 const priceFonts=await renderedFonts(page,'#market-TSX .board-price>bdi');
 expect(priceFonts.some(f=>f.glyphCount>0)).toBeTruthy();
 expect(priceFonts.some(f=>/Vazirmatn/i.test(f.familyName)&&f.glyphCount>0)).toBeFalsy();
 await expect(page.locator('#pageTitle')).toHaveCSS('font-weight','600');
 await expect(page.locator('#pageTitle')).toHaveCSS('letter-spacing',/^(normal|0px)$/);
 await page.locator('[data-view="shortlist"]:visible').click();
 await expect(page.locator('.stock-summary-lead').first()).toHaveCSS('font-weight','400');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 await page.locator('#themeBtn').click();
 await page.locator('#languageBtn').click();
 await expect(page.locator('#pageTitle')).toHaveText('Review');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
test('font response is WOFF2 and missing font falls back to readable text',async({page})=>{
 const response=await page.request.get(fontUrl);expect(response.ok()).toBeTruthy();
 expect(response.headers()['content-type']).toContain('font/woff2');
 expect((await response.body()).subarray(0,4).toString()).toBe('wOF2');
 await page.route('**/fonts/*.woff2',route=>route.abort());
 await setup(page);await expect(page.locator('#pageTitle')).toBeVisible();await expect(page.locator('#pageTitle')).toHaveText('خانه');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
