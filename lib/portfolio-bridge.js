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

async function bridgeRequest(op,{userId,token,payload,dailyPayload,expectedRevision}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch(SUPABASE_URL+'/functions/v1/market-hunter-portfolio-bridge',{
      method:'POST',
      signal:controller.signal,
      headers:{
        apikey:SUPABASE_PUBLISHABLE_KEY,
        'Content-Type':'application/json',
        Accept:'application/json'
      },
      body:JSON.stringify({
        op,
        userId:Number(userId),
        token,
        ...(payload!==undefined?{payload}:{}),
        ...(dailyPayload!==undefined?{dailyPayload}:{}),
        ...(Number.isInteger(expectedRevision)?{expectedRevision}:{})
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.ok===false){
      const error=new Error(String(data?.error||'portfolio_bridge_'+response.status));
      error.status=response.status;
      throw error;
    }
    return data;
  }finally{
    clearTimeout(timer);
  }
}

export async function pairPortfolioBridge(userId=primaryTelegramUserId()){
  const token=derivePortfolioBridgeToken(userId);
  if(!token||!userId)return false;
  const data=await bridgeRequest('pair',{userId,token});
  return data?.ok===true;
}

export async function putPortfolioBridge(payload,userId=primaryTelegramUserId(),token=derivePortfolioBridgeToken(userId)){
  if(!token||!userId)return false;
  const data=await bridgeRequest('put',{userId,token,payload,dailyPayload:null});
  return data?.ok===true;
}

export async function getPortfolioBridge(userId=primaryTelegramUserId()){
  const token=derivePortfolioBridgeToken(userId);
  if(!token||!userId)return null;
  const data=await bridgeRequest('get',{userId,token});
  return data?.payload||null;
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
  const data=await bridgeRequest('get',{userId,token});
  if(!data?.ok)return null;
  return {
    payload:data.payload||null,
    daily_payload:data.dailyPayload||null,
    revision:Number(data.revision||0),
    updated_at:data.updatedAt||null
  };
}

export async function putPortfolioBridgeBundle(
  payload,
  dailyPayload,
  expectedRevision=null,
  userId=primaryTelegramUserId(),
  token=derivePortfolioBridgeToken(userId)
){
  if(!token||!userId)return null;
  try{
    const data=await bridgeRequest('put',{
      userId,token,payload,dailyPayload:dailyPayload??null,
      expectedRevision:Number.isInteger(expectedRevision)?expectedRevision:undefined
    });
    return {
      ok:data?.ok===true,
      revision:Number(data?.revision||0),
      updated_at:data?.updatedAt||null
    };
  }catch(error){
    if(error?.status===409)return {ok:false,conflict:true};
    throw error;
  }
}
