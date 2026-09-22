const UNIVERSE = [
  // Financials
  ['RY.TO','Royal Bank of Canada','Financials'],['TD.TO','Toronto-Dominion Bank','Financials'],['BMO.TO','Bank of Montreal','Financials'],['BNS.TO','Bank of Nova Scotia','Financials'],['CM.TO','CIBC','Financials'],['NA.TO','National Bank of Canada','Financials'],['MFC.TO','Manulife Financial','Financials'],['SLF.TO','Sun Life Financial','Financials'],['IFC.TO','Intact Financial','Financials'],['GWO.TO','Great-West Lifeco','Financials'],['POW.TO','Power Corporation of Canada','Financials'],['FFH.TO','Fairfax Financial','Financials'],['EQB.TO','EQB','Financials'],['IAG.TO','iA Financial','Financials'],['ONEX.TO','Onex','Financials'],
  // Energy
  ['CNQ.TO','Canadian Natural Resources','Energy'],['SU.TO','Suncor Energy','Energy'],['CVE.TO','Cenovus Energy','Energy'],['IMO.TO','Imperial Oil','Energy'],['TOU.TO','Tourmaline Oil','Energy'],['ARX.TO','ARC Resources','Energy'],['ENB.TO','Enbridge','Energy'],['TRP.TO','TC Energy','Energy'],['PPL.TO','Pembina Pipeline','Energy'],['KEY.TO','Keyera','Energy'],['MEG.TO','MEG Energy','Energy'],['WCP.TO','Whitecap Resources','Energy'],['BIR.TO','Birchcliff Energy','Energy'],['VET.TO','Vermilion Energy','Energy'],['CPG.TO','Crescent Point Energy','Energy'],
  // Materials
  ['ABX.TO','Barrick Mining','Materials'],['AEM.TO','Agnico Eagle Mines','Materials'],['WPM.TO','Wheaton Precious Metals','Materials'],['NTR.TO','Nutrien','Materials'],['TECK-B.TO','Teck Resources','Materials'],['FM.TO','First Quantum Minerals','Materials'],['K.TO','Kinross Gold','Materials'],['LUG.TO','Lundin Gold','Materials'],['AGI.TO','Alamos Gold','Materials'],['PAAS.TO','Pan American Silver','Materials'],['CCO.TO','Cameco','Materials'],['HBM.TO','Hudbay Minerals','Materials'],['ERO.TO','Ero Copper','Materials'],['LUN.TO','Lundin Mining','Materials'],['IVN.TO','Ivanhoe Mines','Materials'],
  // Industrials
  ['CNR.TO','Canadian National Railway','Industrials'],['CP.TO','Canadian Pacific Kansas City','Industrials'],['WSP.TO','WSP Global','Industrials'],['TFII.TO','TFI International','Industrials'],['ATRL.TO','AtkinsRéalis','Industrials'],['CAE.TO','CAE','Industrials'],['GFL.TO','GFL Environmental','Industrials'],['STN.TO','Stantec','Industrials'],['TIH.TO','Toromont Industries','Industrials'],['WCN.TO','Waste Connections','Industrials'],['BDGI.TO','Badger Infrastructure Solutions','Industrials'],['AC.TO','Air Canada','Industrials'],
  // Technology
  ['SHOP.TO','Shopify','Technology'],['CSU.TO','Constellation Software','Technology'],['OTEX.TO','OpenText','Technology'],['KXS.TO','Kinaxis','Technology'],['DSG.TO','Descartes Systems','Technology'],['CLS.TO','Celestica','Technology'],['GIB-A.TO','CGI','Technology'],['LSPD.TO','Lightspeed Commerce','Technology'],['BB.TO','BlackBerry','Technology'],['DCBO.TO','Docebo','Technology'],['ENGH.TO','Enghouse Systems','Technology'],['HPS-A.TO','Hammond Power Solutions','Technology'],
  // Communication
  ['BCE.TO','BCE','Communication'],['T.TO','TELUS','Communication'],['RCI-B.TO','Rogers Communications','Communication'],['QBR-B.TO','Quebecor','Communication'],['CCA.TO','Cogeco Communications','Communication'],
  // Utilities
  ['FTS.TO','Fortis','Utilities'],['EMA.TO','Emera','Utilities'],['AQN.TO','Algonquin Power & Utilities','Utilities'],['CPX.TO','Capital Power','Utilities'],['NPI.TO','Northland Power','Utilities'],['CU.TO','Canadian Utilities','Utilities'],['H.TO','Hydro One','Utilities'],
  // Consumer
  ['L.TO','Loblaw Companies','Consumer'],['ATD.TO','Alimentation Couche-Tard','Consumer'],['DOL.TO','Dollarama','Consumer'],['QSR.TO','Restaurant Brands International','Consumer'],['MG.TO','Magna International','Consumer'],['CTC-A.TO','Canadian Tire','Consumer'],['MRU.TO','Metro','Consumer'],['WN.TO','George Weston','Consumer'],['SAP.TO','Saputo','Consumer'],['DOO.TO','BRP','Consumer'],['GOOS.TO','Canada Goose','Consumer'],['GIL.TO','Gildan Activewear','Consumer'],
  // Real estate / health
  ['CAR-UN.TO','Canadian Apartment Properties REIT','Real Estate'],['REI-UN.TO','RioCan REIT','Real Estate'],['SRU-UN.TO','SmartCentres REIT','Real Estate'],['DIR-UN.TO','Dream Industrial REIT','Real Estate'],['CSH-UN.TO','Chartwell Retirement Residences','Health Care'],
  // Additional liquid Canadian hunting names
  ['BAM.TO','Brookfield Asset Management','Financials'],['BN.TO','Brookfield Corporation','Financials'],['FSV.TO','FirstService','Real Estate'],['CIX.TO','CI Financial','Financials'],['LB.TO','Laurentian Bank','Financials'],
  ['ATH.TO','Athabasca Oil','Energy'],['PEY.TO','Peyto Exploration & Development','Energy'],['TVE.TO','Tamarack Valley Energy','Energy'],['KEL.TO','Kelt Exploration','Energy'],['HWX.TO','Headwater Exploration','Energy'],['PSK.TO','PrairieSky Royalty','Energy'],
  ['OR.TO','Osisko Gold Royalties','Materials'],['IMG.TO','IAMGOLD','Materials'],['BTO.TO','B2Gold','Materials'],['NGD.TO','New Gold','Materials'],['EQX.TO','Equinox Gold','Materials'],['SSL.TO','Sandstorm Gold','Materials'],['CS.TO','Capstone Copper','Materials'],['DPM.TO','Dundee Precious Metals','Materials'],['AYA.TO','Aya Gold & Silver','Materials'],['ERO.TO','Ero Copper','Materials'],
  ['MDA.TO','MDA Space','Industrials'],['ATS.TO','ATS Corporation','Industrials'],['NFI.TO','NFI Group','Industrials'],['BBD-B.TO','Bombardier','Industrials'],['EIF.TO','Exchange Income','Industrials'],['RUS.TO','Russel Metals','Industrials'],['SJ.TO','Stella-Jones','Industrials'],
  ['TOI.TO','Topicus.com','Technology'],['LMN.TO','Lumine Group','Technology'],['TIXT.TO','TELUS International','Technology'],['CMG.TO','Computer Modelling Group','Technology'],['REAL.TO','Real Matters','Technology'],
  ['PKI.TO','Parkland','Consumer'],['MFI.TO','Maple Leaf Foods','Consumer'],['EMP-A.TO','Empire Company','Consumer'],['PET.TO','Pet Valu','Consumer'],['GIB-A.TO','CGI','Technology'],
  ['BEPC.TO','Brookfield Renewable','Utilities'],['BEP-UN.TO','Brookfield Renewable Partners','Utilities'],['TA.TO','TransAlta','Utilities'],
  ['AP-UN.TO','Allied Properties REIT','Real Estate'],['GRT-UN.TO','Granite REIT','Real Estate'],['HR-UN.TO','H&R REIT','Real Estate'],['CRT-UN.TO','CT REIT','Real Estate'],['CHP-UN.TO','Choice Properties REIT','Real Estate'],
  ['WELL.TO','WELL Health Technologies','Health Care'],['SIA.TO','Sienna Senior Living','Health Care'],
  // CAD-traded CDRs
  ['AAPL.TO','Apple CDR','CDR'],['MSFT.TO','Microsoft CDR','CDR'],['NVDA.TO','Nvidia CDR','CDR'],['AMZN.TO','Amazon CDR','CDR'],['GOOG.TO','Alphabet CDR','CDR'],['META.TO','Meta CDR','CDR'],['TSLA.TO','Tesla CDR','CDR'],['AMD.TO','AMD CDR','CDR'],['COST.TO','Costco CDR','CDR']
];
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
  Technology:'XIT.TO', Communication:'XTL.TO', Utilities:'XUT.TO', Consumer:'XST.TO', 'Real Estate':'XRE.TO', 'Health Care':'XHC.TO', CDR:'^GSPC'
};

function avg(a){const v=a.filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null}
function dayKey(t){return new Date(t*1000).toISOString().slice(0,10)}
function alignedReturn(rows,benchmarkRows,lookback){
  if(!Array.isArray(rows)||!Array.isArray(benchmarkRows)) return null;
  const stock=new Map(rows.map(x=>[dayKey(x.t),x.close]));
  const bench=new Map(benchmarkRows.map(x=>[dayKey(x.t),x.close]));
  const dates=[...stock.keys()].filter(d=>bench.has(d)).sort();
  if(dates.length<lookback+1) return null;
  const end=dates.at(-1),start=dates.at(-(lookback+1));
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
  if(avgLoss===0) return 100;
  const rs=avgGain/avgLoss;
  return 100-(100/(1+rs));
}
function breadthLabel(n){return !Number.isFinite(n)?'Unavailable':n>=60?'Strong':n<40?'Weak':'Neutral'}
function direction(delta){return !Number.isFinite(delta)?'Flat':delta>=3?'Improving':delta<=-3?'Weakening':'Stable'}

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function chart(symbol,range='6mo',interval='1d'){
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
  let lastError=null;
  for(let attempt=0;attempt<2;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
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
      const rows=(res.timestamp||[]).map((t,i)=>({
        t,close:adj[i]??q.close?.[i],high:q.high?.[i],low:q.low?.[i],volume:q.volume?.[i]
      })).filter(x=>Number.isFinite(x.close));
      return {symbol,rows,currency:res.meta?.currency||null};
    }catch(e){
      lastError=e;
      const retryable=e?.name==='AbortError'||e?.status===429||e?.status>=500;
      if(!retryable||attempt===1) throw e;
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

function metrics(data,benchmarkData,sectorRet20){
  const r=data.rows,c=r.map(x=>x.close),v=r.map(x=>x.volume||0);
  if(c.length<65) return null;

  const last=c.at(-1),ma20=sma(c,20),ma50=sma(c,50),rsi14=rsi(c,14);
  const prev5=c.at(-6);
  const prev50=c.length>=55?avg(c.slice(-55,-5)):null;
  const above50Now=Number.isFinite(ma50)?last>ma50:null;
  const above50Prev5=Number.isFinite(prev50)?prev5>prev50:null;

  const vol20=avg(v.slice(-20,-1));
  const rvol=vol20?v.at(-1)/vol20:null;
  const dollar20=avg(r.slice(-20).map(x=>x.close*(x.volume||0)));
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
  const sectorRs=Number.isFinite(sectorRet20)&&Number.isFinite(ret20)?ret20-sectorRet20:null;
  const dist20=pct(last,ma20),dist50=pct(last,ma50);
    const volumeVsAvg=Number.isFinite(rvol)?(rvol-1)*100:null;
  const trendState=dailyUp&&weeklyUp?'Daily + Weekly aligned':weeklyUp?'Weekly up · Daily mixed':dailyUp?'Daily up · Weekly mixed':'Trend mixed';

  const last5Volumes=v.slice(-5);
  const prior20Vol=avg(v.slice(-25,-5));
  let max5Rvol=null,max5RvolAgo=null;
  if(Number.isFinite(prior20Vol)&&prior20Vol>0&&last5Volumes.length){
    let max=-Infinity,idx=-1;
    last5Volumes.forEach((vol,i)=>{const ratio=vol/prior20Vol;if(ratio>max){max=ratio;idx=i}});
    max5Rvol=max;
    max5RvolAgo=last5Volumes.length-1-idx;
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

  const recentDown=downVolumeAverage(r,r.length-5,r.length);
  const priorDown=downVolumeAverage(r,r.length-15,r.length-5);
  const sellingPressureFading=Number.isFinite(recentDown)&&Number.isFinite(priorDown)&&recentDown<priorDown*0.82;

  let trendScore=(weeklyUp?15:(last>ma50?8:2))+(dailyUp?15:(last>ma20?8:2));
  let momentumScore=clamp(10+(Number.isFinite(ret5)?ret5:0)*1.2+(Number.isFinite(ret20)?ret20:0)*0.4+(momentumImproving?5:0),0,25);
  const recentVolumeBoost=Number.isFinite(max5Rvol)?Math.max(0,max5Rvol-1):0;
  const directionalVolumeBoost=unusual5dDirection==='positive'?recentVolumeBoost:unusual5dDirection==='mixed'?recentVolumeBoost*0.35:0;
  let volumeScore=clamp(7+directionalVolumeBoost*7+(sellingPressureFading?2:0),0,15);
  let relativeScore=Number.isFinite(rs20)?clamp(6+rs20*0.55,0,12):null;
  // Sector RS is intentionally modest: useful tie-breaker, not a reason to hide an early Recovery.
  let sectorScore=Number.isFinite(sectorRs)?clamp(4+sectorRs*0.45,0,8):null;
  let structureScore=2;
  if(pullback<=-2&&pullback>=-12) structureScore+=7;
  if(Number.isFinite(dist20)&&dist20>=-3&&dist20<=5) structureScore+=3;
  if(Number.isFinite(dist50)&&dist50>-4) structureScore+=4;
  structureScore=clamp(structureScore,0,15);
  const score=clamp(trendScore+momentumScore+volumeScore+(Number.isFinite(relativeScore)?relativeScore:6)+(Number.isFinite(sectorScore)?sectorScore:4)+structureScore,0,100);

  let stage=null;
  const established=weeklyUp&&dailyUp&&Number.isFinite(ret20)&&Number.isFinite(ret60)&&Number.isFinite(rs20)&&(ret20>=10||ret60>=20)&&rs20>2;
  const attractive=weeklyUp&&Number.isFinite(ret5)&&Number.isFinite(ret20)&&Number.isFinite(rs20)&&(dailyUp||(last>ma50&&ret5>0))&&ret20>0&&rs20>-3;
  const recovery=momentumImproving&&Number.isFinite(ret5)&&Number.isFinite(dist50)&&Number.isFinite(rs20)&&ret5>0&&pullback<=-1&&pullback>=-18&&(last>ma50||dist50>-4)&&rs20>-8&&((Number.isFinite(max5Rvol)&&max5Rvol>=0.75&&unusual5dDirection!=='negative')||sellingPressureFading);

  if(established) stage='Established Move';
  else if(attractive) stage='Attractive Growth';
  else if(recovery) stage='Recovery';

  const why=[];
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
    price:round(last,2),ret5:round(ret5),ret20:round(ret20),ret60:round(ret60),rvol:round(rvol,2),\n    lastSession:dayKey(r.at(-1).t),dataAgeDays:round(ageDays(r.at(-1).t),1),
    avgDollarVol:round(dollar20,0),pullback:round(pullback),rs20:round(rs20),sectorRs:round(sectorRs),
    ma20:round(ma20),ma50:round(ma50),dist20:round(dist20),dist50:round(dist50),rsi14:round(rsi14,1),
    weeklyUp,dailyUp,momentumImproving,sellingPressureFading,above50Now,above50Prev5,
    prev5:round(prev5,1),momentumShift:round(momentumShift,1),volumeVsAvg:round(volumeVsAvg,1),trendState,
    unusual5d,max5Rvol:round(max5Rvol,2),max5RvolAgo,spikeReturn:round(spikeReturn,1),unusual5dDirection,unusual5dLabel,
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

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=1800');
  const minDollar=Math.max(1000000,Number(req.query.minDollar||5000000));

  try{
    const idxResults=await mapLimit(INDEXES,4,([s])=>chart(s));
    const idx={};
    idxResults.forEach((x,i)=>{
      const [,name,region]=INDEXES[i];
      if(x.status==='fulfilled'){
        const c=x.value.rows.map(r=>r.close);
        idx[name]={
          symbol:INDEXES[i][0],region,price:round(c.at(-1),2),
          ret5:round(pct(c.at(-1),c.at(-6))),ret20:round(pct(c.at(-1),c.at(-21)))
        };
      }
    });
    const benchmarkBySymbol={};
    idxResults.forEach((x,i)=>{if(x.status==='fulfilled') benchmarkBySymbol[INDEXES[i][0]]=x.value});
    const tsxBenchmark=benchmarkBySymbol['^GSPTSE']||null;

    const sectorSymbols=[...new Set(Object.values(SECTOR_PROXY))];
    const sectorSettled=await mapLimit(sectorSymbols,5,s=>chart(s));
    const sectorMap={};
    sectorSettled.forEach((x,i)=>{
      if(x.status==='fulfilled'){
        const c=x.value.rows.map(r=>r.close);
        sectorMap[sectorSymbols[i]]=pct(c.at(-1),c.at(-21));
      }
    });

    const settled=await mapLimit(UNIQUE_UNIVERSE,8,([s])=>chart(s));
    const liquid=[],candidates=[],unavailable=[],failureDetails=[],rejectedLiquidity=[];

    settled.forEach((x,i)=>{
      const [symbol,company,sector]=UNIQUE_UNIVERSE[i];
      if(x.status!=='fulfilled'){
        unavailable.push(symbol);
        failureDetails.push({symbol,reason:x.reason?.name==='AbortError'?'timeout':String(x.reason?.message||'fetch_failed')});
        return;
      }
      const benchmark=sector==='CDR'?(benchmarkBySymbol[CDR_BENCHMARK[symbol]]||benchmarkBySymbol['^GSPC']||null):tsxBenchmark;
      const m=metrics(x.value,benchmark,sectorMap[SECTOR_PROXY[sector]]);
      if(!m){unavailable.push(symbol);failureDetails.push({symbol,reason:'insufficient_history'});return}
      if(Number.isFinite(m.dataAgeDays)&&m.dataAgeDays>5){unavailable.push(symbol);failureDetails.push({symbol,reason:'stale_data'});return}
      if(!Number.isFinite(m.price)||!Number.isFinite(m.avgDollarVol)){unavailable.push(symbol);failureDetails.push({symbol,reason:'missing_price_or_volume'});return}
      if(m.price<2 || m.avgDollarVol<minDollar){
        rejectedLiquidity.push({symbol,price:m.price,avgDollarVol:m.avgDollarVol});
        return;
      }

      const benchmarkLabel=sector==='CDR'?(CDR_BENCHMARK[symbol]==='^IXIC'?'Nasdaq':'S&P 500'):'TSX';
      const item={symbol,company,sector,benchmarkLabel,...m};
      if(sector==='CDR'&&Array.isArray(item.why)) item.why=item.why.map(w=>w==='outperforming TSX'?`outperforming ${benchmarkLabel}`:w);
      liquid.push(item);
      if(m.stage) candidates.push(item);
    });

    const above50=liquid.filter(x=>x.above50Now===true).length;
    const above50Prev=liquid.filter(x=>x.above50Prev5===true).length;
    const eligibleNow=liquid.filter(x=>x.above50Now!==null).length;
    const eligiblePrev=liquid.filter(x=>x.above50Prev5!==null).length;
    const percentAbove50=eligibleNow?above50/eligibleNow*100:null;
    const percentAbove50Prev5=eligiblePrev?above50Prev/eligiblePrev*100:null;
    const breadthDelta=Number.isFinite(percentAbove50)&&Number.isFinite(percentAbove50Prev5)?percentAbove50-percentAbove50Prev5:null;
    const adv=liquid.filter(x=>(x.ret5||0)>0).length;
    const dec=liquid.filter(x=>(x.ret5||0)<0).length;

    const breadth={
      percentAbove50:round(percentAbove50,0),
      percentAbove50Prev5:round(percentAbove50Prev5,0),
      change5d:round(breadthDelta,0),
      status:breadthLabel(percentAbove50),
      trend:direction(breadthDelta),
      advancers5d:adv,decliners5d:dec,scanned:liquid.length,candidates:candidates.length
    };

    const sectors=sectorSummary(liquid);
    const strongest=sectors[0]||null;
    const weakest=sectors.at(-1)||null;

    const canada20=avg([idx.TSX?.ret20,idx['TSX Venture']?.ret20]);
    const usa20=avg([idx['S&P 500']?.ret20,idx.Nasdaq?.ret20,idx['Dow Jones']?.ret20,idx['Russell 2000']?.ret20]);
    const marketContext={
      canada20:round(canada20,1),
      usa20:round(usa20,1),
      breadthStatus:breadth.status,
      breadthTrend:breadth.trend,
      strongestSector:strongest?.sector||null,
      weakestSector:weakest?.sector||null
    };

    candidates.sort((a,b)=>b.score-a.score);

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
      stageCounts
    };

    res.status(200).json({
      asOf:new Date().toISOString(),minDollar,indexes:idx,breadth,sectors,marketContext,
      items:candidates,unavailable,failureDetails,universeSize:UNIQUE_UNIVERSE.length,diagnostics
    });
  }catch(e){
    res.status(500).json({error:'scan_failed',message:e?.message||'Unknown error'});
  }
}