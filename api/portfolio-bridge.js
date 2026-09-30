import {
  primaryTelegramUserId,verifyPortfolioBridgeToken,pairPortfolioBridge,putPortfolioBridge
} from '../lib/portfolio-bridge.js';

function cookieValue(req,name){
  const raw=String(req.headers?.cookie||'');
  for(const part of raw.split(';')){
    const [k,...rest]=part.trim().split('=');
    if(k===name)return decodeURIComponent(rest.join('=')||'');
  }
  return '';
}

function visiblePositionCount(payload){
  const records=payload?.positions&&typeof payload.positions==='object'?payload.positions:{};
  let count=0;
  for(const record of Object.values(records)){
    if(!record||typeof record!=='object')continue;
    if('deleted' in record||'value' in record){
      if(!record.deleted&&record.value?.symbol)count++;
    }else if(record.symbol)count++;
  }
  return count;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const userId=primaryTelegramUserId();
  const token=cookieValue(req,'mh_portfolio_bridge');
  if(!userId||!verifyPortfolioBridgeToken(userId,token)){
    return res.status(401).json({ok:false,connected:false});
  }

  try{
    const paired=await pairPortfolioBridge(userId);
    if(!paired)return res.status(409).json({ok:false,error:'pairing_conflict'});

    if(req.method==='GET'){
      return res.status(200).json({ok:true,connected:true});
    }
    if(req.method!=='POST')return res.status(405).json({ok:false,error:'method_not_allowed'});

    const payload=req.body?.payload;
    if(!payload||typeof payload!=='object'||Array.isArray(payload)){
      return res.status(400).json({ok:false,error:'invalid_payload'});
    }
    const ok=await putPortfolioBridge(payload,userId,token);
    if(!ok)return res.status(409).json({ok:false,error:'bridge_write_failed'});
    return res.status(200).json({ok:true,connected:true,positions:visiblePositionCount(payload)});
  }catch(error){
    return res.status(500).json({ok:false,error:String(error?.message||'bridge_failed')});
  }
}
