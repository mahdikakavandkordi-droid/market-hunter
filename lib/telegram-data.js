import { getPortfolioBridgeBundle, putPortfolioBridgeBundle, pairPortfolioBridge, portfolioBridgeConfigured } from './portfolio-bridge.js';
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

export async function loadRecentScans(limit=5){
  const max=Math.max(2,Math.min(5,Number(limit)||5));
  const current=await loadScan();
  const byDate=new Map();
  if(current?.marketAsOf)byDate.set(String(current.marketAsOf),current);

  const commits=await fetchJson(API_BASE+'/commits?path='+encodeURIComponent('data/v2-latest-scan.json')+'&per_page=30');
  if(Array.isArray(commits)){
    for(const commit of commits){
      if(byDate.size>=max)break;
      const sha=commit?.sha;
      if(!sha)continue;
      try{
        const scan=await loadScan(sha);
        const date=String(scan?.marketAsOf||'');
        if(date&&!byDate.has(date))byDate.set(date,scan);
      }catch{}
    }
  }

  return [...byDate.entries()]
    .sort((a,b)=>a[0].localeCompare(b[0]))
    .slice(-max)
    .map(([,scan])=>scan);
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

function visiblePortfolioPositions(payload){
  const records=payload?.positions&&typeof payload.positions==='object'?payload.positions:{};
  const out=[];
  for(const [key,record] of Object.entries(records)){
    const value=record&&typeof record==='object'&&('value' in record||'deleted' in record)
      ?(record.deleted?null:record.value)
      :record;
    if(!value||typeof value!=='object')continue;
    const symbol=String(value.symbol||key||'').trim().toUpperCase();
    if(!symbol)continue;
    out.push({...value,symbol});
  }
  return out.sort((a,b)=>a.symbol.localeCompare(b.symbol));
}

function appBase(){
  if(process.env.MARKET_HUNTER_API_BASE)return String(process.env.MARKET_HUNTER_API_BASE).replace(/\/$/,'');
  if(process.env.MARKET_HUNTER_PUBLIC_BASE)return String(process.env.MARKET_HUNTER_PUBLIC_BASE).replace(/\/$/,'');
  // Never call VERCEL_URL here: deployment URLs can be protected even when
  // the canonical production alias is public, which causes server-to-server 401s.
  return 'https://market-hunter-five.vercel.app';
}

async function loadCloudRows(serviceKey,userId){
  const headers={apikey:serviceKey,Authorization:'Bearer '+serviceKey};
  const stateUrl=supabaseBase()+
    '/rest/v1/market_hunter_portfolio_state?user_id=eq.'+encodeURIComponent(userId)+
    '&select=payload,revision,updated_at&limit=1';
  const snapshotUrl=supabaseBase()+
    '/rest/v1/market_hunter_portfolio_snapshots?user_id=eq.'+encodeURIComponent(userId)+
    '&select=market_as_of,payload,revision,updated_at&order=market_as_of.desc&limit=1';
  const [stateRows,snapshotRows]=await Promise.all([
    fetchJson(stateUrl,{headers}),
    fetchJson(snapshotUrl,{headers})
  ]);
  return {
    state:Array.isArray(stateRows)?stateRows[0]||null:null,
    snapshot:Array.isArray(snapshotRows)?snapshotRows[0]||null:null
  };
}

function snapshotFromBundle(bundle){
  const daily=bundle?.daily_payload;
  const savedItems=Array.isArray(daily?.currentItems)?daily.currentItems:[];
  if(!savedItems.length)return null;
  const positions=visiblePortfolioPositions(bundle?.payload);
  const positionBySymbol=new Map(positions.map(x=>[x.symbol,x]));
  return {
    marketAsOf:daily.currentDate||savedItems[0]?.asOf||null,
    generatedAt:daily?.currentMeta?.capturedAt||bundle?.updated_at||null,
    items:savedItems.map(x=>({...x,position:positionBySymbol.get(x.symbol)||null})),
    failures:daily?.lastAttempt?.failures||[],
    portfolioAnalytics:daily?.portfolioAnalytics||null,
    cloudRevision:bundle?.revision??null,
    cloudUpdatedAt:bundle?.updated_at||null,
    source:'telegram-bridge-backend-snapshot'
  };
}

function dailyPayloadFromLive(bundle,live){
  const prior=bundle?.daily_payload&&typeof bundle.daily_payload==='object'?bundle.daily_payload:{};
  const currentDate=live?.marketAsOf||null;
  const currentItems=Array.isArray(live?.items)?live.items:[];
  const symbols=currentItems.map(x=>x.symbol).filter(Boolean);
  const capturedAt=live?.generatedAt||new Date().toISOString();
  const sameDay=prior?.currentDate&&prior.currentDate===currentDate;
  return {
    previousDate:sameDay?(prior.previousDate||null):(prior.currentDate||prior.previousDate||null),
    previousItems:sameDay?(prior.previousItems||[]):(Array.isArray(prior.currentItems)?prior.currentItems:(prior.previousItems||[])),
    currentDate,
    currentItems,
    currentComplete:true,
    currentMeta:{
      complete:true,
      requestedSymbols:symbols,
      portfolioSymbols:symbols,
      portfolioEmpty:symbols.length===0,
      portfolioContextKey:symbols.join('|'),
      capturedAt,
      sourceGeneratedAt:capturedAt
    },
    lastAttempt:{
      status:'complete',
      complete:true,
      date:currentDate,
      requestedSymbols:symbols,
      returnedSymbols:symbols,
      failures:Array.isArray(live?.failures)?live.failures:[],
      capturedAt,
      sourceGeneratedAt:capturedAt
    },
    portfolioAnalytics:live?.portfolioAnalytics||null
  };
}

async function refreshPortfolioFromState(stateRow){
  const positions=visiblePortfolioPositions(stateRow?.payload);
  if(!positions.length)return null;
  const symbols=positions.map(x=>x.symbol);
  const entries=positions
    .filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x.boughtAt||''))&&Number(x.entryPrice)>0)
    .map(x=>[x.symbol,x.boughtAt,Number(x.entryPrice)].join('|'));
  const quantities=positions
    .filter(x=>Number(x.quantity)>0)
    .map(x=>[x.symbol,Number(x.quantity)].join('|'));
  const qs=new URLSearchParams({symbols:symbols.join(',')});
  if(entries.length)qs.set('entries',entries.join(','));
  if(quantities.length)qs.set('positions',quantities.join(','));
  const live=await fetchJson(appBase()+'/api/portfolio?'+qs.toString(),{timeout:12000});
  const positionBySymbol=new Map(positions.map(x=>[x.symbol,x]));
  return {
    marketAsOf:(live.items||[]).map(x=>x.asOf).filter(Boolean).sort().at(-1)||null,
    generatedAt:live.generatedAt||new Date().toISOString(),
    items:(live.items||[]).map(x=>({...x,position:positionBySymbol.get(x.symbol)||null})),
    failures:live.failures||[],
    portfolioAnalytics:live.portfolioAnalytics||null,
    cloudRevision:stateRow?.revision??null,
    cloudUpdatedAt:stateRow?.updated_at||null,
    source:'cloud-state-live'
  };
}

export async function loadPortfolioSnapshot(){
  const envSnapshot=portfolioEnvSnapshot();
  if(envSnapshot)return envSnapshot;

  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const userId=process.env.TELEGRAM_PORTFOLIO_USER_ID;
  if(serviceKey&&userId){
    const {state,snapshot}=await loadCloudRows(serviceKey,userId);
    if(state?.payload){
      try{
        const live=await refreshPortfolioFromState(state);
        if(live)return live;
      }catch{}
    }
    if(snapshot?.payload){
      return {
        ...snapshot.payload,
        marketAsOf:snapshot.market_as_of||snapshot.payload.marketAsOf||null,
        cloudRevision:snapshot.revision??null,
        cloudUpdatedAt:snapshot.updated_at||null,
        source:'cloud-snapshot'
      };
    }
  }

  if(portfolioBridgeConfigured()){
    try{
      await pairPortfolioBridge();
      const [bundle,latestScan]=await Promise.all([
        getPortfolioBridgeBundle(),
        loadScan().catch(()=>null)
      ]);
      const saved=snapshotFromBundle(bundle);
      const expectedDate=latestScan?.marketAsOf||null;
      const savedFresh=Boolean(saved&&(!expectedDate||String(saved.marketAsOf||'')>=String(expectedDate)));

      if(savedFresh)return saved;

      if(bundle?.payload){
        try{
          const live=await refreshPortfolioFromState({
            payload:bundle.payload,
            revision:bundle.revision,
            updated_at:bundle.updated_at
          });
          if(live){
            const fresh={...live,source:saved?'telegram-bridge-auto-refresh':'telegram-bridge-live-fallback'};
            try{
              const nextDaily=dailyPayloadFromLive(bundle,fresh);
              const savedWrite=await putPortfolioBridgeBundle(
                bundle.payload,
                nextDaily,
                Number.isInteger(bundle.revision)?bundle.revision:null
              );
              if(savedWrite?.ok){
                fresh.cloudRevision=savedWrite.revision;
                fresh.cloudUpdatedAt=savedWrite.updated_at||fresh.cloudUpdatedAt;
              }
            }catch(error){
              console.error('telegram_portfolio_backend_write_failed',String(error?.message||error));
            }
            return fresh;
          }
        }catch(error){
          console.error('telegram_portfolio_live_refresh_failed',String(error?.message||error));
        }
      }

      // A failed live refresh must never hide an already-valid backend snapshot.
      if(saved)return {...saved,source:'telegram-bridge-stale-fallback'};
    }catch(error){
      console.error('telegram_portfolio_load_failed',String(error?.message||error));
    }
  }

  return null;
}

export async function loadStockLive(symbol){
  const clean=String(symbol||'').trim().toUpperCase();
  if(!/^[A-Z0-9.^-]{1,16}$/.test(clean))return null;
  try{
    const data=await fetchJson(appBase()+'/api/portfolio?symbols='+encodeURIComponent(clean),{timeout:12000});
    return (data?.items||[]).find(x=>x.symbol===clean)||null;
  }catch{
    return null;
  }
}

export async function loadBotBundle(){
  const [scan,pulse,report]=await Promise.all([loadScan(),loadPulse(),loadDailyReport()]);
  return {scan,pulse,report};
}
