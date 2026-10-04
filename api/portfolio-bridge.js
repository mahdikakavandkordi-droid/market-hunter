import {
  primaryTelegramUserId,verifyPortfolioBridgeToken,pairPortfolioBridge,
  getPortfolioBridgeBundle,putPortfolioBridgeBundle
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
  const cookieToken=cookieValue(req,'mh_portfolio_bridge');
  const bodyUserId=String(req.body?.user_id||'').trim();
  const bodyToken=String(req.body?.sig||'').trim();
  const token=verifyPortfolioBridgeToken(userId,cookieToken)
    ?cookieToken
    :(bodyUserId===String(userId||'')&&verifyPortfolioBridgeToken(userId,bodyToken)?bodyToken:'');
  if(!userId||!token){
    return res.status(401).json({ok:false,connected:false});
  }

  try{
    const paired=await pairPortfolioBridge(userId);
    if(!paired)return res.status(409).json({ok:false,error:'pairing_conflict'});

    // Restore is authenticated exactly like writes, but never calls put.
    if(req.method==='GET'||(req.method==='POST'&&req.body?.action==='restore')){
      const bundle=await getPortfolioBridgeBundle(userId,token);
      if(req.method==='POST'&&bodyToken&&bodyUserId===String(userId)){
        res.setHeader('Set-Cookie',['mh_portfolio_bridge='+encodeURIComponent(bodyToken)+'; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax']);
      }
      return res.status(200).json({
        ok:true,
        connected:true,
        payload:bundle?.payload||null,
        dailyPayload:bundle?.daily_payload||null,
        revision:Number(bundle?.revision||0),
        updatedAt:bundle?.updated_at||null
      });
    }
    if(req.method!=='POST')return res.status(405).json({ok:false,error:'method_not_allowed'});

    const payload=req.body?.payload;
    if(!payload||typeof payload!=='object'||Array.isArray(payload)){
      return res.status(400).json({ok:false,error:'invalid_payload'});
    }
    const expectedRevision=Number.isInteger(req.body?.expectedRevision)?req.body.expectedRevision:null;
    const dailyPayload=req.body?.dailyPayload??null;
    const saved=await putPortfolioBridgeBundle(payload,dailyPayload,expectedRevision,userId,token);
    if(!saved?.ok)return res.status(409).json({ok:false,error:'backend_revision_conflict'});
    if(bodyToken&&bodyUserId===String(userId)){
      res.setHeader('Set-Cookie',[
        'mh_portfolio_bridge='+encodeURIComponent(bodyToken)+'; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax'
      ]);
    }
    return res.status(200).json({
      ok:true,
      connected:true,
      positions:visiblePositionCount(payload),
      revision:Number(saved.revision||0),
      updatedAt:saved.updated_at||null
    });
  }catch(error){
    return res.status(500).json({ok:false,error:String(error?.message||'bridge_failed')});
  }
}
