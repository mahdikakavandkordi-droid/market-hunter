import crypto from 'node:crypto';

const SUPABASE_URL='https://ivmpzyjxyfcefjyylybr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_yy1QKQRcgf2ny3aWhhHSkw_Z7Y0Fa55';

export function allowedTelegramIds(){
  return String(process.env.TELEGRAM_ALLOWED_USER_ID||'')
    .split(',').map(x=>x.trim()).filter(Boolean);
}

export function primaryTelegramUserId(){
  return allowedTelegramIds()[0]||null;
}

export function portfolioBridgeConfigured(){
  return Boolean(process.env.TELEGRAM_BOT_TOKEN&&primaryTelegramUserId());
}

export function derivePortfolioBridgeToken(userId=primaryTelegramUserId()){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  const id=String(userId||'').trim();
  if(!token||!id)return null;
  return crypto.createHmac('sha256',token)
    .update('market-hunter-portfolio-bridge:v1:'+id)
    .digest('base64url');
}

export function verifyPortfolioBridgeToken(userId,value){
  const expected=derivePortfolioBridgeToken(userId);
  const actual=String(value||'');
  if(!expected||expected.length!==actual.length)return false;
  return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(actual));
}

async function rpc(name,body){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+name,{
      method:'POST',
      signal:controller.signal,
      headers:{
        apikey:SUPABASE_PUBLISHABLE_KEY,
        'Content-Type':'application/json',
        Accept:'application/json'
      },
      body:JSON.stringify(body)
    });
    if(!response.ok){
      const data=await response.json().catch(()=>({}));
      throw new Error(String(data?.message||data?.hint||'portfolio_bridge_'+response.status));
    }
    if(response.status===204)return null;
    const text=await response.text();
    return text?JSON.parse(text):null;
  }finally{
    clearTimeout(timer);
  }
}

export async function pairPortfolioBridge(userId=primaryTelegramUserId()){
  const token=derivePortfolioBridgeToken(userId);
  if(!token||!userId)return false;
  const ok=await rpc('market_hunter_bridge_pair',{
    p_telegram_user_id:Number(userId),
    p_token:token
  });
  return ok===true;
}

export async function putPortfolioBridge(payload,userId=primaryTelegramUserId(),token=derivePortfolioBridgeToken(userId)){
  if(!token||!userId)return false;
  const ok=await rpc('market_hunter_bridge_put',{
    p_telegram_user_id:Number(userId),
    p_token:token,
    p_payload:payload
  });
  return ok===true;
}

export async function getPortfolioBridge(userId=primaryTelegramUserId()){
  const token=derivePortfolioBridgeToken(userId);
  if(!token||!userId)return null;
  return rpc('market_hunter_bridge_get',{
    p_telegram_user_id:Number(userId),
    p_token:token
  });
}

export function portfolioPairUrl(userId=primaryTelegramUserId()){
  const token=derivePortfolioBridgeToken(userId);
  if(!token||!userId)return null;
  const base=String(process.env.MARKET_HUNTER_PUBLIC_BASE||'https://market-hunter-five.vercel.app').replace(/\/$/,'');
  const qs=new URLSearchParams({portfolioBridge:'1',user_id:String(userId),sig:token});
  return base+'/?'+qs.toString()+'#portfolio';
}

export async function getPortfolioBridgeBundle(userId=primaryTelegramUserId(),token=derivePortfolioBridgeToken(userId)){
  if(!token||!userId)return null;
  const rows=await rpc('market_hunter_bridge_get_bundle',{
    p_telegram_user_id:Number(userId),
    p_token:token
  });
  return Array.isArray(rows)?rows[0]||null:null;
}

export async function putPortfolioBridgeBundle(
  payload,
  dailyPayload,
  expectedRevision=null,
  userId=primaryTelegramUserId(),
  token=derivePortfolioBridgeToken(userId)
){
  if(!token||!userId)return null;
  const rows=await rpc('market_hunter_bridge_put_bundle',{
    p_telegram_user_id:Number(userId),
    p_token:token,
    p_payload:payload,
    p_daily_payload:dailyPayload??null,
    p_expected_revision:Number.isInteger(expectedRevision)?expectedRevision:null
  });
  return Array.isArray(rows)?rows[0]||null:null;
}
