import {test,expect} from '@playwright/test';
const names={TSX:'TSX Composite',SP500:'S&P 500',NASDAQ100:'Nasdaq-100',GOLD:'Gold',SILVER:'Silver',BTC:'Bitcoin',ETH:'Ethereum'};
const market=key=>({key,name:names[key],asOf:'2026-10-19',price:100,regime:'Mixed',condition:key==='TSX'?'Breakout / Near High':'Weakening',current:{currency:'USD',returns:{d1:1,d5:-1,d20:key==='TSX'?2:-3}},freshness:{status:key==='BTC'||key==='ETH'?'stale':'fresh',expectedCompletedSession:'2026-10-19'},levels:{bullishTrigger:110,bearishTrigger:90},outlook:'Recorded synthetic context'});
async function setup(page,{differentDate=false,empty=false}={}){
 const markets=empty?[]:Object.keys(names).map(market);if(differentDate)markets.find(m=>m.key==='SP500').asOf='2026-10-16';
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();
  if(url.pathname.startsWith('/api/')){
   if(url.pathname==='/api/research-data')return route.fulfill({json:url.searchParams.get('kind')==='pulse'?{markets}:url.searchParams.get('kind')==='daily'?{markets:markets.map(m=>({...m,asOf:'2026-10-19'})),groups:[{label:'Equities',state:'Weakening'},{label:'Metals',state:'Weakening'},{label:'Crypto',state:'Bull'}],highestAttention:['BTC','SILVER','SP500'],watchNext:[],executiveSummary:['Source summary']}:{all:[],integratedSurfacePicks:[],surfacePicks:{}}});
   return route.fulfill({json:{reports:[],quotes:{},items:[],rows:[],connected:false}});
  }
  return route.continue();
 });
 await page.goto('/');await expect(page.locator('#refreshBtn')).toBeEnabled();
}
for(const width of [320,390,1440])test(`home overview is comparable and navigable at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await setup(page);
 await expect(page.locator('.overview-coverage')).toContainText('5/7');
 await expect(page.locator('.overview-headline')).toContainText('4 of 5');
 await expect(page.locator('#homeBriefGroups .brief-group')).toHaveCount(3);
 expect(await page.locator('#homeBriefGroups').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
 await expect(page.locator('.equity-comparison')).toContainText('+2.0%');
 await expect(page.locator('.home-focus-list')).not.toContainText('Bitcoin');
 await expect(page.locator('#homeMarkets .market-board-item')).toHaveCount(7);
 await expect(page.locator('#market-BTC .board-state')).toContainText('Update required');
 await expect(page.locator('#market-BTC')).toContainText('excluded from current summary');
 await page.locator('#homeBriefGroups [data-home-group="metals"]').click();
 await expect(page.locator('#homeMarkets .market-board-item')).toHaveCount(2);
 await page.locator('.home-focus-list [data-market-focus="SP500"]').click();
 await expect(page.locator('#homeMarkets .market-board-item')).toHaveCount(7);
 await expect(page.locator('#market-SP500 details')).toHaveAttribute('open','');
 await expect(page.locator('#market-SP500')).toContainText('110');
 await page.locator('#languageBtn').click();
 await expect(page.locator('.overview-headline')).toContainText('ضعف کوتاه‌مدت');
 await expect(page.locator('#pageTitle')).toHaveText('خانه');
 await expect(page.locator('#market-BTC .board-state')).toContainText('نیازمند بروزرسانی');
 await page.locator('#themeBtn').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 await page.reload();await expect(page.locator('#pageTitle')).toHaveText('خانه');
});
test('mismatched sessions suppress the equity comparison and unmatched focus levels',async({page})=>{
 await setup(page,{differentDate:true});await expect(page.locator('.equity-comparison')).toHaveCount(0);
 await expect(page.locator('.home-focus-list [data-market-focus="SP500"]')).toHaveCount(0);
});
test('empty reports never create a current market posture',async({page})=>{
 await setup(page,{empty:true});await expect(page.locator('.overview-coverage')).toContainText('0/7');
 await expect(page.locator('.overview-headline')).toContainText('unavailable');
 await expect(page.locator('#homeMarkets')).toContainText('Market data is unavailable');
 await expect(page.locator('.equity-comparison')).toHaveCount(0);
});
