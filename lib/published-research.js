export function validResearch(kind,data){
  if(!data||typeof data!=='object'||!Number.isFinite(Date.parse(data.generatedAt)))return false;
  if(kind==='daily')return Boolean(data.asOf?.latest)&&Array.isArray(data.groups);
  if(kind==='pulse')return Array.isArray(data.markets)&&data.markets.length>0;
  if(kind==='v2'){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data.marketAsOf||'')||!Array.isArray(data.integratedSurfacePicks)||data.integratedSurfacePicks.length>6)return false;
    if(data.all!==undefined&&!Array.isArray(data.all))return false;
    const surfaces=Object.values(data.surfacePicks||{});
    if(surfaces.some(x=>!Array.isArray(x)))return false;
    return [...(data.all||[]),...data.integratedSurfacePicks,...surfaces.flat()].every(row=>row?.date===data.marketAsOf);
  }
  return false;
}

// A mutable branch's raw CDN can lag the already-deployed, validated package.
// Never let that older response regress the deployed session or build timestamp.
export function choosePublishedResearch(kind,remote,deployed){
  if(!validResearch(kind,remote)){
    if(validResearch(kind,deployed))return {data:deployed,source:'deployment-snapshot',warning:'invalid_upstream_snapshot'};
    throw new Error('invalid_research_data');
  }
  if(!validResearch(kind,deployed))return {data:remote,source:'github-main'};
  const older=kind==='v2'&&remote.marketAsOf!==deployed.marketAsOf
    ?remote.marketAsOf<deployed.marketAsOf
    :Date.parse(remote.generatedAt)<Date.parse(deployed.generatedAt);
  return older?{data:deployed,source:'deployment-snapshot'}:{data:remote,source:'github-main'};
}
