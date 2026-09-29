const token=process.env.TELEGRAM_BOT_TOKEN;
const webhookUrl=process.env.TELEGRAM_WEBHOOK_URL;
const secret=process.env.TELEGRAM_WEBHOOK_SECRET||'';

if(!token)throw new Error('TELEGRAM_BOT_TOKEN is required');
if(!webhookUrl||!/^https:\/\//.test(webhookUrl))throw new Error('TELEGRAM_WEBHOOK_URL must be an https URL');

async function telegram(method,payload){
  const response=await fetch('https://api.telegram.org/bot'+token+'/'+method,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  const data=await response.json();
  if(!response.ok||!data.ok)throw new Error(data?.description||method+' failed');
  return data.result;
}

const webhook={
  url:webhookUrl,
  allowed_updates:['message','callback_query'],
  drop_pending_updates:true
};
if(secret)webhook.secret_token=secret;

await telegram('setWebhook',webhook);
await telegram('setMyCommands',{commands:[
  {command:'menu',description:'منوی اصلی Market Hunter'},
  {command:'markets',description:'بازار و شاخص‌ها'},
  {command:'hunter',description:'چهار مرحله Hunter'},
  {command:'brief',description:'تغییرات آخرین اسکن'},
  {command:'portfolio',description:'پورتفولیو'}
]});

const info=await telegram('getWebhookInfo',{});
console.log(JSON.stringify({
  ok:true,
  url:info.url,
  pending_update_count:info.pending_update_count,
  has_custom_certificate:info.has_custom_certificate,
  last_error_message:info.last_error_message||null
},null,2));
