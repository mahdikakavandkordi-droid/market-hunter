const TELEGRAM_API='https://api.telegram.org';

function allowedIds(){
  return new Set(String(process.env.TELEGRAM_ALLOWED_USER_ID||'')
    .split(',').map(x=>x.trim()).filter(Boolean));
}

function authorizedUserId(value){
  const ids=allowedIds();
  return ids.size>0 && ids.has(String(value||'').trim());
}

async function telegram(method,payload){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token)throw new Error('telegram_not_configured');
  const response=await fetch(`${TELEGRAM_API}/bot${token}/${method}`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  const data=await response.json().catch(()=>({ok:false}));
  if(!response.ok||data.ok===false){
    throw new Error(String(data?.description||'telegram_api_error'));
  }
  return data.result;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');

  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});

  const userId=String(req.query?.user_id||'');
  if(!authorizedUserId(userId))return res.status(401).json({ok:false,error:'unauthorized'});

  const host=String(req.headers?.host||'').trim();
  if(!host)return res.status(400).json({ok:false,error:'missing_host'});

  const webhookUrl=`https://${host}/api/telegram`;

  try{
    const webhook=await telegram('setWebhook',{
      url:webhookUrl,
      allowed_updates:['message','callback_query'],
      drop_pending_updates:true,
      ...(process.env.TELEGRAM_WEBHOOK_SECRET?{secret_token:process.env.TELEGRAM_WEBHOOK_SECRET}:{})
    });

    await telegram('setMyCommands',{
      commands:[
        {command:'start',description:'باز کردن منوی اصلی'},
        {command:'menu',description:'منوی اصلی'},
        {command:'markets',description:'بازار و شاخص‌ها'},
        {command:'hunter',description:'سهام Market Hunter'},
        {command:'brief',description:'Market Brief'},
        {command:'portfolio',description:'پورتفولیو'}
      ]
    });

    const info=await telegram('getWebhookInfo',{});
    return res.status(200).json({
      ok:true,
      webhookSet:Boolean(webhook),
      webhookUrl:info?.url||webhookUrl,
      pendingUpdateCount:Number(info?.pending_update_count||0),
      hasCustomCertificate:Boolean(info?.has_custom_certificate)
    });
  }catch(error){
    return res.status(500).json({ok:false,error:String(error?.message||'setup_failed')});
  }
}
