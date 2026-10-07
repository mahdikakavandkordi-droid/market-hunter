import {engineDeskMenu,engineDeskReport} from '../lib/telegram-engines.js';
import {
  mainMenu,enginesMenu,pulseMenu,marketReport,allMarketsReport,hunterMenu,stageMenu,stockReport,
  hunterMonitorReport,marketBrief,statusReport,portfolioMenu,portfolioItemReport,portfolioSummaryReport,portfolioEmpty
} from '../lib/telegram-fa.js';
import {
  loadHunterMonitor,loadEngineEvidence,loadScan,loadPulse,loadDailyReport,loadPreviousScan,loadRecentScans,loadPortfolioSnapshot,loadBotBundle,loadStockLive
} from '../lib/telegram-data.js';
import { portfolioPairUrl, portfolioBridgeConfigured } from '../lib/portfolio-bridge.js';

const TELEGRAM_API='https://api.telegram.org';

function allowedIds(){
  return new Set(String(process.env.TELEGRAM_ALLOWED_USER_ID||'')
    .split(',').map(x=>x.trim()).filter(Boolean));
}

function configured(){
  return Boolean(process.env.TELEGRAM_BOT_TOKEN&&allowedIds().size);
}

function updateUserId(update){
  return String(update?.callback_query?.from?.id??update?.message?.from?.id??'');
}

function authorized(update){
  const id=updateUserId(update);
  return Boolean(id&&allowedIds().has(id));
}

function verifyWebhookSecret(req){
  const expected=process.env.TELEGRAM_WEBHOOK_SECRET;
  if(!expected)return true;
  return String(req.headers?.['x-telegram-bot-api-secret-token']||'')===expected;
}

async function telegram(method,payload){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token)throw new Error('telegram_not_configured');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch(TELEGRAM_API+'/bot'+token+'/'+method,{
      method:'POST',
      signal:controller.signal,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    const data=await response.json().catch(()=>({ok:false}));
    if(!response.ok||data.ok===false){
      const description=String(data?.description||'telegram_api_error');
      const error=new Error(description);error.status=response.status;throw error;
    }
    return data.result;
  }finally{
    clearTimeout(timer);
  }
}

async function answerCallback(id){
  if(!id)return;
  try{await telegram('answerCallbackQuery',{callback_query_id:id})}catch{}
}

function messageTarget(update){
  const callback=update?.callback_query;
  if(callback?.message?.chat?.id&&callback?.message?.message_id){
    return {chatId:callback.message.chat.id,messageId:callback.message.message_id,edit:true};
  }
  const message=update?.message;
  if(message?.chat?.id)return {chatId:message.chat.id,messageId:null,edit:false};
  return null;
}

async function render(update,view){
  const target=messageTarget(update);
  if(!target)return;
  const payload={
    chat_id:target.chatId,
    text:String(view?.text||'—').slice(0,4096),
    parse_mode:'HTML',
    disable_web_page_preview:true,
    reply_markup:view?.keyboard||undefined
  };
  if(target.edit){
    try{
      await telegram('editMessageText',{...payload,message_id:target.messageId});
      return;
    }catch(error){
      if(String(error?.message||'').includes('message is not modified'))return;
    }
  }
  await telegram('sendMessage',payload);
}

async function renderError(update){
  await render(update,{
    text:'<b>خطا در دریافت داده</b>\nفعلاً نتوانستم آخرین بسته‌ی Market Hunter را بخوانم. چند لحظه بعد دوباره از همان منو امتحان کن.',
    keyboard:{inline_keyboard:[[{text:'🏠 منوی اصلی',callback_data:'m:home'}]]}
  });
}

function findMarket(pulse,key){
  return (pulse?.markets||[]).find(x=>x.key===key)||null;
}

async function routeCallback(update,data){
  if(data==='m:home')return render(update,mainMenu());
  if(data==='m:engineDesk')return render(update,engineDeskMenu());
  const desk=/^desk:(smc|trend|mean):(open|closed|pending|capital):(\d+)$/.exec(data);
  if(desk){const engines=await loadEngineEvidence();return render(update,engineDeskReport(engines,desk[1],desk[2],Number(desk[3])));}

  if(data==='m:pulse'){
    const pulse=await loadPulse();
    return render(update,pulseMenu(pulse));
  }
  if(data==='pulse:all'){
    const [report,pulse]=await Promise.all([loadDailyReport(),loadPulse()]);
    return render(update,allMarketsReport(report,pulse));
  }
  if(data.startsWith('pulse:')){
    const key=data.slice('pulse:'.length);
    const pulse=await loadPulse();
    return render(update,marketReport(findMarket(pulse,key)));
  }

  if(data==='m:engines'||/^eng:(all|smc|trend|mean)$/.test(data)){
    const [scan,engines]=await Promise.all([loadScan(),loadEngineEvidence()]);
    return render(update,enginesMenu(scan,engines,data.startsWith('eng:')?data.slice(4):'all'));
  }
  if(/^hm:\d+$/.test(data)){
    const monitor=await loadHunterMonitor().catch(()=>null);
    return render(update,hunterMonitorReport(monitor,Number(data.slice(3))));
  }
  if(data==='m:hunter'){
    const scan=await loadScan();
    return render(update,hunterMenu(scan));
  }
  if(data.startsWith('stage:')){
    const index=Number(data.slice('stage:'.length));
    const scan=await loadScan();
    return render(update,stageMenu(scan,Number.isInteger(index)?index:0));
  }
  if(data.startsWith('stock:')){
    const symbol=data.slice('stock:'.length).toUpperCase();
    const [scan,live,engines]=await Promise.all([loadScan(),loadStockLive(symbol),loadEngineEvidence()]);
    return render(update,stockReport(scan,symbol,live,engines));
  }
  if(data==='brief:hunter'){
    const history=await loadRecentScans(5);
    const scan=history.at(-1)||await loadScan();
    const previous=history.length>1?history.at(-2):await loadPreviousScan();
    return render(update,marketBrief(scan,previous,history));
  }

  if(data==='m:portfolio'){
    const snapshot=await loadPortfolioSnapshot();
    return render(update,snapshot?portfolioMenu(snapshot,portfolioPairUrl()):portfolioEmpty(undefined,portfolioPairUrl()));
  }
  if(data==='pf:all'){
    const snapshot=await loadPortfolioSnapshot();
    return render(update,snapshot?portfolioSummaryReport(snapshot):portfolioEmpty(undefined,portfolioPairUrl()));
  }
  if(/^pfpage:\d+$/.test(data)){
    const snapshot=await loadPortfolioSnapshot();
    return render(update,snapshot?portfolioSummaryReport(snapshot,Number(data.slice(7))):portfolioEmpty(undefined,portfolioPairUrl()));
  }
  if(data.startsWith('pf:')){
    const symbol=data.slice('pf:'.length).toUpperCase();
    const snapshot=await loadPortfolioSnapshot();
    return render(update,snapshot?portfolioItemReport(snapshot,symbol):portfolioEmpty(undefined,portfolioPairUrl()));
  }

  if(data==='m:status'){
    const {scan,pulse}=await loadBotBundle();
    return render(update,statusReport(scan,pulse));
  }

  return render(update,mainMenu());
}

async function routeMessage(update){
  const text=String(update?.message?.text||'').trim().toLowerCase();
  if(text==='/monitor'||text.includes('پیگیری'))return render(update,hunterMonitorReport(await loadHunterMonitor().catch(()=>null)));
  if(text==='/engines'||text==='موتورها')return render(update,engineDeskMenu());
  if(text==='/start'||text==='/menu'||text==='منو'||text==='خانه'||!text)return render(update,mainMenu());
  if(text.includes('بازار')||text==='/markets'){
    const pulse=await loadPulse();return render(update,pulseMenu(pulse));
  }
  if(text.includes('پورتفولیو')||text==='/portfolio'){
    const snapshot=await loadPortfolioSnapshot();return render(update,snapshot?portfolioMenu(snapshot,portfolioPairUrl()):portfolioEmpty(undefined,portfolioPairUrl()));
  }
  if(text.includes('brief')||text.includes('گزارش')||text==='/brief'){
    const history=await loadRecentScans(5);
    const scan=history.at(-1)||await loadScan();
    const previous=history.length>1?history.at(-2):await loadPreviousScan();
    return render(update,marketBrief(scan,previous,history));
  }
  if(text.includes('hunter')||text.includes('سهام')||text==='/hunter'){
    const scan=await loadScan();return render(update,hunterMenu(scan));
  }
  return render(update,mainMenu());
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');

  if(req.method==='GET'){
    return res.status(200).json({
      ok:true,
      service:'market-hunter-telegram',
      configured:configured(),
      portfolioCloudConfigured:Boolean(
        (process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.TELEGRAM_PORTFOLIO_USER_ID)||
        portfolioBridgeConfigured()
      )
    });
  }
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'method_not_allowed'});
  if(!verifyWebhookSecret(req))return res.status(401).json({ok:false,error:'invalid_webhook_secret'});
  if(!configured())return res.status(503).json({ok:false,error:'telegram_not_configured'});

  const update=req.body&&typeof req.body==='object'?req.body:{};
  if(!authorized(update))return res.status(200).json({ok:true,ignored:true});

  const callback=update.callback_query;
  if(callback?.id)await answerCallback(callback.id);

  try{
    if(callback?.data)await routeCallback(update,String(callback.data));
    else await routeMessage(update);
  }catch(error){
    try{await renderError(update)}catch{}
  }

  return res.status(200).json({ok:true});
}

