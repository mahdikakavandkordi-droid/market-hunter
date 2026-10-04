function torontoDate(value){
  const d=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(d.getTime()))return null;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(d).map(x=>[x.type,x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function decorateIntradaySnapshot(data,now=new Date()){
  const capturedAt=Date.parse(data?.capturedAt||'');
  const ageMinutes=Number.isFinite(capturedAt)?Math.max(0,(now.getTime()-capturedAt)/60000):null;
  const benchmark=data?.quotes?.['^GSPTSE']||null;
  const nowSec=now.getTime()/1000;
  const sameSession=benchmark?.sessionDate&&benchmark.sessionDate===torontoDate(now);
  const withinSession=Number.isFinite(Number(benchmark?.sessionStart))&&Number.isFinite(Number(benchmark?.sessionEnd))&&
    nowSec>=Number(benchmark.sessionStart)&&nowSec<Number(benchmark.sessionEnd);
  const snapshotFresh=Number.isFinite(ageMinutes)&&ageMinutes<=90;
  const currentMarketOpen=Boolean(sameSession&&withinSession&&snapshotFresh&&!benchmark?.stale);
  const currentStatus=currentMarketOpen?'live':
    snapshotFresh&&sameSession?'recent_snapshot':'stale_snapshot';

  return {
    ...data,
    marketOpenAtCapture:Boolean(data?.marketOpen),
    provisionalAtCapture:Boolean(data?.provisional),
    captureState:{
      capturedAt:data?.capturedAt||null,
      sessionDate:data?.sessionDate||null,
      marketOpen:Boolean(data?.marketOpen),
      provisional:Boolean(data?.provisional)
    },
    currentState:{
      asOf:now.toISOString(),
      sessionDate:torontoDate(now),
      marketOpen:currentMarketOpen,
      snapshotFresh,
      ageMinutes:Number.isFinite(ageMinutes)?ageMinutes:null,
      status:currentStatus
    }
  };
}

export default async function handler(req,res){
  try{
    const r=await fetch('https://raw.githubusercontent.com/mahdikakavandkordi-droid/market-hunter/data/intraday-quotes/data/intraday.json',{signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw Error('Hourly snapshot not available yet');
    const data=await r.json();
    if(data.version!=='intraday-v1'||!data.quotes||!Number.isFinite(Date.parse(data.capturedAt)))throw Error('Invalid hourly snapshot');
    const decorated=decorateIntradaySnapshot(data,new Date());
    res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=60');
    res.status(200).json(decorated);
  }catch(e){res.setHeader('Cache-Control','no-store');res.status(503).json({error:'intraday_unavailable',message:e.message});}
}
