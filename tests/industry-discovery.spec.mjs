import {test,expect} from '@playwright/test';
import {industryContext} from '../lib/industry-context.js';
const date='2026-10-28';
function scan(market='CA',zero=false){
 const rows=Array.from({length:11},(_,i)=>({symbol:market==='CA'?`T${i}.TO`:`U${i}`,market,currency:market==='CA'?'CAD':'USD',name:'Synthetic stock '+i,sector:i===10?'CDR':'Technology',date,asOf:date,price:20,ret20:2,rs20:zero?-1:1,dist50:3,dist20:2,rsi14:55,atr14Pct:2,lowBroken:false,riskFlags:[],benchmark:market==='CA'?'^GSPTSE':'^GSPC'}));
 return {market,currency:rows[0].currency,marketAsOf:date,universeCount:12,universeRows:rows,industryContext:industryContext(rows,[...rows,{symbol:'E',sector:'Energy'}],date),integratedSurfacePicks:[],sessionIntegrity:{referenceSymbol:market==='CA'?'^GSPTSE':'^GSPC'}};
}
for(const zero of [false,true])test(`industry discovery zero=${zero}`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:390,height:844});
 await page.route('**/api/**',r=>{const k=new URL(r.request().url()).searchParams.get('kind');return r.fulfill({json:k==='v2'?scan('CA',zero):k==='v2-us'?scan('US',zero):{markets:[],reports:[],items:[],rows:[],quotes:{}}})});
 await page.goto('/');await expect(page.locator('#refreshBtn')).toBeEnabled();await expect(page.locator('#industryHome')).toContainText(zero?'No stocks meet':'11');
 await page.locator('[data-view="shortlist"]:visible').click();await expect(page.locator('[data-stage-tab]')).toHaveCount(0);await expect(page.locator('.discovery-card')).toHaveCount(zero?0:11);
 await expect(page.locator('.industry-group').filter({hasText:'Energy'})).toContainText('No qualifying stocks');await expect(page.locator('.industry-group').filter({hasText:'Unmapped'})).toContainText('Sector comparison unavailable');
 await page.locator('[data-hunter-market="US"]').click();await expect(page.locator('.discovery-card')).toHaveCount(zero?0:11);
 if(!zero){await expect(page.locator('.discovery-card').first()).toContainText('US · USD');await page.evaluate(()=>window.open=url=>window.chartUrl=url);await page.locator('.discovery-card [data-chart]').first().click();expect(await page.evaluate(()=>window.chartUrl)).toContain('U0');}
 await page.locator('#languageBtn').click();await expect(page.locator('#shortlistView')).toContainText('بررسی صنایع و سهم‌ها');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();expect(errors).toEqual([]);
});
