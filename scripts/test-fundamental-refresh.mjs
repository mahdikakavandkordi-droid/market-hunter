import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PILOT,ISSUERS,buildSnapshot,narrative} from '../lib/fundamental-pilot.mjs';
import {reviewedManualSnapshot} from '../lib/fundamental-manual.mjs';
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/fundamental-pilot/BHC.json'));
const input={...fixture,spec:PILOT[0],asOf:'2026-10-08T12:00:00Z'};
const initial=buildSnapshot(input);
function quarterLater(value){
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/.test(value)){
  const d=new Date(value);d.setUTCMonth(d.getUTCMonth()+3);return value.includes('T')?d.toISOString():d.toISOString().slice(0,10);
 }
 if(Array.isArray(value))return value.map(quarterLater);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,quarterLater(v)]));
 return value;
}
const later={...quarterLater(input),spec:PILOT[0],asOf:'2027-01-15T12:00:00Z',retrievedAt:'2027-01-15T12:01:00Z'};
// Dates in these synthetic source excerpts are deliberately advanced; no real evidence is changed.
const next=buildSnapshot(later);assert.equal(next.status,'complete');assert.equal(next.financialPeriod.end,'2026-09-30');assert.equal(next.financialPeriod.start,'2026-07-01');
assert.equal(next.metrics.operatingCash.periodStart,'2026-04-01');
const before=narrative(initial);const different=structuredClone(initial);different.metrics.currentLongTermDebt.value*=2;
assert.notEqual(narrative(different).uncertainty,before.uncertainty);
const missing=structuredClone(initial);missing.metrics.currentLongTermDebt.status='missing';assert(!narrative(missing).evidence.includes('currentLongTermDebt'));assert(!narrative(missing).uncertainty.includes('0.87'));
for(const spec of PILOT){
 const data=JSON.parse(fs.readFileSync(`tests/fixtures/fundamental-pilot/${spec.symbol.split('.')[0]}.json`));
 const s=buildSnapshot({...data,spec,asOf:'2026-10-08T12:00:00Z'});
 assert.deepEqual(narrative(s,'en').evidence,narrative(s,'fa').evidence);
 if(['digital-platforms','software-cloud'].includes(spec.lens)){
  assert(narrative(s).evidence.includes('propertyEquipmentPayments'));
  const unverified=structuredClone(s);unverified.metrics.propertyEquipmentPayments.status='missing';assert(!narrative(unverified).evidence.includes('propertyEquipmentPayments'));
  const mismatched=structuredClone(s);mismatched.metrics.propertyEquipmentPayments.periodStart='2026-02-01';assert(!narrative(mismatched).evidence.includes('propertyEquipmentPayments'));
 }
}
const spec=ISSUERS.find(x=>x.symbol==='SIA.TO');
const metric=(value,start='2026-04-01',scope='consolidated')=>({value,sourceNumber:String(value),scale:1,periodStart:start,periodEnd:'2026-06-30',scope,location:'Synthetic page 1',anchor:`value ${value}`});
const submission={symbol:spec.symbol,issuer:spec.name,sourceUrl:spec.sourceUrl,publishedAt:'2026-08-01T12:00:00Z',retrievedAt:'2026-08-01T13:00:00Z',currency:'CAD',period:{start:'2026-04-01',end:'2026-06-30',basis:'quarter'},review:{approved:true,reviewer:'Synthetic reviewer',reviewedAt:'2026-08-02T12:00:00Z',permission:{scope:'republication-authorized',reference:'Synthetic written permission fixture'}},metrics:{revenue:metric(100000000),operatingIncome:metric(20000000),operatingCash:metric(30000000,'2026-01-01'),cash:metric(50000000,null)}};
const sourceText='value 100000000; value 20000000; value 30000000; value 50000000';
const manual=reviewedManualSnapshot({spec,submission,sourceText,asOf:'2026-10-08T12:00:00Z'});
assert.equal(manual.reportingCurrency,'CAD');assert(narrative(manual).summary.includes('CAD'));assert(narrative(manual,'fa').summary.includes('دلار کانادا'));
for(const change of [x=>x.review.approved=false,x=>x.review.permission.scope='personal-copy-only',x=>x.metrics.revenue.value=999,x=>x.sourceUrl='https://example.com/report',x=>x.metrics.cash.periodStart='2026-04-01']){
 const bad=structuredClone(submission);change(bad);assert.throws(()=>reviewedManualSnapshot({spec,submission:bad,sourceText,asOf:'2026-10-08T12:00:00Z'}));
}
console.log('Runtime period advancement, evidence-driven narratives, missing/mismatched inputs and reviewed manual currency/permission guards passed');
