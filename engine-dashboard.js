/* Separate, read-only research surface; account values are nominal paper units. */
window.MarketHunterEngines=(()=>{
  const engines=[{id:'smc',name:'SMC',icon:'◇',description:'Weekly / Daily structure · 4H CHoCH'},
    {id:'trend',name:'Trend Breakout',icon:'↗',description:'Follow a trend after a confirmed breakout'},
    {id:'mean',name:'Mean Reversion',icon:'↶',description:'Look for a return after a price stretch'}];
  const markets=[['tsx-core','Canada · Core'],['tsx-extra','Canada · Extended'],['us-75','US stocks'],['crypto-15','Crypto'],['metals-5','Metals']];
  const tr=(en,fa)=>window.MHI18n?.t(en,fa)||en;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-CA',{maximumFractionDigits:2}):'—';
  const price=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-CA',{maximumFractionDigits:Math.abs(v)>=100?2:Math.abs(v)>=1?4:6}):'—';
  const pct=v=>typeof v==='number'&&Number.isFinite(v)?(v>0?'+':'')+(v*100).toFixed(2)+'%':'—';
  const tone=v=>Number.isFinite(v)?v>0?'up':v<0?'down':'flat':'flat';
  const date=v=>!v||!Number.isFinite(Date.parse(v))?'—':/^\d{4}-\d{2}-\d{2}$/.test(v)
    ?new Date(v).toLocaleDateString('en-CA',{month:'short',day:'numeric',timeZone:'UTC'})
    :new Date(v).toLocaleString('en-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});
  const report=(data,e,c)=>data?.reports?.find(r=>r.engine===e&&r.cohort===c);
  function badges(data,symbol){
    const rows=(data?.reports||[]).filter(r=>r.status==='available').flatMap(r=>(r.account?.open||[]).filter(p=>p.symbol===symbol&&p.status==='open'&&p.notional>0&&[1,-1].includes(p.dir)&&p.entryT&&Number.isFinite(Date.parse(p.entryT))&&Date.parse(p.entryT)<=Date.now()).map(p=>({r,p})));
    if(!rows.length)return '';
    return '<div class="engine-badges">'+rows.map(({r,p})=>`<button type="button" class="engine-badge ${p.dir===1?'long':'short'}" data-engine-open="${esc(r.engine)}" data-engine-cohort="${esc(r.cohort)}" title="${esc(tr('Recorded position','پوزیشن ثبت‌شده'))} · ${esc(date(r.generatedAt))}"><bdi>${esc(engines.find(e=>e.id===r.engine)?.name||r.engine)} · ${p.dir===1?'Long':'Short'}</bdi> · ${r.reportOverdue?tr('Last snapshot','آخرین گزارش'):tr('Paper open','آزمایشی باز')}</button>`).join('')+'</div>';
  }
  function confirmation(data,symbol){return badges(data,symbol);}
  function metric(label,value,cls=''){return `<div class="engine-metric"><small>${esc(label)}</small><strong class="${cls}">${value}</strong></div>`;}
  const marketName=id=>tr(markets.find(m=>m[0]===id)?.[1]||id,({'tsx-core':'کانادا · اصلی','tsx-extra':'کانادا · تکمیلی','us-75':'سهام آمریکا','crypto-15':'کریپتو','metals-5':'فلزات'})[id]||id);
  function segmentCard(r,id){
    const a=r?.status==='available'?r.account:null;
    const committed=a&&Array.isArray(a.open)&&a.open.every(p=>Number.isFinite(p.notional)&&p.notional>=0)?a.open.reduce((sum,p)=>sum+p.notional,0):null;
    const realized=a&&Number.isFinite(a.realizedEquity)&&Number.isFinite(a.startingCapital)?a.realizedEquity-a.startingCapital:null;
    return `<article class="engine-segment" data-engine-segment="${esc(id)}"><div class="engine-segment-head"><h3>${esc(marketName(id))}</h3><span>${!a?tr('Unavailable','در دسترس نیست'):r.reportOverdue?tr('Last snapshot','آخرین گزارش'):tr('Paper account','حساب آزمایشی')}</span></div>
      <div class="engine-segment-value"><small>${tr('Current account value','ارزش فعلی حساب')}</small><strong>${num(a?.markedEquity)}</strong><span class="${tone(a?.markedReturn)}">${pct(a?.markedReturn)}</span></div>
      <div class="engine-segment-metrics">${metric(tr('Starting capital','سرمایهٔ اولیه'),num(a?.startingCapital))}${metric(tr('In open positions','درگیر پوزیشن‌های باز'),num(committed))}${metric(tr('Free cash','پول آزاد'),num(a?.cash))}${metric(tr('Realized P/L','سود و زیان بسته‌شده'),num(realized),tone(realized))}</div>
      <p class="engine-segment-counts">${a?'<bdi>'+num(a.openCount)+'</bdi> '+tr('open','باز')+' · <bdi>'+num(a.closedCount)+'</bdi> '+tr('closed','بسته'):tr('Account evidence unavailable.','گزارش حساب در دسترس نیست.')}</p>
      ${a&&a.markedEquity===null?'<p class="engine-segment-note">'+tr('Current value is unavailable: an open position is missing its recorded price.','ارزش فعلی قابل محاسبه نیست؛ قیمت ثبت‌شدهٔ یک پوزیشن باز ناقص است.')+'</p>':''}
      <details class="engine-segment-source"><summary>${tr('Account details','جزئیات حساب')}</summary><p>${tr('Started','شروع')}: <bdi>${esc(date(r?.forwardStart))}</bdi><br>${tr('Snapshot','زمان گزارش')}: <bdi>${esc(date(r?.generatedAt))}</bdi><br>${tr('Initial open risk','ریسک اولیهٔ باز')}: <bdi>${num(a?.openRiskAmount)}</bdi></p>${r?.source?.url?'<a href="'+esc(r.source.url)+'" target="_blank" rel="noopener">'+tr('Source evidence ↗','گزارش منبع ↗')+'</a>':''}</details></article>`;
  }
  function funding(data,e){return `<section class="panel engine-funding" data-engine-funding="${e.id}"><div class="sectionhead"><div><h2><bdi>${e.name}</bdi> · ${tr('Capital by segment','سرمایه در هر سگمنت')}</h2><p>${tr('Separate paper accounts · nominal units. Swipe to browse on mobile.','حساب‌های آزمایشی جدا · واحد اسمی. در موبایل ورق بزن.')}</p></div></div><div class="engine-segments" tabindex="0" role="region" aria-label="${esc(e.name+' '+tr('segment accounts','حساب‌های سگمنت‌ها'))}">${markets.map(([id])=>segmentCard(report(data,e.id,id),id)).join('')}</div></section>`;}
  function tradeCard(t,closed,e,cohort){
    const pending=t.status==='pending_entry',profit=closed?t.pnl:t.unrealizedPnl;
    const returnPct=t.notional>0&&Number.isFinite(profit)?profit/t.notional:null;
    return `<article class="engine-position"><div class="engine-position-head"><button class="symbol-link" data-engine-chart="${esc(t.symbol)}" data-engine-cohort="${esc(cohort)}"><bdi>${esc(t.symbol)}</bdi> ↗</button><span class="tag ${t.dir===1?'long':'short'}"><bdi>${t.dir===1?'Long':t.dir===-1?'Short':'—'}</bdi> · ${pending?tr('Pending','منتظر ورود'):closed?tr('Closed','بسته'):tr('Open','باز')}</span></div>
      <p class="engine-position-time"><bdi>${esc(e.name)}</bdi> · ${esc(marketName(cohort))}</p>
      ${pending?`<p class="copy engine-position-reason">${tr('Signal recorded. Waiting for an eligible 4H entry open; no position has opened.','سیگنال ثبت شده است؛ موتور منتظر بازشدن کندل چهار‌ساعتهٔ مناسب برای ورود است. هنوز پوزیشنی باز نشده.')}</p>`:`<div class="engine-position-metrics">${metric(tr('Entry','ورود'),price(t.entry))}${metric(closed?tr('Exit','خروج'):tr('Recorded price','قیمت ثبت‌شده'),price(closed?t.exitPrice:t.markPrice))}${metric(tr('P/L · paper units','سود و زیان · واحد آزمایشی'),num(profit),tone(profit))}${metric(tr('Return','بازده'),pct(returnPct),tone(profit))}${metric(tr('Stop','حد ضرر'),price(t.stop))}${metric(tr('Target','هدف'),price(t.target))}</div>`}
      <p class="engine-position-time">${pending?tr('Signal','سیگنال'):tr('Entered','ورود')}: <bdi>${esc(date(pending?t.availableAt||t.signalT:t.entryT))}</bdi>${closed?' · '+tr('Exited','خروج')+': <bdi>'+esc(date(t.exitT))+'</bdi>':!pending?' · '+tr('Price at','زمان قیمت')+': <bdi>'+esc(date(t.markT))+'</bdi>':''}</p>
      <details class="engine-position-extras"><summary>${tr('Position details','جزئیات پوزیشن')}</summary><p>${tr('Snapshot','زمان گزارش')}: <bdi>${esc(date(t._snapshot))}</bdi>${t._overdue?' · '+tr('Update overdue','گزارش قدیمی'):''}<br>${tr('Notional','اندازه پوزیشن')}: <bdi>${num(t.notional)}</bdi> · ${tr('Initial risk','ریسک اولیه')}: <bdi>${num(t.riskAmount)}</bdi>${closed?'<br>'+tr('Outcome','نتیجه')+': <bdi>'+num(t.R)+'R</bdi>':''}</p></details></article>`;
  }
  function comparison(r){
    const c=r?.comparison;
    if(!c)return '<div class="engine-notice">Common-window comparison is unavailable. Full-period results below have different start dates.</div>';
    return `<section class="panel engine-comparison"><div class="sectionhead"><div><h2>Same starting window</h2><p>New entries since ${esc(date(c.start))} · This market only</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Engine</th><th>Return incl. open P/L</th><th>Open / closed</th><th>Source snapshot</th></tr></thead><tbody>${c.rows.map(row=>`<tr><td>${esc(engines.find(e=>e.id===row.engine)?.name)}</td><td class="${tone(row.account?.markedReturn)}">${pct(row.account?.markedReturn)}</td><td>${row.account?row.account.openCount+' / '+row.account.closedCount:'—'}</td><td>${esc(date(row.sourceAsOf))}${row.stale?' · Update overdue':''}</td></tr>`).join('')}</tbody></table></div>
      <p class="engine-footnote">Early results; no winner yet. Prices are observed independently. Earlier positions are excluded; holding periods and gap rules differ. Returns use each source account’s latest valuation, not a synchronized price snapshot.</p></section>`;
  }
  function html(data,{engine='all',cohort='tsx-core',mode='open',loading=false,error=false}={}){
    const e=engines.find(e=>e.id===engine)||engines[0];
    const header=`<section class="panel engine-intro"><div class="engine-intro-top"><div><h2>${tr('Paper engines','موتورها')}</h2><p class="copy">${tr('Independent positions across all markets.','پوزیشن‌های مستقل در همهٔ بازارها.')}</p></div><button class="btn" type="button" data-engine-refresh ${loading?'disabled':''}>${loading?tr('Updating…','در حال دریافت…'):tr('Refresh ↻','تازه‌سازی ↻')}</button></div><div class="engine-filters" role="group" aria-label="Engine">${[{id:'all',name:tr('All engines','همهٔ موتورها')},...engines].map(x=>`<button type="button" data-engine-tab="${x.id}" aria-pressed="${engine===x.id}"><bdi>${esc(x.name)}</bdi></button>`).join('')}</div></section>`;
    if(!data)return header+`<div class="engine-notice" role="status">${error?tr('Evidence unavailable. Try refreshing.','گزارش‌ها دریافت نشدند؛ دوباره تازه‌سازی کن.'):tr('Loading positions…','در حال دریافت پوزیشن‌ها…')}</div>`;
    const sources=(data.reports||[]).filter(x=>engine==='all'||x.engine===engine),available=sources.filter(x=>x.status==='available');
    const collect=status=>available.flatMap(x=>(status==='closed'?x.account.closed:status==='pending'?x.pending||[]:x.account.open).map(t=>({...t,_engine:x.engine,_cohort:x.cohort,_snapshot:x.generatedAt,_overdue:x.reportOverdue})));
    const trades=collect(mode),incomplete=sources.some(x=>x.status!=='available'||x.reportOverdue||x.failures?.length);
    const positions=`<section class="panel engine-all-positions"><div class="sectionhead"><div><h2>${tr('Positions · all markets','پوزیشن‌ها · همهٔ بازارها')}</h2><p>${tr('Recorded prices, not live quotes.','قیمت‌ها ثبت‌شده‌اند و لحظه‌ای نیستند.')}</p></div></div><div class="engine-trade-tabs" role="group" aria-label="Position status">${['open','closed','pending'].map(status=>`<button type="button" data-engine-mode="${status}" aria-pressed="${mode===status}">${status==='open'?tr('Open','باز'):status==='closed'?tr('Closed','بسته'):tr('Pending','منتظر ورود')} (<bdi>${collect(status).length}</bdi>)</button>`).join('')}</div>${error?'<div class="engine-notice">'+tr('Refresh failed. Showing the previous snapshot.','به‌روزرسانی ناموفق بود؛ آخرین گزارش نمایش داده می‌شود.')+'</div>':''}${incomplete?'<div class="engine-notice">'+tr('Some reports are unavailable or incomplete.','بعضی گزارش‌ها ناقص یا در دسترس نیستند.')+'</div>':''}<div class="swipe-tools"><span>${tr("Swipe through positions","پوزیشن‌ها را ورق بزن")} ↔ <bdi>${trades.length}</bdi></span><div><button type="button" data-swipe="enginePositions" data-step="-1" aria-label="${tr("Previous position","پوزیشن قبلی")}">←</button><button type="button" data-swipe="enginePositions" data-step="1" aria-label="${tr("Next position","پوزیشن بعدی")}">→</button></div></div><div class="engine-positions mobile-rail" id="enginePositions" tabindex="0" aria-label="Engine positions">${trades.length?trades.map(t=>tradeCard(t,mode==='closed',engines.find(x=>x.id===t._engine),t._cohort)).join(''):`<div class="engine-empty">${mode==='pending'?tr('No recorded pending signals.','سیگنال در انتظار ثبت نشده است.'):mode==='closed'?tr('No settled paper trades in this account yet.','معاملهٔ بسته‌شده ثبت نشده است.'):tr('No recorded open position. Waiting for this engine’s own entry conditions.','پوزیشن بازی ثبت نشده است.')}</div>`}</div></section>`;
    const accounts=engine==='all'?`<details class="panel engine-funding-all dashboard-disclosure"><summary>${tr('Capital by engine','سرمایهٔ هر موتور')}</summary>${engines.map(x=>funding(data,x)).join('')}</details>`:funding(data,e);
    const comparisons=`<details class="panel engine-account-details"><summary>${tr('Compare engines · same starting window','مقایسهٔ موتورها · بازهٔ شروع یکسان')}</summary>${markets.map(([id])=>`<details class="engine-segment-comparison"><summary>${esc(marketName(id))}</summary>${comparison(report(data,'mean',id))}</details>`).join('')}</details>`;
    return header+accounts+positions+comparisons;
  }
  return {html,badges,confirmation};
})();
