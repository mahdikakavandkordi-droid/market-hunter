import assert from 'node:assert/strict';
import {
  mainMenu,pulseMenu,marketReport,hunterMenu,stageMenu,stockReport,diffScans,marketBrief,
  portfolioMenu,portfolioItemReport,portfolioSummaryReport,portfolioEmpty
} from '../lib/telegram-fa.js';

const scan={
  marketAsOf:'2026-09-29',generatedAt:'2026-09-29T22:52:00Z',classifiedCount:4,version:'test',
  byStage:{
    'Early Watch':[
      {symbol:'AAA.TO',name:'Alpha',stage:'Early Watch',score:60,price:10,ret5:1,ret20:-4,ret60:2,rs20:-1,rsi14:45,atr14Pct:2,dist20:-1,dist50:-2,pullback60:-8,momentumShift:2,swingTrend:'Structure improving',localLow:9,localHigh:11,evidence:['downside decelerating'],riskFlags:[]}
    ],
    'Recovery':[
      {symbol:'BBB.TO',name:'Beta',stage:'Recovery',score:55,price:20,ret5:3,ret20:-1,ret60:5,rs20:2,rsi14:52,atr14Pct:2.5,dist20:1,dist50:-1,pullback60:-6,momentumShift:4,swingTrend:'Structure improving',localLow:18,localHigh:21,evidence:['momentum improving'],riskFlags:[]}
    ],
    'Attractive Growth':[
      {symbol:'CCC.TO',name:'Gamma',stage:'Attractive Growth',score:65,price:30,ret5:2,ret20:10,ret60:12,rs20:8,rsi14:61,atr14Pct:3,dist20:4,dist50:7,pullback60:-2,momentumShift:1,swingTrend:'Higher highs + higher lows',localLow:27,localHigh:31,evidence:['rising MA20'],riskFlags:[]}
    ],
    'Established Move':[
      {symbol:'DDD.TO',name:'Delta',stage:'Established Move',score:62,price:40,ret5:-1,ret20:6,ret60:20,rs20:4,rsi14:55,atr14Pct:2.2,dist20:2,dist50:5,pullback60:-5,momentumShift:-2,swingTrend:'Higher highs + higher lows',localLow:37,localHigh:42,evidence:['durable MA50 slope'],riskFlags:[]}
    ]
  },
  surfacePicks:{
    'Early Watch':[{symbol:'AAA.TO'}],
    'Recovery':[],
    'Attractive Growth':[{symbol:'CCC.TO'}],
    'Established Move':[{symbol:'DDD.TO'}]
  },
  integratedSurfacePicks:[
    {symbol:'AAA.TO',stage:'Early Watch',score:60},
    {symbol:'BBB.TO',stage:'Recovery',score:55},
    {symbol:'CCC.TO',stage:'Attractive Growth',score:65}
  ],
  all:[]
};
scan.all=Object.values(scan.byStage).flat();

const previous={
  marketAsOf:'2026-09-28',
  integratedSurfacePicks:[
    {symbol:'AAA.TO',stage:'Early Watch'},
    {symbol:'CCC.TO',stage:'Recovery'},
    {symbol:'OLD.TO',stage:'Recovery'}
  ],
  byStage:{
    'Early Watch':[{symbol:'AAA.TO'}],
    'Recovery':[{symbol:'CCC.TO'},{symbol:'OLD.TO'}],
    'Attractive Growth':[],
    'Established Move':[{symbol:'DDD.TO'}]
  }
};

const history=[
  {
    marketAsOf:'2026-09-24',
    integratedSurfacePicks:[
      {symbol:'AAA.TO',stage:'Early Watch'},
      {symbol:'CCC.TO',stage:'Recovery'}
    ]
  },
  {
    marketAsOf:'2026-09-25',
    integratedSurfacePicks:[
      {symbol:'AAA.TO',stage:'Early Watch'}
    ]
  },
  {
    marketAsOf:'2026-09-26',
    integratedSurfacePicks:[
      {symbol:'AAA.TO',stage:'Early Watch'},
      {symbol:'CCC.TO',stage:'Recovery'}
    ]
  },
  previous,
  scan
];


const pulse={
  generatedAt:'2026-09-29T22:50:00Z',
  markets:[{
    key:'TSX',name:'TSX Composite',price:35000,currency:'CAD',asOf:'2026-09-29',
    returns:{d1:-0.2,d5:-1,d20:2,d60:5},
    trend:{daily:'Up',weekly:'Mixed',dist20:1},
    momentum:{rsi14:51},
    levels:{support:34000,resistance:35500,warningLevel:34500,bearishTrigger:33800},
    descriptiveState:{regime:'Mixed',condition:'Weakening'}
  }]
};

const menu=mainMenu();
assert.match(menu.text,/Market Hunter فارسی/);
assert.equal(menu.keyboard.inline_keyboard[0][0].callback_data,'m:pulse');
assert.equal(menu.keyboard.inline_keyboard[1][0].callback_data,'m:hunter');

const pMenu=pulseMenu(pulse);
assert.match(pMenu.text,/بازار و شاخص‌ها/);
assert.ok(pMenu.keyboard.inline_keyboard.flat().some(x=>x.callback_data==='pulse:TSX'));

const mReport=marketReport(pulse.markets[0]);
assert.match(mReport.text,/TSX/);
assert.match(mReport.text,/امروز/);
assert.match(mReport.text,/برداشت امروز/);
assert.match(mReport.text,/مهم‌ترین چیز برای پیگیری/);

const hMenu=hunterMenu(scan);
assert.match(hMenu.text,/منتخب نهایی امروز/);
assert.ok(hMenu.keyboard.inline_keyboard.flat().some(x=>x.callback_data==='stage:0'));

const ew=stageMenu(scan,0);
assert.match(ew.text,/ارلی واچ/);
assert.ok(ew.keyboard.inline_keyboard.flat().some(x=>x.text.includes('⭐ AAA.TO')));
assert.ok(ew.keyboard.inline_keyboard.flat().some(x=>x.text==='📈 چارت'&&x.url.includes('TSX%3AAAA')));
const established=stageMenu(scan,3);
assert.match(established.text,/سهمی وارد لیست منتخب نهایی نشده/);
assert.ok(!established.keyboard.inline_keyboard.flat().some(x=>x.callback_data==='stock:DDD.TO'));

const stock=stockReport(scan,'CCC.TO');
assert.match(stock.text,/CCC\.TO/);
assert.match(stock.text,/رشد جذاب/);
assert.match(stock.text,/برداشت من از این سهم/);
assert.match(stock.text,/چرا Hunter بهش توجه کرده/);
assert.ok(stock.keyboard.inline_keyboard.flat().some(x=>x.text.includes('TradingView')&&x.url.includes('TSX%3ACCC')));

const diff=diffScans(scan,previous);
assert.deepEqual(diff.added.map(x=>x.symbol).sort(),['BBB.TO']);
assert.deepEqual(diff.removed.map(x=>x.symbol).sort(),['OLD.TO']);
assert.deepEqual(diff.moved.map(x=>x.symbol).sort(),['CCC.TO']);
assert.ok(diff.stayed.some(x=>x.symbol==='AAA.TO'));

const brief=marketBrief(scan,previous,history);
assert.match(brief.text,/امروز چه عوض شد/);
assert.match(brief.text,/ردگیری کوتاه/);
assert.match(brief.text,/بدون تغییر/);
assert.match(brief.text,/AAA\.TO/);
assert.match(brief.text,/5 جلسه از 5 جلسه اخیر/);
assert.match(brief.text,/OLD\.TO/);
assert.match(brief.text,/CCC\.TO/);

const portfolio={
  marketAsOf:'2026-09-29',
  items:[
  {
    symbol:'RY.TO',name:'Royal Bank',price:210,currency:'CAD',dayChangePct:1.2,stage:'Attractive Growth',
    ret5:2,ret20:5,ret60:9,rs20:2,rs60:4,rsi14:58,momentumShift:2,dist20:1.5,dist50:3,
    sector:'Financials',swingTrend:'Structure improving',higherLow:true,higherHigh:true,
    support:202,resistance:215,
    exposure:{assetClass:'Equity',group:'Financials'},
    position:{quantity:5,entryPrice:190,boughtAt:'2026-09-01',source:'manual'},
    entryStats:{sinceEntryReturn:10.5,maxDrawdownPct:-4,maxGainPct:12,excessVsBenchmarkPct:3}
  },
  {
    symbol:'T.TO',name:'TELUS',price:11.63,currency:'CAD',dayChangePct:-2.7,stage:null,
    ret5:-3.3,ret20:-10.8,ret60:-20.2,rs20:-8.2,rs60:-19.9,rsi14:26.3,momentumShift:.2,dist20:-6,dist50:-11.3,
    sector:'Communication',swingTrend:'Lower highs + lower lows',higherLow:false,higherHigh:false,
    support:11.53,resistance:12.78,lowBroken:false,
    exposure:{assetClass:'Equity',group:'Communication'},
    position:{quantity:16.4,entryPrice:12.16,boughtAt:'2026-09-22',source:'manual'},
    entryStats:{sinceEntryReturn:-4.36,maxDrawdownPct:-4.3,maxGainPct:.8,excessVsBenchmarkPct:-1.1}
  },
  ...['IVN.TO','ETHX.TO','PHYS.TO','PSLV.TO','CRT-UN.TO'].map((symbol,i)=>({
    symbol,name:symbol,price:20+i,currency:'CAD',dayChangePct:0,stage:i%2?'Early Watch':null,
    ret5:0,ret20:0,ret60:0,rs20:0,rs60:0,rsi14:50,momentumShift:0,dist20:0,dist50:0,
    sector:'Test',swingTrend:'Structure improving',higherLow:true,higherHigh:false,
    support:19+i,resistance:21+i,
    exposure:{assetClass:'Equity',group:'Test'},
    position:{quantity:1,entryPrice:20+i,boughtAt:'2026-09-01',source:'manual'},
    entryStats:{sinceEntryReturn:0,maxDrawdownPct:0,maxGainPct:0,excessVsBenchmarkPct:0}
  }))
  ],
  portfolioAnalytics:{
    portfolioReturnPct:6,benchmarkReturnPct:3,excessReturnPct:3,
    annualizedVolatilityPct:12,betaVsTsx:.9,maxDrawdownPct:-5,
    diversificationRead:'Holdings show moderate diversification',
    topRiskContributor:{symbol:'RY.TO',riskContributionPct:42}
  }
};
const emptyPortfolio=portfolioEmpty(undefined,'https://example.com/pair');
assert.ok(emptyPortfolio.keyboard.inline_keyboard.flat().some(x=>x.url==='https://example.com/pair'));
assert.match(emptyPortfolio.text,/اتصال پورتفولیوی سایت/);
assert.match(portfolioMenu(portfolio).text,/پورتفولیو/);
const portfolioItem=portfolioItemReport(portfolio,'RY.TO');
assert.match(portfolioItem.text,/اگر بخوام ساده بگم/);
assert.match(portfolioItem.text,/پوزیشن تو/);
assert.match(portfolioItem.text,/دفعه‌ی بعد چی رو چک کنیم/);
assert.ok(portfolioItem.keyboard.inline_keyboard.flat().some(x=>x.text.includes('TradingView')&&x.url.includes('TSX%3ARY')));
assert.match(portfolioSummaryReport(portfolio).text,/تحلیل کامل پورتفولیو/);
assert.match(portfolioSummaryReport(portfolio).text,/وزن‌ها و تمرکز/);
assert.match(portfolioSummaryReport(portfolio).text,/ترکیب پورتفولیو/);
const fullPortfolioReport=portfolioSummaryReport(portfolio);
assert.match(fullPortfolioReport.text,/Beta/);
assert.match(fullPortfolioReport.text,/دارایی به دارایی/);
for(const symbol of ['RY.TO','T.TO','IVN.TO','ETHX.TO','PHYS.TO','PSLV.TO','CRT-UN.TO']){
  assert.match(fullPortfolioReport.text,new RegExp(symbol.replace('.','\\.')));
}
assert.match(fullPortfolioReport.text,/TELUS/);

console.log('telegram bot formatters: ok');
