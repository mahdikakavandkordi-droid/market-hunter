import {readFileSync} from 'node:fs';
import {UNIVERSE,UNIVERSE_SOURCE} from './universe.js';

const us=JSON.parse(readFileSync(new URL('../data/universes/us-ivv-2026-10-16.json',import.meta.url),'utf8'));
export const US_INSTRUMENTS=us.instruments;
export const US_META=new Map(US_INSTRUMENTS.map(x=>[x.symbol,x]));
export function hunterMarket(market='CA'){
  if(market==='CA')return {market,currency:'CAD',referenceSymbol:'^GSPTSE',file:'data/v2-latest-scan.json',source:UNIVERSE_SOURCE,instruments:UNIVERSE.map(([symbol,name,sector])=>({symbol,name,sector,currency:'CAD',market}))};
  if(market==='US')return {market,currency:'USD',referenceSymbol:'^GSPC',file:'data/v2-us-latest-scan.json',source:us.source,instruments:US_INSTRUMENTS};
  throw new Error('invalid_hunter_market');
}
export function scanCurrencyIssue(actual,expected){return actual===expected?null:'currency_mismatch'}
