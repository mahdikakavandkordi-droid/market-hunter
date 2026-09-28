import assert from 'node:assert/strict';
import {
  HTP_FORWARD_COLLECTOR_VERSION,normalizeYahooChart,sha256Json,appendJsonlStrict,coverageStatus,matureForwardPick
} from '../lib/healthy-trend-pullback-forward.js';

const ts=d=>Math.floor(new Date(d+'T20:00:00Z').getTime()/1000);

assert.equal(HTP_FORWARD_COLLECTOR_VERSION,'healthy-trend-pullback-forward-v1-2026-09-28');

// Yahoo normalization must put adjusted close/high/low on one scale while preserving raw close.
const payload={chart:{result:[{
  meta:{currency:'CAD',exchangeName:'TOR',currentTradingPeriod:{regular:{end:ts('2026-09-30')}}},
  timestamp:[ts('2026-09-28'),ts('2026-09-29')],
  indicators:{
    quote:[{close:[100,102],high:[104,106],low:[98,100],volume:[1000000,1100000]}],
    adjclose:[{adjclose:[50,51]}]
  },
  events:{splits:{a:{date:ts('2026-09-29'),numerator:2,denominator:1}}}
}]}};
const normalized=normalizeYahooChart(payload,'AAA.TO',new Date('2026-09-29T23:00:00Z').getTime());
assert.equal(normalized.rows.length,2);
assert.equal(normalized.rows[0].close,50);
assert.equal(normalized.rows[0].rawClose,100);
assert.equal(normalized.rows[0].high,52);
assert.equal(normalized.rows[0].low,49);
assert.deepEqual(normalized.splitDays,['2026-09-29']);
assert.equal(normalized.sourceHash.length,64);
assert.equal(sha256Json({b:2,a:1}),sha256Json({a:1,b:2}));

// Append-only storage: exact duplicate is idempotent, conflicting duplicate is rejected.
const first={id:'x',value:1};
let a=appendJsonlStrict('',[first],x=>x.id);
assert.equal(a.added.length,1);
a=appendJsonlStrict(a.text,[first],x=>x.id);
assert.equal(a.added.length,0);
assert.throws(()=>appendJsonlStrict(a.text,[{id:'x',value:2}],x=>x.id),/append_only_conflict/);

assert.equal(coverageStatus({intended:10,evaluated:10,pickCount:0}),'complete_zero_pick');
assert.equal(coverageStatus({intended:10,evaluated:10,pickCount:2}),'complete_nonzero');
assert.equal(coverageStatus({intended:10,evaluated:9,pickCount:2}),'partial_coverage');
assert.equal(coverageStatus({intended:10,evaluated:0,pickCount:0,collectorFailure:true}),'collector_failure');
assert.equal(coverageStatus({intended:10,evaluated:0,pickCount:0,marketCompleted:false}),'market_not_completed');

// Mature outcome: entry is next-session close; D+1 high/low are not used for barriers.
const rows=[];
let d=new Date('2026-01-01T20:00:00Z');
for(let i=0;i<40;i++){
  rows.push({t:Math.floor(d.getTime()/1000),close:100,rawClose:100,high:101,low:99,volume:1000000});
  d=new Date(d.getTime()+86400000);
}
const decisionDate='2026-01-06',di=rows.findIndex(x=>new Date(x.t*1000).toISOString().slice(0,10)===decisionDate);
rows[di+1]={...rows[di+1],close:102,rawClose:102,high:120,low:80}; // entry session extremes must be ignored
rows[di+2]={...rows[di+2],close:102,high:103,low:101};
rows[di+3]={...rows[di+3],close:106,high:107,low:101};
const bench=rows.map(x=>({...x,close:200,rawClose:200,high:201,low:199}));
const result=matureForwardPick({
  pack:{rows,splitDays:[]},decisionDate,decisionAtr14:2,benchmarkRows:bench,maturedAt:'2026-02-10'
});
assert.equal(result.status,'evaluated');
assert.equal(result.entryPrice,102);
assert.equal(result.primaryLabel,'success');
assert.equal(result.timeToFavourable,2);

// A split during the required path is explicitly excluded instead of mixing adjustment scales.
const splitDay=new Date(rows[di+5].t*1000).toISOString().slice(0,10);
const split=matureForwardPick({
  pack:{rows,splitDays:[splitDay]},decisionDate,decisionAtr14:2,benchmarkRows:bench,maturedAt:'2026-02-10'
});
assert.equal(split.status,'corporate_action_during_horizon');
assert.equal(split.primaryExcluded,true);

// Same-bar both-hit stays ambiguous and is never counted as success.
const ambiguousRows=rows.map(x=>({...x,high:103,low:101,close:102,rawClose:102}));
ambiguousRows[di+2]={...ambiguousRows[di+2],high:107,low:99};
const ambiguous=matureForwardPick({
  pack:{rows:ambiguousRows,splitDays:[]},decisionDate,decisionAtr14:2,benchmarkRows:bench,maturedAt:'2026-02-10'
});
assert.equal(ambiguous.primaryLabel,'ambiguous_both_hit');

console.log('Healthy-trend pullback forward collector regression tests passed');
