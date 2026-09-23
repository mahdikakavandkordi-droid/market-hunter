import {UNIVERSE,UNIVERSE_SOURCE} from '../lib/universe.js';
const UNIQUE_UNIVERSE=[...new Map(UNIVERSE.map(x=>[x[0],x])).values()];

const INDEXES = [
  ['^GSPTSE','TSX','Canada'],
  ['^SPCDNX','TSX Venture','Canada'],
  ['^GSPC','S&P 500','USA'],
  ['^IXIC','Nasdaq','USA'],
  ['^DJI','Dow Jones','USA'],
  ['^RUT','Russell 2000','USA']
];

const CDR_BENCHMARK = {
  'AAPL.TO':'^IXIC','MSFT.TO':'^IXIC','NVDA.TO':'^IXIC','AMZN.TO':'^IXIC',
  'GOOG.TO':'^IXIC','META.TO':'^IXIC','TSLA.TO':'^IXIC','AMD.TO':'^IXIC',
  'COST.TO':'^GSPC'
};

const SECTOR_PROXY = {
  Financials:'XFN.TO', Energy:'XEG.TO', Materials:'XMA.TO', Industrials:'XGI.TO',
  Technology:'XIT.TO', Communication:null, Utilities:'XUT.TO', Consumer:null, 'Real Estate':'XRE.TO', 'Health Care':null, CDR:null
};

function avg(a){const v=a.filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null}
function dayKey(t){return new Date(t*1000).toISOString().slice(0,10)}
function alignedReturn(rows,benchmarkRows,lookback){
  if(!Array.isArray(rows)||!Array.isArray(benchmarkRows)) return null;
  const stock=new Map(rows.map(x=>[dayKey(x.t),x.close]));
  const bench=new Map(benchmarkRows.map(x=>[dayKey(x.t),x.close]));
  const dates=[...bench.keys()].sort();
  if(dates.length<lookback+1) return null;
  const window=dates.slice(-(lookback+1));
  if(window.some(d=>!stock.has(d))) return null;
  const end=window.at(-1),start=window[0];
  return {stock:pct(stock.get(end),stock.get(start)),benchmark:pct(bench.get(end),bench.get(start)),start,end};
}
function ageDays(t){return Number.isFinite(t)?(Date.now()-t*1000)/86400000:null}
function sma(a,n){return a.length>=n?avg(a.slice(-n)):null}
function pct(a,b){return Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a/b-1)*100:null}
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function round(x,d=2){return Number.isFinite(x)?Number(x.toFixed(d)):null}
function rsi(values,period=14){
  if(!Array.isArray(values)||values.length<period+1) return null;
  let gains=0,losses=0;
  for(let i=1;i<=period;i++){
    const diff=values[i]-values[i-1];
    if(diff>=0) gains+=diff; else losses-=diff;
  }
  let avgGain=gains/period,avgLoss=losses/period;
  for(let i=period+1;i<values.length;i++){
    const diff=values[i]-values[i-1];
    const gain=diff>0?diff:0,loss=diff<0?-diff:0;
    avgGain=((avgGain*(period-1))+gain)/period;
    avgLoss=((avgLoss*(period-1))+loss)/period;
  }
  if(avgLoss===0) return avgGain===0?50:100;
  const rs=avgGain/avgLoss;
  return 100-(100/(1+rs));
}
function breadthLabel(n){return !Number.isFinite(n)?'Unavailable':n>=60?'Strong':n<40?'Weak':'Neutral'}
function direction(delta){return !Number.isFinite(delta)?'Flat':delta>=3?'Improving':delta<=-3?'Weakening':'Stable'}

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function chart(symbol,range='6mo',interval='1d',deadline=Date.now()+24000,host='query1'){
  const url=`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
  let lastError=null;
  for(let attempt=0;attempt<2;attempt++){
    const controller=new AbortController();
    if(Date.now()>=deadline) throw new Error('scan_deadline');
    const timer=setTimeout(()=>controller.abort(),Math.max(1,Math.min(8000,deadline-Date.now())));
    try{
      const r=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0 MarketHunter/1.0'}});
      if(!r.ok){
        const err=new Error(`${symbol} ${r.status}`);
        err.status=r.status;
        throw err;
      }
      const j=await r.json();
      const res=j?.chart?.result?.[0];
      if(!res) throw new Error(`${symbol} unavailable`);
      const q=res.indicators?.quote?.[0]||{};
      const adj=res.indicators?.adjclose?.[0]?.adjclose||q.close||[];
      const sessionEnd=res.meta?.currentTradingPeriod?.regular?.end;
      const currentSession=sessionEnd?dayKey(sessionEnd):null;
      const rows=(res.timestamp||[]).map((t,i)=>({
        t,close:adj[i],rawClose:q.close?.[i],high:q.high?.[i],low:q.low?.[i],volume:q.volume?.[i]
      })).filter(x=>Number.isFinite(x.close)&&x.close>0&&Number.isFinite(x.rawClose)&&x.rawClose>0)
        .filter(x=>dayKey(x.t)!==currentSession||Date.now()>=sessionEnd*1000);
      return {symbol,rows,currency:res.meta?.currency||null};
    }catch(e){
      lastError=e;
      const retryable=e?.name==='AbortError'||e?.status===429||e?.status>=500;
      if(!retryable||attempt===1||Date.now()+300>=deadline) throw e;
      await sleep(250*(attempt+1));
    }finally{
      clearTimeout(timer);
    }
  }
  throw lastError||new Error(`${symbol} unavailable`);
}

async function mapLimit(values,limit,worker){
  const out=new Array(values.length);
  let next=0;
  async function run(){
    while(true){
      const i=next++;
      if(i>=values.length) return;
      try{out[i]={status:'fulfilled',value:await worker(values[i],i)}}
      catch(reason){out[i]={status:'rejected',reason}}
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,values.length)},()=>run()));
  return out;
}

function weeklyCloses(rows){
  const buckets=[]; let key=null,last=null;
  for(const r of rows){
    const d=new Date(r.t*1000);
    const day=(d.getUTCDay()+6)%7;
    const monday=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-day));
    const k=monday.toISOString().slice(0,10);
    if(k!==key&&last) buckets.push({key,close:last.close});
    key=k; last=r;
  }
  if(last) buckets.push({key,close:last.close});
  const now=new Date();
  const todayDay=(now.getUTCDay()+6)%7;
  const currentMonday=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-todayDay)).toISOString().slice(0,10);
  return buckets.filter(x=>x.key!==currentMonday).map(x=>x.close);
}

function downVolumeAverage(rows,start,end){
  const a=[];
  for(let i=Math.max(1,start);i<Math.min(rows.length,end);i++){
    if(rows[i].close<rows[i-1].close && Number.isFinite(rows[i].volume)) a.push(rows[i].volume);
  }
  return avg(a);
}

function atrPercent(rows,period=14){
  if(!Array.isArray(rows)||rows.length<period+1) return null;
  const tr=[];
  for(let i=1;i<rows.length;i++){
    const h=rows[i].high,l=rows[i].low,pc=rows[i-1].close;
    if(![h,l,pc].every(Number.isFinite)) continue;
    tr.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)));
  }
  const a=avg(tr.slice(-period)),last=rows.at(-1)?.close;
  return Number.isFinite(a)&&Number.isFinite(last)&&last>0?a/last*100:null;
}
function directionalVolume(rows,lookback=20){
  const slice=rows.slice(-lookback);
  let upVol=0,downVol=0,upDays=0,downDays=0;
  for(let i=Math.max(1,rows.length-lookback);i<rows.length;i++){
    const cur=rows[i],prev=rows[i-1];
    if(!Number.isFinite(cur.volume)||!Number.isFinite(cur.close)||!Number.isFinite(prev.close)) continue;
    if(cur.close>prev.close){upVol+=cur.volume;upDays++}
    else if(cur.close<prev.close){downVol+=cur.volume;downDays++}
  }
  const upAvg=upDays?upVol/upDays:null,downAvg=downDays?downVol/downDays:null;
  return {upDownVolumeRatio:Number.isFinite(upAvg)&&Number.isFinite(downAvg)&&downAvg>0?upAvg/downAvg:null};
}
function swingStructure(rows){
  if(!Array.isArray(rows)||rows.length<20) return {swingTrend:'Unknown',higherLow:null,higherHigh:null};
  const highs=[],lows=[];
  for(let i=2;i<=rows.length-3;i++){
    if(Number.isFinite(rows[i].high)&&rows[i].high>rows[i-1].high&&rows[i].high>=rows[i-2].high&&rows[i].high>rows[i+1].high&&rows[i].high>=rows[i+2].high) highs.push(rows[i].high);
    if(Number.isFinite(rows[i].low)&&rows[i].low<rows[i-1].low&&rows[i].low<=rows[i-2].low&&rows[i].low<rows[i+1].low&&rows[i].low<=rows[i+2].low) lows.push(rows[i].low);
  }
  const higherHigh=highs.length>=2?highs.at(-1)>highs.at(-2):null;
  const higherLow=lows.length>=2?lows.at(-1)>lows.at(-2):null;
  const swingTrend=higherHigh===true&&higherLow===true?'Higher highs + higher lows'
    :higherHigh===false&&higherLow===false?'Lower highs + lower lows'
    :higherHigh===true||higherLow===true?'Structure improving'
    :higherHigh===false||higherLow===false?'Structure weakening':'Insufficient pivots';
  return {swingTrend,higherLow,higherHigh};
}

function supportResistance(rows){
  if(!Array.isArray(rows)||rows.length<25) return {support:null,resistance:null,roomToResistance:null,supportDistance:null,resistanceTouches:0,supportTouches:0};
  const last=rows.at(-1).close,pivH=[],pivL=[];
  for(let i=Math.max(2,rows.length-90);i<=rows.length-3;i++){
    const x=rows[i];
    if(Number.isFinite(x.high)&&x.high>rows[i-1].high&&x.high>=rows[i-2].high&&x.high>rows[i+1].high&&x.high>=rows[i+2].high) pivH.push(x.high);
    if(Number.isFinite(x.low)&&x.low<rows[i-1].low&&x.low<=rows[i-2].low&&x.low<rows[i+1].low&&x.low<=rows[i+2].low) pivL.push(x.low);
  }
  const resistanceCandidates=pivH.filter(v=>v>last*1.002).sort((a,b)=>a-b);
  const supportCandidates=pivL.filter(v=>v<last*.998).sort((a,b)=>b-a);
  const resistance=resistanceCandidates[0]??null,support=supportCandidates[0]??null;
  const touches=(vals,level)=>Number.isFinite(level)?vals.filter(v=>Math.abs(v/level-1)<=0.015).length:0;
  return {
    support:round(support,2),resistance:round(resistance,2),
    roomToResistance:round(pct(resistance,last),1),supportDistance:round(pct(last,support),1),
    resistanceTouches:touches(pivH,resistance),supportTouches:touches(pivL,support)
  };
}

export function dailyStructure(rows){
  if(!Array.isArray(rows)||rows.length<12) return {localHigh:null,localLow:null,highState:'unavailable',lowState:'unavailable'};
  const pivotsHigh=[],pivotsLow=[];
  // Two bars on each side confirm a local pivot. The latest two sessions are
  // intentionally excluded from pivot discovery so today's move cannot redefine
  // the level it is being compared with.
  for(let i=2;i<=rows.length-3;i++){
    const hi=rows[i].high,lo=rows[i].low;
    if(Number.isFinite(hi)&&hi>rows[i-1].high&&hi>=rows[i-2].high&&hi>rows[i+1].high&&hi>=rows[i+2].high) pivotsHigh.push(i);
    if(Number.isFinite(lo)&&lo<rows[i-1].low&&lo<=rows[i-2].low&&lo<rows[i+1].low&&lo<=rows[i+2].low) pivotsLow.push(i);
  }
  const hiIndex=pivotsHigh.at(-1),loIndex=pivotsLow.at(-1);
  const localHigh=Number.isInteger(hiIndex)?rows[hiIndex].high:null;
  const localLow=Number.isInteger(loIndex)?rows[loIndex].low:null;
  const last=rows.at(-1);
  const beforeLast=rows.slice(0,-1);
  const priorHighBreak=Number.isFinite(localHigh)&&Number.isInteger(hiIndex)
    ? beforeLast.slice(hiIndex+1).some(x=>Number.isFinite(x.close)&&x.close>localHigh):false;
  const priorLowBreak=Number.isFinite(localLow)&&Number.isInteger(loIndex)
    ? beforeLast.slice(loIndex+1).some(x=>Number.isFinite(x.close)&&x.close<localLow):false;
  const highState=!Number.isFinite(localHigh)?'unavailable'
    : last.close>localHigh?'local_high_broken'
    : (last.high>localHigh||priorHighBreak)?'failed_high_break'
    :'local_high_intact';
  const lowState=!Number.isFinite(localLow)?'unavailable'
    : last.close<localLow?'local_low_broken'
    : (last.low<localLow||priorLowBreak)?'failed_low_break'
    :'local_low_held';
  return {localHigh:round(localHigh,2),localLow:round(localLow,2),highState,lowState};
}

export function metrics(data,benchmarkData,sectorData){
  const r=data.rows,c=r.map(x=>x.close),v=r.map(x=>x.volume);
  if(c.length<65) return null;

  const last=c.at(-1),ma20=sma(c,20),ma50=sma(c,50),rsi14=rsi(c,14);
  const structure=dailyStructure(r);
  const levels=supportResistance(r);
  const swing=swingStructure(r);
  const atr14Pct=atrPercent(r,14);
  const volBehavior=directionalVolume(r,20);
  const pricePrev5=c.at(-6);
  const prev50=c.length>=55?avg(c.slice(-55,-5)):null;
  const above50Now=Number.isFinite(ma50)?last>ma50:null;
  const above50Prev5=Number.isFinite(prev50)?pricePrev5>prev50:null;

  const vol20=avg(v.slice(-21,-1));
  const rvol=vol20?v.at(-1)/vol20:null;
  const dollar20=avg(r.slice(-20).map(x=>x.rawClose*x.volume));
  const ret5=pct(last,c.at(-6)),ret20=pct(last,c.at(-21)),ret60=pct(last,c.at(-61));
  const high60=Math.max(...c.slice(-60)),pullback=pct(last,high60);
  const w=weeklyCloses(r),w10=sma(w,10),wPrev=w.length>=14?avg(w.slice(-14,-4)):null;
  const weeklyUp=Number.isFinite(w10)&&Number.isFinite(wPrev)&&last>w10&&w10>wPrev;
  const dailyUp=Number.isFinite(ma20)&&Number.isFinite(ma50)&&last>ma20&&ma20>ma50;
  const prev5=c.length>=11?pct(c.at(-6),c.at(-11)):null;
  const momentumShift=Number.isFinite(ret5)&&Number.isFinite(prev5)?ret5-prev5:null;
  // Require a visible change rather than treating tiny noise as a recovery signal.
  const momentumImproving=Number.isFinite(momentumShift)&&momentumShift>=2;
  const aligned20=alignedReturn(r,benchmarkData?.rows,20);
  const rs20=aligned20?aligned20.stock-aligned20.benchmark:null;
  const alignedSector20=alignedReturn(r,sectorData?.rows,20);
  const sectorRs=alignedSector20?alignedSector20.stock-alignedSector20.benchmark:null;
  const dist20=pct(last,ma20),dist50=pct(last,ma50);
    const volumeVsAvg=Number.isFinite(rvol)?(rvol-1)*100:null;
  const trendState=dailyUp&&weeklyUp?'Daily + Weekly aligned':weeklyUp?'Weekly up · Daily mixed':dailyUp?'Daily up · Weekly mixed':'Trend mixed';

  let max5Rvol=null,max5RvolAgo=null,positiveUnusual5d=false;
  for(let i=r.length-5;i<r.length;i++){
    const baseline=avg(v.slice(i-20,i));
    if(!Number.isFinite(baseline)||baseline<=0||!Number.isFinite(v[i])) continue;
    const ratio=v[i]/baseline;
    if(ratio>=1.4&&i>0&&pct(r[i].close,r[i-1].close)>=0.5) positiveUnusual5d=true;
    if(max5Rvol===null||ratio>=max5Rvol){max5Rvol=ratio;max5RvolAgo=r.length-1-i;}
  }
  const unusual5d=Number.isFinite(max5Rvol)&&max5Rvol>=1.4;
  const spikeIndex=Number.isFinite(max5RvolAgo)?r.length-1-max5RvolAgo:null;
  const spikeRow=Number.isInteger(spikeIndex)?r[spikeIndex]:null;
  const spikePrev=Number.isInteger(spikeIndex)&&spikeIndex>0?r[spikeIndex-1]:null;
  const spikeReturn=spikeRow&&spikePrev?pct(spikeRow.close,spikePrev.close):null;
  // Direction is deliberately simple: what did price do on the abnormal-volume session?
  const unusual5dDirection=!unusual5d||!Number.isFinite(spikeReturn)?'none':spikeReturn>=0.5?'positive':spikeReturn<=-0.5?'negative':'mixed';
  const unusualPrefix=unusual5dDirection==='positive'?'Positive':unusual5dDirection==='negative'?'Negative':unusual5dDirection==='mixed'?'Mixed':'';
  const unusual5dLabel=!Number.isFinite(max5Rvol)?'—':unusual5d
    ? `${unusualPrefix} ${round(max5Rvol,1)}× volume · ${max5RvolAgo===0?'today':max5RvolAgo===1?'1 day ago':max5RvolAgo+' days ago'}`
    : `No unusual volume · max ${round(max5Rvol,1)}×`;

  // Early Watch is intentionally allowed to fire BEFORE a confirmed reversal.
  // Look for a meaningful decline followed by abnormal participation near the low
  // and evidence that downside momentum is losing force.
  const recentLow10=Math.min(...r.slice(-10).map(x=>x.low).filter(Number.isFinite));
  const nearRecentLow=Number.isFinite(recentLow10)&&Number.isFinite(last)?pct(last,recentLow10)<=4:null;
  const recentDailyReturns=r.slice(-6).map((x,j,a)=>j===0?null:pct(x.close,a[j-1].close)).filter(Number.isFinite);
  const worstPrior4=recentDailyReturns.length>=2?Math.min(...recentDailyReturns.slice(0,-1)):null;
  const latestDayReturn=recentDailyReturns.at(-1);
  const downsideSlowing=Number.isFinite(worstPrior4)&&Number.isFinite(latestDayReturn)&&worstPrior4<=-1.5&&latestDayReturn>worstPrior4+1;
  const volumeShockNearLow=unusual5d===true&&nearRecentLow===true;

  const recentDown=downVolumeAverage(r,r.length-5,r.length);
  const priorDown=downVolumeAverage(r,r.length-15,r.length-5);
  const downCount=(start,end)=>r.slice(start,end).filter((x,j)=>start+j>0&&x.close<r[start+j-1].close&&Number.isFinite(x.volume)).length;
  const sellingPressureFading=downCount(r.length-5,r.length)>=2&&downCount(r.length-15,r.length-5)>=3&&Number.isFinite(recentDown)&&Number.isFinite(priorDown)&&recentDown<priorDown*0.82;

  let trendScore=(weeklyUp?15:(last>ma50?8:2))+(dailyUp?15:(last>ma20?8:2));
  let momentumScore=clamp(10+(Number.isFinite(ret5)?ret5:0)*1.2+(Number.isFinite(ret20)?ret20:0)*0.4+(momentumImproving?5:0),0,25);
  const recentVolumeBoost=Number.isFinite(max5Rvol)?Math.max(0,max5Rvol-1):0;
  const directionalVolumeBoost=unusual5dDirection==='positive'?recentVolumeBoost:unusual5dDirection==='mixed'?recentVolumeBoost*0.35:0;
  let volumeScore=clamp(7+directionalVolumeBoost*7+(sellingPressureFading?2:0)-(unusual5dDirection==='negative'?2:0),0,15);
  let relativeScore=Number.isFinite(rs20)?clamp(6+rs20*0.55,0,12):null;
  // Sector RS is intentionally modest: useful tie-breaker, not a reason to hide an early Recovery.
  let sectorScore=Number.isFinite(sectorRs)?clamp(4+sectorRs*0.45,0,8):null;
  let structureScore=2;
  if(pullback<=-2&&pullback>=-12) structureScore+=7;
  if(Number.isFinite(dist20)&&dist20>=-3&&dist20<=5) structureScore+=3;
  if(Number.isFinite(dist50)&&dist50>-4) structureScore+=4;
  structureScore=clamp(structureScore,0,15);
  // Preserve ordering without clipping distinct raw totals above 100.
  const score=(trendScore+momentumScore+volumeScore+(Number.isFinite(relativeScore)?relativeScore:6)+(Number.isFinite(sectorScore)?sectorScore:4)+structureScore)/105*100;

  let stage=null;
  // Stages describe chart maturity, not buy/sell quality.
  // Established requires a mature multi-week move and avoids labeling a fresh rebound as established.
  const established=weeklyUp&&dailyUp&&Number.isFinite(ret20)&&Number.isFinite(ret60)&&Number.isFinite(rs20)
    && ret20>=8&&ret60>=15&&rs20>2&&pullback>-10;
  // Attractive is constructive trend continuation that has not yet met the mature-move test.
  const attractive=weeklyUp&&Number.isFinite(ret5)&&Number.isFinite(ret20)&&Number.isFinite(rs20)
    && (dailyUp||(last>ma50&&ret5>0))&&ret20>0&&rs20>-3&&pullback>-15;
  // Recovery needs an actual prior soft patch plus a visible recent improvement; this prevents
  // ordinary strong uptrends with a tiny dip from being mislabeled as early recovery.
  // Assess weakness BEFORE the latest five sessions, so a rebound cannot erase it.
  const priorMa20=sma(c.slice(0,-5),20);
  const priorRet20=pct(pricePrev5,c.at(-26));
  const priorPullback=pct(pricePrev5,Math.max(...c.slice(-65,-5)));
  const meaningfulWeakness=priorRet20<=-3||(priorPullback<=-8&&pricePrev5<priorMa20);
  // A large 60-session advance near its high is not an early reversal, even
  // when it misses one of the established-trend gates. Leave it unclassified.
  const advancedNearHigh=ret60>=15&&pullback>-10;
  const recovery=meaningfulWeakness&&!advancedNearHigh&&momentumImproving&&Number.isFinite(ret5)&&Number.isFinite(dist50)&&Number.isFinite(rs20)
    && ret5>=1&&last>=ma20&&pullback>=-18&&(last>ma50||dist50>-4)&&rs20>-8;

  if(established) stage='Established Move';
  else if(attractive) stage='Attractive Growth';
  else if(recovery) stage='Recovery';

  const why=[];
  if(stage==='Recovery') why.push('rebounding after a meaningful prior decline');
  if(stage===null&&volumeShockNearLow) why.push('volume shock near recent low');
  if(stage===null&&downsideSlowing) why.push('selling momentum slowing');
  if(sellingPressureFading) why.push('selling volume fading');
  if(momentumImproving) why.push('momentum improving');
  if(unusual5d) why.push(unusual5dLabel);
  if((rs20||0)>2) why.push('outperforming TSX');
  if(Number.isFinite(sectorRs)&&sectorRs>=3) why.push(`+${round(sectorRs,1)}% vs sector`);
  if(Number.isFinite(sectorRs)&&sectorRs<=-5) why.push(`${round(sectorRs,1)}% vs sector`);
  if(pullback<=-2&&pullback>=-12) why.push(`${Math.abs(round(pullback,1))}% off recent high`);
  if(dailyUp&&weeklyUp) why.push('daily + weekly trend aligned');
  if(!why.length) why.push('structure moved into the scan threshold');

  return {
    price:round(last,2),ret5:round(ret5),ret20:round(ret20),ret60:round(ret60),rvol:round(rvol,2),
    lastSession:dayKey(r.at(-1).t),dataAgeDays:round(ageDays(r.at(-1).t),1),
    avgDollarVol:dollar20,pullback:round(pullback),rs20:round(rs20),sectorRs:round(sectorRs),
    ma20:round(ma20),ma50:round(ma50),dist20:round(dist20),dist50:round(dist50),rsi14:round(rsi14,1),
    atr14Pct:round(atr14Pct,2),upDownVolumeRatio:round(volBehavior.upDownVolumeRatio,2),
    swingTrend:swing.swingTrend,higherHigh:swing.higherHigh,higherLow:swing.higherLow,
    weeklyUp,dailyUp,momentumImproving,sellingPressureFading,above50Now,above50Prev5,
    meaningfulWeakness,advancedNearHigh,priorRet20:round(priorRet20),priorPullback:round(priorPullback),
    prev5:round(prev5,1),momentumShift:round(momentumShift,1),volumeVsAvg:round(volumeVsAvg,1),trendState,
    unusual5d,positiveUnusual5d,max5Rvol:round(max5Rvol,2),max5RvolAgo,spikeReturn:round(spikeReturn,1),unusual5dDirection,unusual5dLabel,
    nearRecentLow,downsideSlowing,volumeShockNearLow,latestDayReturn:round(latestDayReturn,1),
    ...structure,...levels,
    score:round(score,1),stage,why:why.slice(0,3),
    components:{
      trend:round(trendScore,1),momentum:round(momentumScore,1),volume:round(volumeScore,1),
      relative:Number.isFinite(relativeScore)?round(relativeScore,1):null,sector:Number.isFinite(sectorScore)?round(sectorScore,1):null,structure:round(structureScore,1)
    }
  };
}

function sectorStrength(x){
  if(!x) return null;
  let points=0,parts=0;
  const vote=(cond)=>{if(cond===null||cond===undefined)return;parts++;points+=cond?1:-1};
  vote(Number.isFinite(x.ret20)?x.ret20>=0:null);
  vote(Number.isFinite(x.ret5)?x.ret5>=0:null);
  vote(Number.isFinite(x.breadth)?x.breadth>=50:null);
  vote(Number.isFinite(x.breadthDelta)?x.breadthDelta>=0:null);
  if(!parts) return null;
  return points>=2?'Strong':points<=-2?'Weak':'Neutral';
}

function sectorSummary(liquid){
  const groups={};
  for(const item of liquid){
    (groups[item.sector]??=[]).push(item);
  }
  return Object.entries(groups).map(([sector,items])=>{
    const now=items.filter(x=>x.above50Now===true).length;
    const prev=items.filter(x=>x.above50Prev5===true).length;
    const eligibleNow=items.filter(x=>x.above50Now!==null).length;
    const eligiblePrev=items.filter(x=>x.above50Prev5!==null).length;
    const breadth=eligibleNow?now/eligibleNow*100:null;
    const breadthPrev=eligiblePrev?prev/eligiblePrev*100:null;
    const breadthDelta=Number.isFinite(breadth)&&Number.isFinite(breadthPrev)?breadth-breadthPrev:null;
    const avg5=avg(items.map(x=>x.ret5));
    const avg20=avg(items.map(x=>x.ret20));
    return {
      sector,count:items.length,
      breadth:round(breadth,0),breadthPrev5:round(breadthPrev,0),breadthDelta:round(breadthDelta,0),
      breadthStatus:breadthLabel(breadth),trend:direction(breadthDelta),
      ret5:round(avg5,1),ret20:round(avg20,1),
      strength:sectorStrength({ret5:avg5,ret20:avg20,breadth,breadthDelta})
    };
  }).sort((a,b)=>(b.ret20??-999)-(a.ret20??-999));
}

export function validateData(data,referenceDates){
  if(data.currency!=='CAD') return 'non_cad_instrument';
  const r=data.rows;
  if(referenceDates.length<61||r.length<65) return 'insufficient_history';
  if(dayKey(r.at(-1).t)!==referenceDates.at(-1)) return 'stale_data';
  const dates=new Set(r.map(x=>dayKey(x.t)));
  if(referenceDates.some(d=>!dates.has(d))) return 'missing_sessions';
  if(r.slice(-61).some(x=>!Number.isFinite(x.volume)||x.volume<=0)) return 'missing_or_zero_volume';
  return null;
}

// Early Watch is stage 1 of the four-stage discovery continuum; it is pre-reversal, not a reversal signal.
export function isEarlyWatch(m){
  if(m.stage!==null||m.meaningfulWeakness!==true||m.advancedNearHigh===true) return false;
  if(!Number.isFinite(m.ret20)||m.ret20>=-3) return false;
  // Early Watch is a selective pre-reversal hunt, not a bucket for every weak stock.
  // Every name must still be close to a recent low; then it needs either:
  // A) abnormal participation/absorption near that low, or
  // B) fading sell volume plus a clear momentum improvement.
  if(m.nearRecentLow!==true) return false;
  const absorption=m.volumeShockNearLow===true&&(
    m.downsideSlowing===true||
    m.sellingPressureFading===true||
    (Number.isFinite(m.spikeReturn)&&m.spikeReturn>=-2.5)
  );
  const controlledTurn=m.sellingPressureFading===true&&m.momentumImproving===true;
  return absorption||controlledTurn;
}

// Frozen Candidate V2 gate. This is intentionally narrow: only Recovery
// passed the current cross-horizon holdout robustness bar. It uses objective
// chart evidence only; clicks/watchlists/user feedback never enter the gate.
export function recoveryCandidateV2(m){
  if(m?.stage!=='Recovery'||!Number.isFinite(m.rs20)||m.rs20<0) return false;
  // Match the frozen historical predicate exactly:
  // setups() labels Higher-Low Turn only when higherLow && momentumShift > 0.
  const higherLowTurn=m.higherLow===true&&Number.isFinite(m.momentumShift)&&m.momentumShift>0;
  const failedBreakdownReclaim=m.lowState==='failed_low_break';
  return higherLowTurn||failedBreakdownReclaim;
}

export function crossStageScore(x){
  // Objective cross-stage chart-review quality. Never uses clicks, watchlist or user feedback.
  let score=0,parts=0;
  const add=(v,w=1)=>{if(Number.isFinite(v)){score+=clamp(v,0,100)*w;parts+=w}};
  add(Number.isFinite(x.rs20)?50+x.rs20*2:null,1.2);
  add(Number.isFinite(x.momentumShift)?50+x.momentumShift*3:null,1.1);
  add(Number.isFinite(x.rvol)?35+(x.rvol-1)*35:null,.7);
  add(Number.isFinite(x.ret20)?50+x.ret20*2:null,.8);
  add(Number.isFinite(x.dist50)?55+x.dist50*2:null,.8);
  if(Number.isFinite(x.pullback)) add(x.pullback>-3?62:x.pullback>=-12?78:x.pullback>=-20?60:35,1);
  if(x.dailyUp===true) add(78,.8); else if(x.dailyUp===false) add(35,.8);
  if(x.weeklyUp===true) add(82,1); else if(x.weeklyUp===false) add(35,1);
  if(x.unusual5dDirection==='positive') add(82,.6);
  else if(x.unusual5dDirection==='negative') add(35,.6);
  else add(55,.6);
  return parts?round(score/parts,1):null;
}

function indexRegime(data){
  if(!data?.rows?.length) return null;
  const c=data.rows.map(r=>r.close).filter(Number.isFinite);
  if(c.length<55) return null;
  const last=c.at(-1),ma20=sma(c,20),ma50=sma(c,50),ma20Prev=sma(c.slice(0,-5),20);
  const ret5=pct(last,c.at(-6)),ret20=pct(last,c.at(-21));
  const above20=last>ma20,above50=last>ma50,ma20Rising=Number.isFinite(ma20Prev)&&ma20>ma20Prev;
  let points=(above20?1:-1)+(above50?1:-1)+(ma20Rising?1:-1);
  if(Number.isFinite(ret5)) points+=ret5>=1?1:ret5<=-1?-1:0;
  if(Number.isFinite(ret20)) points+=ret20>=3?1:ret20<=-3?-1:0;
  const regime=points>=4?'Strong':points>=1?'Improving':points<=-4?'Weak':points<=-1?'Weakening':'Mixed';
  return {regime,points,ret5:round(ret5,1),ret20:round(ret20,1),above20,above50,ma20Rising};
}
function marketNarrative(regimes,breadth,sectors){
  const tsx=regimes.TSX, nasdaq=regimes.Nasdaq, sp=regimes['S&P 500'];
  const parts=[];
  if(tsx){
    const move=breadth?.trend==='Improving'?'breadth is expanding':breadth?.trend==='Weakening'?'breadth is narrowing':'breadth is stable';
    parts.push(`Canada is ${tsx.regime.toLowerCase()}; ${move}${Number.isFinite(breadth?.percentAbove50)?` with ${breadth.percentAbove50}% of the liquid Hunter universe above MA50`:''}.`);
  }
  if(nasdaq&&sp){
    if(nasdaq.regime===sp.regime) parts.push(`U.S. large-cap and technology conditions are both ${nasdaq.regime.toLowerCase()}.`);
    else parts.push(`U.S. conditions are split: Nasdaq is ${nasdaq.regime.toLowerCase()} while the S&P 500 is ${sp.regime.toLowerCase()}.`);
  }
  const improving=(sectors||[]).filter(x=>x.trend==='Improving').length;
  const weakening=(sectors||[]).filter(x=>x.trend==='Weakening').length;
  if(improving>weakening) parts.push('Sector participation is broadening.');
  else if(weakening>improving) parts.push('Sector participation is narrowing.');
  else parts.push('Sector participation is mixed.');
  return parts.join(' ');
}

function top5SnapshotItem(x,rank){
  return {
    rank,symbol:x.symbol,company:x.company,stage:x.stage,crossStageScore:x.crossStageScore,
    entryPrice:x.price,rsi14:x.rsi14,ret5:x.ret5,ret20:x.ret20,ret60:x.ret60,
    momentumShift:x.momentumShift,rvol:x.rvol,rs20:x.rs20,sectorRs:x.sectorRs,
    pullback:x.pullback,dist20:x.dist20,dist50:x.dist50,
    highState:x.highState,lowState:x.lowState,localHigh:x.localHigh,localLow:x.localLow
  };
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=1800');
  const minDollar=Number(req.query?.minDollar??5000000);
  if(![2000000,5000000,10000000,25000000].includes(minDollar)) return res.status(400).json({error:'invalid_liquidity'});

  try{
    const started=Date.now();
    const deadline=Date.now()+24000;
    const symbols=[...new Set([...INDEXES.map(x=>x[0]),...Object.values(SECTOR_PROXY).filter(Boolean),...UNIQUE_UNIVERSE.map(x=>x[0])])];
    // Reserve time for a bounded second fetch of incomplete vendor responses.
    const fetched=await mapLimit(symbols,16,s=>chart(s,'6mo','1d',deadline-6000));
    const bySymbol=Object.fromEntries(symbols.map((s,i)=>[s,fetched[i]]));
    const benchmarkBySymbol=Object.fromEntries(symbols.filter(s=>bySymbol[s].status==='fulfilled').map(s=>[s,bySymbol[s].value]));
    const idx={};
    INDEXES.forEach(([symbol,name,region])=>{
      const data=benchmarkBySymbol[symbol];if(!data) return;
      const c=data.rows.map(r=>r.close);
      idx[name]={symbol,region,price:round(c.at(-1)),ret5:round(pct(c.at(-1),c.at(-6))),ret20:round(pct(c.at(-1),c.at(-21)))};
    });
    const tsxBenchmark=benchmarkBySymbol['^GSPTSE']||null;
    if(!tsxBenchmark?.rows?.length||ageDays(tsxBenchmark.rows.at(-1).t)>5) throw new Error('reference_market_unavailable');
    const referenceDates=tsxBenchmark.rows.slice(-61).map(x=>dayKey(x.t));
    const marketAsOf=referenceDates.at(-1);
    const retryableQuality=new Set(['missing_sessions','stale_data','missing_or_zero_volume','insufficient_history']);
    const retrySymbols=UNIQUE_UNIVERSE.map(x=>x[0]).filter(s=>{
      const result=bySymbol[s];
      return result.status==='fulfilled'?retryableQuality.has(validateData(result.value,referenceDates)):
        result.reason?.status!==404;
    });
    let recovered=0;
    await mapLimit(retrySymbols,8,async symbol=>{
      const data=await chart(symbol,'1y','1d',deadline,'query2');
      const historyStart=dayKey(tsxBenchmark.rows[0].t);
      data.rows=data.rows.filter(row=>dayKey(row.t)>=historyStart);
      if(validateData(data,referenceDates)===null){
        // Replace the entire series: never mix adjustment scales or invent missing bars.
        bySymbol[symbol]={status:'fulfilled',value:data};recovered++;
      }
    });
    const sectorMap=benchmarkBySymbol;
    const settled=UNIQUE_UNIVERSE.map(([s])=>bySymbol[s]);
    const liquid=[],contextLiquid=[],candidates=[],watchItems=[],availableItems=[],unavailable=[],failureDetails=[],rejectedLiquidity=[];

    settled.forEach((x,i)=>{
      const [symbol,company,sector]=UNIQUE_UNIVERSE[i];
      if(x.status!=='fulfilled'){
        unavailable.push(symbol);
        failureDetails.push({symbol,reason:x.reason?.name==='AbortError'?'timeout':String(x.reason?.message||'fetch_failed')});
        return;
      }
      const qualityError=validateData(x.value,referenceDates);
      if(qualityError){unavailable.push(symbol);failureDetails.push({symbol,reason:qualityError});return;}
      const benchmark=sector==='CDR'?(benchmarkBySymbol[CDR_BENCHMARK[symbol]]||null):tsxBenchmark;
      const m=metrics(x.value,benchmark,sectorMap[SECTOR_PROXY[sector]]);
      if(!m){unavailable.push(symbol);failureDetails.push({symbol,reason:'insufficient_history'});return}
      if(Number.isFinite(m.dataAgeDays)&&m.dataAgeDays>5){unavailable.push(symbol);failureDetails.push({symbol,reason:'stale_data'});return}
      if(!Number.isFinite(m.price)||!Number.isFinite(m.avgDollarVol)){unavailable.push(symbol);failureDetails.push({symbol,reason:'missing_price_or_volume'});return}
      const benchmarkLabel=sector==='CDR'?(CDR_BENCHMARK[symbol]==='^IXIC'?'Nasdaq':'S&P 500'):'TSX';
      const item={symbol,company,sector,benchmarkLabel,...m,candidateV2:m.stage==='Recovery'?recoveryCandidateV2(m):false};
      // Keep valid metrics available to a personal watchlist even when the name
      // is outside the current liquidity/stage shortlist. This does not affect ranking.
      availableItems.push(item);
      if(x.value.rows.at(-1).rawClose>=2&&m.avgDollarVol>=2000000&&sector!=='CDR') contextLiquid.push({symbol,company,sector,...m});
      if(x.value.rows.at(-1).rawClose<2 || m.avgDollarVol<minDollar){
        rejectedLiquidity.push({symbol,price:m.price,avgDollarVol:m.avgDollarVol});
        return;
      }


      if(sector==='CDR'&&Array.isArray(item.why)) item.why=item.why.map(w=>w==='outperforming TSX'?`outperforming ${benchmarkLabel}`:w);
      liquid.push(item);
      if(m.stage) candidates.push(item);
      else if(isEarlyWatch(m)){
        const earlyWhy=['meaningful decline; still near recent low'];
        if(m.volumeShockNearLow) earlyWhy.push(`volume shock near low · ${m.max5Rvol??'—'}×`);
        if(m.downsideSlowing) earlyWhy.push('downside momentum slowing');
        else if(m.sellingPressureFading) earlyWhy.push('selling volume fading');
        else if(Number.isFinite(m.spikeReturn)&&m.spikeReturn>=-2.5) earlyWhy.push('high-volume session held relatively firm');
        watchItems.push({...item,why:earlyWhy.slice(0,3)});
      }
    });

    const canadianLiquid=contextLiquid;
    const above50=canadianLiquid.filter(x=>x.above50Now===true).length;
    const above50Prev=canadianLiquid.filter(x=>x.above50Prev5===true).length;
    const eligibleNow=canadianLiquid.filter(x=>x.above50Now!==null).length;
    const eligiblePrev=canadianLiquid.filter(x=>x.above50Prev5!==null).length;
    const percentAbove50=eligibleNow?above50/eligibleNow*100:null;
    const percentAbove50Prev5=eligiblePrev?above50Prev/eligiblePrev*100:null;
    const breadthDelta=Number.isFinite(percentAbove50)&&Number.isFinite(percentAbove50Prev5)?percentAbove50-percentAbove50Prev5:null;
    const adv=canadianLiquid.filter(x=>Number.isFinite(x.ret5)&&x.ret5>0).length;
    const dec=canadianLiquid.filter(x=>Number.isFinite(x.ret5)&&x.ret5<0).length;

    const breadth={
      percentAbove50:round(percentAbove50,0),
      percentAbove50Prev5:round(percentAbove50Prev5,0),
      change5d:round(breadthDelta,0),
      status:breadthLabel(percentAbove50),
      trend:direction(breadthDelta),
      advancers5d:adv,decliners5d:dec,scanned:canadianLiquid.length,candidates:candidates.filter(x=>x.sector!=='CDR').length
    };

    const sectors=sectorSummary(canadianLiquid);
    const sectorByName=new Map(sectors.map(x=>[x.sector,x]));
    for(const item of [...candidates,...watchItems,...availableItems]){
      const sx=sectorByName.get(item.sector);
      item.sectorStrength=sx?.strength??null;
      item.sectorBreadth=sx?.breadth??null;
      item.sectorBreadthTrend=sx?.trend??null;
      item.sectorRet5=sx?.ret5??null;
      item.sectorRet20=sx?.ret20??null;
    }
    const strongest=sectors[0]||null;
    const weakest=sectors.at(-1)||null;

    const canada20=idx.TSX?.ret20??null;
    const usa20=idx['S&P 500']?.ret20??null;
    const marketRegimes={};
    for(const [symbol,name] of INDEXES){
      const data=benchmarkBySymbol[symbol];
      if(data) marketRegimes[name]=indexRegime(data);
    }
    const marketContext={
      canada20:round(canada20,1),
      usa20:round(usa20,1),
      breadthStatus:breadth.status,
      breadthTrend:breadth.trend,
      strongestSector:strongest?.sector||null,
      weakestSector:weakest?.sector||null,
      narrative:marketNarrative(marketRegimes,breadth,sectors)
    };

    const priority=(a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol);
    candidates.sort(priority);
    watchItems.sort(priority);

    // Build Top 5 in the backend so the exact daily selection and entry metrics can be
    // preserved in historical snapshots and evaluated later without subjective feedback.
    const top5Pool=[
      ...candidates,
      ...watchItems.map(x=>({...x,stage:'Early Watch'}))
    ].map(x=>({...x,crossStageScore:crossStageScore(x)}))
      .sort((a,b)=>(b.crossStageScore??-Infinity)-(a.crossStageScore??-Infinity)||a.symbol.localeCompare(b.symbol));
    const top5=top5Pool.slice(0,5).map((x,i)=>top5SnapshotItem(x,i+1));

    const stageCounts={
      Recovery:candidates.filter(x=>x.stage==='Recovery').length,
      AttractiveGrowth:candidates.filter(x=>x.stage==='Attractive Growth').length,
      EstablishedMove:candidates.filter(x=>x.stage==='Established Move').length
    };
    const diagnostics={
      universe:UNIQUE_UNIVERSE.length,
      fetched:settled.filter(x=>x.status==='fulfilled').length,
      unavailable:unavailable.length,
      liquidityRejected:rejectedLiquidity.length,
      liquid:liquid.length,
      candidates:candidates.length,
      earlyWatch:watchItems.length,
      recoveryAttempted:retrySymbols.length,
      recovered,
      elapsedMs:Date.now()-started,
      stageCounts
    };

    const partial=unavailable.length>0;
    if(partial) res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=60');
    res.status(200).json({
      asOf:new Date().toISOString(),marketAsOf,version:'hunter-1.4-candidate-v2-shadow',universeSource:UNIVERSE_SOURCE,partial,breadthMinDollar:2000000,minDollar,indexes:idx,breadth,sectors,marketContext,marketRegimes,
      items:candidates,watchItems,top5,availableItems,candidateV2Items:candidates.filter(x=>x.candidateV2===true),unavailable,failureDetails,universeSize:UNIQUE_UNIVERSE.length,diagnostics
    });
  }catch(e){
    res.status(500).json({error:'scan_failed',message:e?.message||'Unknown error'});
  }
}
