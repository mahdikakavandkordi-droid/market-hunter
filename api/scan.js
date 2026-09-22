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

export function metrics(data,benchmarkData,sectorData){
  const r=data.rows,c=r.map(x=>x.close),v=r.map(x=>x.volume);
  if(c.length<65) return null;

  const last=c.at(-1),ma20=sma(c,20),ma50=sma(c,50),rsi14=rsi(c,14);
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
    weeklyUp,dailyUp,momentumImproving,sellingPressureFading,above50Now,above50Prev5,
    meaningfulWeakness,advancedNearHigh,priorRet20:round(priorRet20),priorPullback:round(priorPullback),
    prev5:round(prev5,1),momentumShift:round(momentumShift,1),volumeVsAvg:round(volumeVsAvg,1),trendState,
    unusual5d,positiveUnusual5d,max5Rvol:round(max5Rvol,2),max5RvolAgo,spikeReturn:round(spikeReturn,1),unusual5dDirection,unusual5dLabel,
    nearRecentLow,downsideSlowing,volumeShockNearLow,latestDayReturn:round(latestDayReturn,1),
    score:round(score,1),stage,why:why.slice(0,3),
    components:{
      trend:round(trendScore,1),momentum:round(momentumScore,1),volume:round(volumeScore,1),
      relative:Number.isFinite(relativeScore)?round(relativeScore,1):null,sector:Number.isFinite(sectorScore)?round(sectorScore,1):null,structure:round(structureScore,1)
    }
  };
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
      ret5:round(avg5,1),ret20:round(avg20,1)
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

// Supplemental observation list, not a fourth discovery stage or a reversal signal.
export function isEarlyWatch(m){
  if(m.stage!==null||m.meaningfulWeakness!==true||m.advancedNearHigh===true) return false;
  if(!Number.isFinite(m.ret20)||m.ret20>=0) return false;
  // Two explainable paths:
  // 1) the existing momentum-turn path;
  // 2) a TELUS-like exhaustion path: abnormal volume near a recent low while
  //    downside momentum is slowing or selling volume is fading.
  const momentumTurn=m.momentumImproving===true&&(m.positiveUnusual5d===true||m.sellingPressureFading===true);
  const exhaustion=m.volumeShockNearLow===true&&(m.downsideSlowing===true||m.sellingPressureFading===true);
  return momentumTurn||exhaustion;
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
    const liquid=[],contextLiquid=[],candidates=[],watchItems=[],unavailable=[],failureDetails=[],rejectedLiquidity=[];

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
      if(x.value.rows.at(-1).rawClose>=2&&m.avgDollarVol>=2000000&&sector!=='CDR') contextLiquid.push({symbol,company,sector,...m});
      if(x.value.rows.at(-1).rawClose<2 || m.avgDollarVol<minDollar){
        rejectedLiquidity.push({symbol,price:m.price,avgDollarVol:m.avgDollarVol});
        return;
      }

      const benchmarkLabel=sector==='CDR'?(CDR_BENCHMARK[symbol]==='^IXIC'?'Nasdaq':'S&P 500'):'TSX';
      const item={symbol,company,sector,benchmarkLabel,...m};
      if(sector==='CDR'&&Array.isArray(item.why)) item.why=item.why.map(w=>w==='outperforming TSX'?`outperforming ${benchmarkLabel}`:w);
      liquid.push(item);
      if(m.stage) candidates.push(item);
      else if(isEarlyWatch(m)) watchItems.push({...item,why:[
        'prior decline; 20D still negative',
        m.ret5>0?'5D positive; momentum improving':'5D still non-positive; decline slowing',
        m.positiveUnusual5d?'positive unusual-volume session within last 5 sessions':'selling volume fading'
      ]});
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
    const strongest=sectors[0]||null;
    const weakest=sectors.at(-1)||null;

    const canada20=idx.TSX?.ret20??null;
    const usa20=idx['S&P 500']?.ret20??null;
    const marketContext={
      canada20:round(canada20,1),
      usa20:round(usa20,1),
      breadthStatus:breadth.status,
      breadthTrend:breadth.trend,
      strongestSector:strongest?.sector||null,
      weakestSector:weakest?.sector||null
    };

    const priority=(a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol);
    candidates.sort(priority);
    watchItems.sort(priority);

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
      asOf:new Date().toISOString(),marketAsOf,version:'hunter-1.3',universeSource:UNIVERSE_SOURCE,partial,breadthMinDollar:2000000,minDollar,indexes:idx,breadth,sectors,marketContext,
      items:candidates,watchItems,unavailable,failureDetails,universeSize:UNIQUE_UNIVERSE.length,diagnostics
    });
  }catch(e){
    res.status(500).json({error:'scan_failed',message:e?.message||'Unknown error'});
  }
}
