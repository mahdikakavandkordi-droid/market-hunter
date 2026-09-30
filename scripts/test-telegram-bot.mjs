import assert from 'node:assert/strict';
import {
  mainMenu,pulseMenu,marketReport,hunterMenu,stageMenu,stockReport,diffScans,marketBrief,
  portfolioMenu,portfolioItemReport,portfolioSummaryReport
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
    {symbol:'CCC.TO',stage:'Attractive Growth',score:65}
  ],
  all:[]
};
scan.all=Object.values(scan.byStage).flat();

const previous={
  marketAsOf:'2026-09-28',
  byStage:{
    'Early Watch':[{symbol:'AAA.TO'}],
    'Recovery':[{symbol:'CCC.TO'},{symbol:'OLD.TO'}],
    'Attractive Growth':[],
    'Established Move':[{symbol:'DDD.TO'}]
  }
};

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
assert.match(hMenu.text,/چهار مرحله/);
assert.ok(hMenu.keyboard.inline_keyboard.flat().some(x=>x.callback_data==='stage:0'));

const ew=stageMenu(scan,0);
assert.match(ew.text,/ارلی واچ/);
assert.ok(ew.keyboard.inline_keyboard.flat().some(x=>x.text.includes('⭐ AAA.TO')));

const stock=stockReport(scan,'CCC.TO');
assert.match(stock.text,/CCC\.TO/);
assert.match(stock.text,/رشد جذاب/);
assert.match(stock.text,/برداشت من از این سهم/);
assert.match(stock.text,/چرا Hunter بهش توجه کرده/);

const diff=diffScans(scan,previous);
assert.deepEqual(diff.added.map(x=>x.symbol).sort(),['BBB.TO']);
assert.deepEqual(diff.removed.map(x=>x.symbol).sort(),['OLD.TO']);
assert.deepEqual(diff.moved.map(x=>x.symbol).sort(),['CCC.TO']);
assert.ok(diff.stayed.some(x=>x.symbol==='AAA.TO'));

const brief=marketBrief(scan,previous);
assert.match(brief.text,/برداشت کلی از تغییرات/);
assert.match(brief.text,/تازه وارد رادار/);
assert.match(brief.text,/OLD\.TO/);
assert.match(brief.text,/CCC\.TO/);

const portfolio={
  marketAsOf:'2026-09-29',
  items:[{
    symbol:'RY.TO',name:'Royal Bank',price:210,currency:'CAD',dayChangePct:1.2,stage:'Attractive Growth',
    ret20:5,rs20:2,rsi14:58,sector:'Financials',
    exposure:{assetClass:'Equity',group:'Financials'},
    entryStats:{returnPct:8,maxDrawdownPct:-4,maxGainPct:12,excessVsBenchmarkPct:3}
  }],
  portfolioAnalytics:{
    portfolioReturnPct:6,benchmarkReturnPct:3,excessReturnPct:3,
    annualizedVolatilityPct:12,betaVsTsx:.9,maxDrawdownPct:-5,
    diversificationRead:'Holdings show moderate diversification',
    topRiskContributor:{symbol:'RY.TO',riskContributionPct:42}
  }
};
assert.match(portfolioMenu(portfolio).text,/پورتفولیو/);
assert.match(portfolioItemReport(portfolio,'RY.TO').text,/برداشت از وضعیت این دارایی/);
assert.match(portfolioSummaryReport(portfolio).text,/برداشت کلی/);
assert.match(portfolioSummaryReport(portfolio).text,/Beta/);

console.log('telegram bot formatters: ok');
