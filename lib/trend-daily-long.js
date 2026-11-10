export const VERSION='trend-daily-long-v1';
export const SYMBOLS=['AAPL','MSFT','AMZN','GOOGL','META','NVDA','JPM','XOM','JNJ','COST','CAT','NEE'];
export const RULES={capital:10000,riskPct:.01,maxAllocation:.25,maxRisk:.04,maxPositions:4,slippage:.0005,commission:0,sma:200,breakout:20,atr:14,initialAtr:2,trailAtr:3,maxBars:60};
export const MODELS=['baseline','relative_strength'];
const day=t=>new Date(t).toISOString().slice(0,10);
function atr(rows,i){if(i<14)return null;let sum=0;for(let k=i-13;k<=i;k++)sum+=Math.max(rows[k].h-rows[k].l,Math.abs(rows[k].h-rows[k-1].c),Math.abs(rows[k].l-rows[k-1].c));return sum/14}
export function signal(rows,benchmark){
 const i=rows.length-1,b=rows[i],prior=rows.slice(0,i);
 if(prior.length<200||i<20)return null;
 const mean=prior.slice(-200).reduce((s,r)=>s+r.c,0)/200;
 const high=Math.max(...prior.slice(-20).map(r=>r.h)),a=atr(rows,i);
 if(!(prior.at(-1).c>mean&&b.c>high&&a>0))return null;
 const last=prior.at(-1),old=prior.at(-21);
 const reference=new Map(benchmark.map(r=>[r.date,r.c]));
 const rs=old&&reference.get(last.date)>0&&reference.get(old.date)>0?last.c/old.c-reference.get(last.date)/reference.get(old.date):null;
 return {date:b.date,close:b.c,atr:a,breakoutHigh:high,dailySma:mean,relativeStrength:rs};
}
export function initialState(activatedAt,configHash){
 return {version:VERSION,activatedAt,configHash,lastSession:null,sessions:[],models:Object.fromEntries(MODELS.map(id=>[id,{cash:10000,trades:[],pending:[],skipped:[],curve:[]}])),benchmarks:null};
}
export function advanceDaily(prior,series,observedAt){
 const s=structuredClone(prior),reference=series.SPY;
 if(!reference?.length)throw Error('Missing benchmark');
 const latest=reference.at(-1),rowsBySymbol=new Map();
 for(const symbol of SYMBOLS){
  const rows=series[symbol];
  if(!rows?.length||rows.at(-1).date!==latest.date)throw Error('Session mismatch '+symbol);
  rowsBySymbol.set(symbol,new Map(rows.map(r=>[r.date,r])));
 }
 const dates=reference.filter(r=>r.endT>=Date.parse(s.activatedAt)&&(!s.lastSession||r.date>s.lastSession));
 for(const ref of dates){
  const bars=new Map(SYMBOLS.map(symbol=>{
   const b=rowsBySymbol.get(symbol).get(ref.date);if(!b)throw Error('Missing source session '+symbol+' '+ref.date);
   return [symbol,b];
  }));
  for(const id of MODELS){
   const model=s.models[id],positions=model.trades.filter(t=>t.status==='open');
   for(const symbol of [...positions,...model.pending].map(p=>p.symbol)){
    if(bars.get(symbol).split)throw Error('Split requires review '+symbol);
   }
   for(const p of positions){const b=bars.get(p.symbol);if(b.split)throw Error('Split requires review '+p.symbol);model.cash+=p.quantity*(b.dividend||0)}
   const openingEquity=model.cash+positions.reduce((v,p)=>v+p.quantity*bars.get(p.symbol).o,0);
   for(const pending of [...model.pending].sort((a,b)=>a.symbol.localeCompare(b.symbol))){
    const b=bars.get(pending.symbol);
    if(b.t<Date.parse(pending.observedAt))continue;
    model.pending=model.pending.filter(p=>p.id!==pending.id);
    const open=model.trades.filter(t=>t.status==='open');
    const risk=2*pending.snapshot.atr,entry=b.o*(1+RULES.slippage);
    const capacity=.04*openingEquity-open.reduce((v,p)=>v+p.quantity*p.risk,0);
    const units=Math.floor(Math.min(.01*openingEquity/risk,Math.max(0,capacity)/risk,.25*openingEquity/entry,model.cash/entry));
    if(open.length>=4||open.some(p=>p.symbol===pending.symbol)||units<1){model.skipped.push({...pending,processedAt:observedAt,reason:'capital_or_position_limit'});continue}
    model.cash-=units*entry;
    model.trades.push({...pending,dir:1,status:'open',entryT:new Date(b.t).toISOString(),entry,quantity:units,notional:units*entry,risk,stop:entry-risk,currentStop:entry-risk,bestClose:entry,barsHeld:0});
   }
   for(const p of model.trades.filter(t=>t.status==='open')){
    const b=bars.get(p.symbol);p.barsHeld++;
    const gap=b.o<=p.currentStop,hit=b.l<=p.currentStop;
    if(gap||hit||p.barsHeld>=60){
     const price=(gap?b.o:hit?p.currentStop:b.c)*(1-RULES.slippage);
     model.cash+=p.quantity*price;
     Object.assign(p,{status:'closed',exitT:new Date(b.endT).toISOString(),exitPrice:price,pnl:p.quantity*(price-p.entry),exitReason:gap?'gap_open':hit?'stop':'max_hold'});
    }else{
     p.bestClose=Math.max(p.bestClose,b.c);
     const rows=series[p.symbol].filter(r=>r.date<=ref.date),a=atr(rows,rows.length-1);
     if(a>0)p.currentStop=Math.max(p.currentStop,p.bestClose-3*a);
     p.mark=b.c;p.markDate=ref.date;
    }
   }
   // Record new decisions only for a source close observed in this run.
   // Missed earlier sessions can settle existing trades, but generate no new signals.
   if(ref.date===latest.date){
    for(const symbol of SYMBOLS){
     if(model.trades.some(p=>p.symbol===symbol&&p.status==='open')||model.pending.some(p=>p.symbol===symbol))continue;
     const snapshot=signal(series[symbol].filter(r=>r.date<=ref.date),reference.filter(r=>r.date<=ref.date));
     if(!snapshot||(id==='relative_strength'&&!(snapshot.relativeStrength>0)))continue;
     model.pending.push({id:id+'|'+symbol+'|'+ref.date,symbol,observedAt,snapshot,status:'pending_entry'});
    }
   }
   const equity=model.cash+model.trades.filter(p=>p.status==='open').reduce((v,p)=>v+p.quantity*bars.get(p.symbol).c,0);
   if(model.cash<-.000001||!Number.isFinite(equity)||model.trades.filter(p=>p.status==='open').length>4)throw Error('Invalid funded account');
   model.curve.push({date:ref.date,equity,cash:model.cash,observedAt});
  }
  if(!s.benchmarks)s.benchmarks={date:ref.date,lastClose:ref.c,buyHold:10000,halfCash:10000};
  else{
   const ret=(ref.c+(ref.dividend||0))/s.benchmarks.lastClose-1;
   s.benchmarks.buyHold*=1+ret;s.benchmarks.halfCash*=1+.5*ret;s.benchmarks.lastClose=ref.c;s.benchmarks.date=ref.date;
  }
  s.sessions.push({date:ref.date,observedAt,signalCapture:ref.date===latest.date});s.lastSession=ref.date;
 }
 s.updatedAt=observedAt;
 return s;
}
