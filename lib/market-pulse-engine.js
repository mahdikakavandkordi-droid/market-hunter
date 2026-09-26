export const MARKET_PULSE_VERSION='market-pulse-v0.1-2026-09-26';

export const MARKET_PULSE_UNIVERSE=Object.freeze([
  Object.freeze({key:'TSX',symbol:'^GSPTSE',name:'TSX Composite',group:'Equity Index'}),
  Object.freeze({key:'SP500',symbol:'^GSPC',name:'S&P 500',group:'Equity Index'}),
  Object.freeze({key:'NASDAQ100',symbol:'^NDX',name:'Nasdaq-100',group:'Equity Index'}),
  Object.freeze({key:'GOLD',symbol:'GC=F',name:'Gold',group:'Commodity'}),
  Object.freeze({key:'SILVER',symbol:'SI=F',name:'Silver',group:'Commodity'}),
  Object.freeze({key:'BTC',symbol:'BTC-USD',name:'Bitcoin',group:'Crypto'}),
  Object.freeze({key:'ETH',symbol:'ETH-USD',name:'Ethereum',group:'Crypto'})
]);

const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
export const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
export const pct=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a/b-1)*100:null;
const sma=(a,n,offset=0)=>{const end=a.length-offset;return end>=n?avg(a.slice(end-n,end)):null};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const dayKey=t=>new Date(t*1000).toISOString().slice(0,10);

function rsi(values,period=14){
  if(values.length<period+1)return null;
  let gain=0,loss=0;
  for(let i=1;i<=period;i++){const d=values[i]-values[i-1];if(d>0)gain+=d;else loss-=d}
  let ag=gain/period,al=loss/period;
  for(let i=period+1;i<values.length;i++){
    const d=values[i]-values[i-1],g=d>0?d:0,l=d<0?-d:0;
    ag=(ag*(period-1)+g)/period;al=(al*(period-1)+l)/period;
  }
  if(al===0)return ag===0?50:100;
  const rs=ag/al;return 100-100/(1+rs);
}
function atrPct(rows,period=14){
  if(rows.length<period+1)return null;
  const tr=[];
  for(let i=1;i<rows.length;i++){
    const x=rows[i],p=rows[i-1].close;
    if([x.high,x.low,p].every(Number.isFinite))tr.push(Math.max(x.high-x.low,Math.abs(x.high-p),Math.abs(x.low-p)));
  }
  const a=avg(tr.slice(-period)),last=rows.at(-1)?.close;
  return Number.isFinite(a)&&Number.isFinite(last)&&last>0?a/last*100:null;
}
function weekKey(t){
  const d=new Date(t*1000),shift=(d.getUTCDay()+6)%7;
  d.setUTCDate(d.getUTCDate()-shift);
  return d.toISOString().slice(0,10);
}
function weeklyCloses(rows){
  const m=new Map();
  for(const x of rows)m.set(weekKey(x.t),x.close);
  return [...m.values()];
}
function structure(rows){
  const highs=[],lows=[];
  for(let i=Math.max(2,rows.length-100);i<=rows.length-3;i++){
    const x=rows[i];
    if(Number.isFinite(x.high)&&x.high>rows[i-1].high&&x.high>=rows[i-2].high&&x.high>rows[i+1].high&&x.high>=rows[i+2].high)highs.push(i);
    if(Number.isFinite(x.low)&&x.low<rows[i-1].low&&x.low<=rows[i-2].low&&x.low<rows[i+1].low&&x.low<=rows[i+2].low)lows.push(i);
  }
  const hi=highs.at(-1),lo=lows.at(-1),last=rows.length-1;
  const localHigh=Number.isInteger(hi)?rows[hi].high:null,localLow=Number.isInteger(lo)?rows[lo].low:null;
  const higherHigh=highs.length>=2?rows[highs.at(-1)].high>rows[highs.at(-2)].high:null;
  const higherLow=lows.length>=2?rows[lows.at(-1)].low>rows[lows.at(-2)].low:null;
  const swingTrend=higherHigh===true&&higherLow===true?'Higher highs + higher lows':
    higherHigh===false&&higherLow===false?'Lower highs + lower lows':
    higherHigh===true||higherLow===true?'Structure improving':
    higherHigh===false||higherLow===false?'Structure weakening':'Insufficient pivots';
  const highBroken=Number.isFinite(localHigh)?rows[last].close>localHigh:false;
  const lowBroken=Number.isFinite(localLow)?rows[last].close<localLow:false;
  return {localHigh,localLow,higherHigh,higherLow,swingTrend,highBroken,lowBroken};
}
function supportResistance(rows){
  const last=rows.at(-1)?.close,pivH=[],pivL=[];
  for(let i=Math.max(2,rows.length-120);i<=rows.length-3;i++){
    if(rows[i].high>rows[i-1].high&&rows[i].high>=rows[i-2].high&&rows[i].high>rows[i+1].high&&rows[i].high>=rows[i+2].high)pivH.push(rows[i].high);
    if(rows[i].low<rows[i-1].low&&rows[i].low<=rows[i-2].low&&rows[i].low<rows[i+1].low&&rows[i].low<=rows[i+2].low)pivL.push(rows[i].low);
  }
  const resistance=pivH.filter(v=>v>last*1.001).sort((a,b)=>a-b)[0]??null;
  const support=pivL.filter(v=>v<last*.999).sort((a,b)=>b-a)[0]??null;
  return {support,resistance,supportDistance:pct(last,support),roomToResistance:pct(resistance,last)};
}

export function pulseMetrics(rows){
  if(!Array.isArray(rows)||rows.length<220)return null;
  const c=rows.map(x=>x.close),last=c.at(-1);
  const ma20=sma(c,20),ma50=sma(c,50),ma200=sma(c,200);
  const ma20p=sma(c,20,5),ma50p=sma(c,50,10),ma200p=sma(c,200,20);
  const ret1=pct(last,c.at(-2)),ret5=pct(last,c.at(-6)),ret20=pct(last,c.at(-21)),ret60=pct(last,c.at(-61)),ret120=pct(last,c.at(-121));
  const high20=Math.max(...c.slice(-20)),high60=Math.max(...c.slice(-60)),high252=Math.max(...c.slice(-Math.min(252,c.length)));
  const low20=Math.min(...c.slice(-20)),low60=Math.min(...c.slice(-60));
  const prev5Ret=pct(c.at(-6),c.at(-11)),momentumShift=Number.isFinite(ret5)&&Number.isFinite(prev5Ret)?ret5-prev5Ret:null;
  const w=weeklyCloses(rows),w10=sma(w,10),w10p=sma(w,10,4);
  const weeklyTrend=Number.isFinite(w10)&&Number.isFinite(w10p)?(last>w10&&w10>w10p?'Up':last<w10&&w10<w10p?'Down':'Mixed'):'Unknown';
  const dailyTrend=last>ma20&&ma20>ma50&&ma50>ma200?'Strong Up':
    last>ma20&&ma20>ma50?'Up':
    last<ma20&&ma20<ma50&&ma50<ma200?'Strong Down':
    last<ma20&&ma20<ma50?'Down':'Mixed';
  const s=structure(rows),levels=supportResistance(rows);
  return {
    last,ret1,ret5,ret20,ret60,ret120,
    ma20,ma50,ma200,dist20:pct(last,ma20),dist50:pct(last,ma50),dist200:pct(last,ma200),
    ma20Slope5:pct(ma20,ma20p),ma50Slope10:pct(ma50,ma50p),ma200Slope20:pct(ma200,ma200p),
    rsi14:rsi(c),atr14Pct:atrPct(rows,14),momentumShift,
    pullback20:pct(last,high20),pullback60:pct(last,high60),pullback252:pct(last,high252),
    rebound20:pct(last,low20),rebound60:pct(last,low60),
    dailyTrend,weeklyTrend,...s,...levels
  };
}

export function trendRegime(m){
  if(!m)return 'Unavailable';
  if(m.dailyTrend==='Strong Up'&&m.weeklyTrend==='Up')return 'Strong Bull';
  if(m.dailyTrend==='Strong Down'&&m.weeklyTrend==='Down')return 'Strong Bear';
  if(Number.isFinite(m.dist200)&&m.dist200>0&&(m.dailyTrend==='Up'||m.weeklyTrend==='Up'))return 'Bull';
  if(Number.isFinite(m.dist200)&&m.dist200<0&&(m.dailyTrend==='Down'||m.weeklyTrend==='Down'))return 'Bear';
  return 'Mixed';
}

export function shortTermCondition(m){
  if(!m)return 'Unavailable';
  const regime=trendRegime(m);
  if((Number.isFinite(m.dist20)&&m.dist20>=6)||(Number.isFinite(m.rsi14)&&m.rsi14>=75))return 'Extended';
  if(m.highBroken===true||(Number.isFinite(m.pullback20)&&m.pullback20>=-0.5&&Number.isFinite(m.ret5)&&m.ret5>0))return 'Breakout / Near High';
  if((regime==='Strong Bull'||regime==='Bull')&&Number.isFinite(m.ret5)&&m.ret5<0&&!m.lowBroken)return 'Pullback';
  if((regime==='Bear'||regime==='Strong Bear'||regime==='Mixed')&&Number.isFinite(m.momentumShift)&&m.momentumShift>0&&(m.ret5>0||m.swingTrend==='Structure improving'||m.highBroken===true))return 'Recovery Attempt';
  if(Number.isFinite(m.ret5)&&m.ret5<=0&&(Number.isFinite(m.momentumShift)&&m.momentumShift<0||m.swingTrend==='Structure weakening'||m.swingTrend==='Lower highs + lower lows'))return 'Weakening';
  if(Number.isFinite(m.ret5)&&m.ret5>0&&Number.isFinite(m.ret20)&&m.ret20>0)return 'Positive Momentum';
  return 'Range / Mixed';
}

export function descriptiveState(m){
  if(!m)return {state:'Unavailable',tone:'Neutral',reasons:[],regime:'Unavailable',condition:'Unavailable'};
  const regime=trendRegime(m),condition=shortTermCondition(m);
  const reasons=[];
  const alignedUp=m.dailyTrend==='Strong Up'&&m.weeklyTrend==='Up';
  const alignedDown=m.dailyTrend==='Strong Down'&&m.weeklyTrend==='Down';
  const extended=(Number.isFinite(m.dist20)&&m.dist20>=6)||(Number.isFinite(m.rsi14)&&m.rsi14>=75);
  const improving=(Number.isFinite(m.momentumShift)&&m.momentumShift>0)||(m.swingTrend==='Structure improving')||m.highBroken===true;
  const weakening=(Number.isFinite(m.momentumShift)&&m.momentumShift<0)||(m.swingTrend==='Structure weakening')||m.lowBroken===true;
  let state='Mixed / Range',tone='Neutral';
  if(alignedUp&&extended){state='Bullish · Extended';tone='Bullish'}
  else if(alignedUp){state='Bullish Trend';tone='Bullish'}
  else if(alignedDown){state='Bearish Trend';tone='Bearish'}
  else if(m.ret20<0&&improving){state='Recovery Attempt';tone='Improving'}
  else if(m.ret20>0&&weakening){state='Trend Weakening';tone='Caution'}
  else if(m.dailyTrend==='Up'||m.weeklyTrend==='Up'){state='Constructive';tone='Bullish'}
  else if(m.dailyTrend==='Down'||m.weeklyTrend==='Down'){state='Weak';tone='Bearish'}
  if(m.dailyTrend==='Strong Up')reasons.push('Daily trend aligned above MA20/50/200');
  if(m.weeklyTrend==='Up')reasons.push('Weekly trend up');
  if(Number.isFinite(m.ret20))reasons.push('20D '+(m.ret20>=0?'+':'')+round(m.ret20,1)+'%');
  if(Number.isFinite(m.rsi14)&&m.rsi14>=75)reasons.push('RSI elevated');
  if(Number.isFinite(m.dist20)&&m.dist20>=6)reasons.push('Extended above MA20');
  if(m.highBroken)reasons.push('Recent swing high broken');
  if(m.lowBroken)reasons.push('Recent swing low broken');
  if(m.swingTrend==='Structure improving')reasons.push('Swing structure improving');
  if(m.swingTrend==='Structure weakening')reasons.push('Swing structure weakening');
  return {state,tone,regime,condition,reasons:reasons.slice(0,5)};
}

export function scenarioLevels(m){
  if(!m)return null;
  const bullishTrigger=Number.isFinite(m.resistance)?m.resistance:(Number.isFinite(m.localHigh)?m.localHigh:null);
  const warningLevel=Number.isFinite(m.ma20)?m.ma20:null;
  const bearishTrigger=Number.isFinite(m.support)?m.support:(Number.isFinite(m.localLow)?m.localLow:null);
  return {
    bullishTrigger:round(bullishTrigger),
    warningLevel:round(warningLevel),
    bearishTrigger:round(bearishTrigger)
  };
}
