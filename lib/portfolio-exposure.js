// Presentation metadata only. Never used by scanner scores or benchmarks.
// Exact exchange-qualified symbols; no name/substring inference.
const reviewedAt='2026-09-29';
const registry=new Map();
function add(symbols,name,group,instrument,detail,source,assetClass='Commodities'){
  for(const symbol of symbols)registry.set(symbol,{name,group,instrument,detail,source,assetClass,reviewedAt});
}
// Broad economic groups follow the project's existing sector vocabulary.
for(const [ticker,name,group] of [
  ['AAPL','Apple','Technology'],['MSFT','Microsoft','Technology'],
  ['NVDA','Nvidia','Technology'],['AMD','AMD','Technology'],
  ['AMZN','Amazon','Consumer'],['TSLA','Tesla','Consumer'],['COST','Costco','Consumer'],
  ['GOOG','Alphabet','Communication'],['META','Meta','Communication']
])add([ticker+'.TO'],name+' CDR',group,'CDR','Underlying company: '+name+' · CAD hedged','https://cdr.cibc.com/en/cdr-directory/'+ticker,'Equities');
add(['CGL.TO','CGL-C.TO','CGL.C.TO'],'iShares Gold Bullion ETF','Gold','ETF','Gold bullion exposure','https://www.blackrock.com/ca/investors/en/products/272269/ishares-gold-bullion-etf');
add(['SVR.TO','SVR-C.TO','SVR.C.TO'],'iShares Silver Bullion ETF','Silver','ETF','Silver bullion exposure','https://www.blackrock.com/ca/investors/en/products/272952/ishares-silver-bullion-etf');
add(['PHYS.TO','PHYS-U.TO'],'Sprott Physical Gold Trust','Gold','Trust','Physical gold bullion','https://sprott.com/investment-strategies/exchange-listed-products/physical-bullion-funds/gold/');
add(['PSLV.TO','PSLV-U.TO'],'Sprott Physical Silver Trust','Silver','Trust','Physical silver bullion','https://sprott.com/investment-strategies/exchange-listed-products/physical-bullion-funds/silver/');
add(['CEF.TO','CEF-U.TO'],'Sprott Physical Gold and Silver Trust','Gold & silver','Trust','Mixed bullion; not split into estimated metal weights','https://sprott.com/investment-strategies/exchange-listed-products/physical-bullion-funds/gold-and-silver/');
add(['HUG.TO'],'Global X Gold ETF','Gold','ETF','Gold futures exposure','https://www.globalx.ca/product/hug');
add(['HUZ.TO'],'Global X Silver ETF','Silver','ETF','Silver futures exposure','https://www.globalx.ca/product/huz');

export function portfolioExposure(symbol,meta={}){
  const mapped=registry.get(String(symbol||'').trim().toUpperCase());
  if(mapped)return {...mapped};
  const sector=typeof meta.sector==='string'?meta.sector.trim():'';
  if(sector&&!/^(cdr|unknown|other|n\/a)$/i.test(sector))return {group:sector,assetClass:'Equities',instrument:'Stock',detail:'Existing universe sector classification',source:null,reviewedAt:null};
  return {group:'Unknown',assetClass:'Unknown',instrument:sector==='CDR'?'CDR':'Unknown',detail:'Classification not yet verified',source:null,reviewedAt:null};
}
