// Read-only Telegram views over normalized forward paper evidence.
const ENGINES={smc:'SMC',trend:'Trend Breakout',mean:'Mean Reversion'};
const SEGMENTS={'tsx-core':'کانادا · اصلی','tsx-extra':'کانادا · تکمیلی','us-75':'سهام آمریکا','crypto-15':'کریپتو','metals-5':'فلزات'};
const esc=v=>String(v??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const num=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-CA',{maximumFractionDigits:4}):'—';
const code=v=>'<code>\u2066'+esc(v)+'\u2069</code>';
const pct=v=>typeof v==='number'&&Number.isFinite(v)?(v>0?'+':'')+(v*100).toFixed(2)+'%':'—';
const stamp=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('en-CA',{timeZone:'America/St_Johns',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const callback=(engine,mode,page=0)=>`desk:${engine}:${mode}:${page}`;
export function engineDeskMenu(){return {text:'<b>⚙️ دفتر موتورها</b>\nموتور را انتخاب کن؛ پوزیشن‌های همهٔ بازارهای همان موتور و سرمایهٔ هر سگمنت را می‌بینی.\n\n🟢 Long · 🔴 Short\nمعاملات آزمایشی‌اند.',keyboard:{inline_keyboard:[...Object.entries(ENGINES).map(([id,name])=>[{text:name,callback_data:callback(id,'open')}]),[{text:'🎯 خریدهای مشترک با هانتر',callback_data:'m:engines'}],[{text:'🏠 خانه',callback_data:'m:home'}]]}};}
export function engineDeskReport(data,engine,mode='open',page=0){
 if(!ENGINES[engine])return engineDeskMenu();
 const reports=(data?.reports||[]).filter(r=>r.engine===engine),available=reports.filter(r=>r.status==='available'&&r.account);
 const trades=status=>available.flatMap(r=>(status==='pending'?r.pending||[]:r.account[status]||[]).map(p=>({p,r})));
 const modes=['open','closed','pending','capital'];if(!modes.includes(mode))mode='open';
 const names={open:'پوزیشن‌های باز',closed:'پوزیشن‌های بسته',pending:'منتظر ورود',capital:'سرمایهٔ سگمنت‌ها'};
 const list=mode==='capital'?Object.keys(SEGMENTS).map(id=>({id,r:reports.find(r=>r.cohort===id)})):trades(mode);
 const size=mode==='capital'?2:3,pages=Math.max(1,Math.ceil(list.length/size)),index=Math.min(pages-1,Math.max(0,Number.isInteger(page)?page:0));
 const lines=[`<b>⚙️ ${ENGINES[engine]} · ${names[mode]}</b>`,`صفحهٔ ${index+1} از ${pages} · ${mode==='capital'?'حساب‌های مستقل':list.length+' پوزیشن'}`];
 if(!data||reports.length<5||reports.some(r=>r.status!=='available'||r.reportOverdue||r.failures?.length))lines.push('⚠️ بعضی گزارش‌ها ناقص یا قدیمی‌اند؛ فقط اطلاعات ثبت‌شده نمایش داده می‌شود.');
 for(const item of list.slice(index*size,(index+1)*size)){
  if(mode==='capital'){
   const {id,r}=item,a=r?.status==='available'?r.account:null;
   lines.push('',`<b>${SEGMENTS[id]}</b>`);
   if(!a){lines.push('گزارش حساب در دسترس نیست.');continue;}
   const invested=Array.isArray(a.open)&&a.open.every(p=>Number.isFinite(p.notional)&&p.notional>=0)?a.open.reduce((s,p)=>s+p.notional,0):null;
   const realized=Number.isFinite(a.realizedEquity)&&Number.isFinite(a.startingCapital)?a.realizedEquity-a.startingCapital:null;
   lines.push(`ارزش فعلی ${code(num(a.markedEquity))} · بازده ${code(pct(a.markedReturn))}`,`سرمایهٔ اولیه ${code(num(a.startingCapital))}`,`درگیر پوزیشن‌ها ${code(num(invested))} · پول آزاد ${code(num(a.cash))}`,`سود/زیان بسته‌شده ${code(num(realized))}`,`باز ${code(num(a.openCount))} · بسته ${code(num(a.closedCount))}`,`گزارش ${code(stamp(r.generatedAt))}`);
  }else{
   const {p,r}=item,closed=mode==='closed',pending=mode==='pending',profit=closed?p.pnl:p.unrealizedPnl;
   lines.push('',`<b>${p.dir===1?'🟢 Long':p.dir===-1?'🔴 Short':'⚪️'}</b> ${code(p.symbol)}`,esc(SEGMENTS[r.cohort]||r.cohort));
   if(pending){lines.push('سیگنال ثبت شده؛ هنوز پوزیشنی باز نشده است.',`زمان سیگنال ${code(stamp(p.availableAt||p.signalT))}`);continue;}
   lines.push(`ورود ${code(num(p.entry))} · ${closed?'خروج':'قیمت ثبت‌شده'} ${code(num(closed?p.exitPrice:p.markPrice))}`,`سود/زیان ${code(num(profit))} · ${code(pct(p.notional>0&&Number.isFinite(profit)?profit/p.notional:null))}`,`اندازهٔ پوزیشن ${code(num(p.notional))}`,`حد ضرر ${code(num(p.stop))} · هدف ${code(num(p.target))}`,`ورود ${code(stamp(p.entryT))} · ${closed?'خروج':'زمان قیمت'} ${code(stamp(closed?p.exitT:p.markT))}`);
  }
 }
 if(!list.length)lines.push('',!available.length?'گزارش موتور در دسترس نیست.':mode==='closed'?'معاملهٔ بسته‌شده‌ای ثبت نشده است.':mode==='pending'?'سیگنال در انتظار ورود ثبت نشده است.':'پوزیشن بازی ثبت نشده است.');
 lines.push('',mode==='capital'?'<i>مبالغ واحد اسمی حساب آزمایشی‌اند؛ سگمنت‌ها با هم جمع نمی‌شوند.</i>':'<i>قیمت‌ها ثبت‌شده‌اند، لحظه‌ای نیستند؛ — یعنی داده در دسترس نیست.</i>');
 const nav=[];if(index>0)nav.push({text:'⬅️ قبلی',callback_data:callback(engine,mode,index-1)});if(index+1<pages)nav.push({text:'بعدی ➡️',callback_data:callback(engine,mode,index+1)});
 return {text:lines.join('\n'),keyboard:{inline_keyboard:[[{text:`باز (${trades('open').length})`,callback_data:callback(engine,'open')},{text:`بسته (${trades('closed').length})`,callback_data:callback(engine,'closed')}],[{text:'💰 سرمایهٔ سگمنت‌ها',callback_data:callback(engine,'capital')},{text:`منتظر ورود (${trades('pending').length})`,callback_data:callback(engine,'pending')}],...(nav.length?[nav]:[]),[{text:'🔄 تازه‌سازی',callback_data:callback(engine,mode,index)}],[{text:'⬅️ موتورها',callback_data:'m:engineDesk'},{text:'🏠 خانه',callback_data:'m:home'}]]}};
}
