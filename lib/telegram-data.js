const OWNER='mahdikakavandkordi-droid';
const REPO='market-hunter';
const DEFAULT_REF='main';
const RAW_BASE='https://raw.githubusercontent.com/'+OWNER+'/'+REPO+'/';
const API_BASE='https://api.github.com/repos/'+OWNER+'/'+REPO;

async function fetchJson(url,{timeout=7000,headers={}}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetch(url,{
      signal:controller.signal,
      cache:'no-store',
      headers:{'User-Agent':'Market-Hunter-Telegram/1.0','Accept':'application/json',...headers}
    });
    if(!response.ok)throw new Error('upstream_'+response.status);
    return await response.json();
  }finally{
    clearTimeout(timer);
  }
}

export async function loadScan(ref=DEFAULT_REF){
  return fetchJson(RAW_BASE+encodeURIComponent(ref)+'/data/v2-latest-scan.json');
}

export async function loadPulse(ref=DEFAULT_REF){
  return fetchJson(RAW_BASE+encodeURIComponent(ref)+'/data/market-pulse-latest.json');
}

export async function loadDailyReport(ref=DEFAULT_REF){
  return fetchJson(RAW_BASE+encodeURIComponent(ref)+'/data/daily-market-report.json');
}

export async function loadPreviousScan(){
  const commits=await fetchJson(API_BASE+'/commits?path='+encodeURIComponent('data/v2-latest-scan.json')+'&per_page=6');
  if(!Array.isArray(commits)||commits.length<2)return null;

  // A workflow can write the same market date more than once. Compare with the
  // latest genuinely earlier package rather than blindly using the previous commit.
  const current=await loadScan();
  for(const commit of commits.slice(1)){
    const sha=commit?.sha;
    if(!sha)continue;
    try{
      const prior=await loadScan(sha);
      if(prior?.marketAsOf&&prior.marketAsOf!==current?.marketAsOf)return prior;
      if(prior?.generatedAt&&prior.generatedAt!==current?.generatedAt&&prior?.engineCommit!==current?.engineCommit)return prior;
    }catch{}
  }
  return null;
}

function supabaseBase(){
  return String(process.env.SUPABASE_URL||'https://ivmpzyjxyfcefjyylybr.supabase.co').replace(/\/$/,'');
}

function portfolioEnvSnapshot(){
  const raw=process.env.TELEGRAM_PORTFOLIO_SNAPSHOT_JSON;
  if(!raw)return null;
  try{
    const parsed=JSON.parse(raw);
    return parsed&&typeof parsed==='object'?parsed:null;
  }catch{
    return null;
  }
}

export async function loadPortfolioSnapshot(){
  const envSnapshot=portfolioEnvSnapshot();
  if(envSnapshot)return envSnapshot;

  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const userId=process.env.TELEGRAM_PORTFOLIO_USER_ID;
  if(!serviceKey||!userId)return null;

  const url=supabaseBase()+
    '/rest/v1/market_hunter_portfolio_snapshots?user_id=eq.'+encodeURIComponent(userId)+
    '&select=market_as_of,payload,revision,updated_at&order=market_as_of.desc&limit=1';
  const rows=await fetchJson(url,{
    headers:{
      apikey:serviceKey,
      Authorization:'Bearer '+serviceKey
    }
  });
  const row=Array.isArray(rows)?rows[0]:null;
  if(!row?.payload)return null;
  return {
    ...row.payload,
    marketAsOf:row.market_as_of||row.payload.marketAsOf||null,
    cloudRevision:row.revision??null,
    cloudUpdatedAt:row.updated_at||null
  };
}

export async function loadBotBundle(){
  const [scan,pulse,report]=await Promise.all([loadScan(),loadPulse(),loadDailyReport()]);
  return {scan,pulse,report};
}
