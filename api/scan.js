const UNIVERSE = [
  // Canadian financials
  ['RY.TO','Royal Bank of Canada','Financials'],['TD.TO','Toronto-Dominion Bank','Financials'],['BMO.TO','Bank of Montreal','Financials'],['BNS.TO','Bank of Nova Scotia','Financials'],['CM.TO','CIBC','Financials'],['NA.TO','National Bank of Canada','Financials'],['MFC.TO','Manulife Financial','Financials'],['SLF.TO','Sun Life Financial','Financials'],['IFC.TO','Intact Financial','Financials'],
  // Energy
  ['CNQ.TO','Canadian Natural Resources','Energy'],['SU.TO','Suncor Energy','Energy'],['CVE.TO','Cenovus Energy','Energy'],['IMO.TO','Imperial Oil','Energy'],['TOU.TO','Tourmaline Oil','Energy'],['ARX.TO','ARC Resources','Energy'],['ENB.TO','Enbridge','Energy'],['TRP.TO','TC Energy','Energy'],
  // Materials / mining
  ['ABX.TO','Barrick Mining','Materials'],['AEM.TO','Agnico Eagle Mines','Materials'],['WPM.TO','Wheaton Precious Metals','Materials'],['NTR.TO','Nutrien','Materials'],['TECK-B.TO','Teck Resources','Materials'],['FM.TO','First Quantum Minerals','Materials'],
  // Industrials
  ['CNR.TO','Canadian National Railway','Industrials'],['CP.TO','Canadian Pacific Kansas City','Industrials'],['WSP.TO','WSP Global','Industrials'],['TFII.TO','TFI International','Industrials'],['ATRL.TO','AtkinsRéalis','Industrials'],
  // Technology
  ['SHOP.TO','Shopify','Technology'],['CSU.TO','Constellation Software','Technology'],['OTEX.TO','OpenText','Technology'],['KXS.TO','Kinaxis','Technology'],['DSG.TO','Descartes Systems','Technology'],
  // Telecom / utilities / consumer
  ['BCE.TO','BCE','Communication'],['T.TO','TELUS','Communication'],['RCI-B.TO','Rogers Communications','Communication'],['FTS.TO','Fortis','Utilities'],['EMA.TO','Emera','Utilities'],['L.TO','Loblaw Companies','Consumer'],['ATD.TO','Alimentation Couche-Tard','Consumer'],['DOL.TO','Dollarama','Consumer'],['QSR.TO','Restaurant Brands International','Consumer'],['MG.TO','Magna International','Consumer'],
  // Canadian-traded CDRs. Yahoo Finance uses the .NE suffix for these Canadian listings.
  ['AAPL.NE','Apple CDR','CDR'],['MSFT.NE','Microsoft CDR','CDR'],['NVDA.NE','Nvidia CDR','CDR'],['AMZN.NE','Amazon CDR','CDR'],['GOOG.NE','Alphabet CDR','CDR'],['META.NE','Meta CDR','CDR'],['TSLA.NE','Tesla CDR','CDR'],['AMD.NE','AMD CDR','CDR'],['COST.NE','Costco CDR','CDR']
];

const INDEXES = [['^GSPTSE','TSX'],['^GSPC','S&P 500'],['^IXIC','Nasdaq']];
const SECTOR_PROXY = {
  Financials:'XFN.TO', Energy:'XEG.TO', Materials:'XMA.TO', Industrials:'XGI.TO',
  Technology:'XIT.TO', Communication:'XTL.TO', Utilities:'XUT.TO', Consumer:'XST.TO', CDR:'^GSPC'
};

function avg(a){const v=a.filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null}
function sma(a,n){return a.length>=n?avg(a.slice(-n)):null}
function pct(a,b){return Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a/b-1)*100:null}
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function round(x,d=2){return Number.isFinite(x)?Number(x.toFixed(d)):null}

async function chart(symbol,range='6mo',interval='1d'){
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const r=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0 MarketHunter/1.0'}});
    if(!r.ok) throw new Error(`${symbol} ${r.status}`);
    const j=await r.json();
    const res=j?.chart?.result?.[0];
    if(!res) throw new Error(`${symbol} unavailable`);
    const q=res.indicators?.quote?.[0]||{};
    const adj=res.indicators?.adjclose?.[0]?.adjclose||q.close||[];
    const rows=(res.timestamp||[]).map((t,i)=>({
      t,close:adj[i]??q.close?.[i],high:q.high?.[i],low:q.low?.[i],volume:q.volume?.[i]
    })).filter(x=>Number.isFinite(x.close));
    return {symbol,rows,currency:res.meta?.currency||null};
  } finally {
    clearTimeout(timer);
  }
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
  const out=[]; let key=null,last=null;
  for(const r of rows){
    const d=new Date(r.t*1000);
    const day=(d.getUTCDay()+6)%7;
    const monday=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-day));
    const k=monday.toISOString().slice(0,10);
    if(k!==key&&last) out.push(last.close);
    key=k; last=r;
  }
  if(last) out.push(last.close);
  return out;
}

function downVolumeAverage(rows,start,end){
  const a=[];
  for(let i=Math.max(1,start);i<Math.min(rows.length,end);i++){
    if(rows[i].close<rows[i-1].close && Number.isFinite(rows[i].volume)) a.push(rows[i].volume);
  }
  return avg(a);
}

function metrics(data,tsxRet20,sectorRet20){
  const r=data.rows,c=r.map(x=>x.close),v=r.map(x=>x.volume||0);
  if(c.length<65) return null;

  const last=c.at(-1),ma20=sma(c,20),ma50=sma(c,50);
  const vol20=avg(v.slice(-20,-1));
  const rvol=vol20?v.at(-1)/vol20:null;
  const dollar20=avg(r.slice(-20).map(x=>x.close*(x.volume||0)));
  const ret5=pct(last,c.at(-6)),ret20=pct(last,c.at(-21)),ret60=pct(last,c.at(-61));
  const high60=Math.max(...c.slice(-60)),pullback=pct(last,high60);
  const w=weeklyCloses(r),w10=sma(w,10),wPrev=w.length>=14?avg(w.slice(-14,-4)):null;
  const weeklyUp=Number.isFinite(w10)&&Number.isFinite(wPrev)&&last>w10&&w10>wPrev;
  const dailyUp=Number.isFinite(ma20)&&Number.isFinite(ma50)&&last>ma20&&ma20>ma50;
  const momentumImproving=Number.isFinite(ret5)&&Number.isFinite(ret20)?ret5>ret20/4:false;
  const rs20=Number.isFinite(tsxRet20)&&Number.isFinite(ret20)?ret20-tsxRet20:null;
  const sectorRs=Number.isFinite(sectorRet20)&&Number.isFinite(ret20)?ret20-sectorRet20:null;
  const dist20=pct(last,ma20),dist50=pct(last,ma50);

  const recentDown=downVolumeAverage(r,r.length-5,r.length);
  const priorDown=downVolumeAverage(r,r.length-15,r.length-5);
  const sellingPressureFading=Number.isFinite(recentDown)&&Number.isFinite(priorDown)&&recentDown<priorDown*0.82;

  let trendScore=(weeklyUp?15:(last>ma50?8:2))+(dailyUp?15:(last>ma20?8:2));
  let momentumScore=clamp(10+(ret5||0)*1.2+(ret20||0)*0.4+(momentumImproving?5:0),0,25);
  let volumeScore=clamp(7+((rvol||1)-1)*10+(sellingPressureFading?2:0),0,15);
  let relativeScore=clamp(7.5+(rs20||0)*0.8,0,15);
  let structureScore=2;
  if(pullback<=-2&&pullback>=-12) structureScore+=7;
  if(Number.isFinite(dist20)&&dist20>=-3&&dist20<=5) structureScore+=3;
  if(Number.isFinite(dist50)&&dist50>-4) structureScore+=4;
  structureScore=clamp(structureScore,0,15);
  const score=clamp(trendScore+momentumScore+volumeScore+relativeScore+structureScore,0,100);

  let stage=null;
  const established=weeklyUp&&dailyUp&&((ret20||0)>=10||(ret60||0)>=20)&&(rs20||0)>2;
  const attractive=weeklyUp&&(dailyUp||(last>ma50&&(ret5||0)>0))&&(ret20||0)>0&&(rs20||0)>-3;
  const recovery=momentumImproving&&(ret5||0)>0&&pullback<=-1&&pullback>=-18&&(last>ma50||(dist50||-99)>-4)&&(rs20||0)>-8&&((rvol||1)>=0.75||sellingPressureFading);

  if(established) stage='Established Move';
  else if(attractive) stage='Attractive Growth';
  else if(recovery) stage='Recovery';

  const why=[];
  if(sellingPressureFading) why.push('selling volume fading');
  if(momentumImproving) why.push('momentum improving');
  if((rvol||0)>=1.4) why.push(`volume ${round(rvol,1)}× normal`);
  if((rs20||0)>2) why.push('outperforming TSX');
  if(pullback<=-2&&pullback>=-12) why.push(`${Math.abs(round(pullback,1))}% off recent high`);
  if(dailyUp&&weeklyUp) why.push('daily + weekly trend aligned');
  if(!why.length) why.push('structure moved into the scan threshold');

  return {
    price:round(last,2),ret5:round(ret5),ret20:round(ret20),ret60:round(ret60),rvol:round(rvol,2),
    avgDollarVol:round(dollar20,0),pullback:round(pullback),rs20:round(rs20),sectorRs:round(sectorRs),
    ma20:round(ma20),ma50:round(ma50),dist20:round(dist20),dist50:round(dist50),
    weeklyUp,dailyUp,momentumImproving,sellingPressureFading,
    score:round(score,1),stage,why:why.slice(0,3),
    components:{
      trend:round(trendScore,1),momentum:round(momentumScore,1),volume:round(volumeScore,1),
      relative:round(relativeScore,1),structure:round(structureScore,1)
    }
  };
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=1800');
  const minDollar=Math.max(1000000,Number(req.query.minDollar||5000000));

  try{
    const idxResults=await mapLimit(INDEXES,3,([s])=>chart(s));
    const idx={};
    idxResults.forEach((x,i)=>{
      if(x.status==='fulfilled'){
        const c=x.value.rows.map(r=>r.close);
        idx[INDEXES[i][1]]={
          symbol:INDEXES[i][0],price:round(c.at(-1),2),
          ret5:round(pct(c.at(-1),c.at(-6))),ret20:round(pct(c.at(-1),c.at(-21)))
        };
      }
    });
    const tsxRet20=idx.TSX?.ret20??0;

    const sectorSymbols=[...new Set(Object.values(SECTOR_PROXY))];
    const sectorSettled=await mapLimit(sectorSymbols,5,s=>chart(s));
    const sectorMap={};
    sectorSettled.forEach((x,i)=>{
      if(x.status==='fulfilled'){
        const c=x.value.rows.map(r=>r.close);
        sectorMap[sectorSymbols[i]]=pct(c.at(-1),c.at(-21));
      }
    });

    const settled=await mapLimit(UNIVERSE,8,([s])=>chart(s));
    const liquid=[],candidates=[],unavailable=[];

    settled.forEach((x,i)=>{
      const [symbol,company,sector]=UNIVERSE[i];
      if(x.status!=='fulfilled'){unavailable.push(symbol);return}
      const m=metrics(x.value,tsxRet20,sectorMap[SECTOR_PROXY[sector]]);
      if(!m){unavailable.push(symbol);return}
      if((m.price||0)<2 || (m.avgDollarVol||0)<minDollar) return;

      const item={symbol,company,sector,...m};
      liquid.push(item);
      if(m.stage) candidates.push(item);
    });

    const above50=liquid.filter(x=>x.price>x.ma50).length;
    const adv=liquid.filter(x=>(x.ret5||0)>0).length;
    const dec=liquid.filter(x=>(x.ret5||0)<0).length;
    const breadth={
      percentAbove50:liquid.length?round(above50/liquid.length*100,0):null,
      advancers5d:adv,decliners5d:dec,scanned:liquid.length,candidates:candidates.length
    };

    candidates.sort((a,b)=>b.score-a.score);

    res.status(200).json({
      asOf:new Date().toISOString(),minDollar,indexes:idx,breadth,
      items:candidates,unavailable,universeSize:UNIVERSE.length
    });
  }catch(e){
    res.status(500).json({error:'scan_failed',message:e?.message||'Unknown error'});
  }
}