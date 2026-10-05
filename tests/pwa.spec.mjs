import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'allow',viewport:{width:390,height:844}});
test('installable mobile shell caches assets and opens offline',async({page,context})=>{
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/api/**',route=>route.fulfill({json:{version:'engine-dashboard-v1',reports:[],items:[],markets:[],groups:[],integratedSurfacePicks:[],surfacePicks:{}}}));
  await page.goto('/');
  await expect(page.locator('#installBtn')).toHaveCount(0);
  await expect(page.locator('#languageBtn')).toBeVisible();
  const manifest=await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');expect(manifest.icons.some(x=>x.purpose==='maskable')).toBe(true);
  for(const icon of manifest.icons){const r=await page.request.get(icon.src);expect(r.ok()).toBe(true);const b=await r.body();const size=Number(icon.sizes.split('x')[0]);expect(b.readUInt32BE(16)).toBe(size);expect(b.readUInt32BE(20)).toBe(size);}
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>caches.keys())).toContain('market-hunter-shell-v22');
  await expect.poll(()=>page.evaluate(async()=>{const c=await caches.open('market-hunter-shell-v22');return Boolean(await c.match('/i18n.js'))&&Boolean(await c.match('/engine-dashboard.js'));})).toBe(true);
  await page.locator('#languageBtn').click();
  await context.setOffline(true);await page.reload();
  await expect(page.locator('#languageBtn')).toHaveText('EN');
  await expect(page.locator('[data-view="engines"]:visible')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});
