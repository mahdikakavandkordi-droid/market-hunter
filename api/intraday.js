export default async function handler(req,res){
  try{
    const r=await fetch('https://raw.githubusercontent.com/mahdikakavandkordi-droid/market-hunter/data/intraday-quotes/data/intraday.json',{signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw Error('Hourly snapshot not available yet');
    const data=await r.json();
    if(data.version!=='intraday-v1'||!data.quotes||!Number.isFinite(Date.parse(data.capturedAt)))throw Error('Invalid hourly snapshot');
    res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=60');
    res.status(200).json(data);
  }catch(e){res.setHeader('Cache-Control','no-store');res.status(503).json({error:'intraday_unavailable',message:e.message});}
}
