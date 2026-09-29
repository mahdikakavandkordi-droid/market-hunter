const FILES=Object.freeze({
  daily:'daily-market-report.json',
  pulse:'market-pulse-report.json',
  v2:'v2-latest-scan.json'
});
function valid(kind,data){
  if(!data||typeof data!=='object'||!Number.isFinite(Date.parse(data.generatedAt)))return false;
  if(kind==='daily')return Boolean(data.asOf?.latest)&&Array.isArray(data.groups);
  if(kind==='pulse')return Array.isArray(data.markets)&&data.markets.length>0;
  if(kind==='v2')return Array.isArray(data.integratedSurfacePicks)&&data.integratedSurfacePicks.length<=6;
  return false;
}
export default async function handler(req,res){
  if((req.method||'GET')!=='GET')return res.status(405).json({error:'method_not_allowed'});
  const kind=String(req.query?.kind||'');
  const file=FILES[kind];
  if(!file)return res.status(400).json({error:'invalid_research_data_kind'});
  try{
    const minute=Math.floor(Date.now()/60000);
    const url='https://raw.githubusercontent.com/mahdikakavandkordi-droid/market-hunter/main/data/'+file+'?v='+minute;
    const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw new Error('upstream_'+r.status);
    const data=await r.json();
    if(!valid(kind,data))throw new Error('invalid_research_data');
    res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=120');
    res.setHeader('X-Market-Hunter-Source','github-main');
    return res.status(200).json(data);
  }catch(e){
    res.setHeader('Cache-Control','no-store');
    return res.status(503).json({error:'research_data_unavailable',message:e.message});
  }
}
