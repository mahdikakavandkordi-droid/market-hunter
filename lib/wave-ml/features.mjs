import {createHash} from 'node:crypto';
const DAY=86400000;
export const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const iso=t=>new Date(t).toISOString(),mean=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;
export function partition(symbol,time,contract) {
  const s=contract.split,t=Date.parse(time);
  if(s.holdoutSymbols.includes(symbol))return t>=Date.parse(s.finalTestStart)&&t<Date.parse(s.finalTestEndExclusive)?'sealed_final':'reserved_symbol';
  if(t<Date.parse(s.trainDecisionStart)||t>=Date.parse(s.finalTestEndExclusive))return 'outside';
  if(t>=Date.parse(s.finalTestStart))return 'development_final_time';
  if(t>=Date.parse(s.validationStart))return 'validation';
  return 'train';
}
function week(t){const d=new Date(t),day=d.getUTCDay();return Math.floor((t-((day+6)%7)*DAY)/DAY)}
function pivot(bars,i,r,start){const k=i-r;if(k-r<start)return null;const b=bars[k];let hi=true,lo=true;
  for(let j=k-r;j<=i;j++)if(j!==k){hi&&=b.h>bars[j].h;lo&&=b.l<bars[j].l}
  if(hi===lo)return null;return {index:k,t:b.t,confirmedAt:bars[i].endT,type:hi?'high':'low',price:hi?b.h:b.l,radius:r};
}
function append(points,p){if(!p)return;const last=points.at(-1);if(!last||last.type!==p.type)points.push(p);else if(p.type==='high'?p.price>last.price:p.price<last.price)points[points.length-1]=p}

export function buildFeatures(snapshot,contract,{asOf=Date.parse(snapshot.asOf)}={}) {
  if(!Number.isFinite(asOf))throw Error('finite_asOf_required');
  const bars=snapshot.daily.filter(b=>b.endT<=asOf),gaps=new Set(snapshot.dailyGapBeforeTimes),rows=[];
  let start=0,small=[],large=[],weekly=[],weekKey=null,weekClose=null,gain=0,loss=0;
  for(let i=0;i<bars.length;i++) {
    const b=bars[i];
    if(![b.t,b.endT,b.o,b.h,b.l,b.c].every(Number.isFinite)||b.endT<=b.t||Math.min(b.o,b.h,b.l,b.c)<=0||b.h<Math.max(b.o,b.l,b.c)||b.l>Math.min(b.o,b.h,b.c)||(i&&(b.t<=bars[i-1].t||b.t<bars[i-1].endT)))throw Error('invalid_daily_path');
    if(i&&gaps.has(b.t)){start=i;small=[];large=[];weekly=[];weekKey=null;weekClose=null;gain=0;loss=0}
    const n=i-start,k=week(Date.parse(b.date+'T12:00:00Z'));
    // A previous week becomes usable only when an actually observed new week
    // starts. This conservative lag needs no inferred Friday/holiday ordering.
    if(weekKey!==null&&k!==weekKey&&weekClose)weekly.push(weekClose);
    weekKey=k;weekClose={c:b.c,endT:b.endT};
    if(n>0){const delta=b.c-bars[i-1].c;
      if(n<=14){gain+=Math.max(delta,0)/14;loss+=Math.max(-delta,0)/14}
      else {gain=(gain*13+Math.max(delta,0))/14;loss=(loss*13+Math.max(-delta,0))/14}}
    append(small,pivot(bars,i,contract.sample.smallPivotRadius,start));append(large,pivot(bars,i,contract.sample.outerPivotRadius,start));
    if(n+1<contract.sample.dailyWarmupBars)continue;
    const atr=mean(bars.slice(i-13,i+1).map((x,j)=>Math.max(x.h-x.l,Math.abs(x.h-bars[i-14+j].c),Math.abs(x.l-bars[i-14+j].c))));
    if(!(atr>0))continue;
    const closes=bars.slice(start,i+1).map(x=>x.c),base={atr_pct:atr/b.c,rsi14:loss===0?(gain===0?50:100):100-100/(1+gain/loss)};
    const history=bars.slice(i-20,i),validVolume=Number.isFinite(b.v)&&b.v>=0&&history.every(x=>Number.isFinite(x.v)&&x.v>=0),avgVolume=validVolume?mean(history.map(x=>x.v)):0;
    base.rvol20=avgVolume>0?b.v/avgVolume:null;
    for(const period of [20,50,200]){const ma=mean(closes.slice(-period)),old=mean(closes.slice(-period-5,-5));base['ma'+period+'_distance']=(b.c-ma)/atr;base['ma'+period+'_slope']=(ma-old)/(5*atr)}
    for(const period of [5,20,60])base['return'+period]=Math.log(b.c/bars[i-period].c);
    const returns=bars.slice(i-19,i+1).map((x,j)=>Math.log(x.c/bars[i-20+j].c)),avg=mean(returns);base.volatility20=Math.sqrt(mean(returns.map(x=>(x-avg)**2)));
    base.weekly_distance=weekly.length>=20?(weekly.at(-1).c-mean(weekly.slice(-20).map(x=>x.c)))/atr:null;
    if(base.weekly_distance===null)continue;
    const points=small.slice(-7),legs=points.slice(1).map((p,j)=>({size:(p.price-points[j].price)/atr,duration:p.index-points[j].index}));
    for(let j=0;j<6;j++){const leg=legs.at(-6+j);base['leg'+j+'_size']=legs.length===6?leg.size:null;base['leg'+j+'_duration']=legs.length===6?leg.duration:null;base['leg'+j+'_speed']=legs.length===6?leg.size/leg.duration:null}
    for(let j=0;j<5;j++){base['size_ratio'+j]=legs.length===6&&legs[j].size!==0?Math.abs(legs[j+1].size/legs[j].size):null;base['duration_ratio'+j]=legs.length===6?legs[j+1].duration/legs[j].duration:null}
    base.bars_since_pivot=small.length?i-small.at(-1).index:null;
    base.bars_since_confirmation=small.length?i-bars.findIndex(x=>x.endT===small.at(-1).confirmedAt):null;
    const highs=small.filter(p=>p.type==='high').slice(-2),lows=small.filter(p=>p.type==='low').slice(-2);
    base.distance_high=highs.length?(b.c-highs.at(-1).price)/atr:null;base.distance_low=lows.length?(b.c-lows.at(-1).price)/atr:null;
    base.higher_high=highs.length===2?Number(highs[1].price>highs[0].price):null;base.lower_high=highs.length===2?Number(highs[1].price<highs[0].price):null;
    base.higher_low=lows.length===2?Number(lows[1].price>lows[0].price):null;base.lower_low=lows.length===2?Number(lows[1].price<lows[0].price):null;
    const availability=b.endT+contract.sample.historicalAvailabilityDelayMinutes*60000;
    if(availability>asOf)continue;
    for(const dir of [1,-1]) {
      const features={...base};for(const key of Object.keys(features))if(/^(leg\d+_(size|speed)|return\d+|distance_(high|low))$/.test(key)&&features[key]!==null)features[key]*=dir;
      for(const key of Object.keys(features)){if(features[key]!==null&&!Number.isFinite(features[key]))throw Error('nonfinite_feature');features[key+'_missing']=Number(features[key]===null)}
      rows.push({id:[snapshot.symbol,b.endT,dir].join('|'),symbol:snapshot.symbol,market:snapshot.market,dir,
        decisionCompletedAt:iso(b.endT),availableAt:iso(availability),partition:partition(snapshot.symbol,iso(availability),contract),
        decisionATR14:atr,features,audit:{dailyInputEnd:iso(b.endT),weeklyInputEnd:iso(weekly.at(-1).endT),
          lastSmallConfirmation:small.length?iso(small.at(-1).confirmedAt):null,lastOuterConfirmation:large.length?iso(large.at(-1).confirmedAt):null,
          segmentStart:iso(bars[start].t)}});
    }
  }
  return rows.filter(r=>!['outside','reserved_symbol'].includes(r.partition));
}
