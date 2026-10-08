// A reviewed manual source route, not an automatic PDF/accounting parser.
import crypto from 'node:crypto';
const iso=value=>typeof value==='string'&&/T.*Z$/.test(value)&&Number.isFinite(Date.parse(value));
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value).toISOString().slice(0,10)===value;
export function reviewedManualSnapshot({spec,submission,sourceText,asOf}){
 const r=submission.review,p=submission.period;
 if(spec.source!=='manual'||submission.symbol!==spec.symbol||submission.issuer!==spec.name)throw new Error('Manual issuer identity mismatch');
 if(!iso(asOf)||!iso(r?.reviewedAt)||!r.reviewer?.trim()||r.approved!==true||r.permission?.scope!=='republication-authorized'||!r.permission.reference?.trim())throw new Error('Explicit reviewer and source republication permission are required');
 if(Date.parse(r.reviewedAt)>Date.parse(asOf)||!iso(submission.publishedAt)||!iso(submission.retrievedAt)||Date.parse(submission.publishedAt)>Date.parse(submission.retrievedAt)||Date.parse(submission.retrievedAt)>Date.parse(r.reviewedAt))throw new Error('Invalid publication/review chronology');
 const url=new URL(submission.sourceUrl);
 if(url.protocol!=='https:'||url.username||url.password||!spec.sourceHosts.includes(url.hostname))throw new Error('Unapproved issuer source URL');
 if(!date(p?.start)||!date(p?.end)||p.start>p.end||p.end>submission.publishedAt.slice(0,10)||!['quarter','fiscal-year'].includes(p.basis)||!['CAD','USD'].includes(submission.currency))throw new Error('Explicit valid periods and reporting currency are required');
 const metrics={};
 const allowed=new Set(['revenue','operatingIncome','operatingCash','cash','priorRevenue','priorOperatingIncome','propertyEquipmentPayments','currentLongTermDebt','noncurrentLongTermDebt','continuingOperatingCash','netIncome','continuingNetIncome']);
 for(const [name,entry] of Object.entries(submission.metrics??{})){
  if(!allowed.has(name))throw new Error('Unsupported manual metric');
  if(typeof entry.value!=='number'||!Number.isFinite(entry.value)||!date(entry.periodEnd)||entry.periodEnd>p.end||!entry.location?.trim()||!entry.anchor?.trim()||!sourceText.includes(entry.anchor)||typeof entry.sourceNumber!=='string'||!entry.sourceNumber.trim()||!entry.anchor.includes(entry.sourceNumber)||Number(String(entry.sourceNumber).replaceAll(',',''))*entry.scale!==entry.value)throw new Error(`Manual evidence incomplete: ${name}`);
  if(![1,1000,1000000,1000000000].includes(entry.scale)||!['consolidated','continuing'].includes(entry.scope))throw new Error(`Explicit units and scope required: ${name}`);
  if(entry.periodStart!==null&&(!date(entry.periodStart)||entry.periodStart>entry.periodEnd))throw new Error(`Invalid metric period: ${name}`);
  metrics[name]={status:'verified',value:entry.value,unit:submission.currency,periodStart:entry.periodStart,periodEnd:entry.periodEnd,basis:entry.periodStart===null?'instant':name==='operatingCash'?'filing-to-date':p.basis,manualEvidence:{location:entry.location,sourceSha256:crypto.createHash('sha256').update(sourceText).digest('hex'),scope:entry.scope}};
 }
 for(const key of ['revenue','operatingIncome','operatingCash','cash'])if(!metrics[key])throw new Error(`Missing reviewed core metric: ${key}`);
 for(const key of ['revenue','operatingIncome'])if(metrics[key].periodStart!==p.start||metrics[key].periodEnd!==p.end)throw new Error('Income statement periods must match exactly');
 if(metrics.cash.periodStart!==null||metrics.cash.periodEnd!==p.end)throw new Error('Cash must be an exact period-end instant');
 if(metrics.operatingCash.periodEnd!==p.end||!metrics.operatingCash.periodStart)throw new Error('Cash flow dates must match');
 const earlier=date=>{const d=new Date(date+'T00:00:00Z');d.setUTCFullYear(d.getUTCFullYear()-1);return d.toISOString().slice(0,10);};
 for(const key of ['priorRevenue','priorOperatingIncome'])if(metrics[key]&&(metrics[key].periodStart!==earlier(p.start)||metrics[key].periodEnd!==earlier(p.end)))throw new Error('Prior-year comparison periods do not match');
 return {version:'fundamental-pilot-v1',symbol:spec.symbol,issuer:spec.name,businessLens:spec.lens,instrument:'Common equity',reportingCurrency:submission.currency,asOf,retrievedAt:submission.retrievedAt,reviewedAt:r.reviewedAt,reconciledAt:r.reviewedAt,financialPeriod:p,status:'complete',metrics,gaps:[],filing:{form:'Reviewed issuer report',accession:crypto.createHash('sha256').update(submission.sourceUrl+'|'+p.end).digest('hex'),reportDate:p.end,acceptedAt:submission.publishedAt,filed:submission.publishedAt.slice(0,10),url:url.href},manualReview:{reviewer:r.reviewer,permission:r.permission}};
}
