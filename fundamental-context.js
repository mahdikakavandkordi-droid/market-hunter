window.MHFundamentals=(()=>{
  const issuers={'BHC.TO':'0000885590','SSRM.TO':'0000921638','META.TO':'0001326801','MSFT.TO':'0000789019'};
  const validTime=v=>typeof v==='string'&&/T.*Z$/.test(v)&&Number.isFinite(Date.parse(v));
  const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
  const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<1800;
  function reading(data,symbol,language='en',now=new Date()){
    const unavailable={status:'unavailable',reason:data?'not-covered':'source-unavailable'};
    if(data?.version!=='fundamental-context-v1'||!validTime(data.reviewedAt)||Date.parse(data.reviewedAt)>now.getTime())return unavailable;
    if(!Array.isArray(data.items)||!Number.isFinite(now.getTime()))return unavailable;
    const matches=data.items.filter(x=>x?.symbol===symbol);
    if(matches.length!==1)return unavailable;
    const x=matches[0];
    const reviewedAt=x.reviewedAt??data.reviewedAt;
    if(!validTime(reviewedAt)||Date.parse(reviewedAt)>now.getTime())return unavailable;
    if(!x||issuers[symbol]!==x.cik||x.status!=='complete'||!validDate(x.period?.end)||!validDate(x.filed)||!validTime(x.acceptedAt)||x.period.end>reviewedAt.slice(0,10)||Date.parse(x.acceptedAt)>Date.parse(reviewedAt))return unavailable;
    if(!['quarter','fiscal-year'].includes(x.period.basis))return unavailable;
    let url;try{url=new URL(x.sourceUrl)}catch{return unavailable}
    if(url.protocol!=='https:'||url.hostname!=='www.sec.gov'||url.username||url.password||!url.pathname.startsWith(`/Archives/edgar/data/${Number(x.cik)}/`))return unavailable;
    const r=x.reading?.[language==='fa'?'fa':'en'];
    if(!r||![r.context,r.summary,r.uncertainty].every(text)||!Array.isArray(r.monitoring)||r.monitoring.length!==2||!r.monitoring.every(text)||!r.evidence?.includes('revenue')||!r.evidence?.includes('operatingIncome')||!r.evidence?.includes('operatingCash'))return unavailable;
    if(r.instrumentNote!==null&&r.instrumentNote!==undefined&&!text(r.instrumentNote))return unavailable;
    const oldPeriod=(now.getTime()-Date.parse(x.period.end))/86400000>(x.period.basis==='fiscal-year'?450:180);
    return {...r,status:oldPeriod?'older-period':'available',sourceUrl:url.href,period:x.period,filed:x.filed,reviewedAt,issuer:x.issuer};
  }
  return {reading};
})();
