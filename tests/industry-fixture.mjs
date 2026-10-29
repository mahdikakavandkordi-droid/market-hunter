import {industryContext} from '../lib/industry-context.js';
export function industryFixture(){
 const date='2026-10-28';
 const rows=['SYNTH1.TO','SYNTH2.TO','SYNTH3.TO'].map(symbol=>({symbol,name:'Synthetic industry candidate',sector:'Technology',market:'CA',currency:'CAD',benchmark:'^GSPTSE',date,asOf:date,price:20,dayChangePct:1.5,ret20:3,rs20:2,dist20:2,dist50:4,rsi14:55,atr14Pct:2,lowBroken:false,riskFlags:[]}));
 return {market:'CA',currency:'CAD',marketAsOf:date,universeCount:rows.length,universeRows:rows,industryContext:industryContext(rows,rows,date),integratedSurfacePicks:[]};
}
