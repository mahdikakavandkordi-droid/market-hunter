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
    const matches=(data?.reports||[]).filter(r=>r.status==='available'&&r.account.open.some(p=>p.symbol===symbol));
    return matches.length?'<div class="engine-badges">'+matches.flatMap(r=>r.account.open.filter(p=>p.symbol===symbol).map(p=>`<button type="button" class="engine-badge ${p.dir===1?'long':'short'}" data-engine-open="${esc(r.engine)}" data-engine-cohort="${esc(r.cohort)}" title="Entered ${esc(date(p.entryT))} · Snapshot ${esc(date(r.generatedAt))}">${esc(engines.find(e=>e.id===r.engine)?.name)} · ${p.dir===1?'Long':p.dir===-1?'Short':'Unknown direction'} · paper ${r.reportOverdue?'snapshot':'open'}</button>`)).join('')+'</div>':'';
  }
  function confirmation(data,symbol,scan){
    const policy=window.MarketHunterEngineMatches;
    if(!policy||!scan)return badges(data,symbol);
    scan={...scan,integratedSurfacePicks:[{symbol}]};
    const hits=policy.matches(scan,data).filter(x=>x.symbol===symbol),complete=policy.coverage(scan,data);
    return `<div class="engine-confirmation copy"><strong>${tr('Hunter × Engines','هم‌پوشانی هانتر و موتورها')}</strong>${hits.length?hits.map(h=>{const p=h.position,pending=p.status==='pending_entry';return `<div><button type="button" class="engine-badge ${p.dir===1?'long':'short'}" data-engine-pending="${pending}" data-engine-open="${esc(h.engine)}" data-engine-cohort="${esc(h.cohort)}">${esc(h.engineName)} · ${p.dir===1?'Long':'Short'} · ${pending?tr('Awaiting entry','منتظر ورود'):tr('Paper position open','پوزیشن آزمایشی باز')}</button><small>${pending?tr('Recorded signal. Entry awaits the first eligible 4H open after signal availability; this is not an executed position.','سیگنال ثبت شده؛ ورود منتظر اولین بازشدن کندل چهار‌ساعتهٔ واجد شرایط پس از در دسترس شدن سیگنال است. هنوز پوزیشنی باز نشده.'):tr('Opened','بازشده در')+' '+esc(date(p.entryT))+' · '+tr('Entry','ورود')+' '+price(p.entry)+' · '+tr('Stop','حد ضرر')+' '+price(p.stop)+' · '+tr('Target','هدف')+' '+price(p.target)}</small></div>`}).join(''):`<small>${complete?tr('No recorded matching entry or pending signal.','ورود یا سیگنال در انتظارِ هم‌پوشان ثبت نشده است.'):tr('Engine evidence is incomplete or out of date.','اطلاعات موتورها ناقص یا قدیمی است؛ هم‌پوشانی قابل تأیید نیست.')}</small>`}${entryRules()}</div>`;
  }
  function entryRules(){
    return `<details class="engine-rules copy"><summary>${tr('What would trigger an entry?','چه اتفاقی باعث ورود موتور می‌شود؟')}</summary><small>${tr('Frozen strategy rules, not a claim that this stock currently meets them. Orders also depend on each engine’s risk and capital limits.','این‌ها قواعد ثابت استراتژی هستند؛ به معنی برقرار بودن شروط روی این سهم نیستند. ورود به محدودیت ریسک و سرمایهٔ هر موتور هم بستگی دارد.')}</small><p><b>SMC</b> · ${tr('Weekly and Daily structure must align; a completed 4H change of character triggers a signal. Entry uses the first eligible subsequent 4H open.','ساختار هفتگی و روزانه باید هم‌جهت باشد؛ تغییر شخصیت در کندل کامل چهار‌ساعته سیگنال می‌دهد. ورود در اولین بازشدن چهار‌ساعتهٔ بعدیِ واجد شرایط انجام می‌شود.')}</p><p><b>Trend Breakout</b> · ${tr('Daily close above SMA200 for Long (below for Short), followed by a completed 4H close above the preceding 20-bar high (below the low for Short). Entry at the first eligible subsequent 4H open.','برای لانگ، بسته‌شدن روزانه بالای میانگین ۲۰۰روزه و سپس بسته‌شدن چهار‌ساعته بالای سقف ۲۰ کندل قبلی؛ برای شورت برعکس، زیر میانگین و زیر کف ۲۰ کندل. ورود در اولین بازشدن چهار‌ساعتهٔ بعدیِ واجد شرایط.')}</p><p><b>Mean Reversion</b> · ${tr('Long only: daily close above SMA200, a dip at least 1.5 ATR below SMA20, then a bullish daily close above the dip high and below the frozen SMA20 target. Liquidity and reward/risk gates must also pass.','فقط لانگ: بسته‌شدن روزانه بالای میانگین ۲۰۰روزه، افت حداقل ۱٫۵ برابر ATR زیر میانگین ۲۰روزه، سپس کندل روزانهٔ صعودی بالای سقف کندل افت و زیر هدف ثابت میانگین ۲۰روزه. شرط نقدشوندگی و نسبت سود به ریسک هم باید پاس شود.')}</p></details>`;
  }
  function metric(label,value,cls=''){return `<div class="engine-metric"><small>${esc(label)}</small><strong class="${cls}">${value}</strong></div>`;}
  function overview(r,e,selected){
    const a=r?.account;
    return `<button type="button" class="engine-overview ${selected?'selected':''}" data-engine-tab="${e.id}" aria-pressed="${selected}">
      <span class="engine-card-heading"><span class="engine-icon">${e.icon}</span><span>${e.name}</span><span class="engine-status">${a?r.reportOverdue?'Update overdue':r.failures.length?'Partial coverage':'Recorded':'Unavailable'}</span></span>
      <span class="engine-equity">${num(a?.markedEquity)} <small>paper units</small></span>
      <span class="engine-return ${tone(a?.markedReturn)}">${pct(a?.markedReturn)} <small>including open P/L</small></span>
      <span class="engine-counts">${a?`${a.openCount} open · ${a.closedCount} closed`:'Evidence could not be loaded'}</span>
      <span class="engine-description copy">${tr(e.description,e.id==='smc'?'ساختار هفتگی و روزانه؛ تغییر شخصیت چهار‌ساعته':e.id==='trend'?'دنبال‌کردن روند پس از شکست تأییدشده':'بازگشت به میانگین پس از کشیدگی قیمت')}</span>
    </button>`;
  }
  function tradeCard(t,closed,e,cohort){
    const pending=t.status==='pending_entry',profit=closed?t.pnl:t.unrealizedPnl;
    return `<article class="engine-position">
      <div class="engine-position-head"><button class="symbol-link" data-engine-chart="${esc(t.symbol)}" data-engine-cohort="${esc(cohort)}">${esc(t.symbol)} ↗</button><span class="tag ${t.dir===1?'long':'short'}">${t.dir===1?'Long':t.dir===-1?'Short':'Direction unavailable'} · ${pending?tr('Awaiting entry','منتظر ورود'):closed?tr('Closed','بسته'):tr('Paper open','آزمایشی باز')}</span></div>
      <p class="engine-position-time"><strong>${tr('Engine','موتور')}: ${esc(e.name)} · ${esc(markets.find(m=>m[0]===cohort)?.[1]||cohort)}</strong><br>${pending?tr('Signal','سیگنال'):tr('Entered','ورود')} ${esc(date(pending?t.availableAt||t.signalT:t.entryT))}${closed?' · Exited '+esc(date(t.exitT)):''}</p>
      <div class="engine-position-metrics">${metric(tr('Entry','ورود'),price(t.entry))}${metric(tr('Latest recorded price','آخرین قیمت ثبت‌شده'),price(t.markPrice))}${closed?metric(tr('Exit price','قیمت خروج'),price(t.exitPrice)):''}${metric(tr('Stop','حد ضرر'),price(t.stop))}${metric(tr('Target','هدف'),price(t.target))}${metric(closed?tr('Settled P/L','سود و زیان نهایی'):tr('Open P/L','سود و زیان باز'),num(closed?t.pnl:t.unrealizedPnl),tone(closed?t.pnl:t.unrealizedPnl))}${metric(tr('Position return','بازده پوزیشن'),pct(t.notional>0&&Number.isFinite(profit)?profit/t.notional:null),tone(profit))}</div>
      ${closed?`<p class="engine-position-time">Outcome ${num(t.R)}R · Position ${num(t.notional)} paper units</p>`:`<p class="engine-position-time">Last mark ${price(t.markPrice)} · ${esc(date(t.markT))} · ${esc(t.markStatus)}<br>Position ${num(t.notional)} · Initial risk ${num(t.riskAmount)} paper units</p>`}
      <p class="engine-position-time">${tr('Source snapshot','زمان گزارش')}: ${esc(date(t._snapshot))}${t._overdue?' · '+tr('Update overdue','گزارش قدیمی'):''}</p><p class="engine-position-reason copy">${pending?tr('Recorded signal; awaiting an eligible 4H entry open. No capital committed yet.','سیگنال ثبت شده؛ منتظر بازشدن کندل چهار‌ساعتهٔ واجد شرایط برای ورود است. هنوز سرمایه‌ای وارد نشده.'):e.id==='smc'?tr(`${t.dir===1?'Bullish':'Bearish'} CHoCH under the frozen Weekly / Daily / 4H rules.`,`${t.dir===1?'تغییر شخصیت صعودی':'تغییر شخصیت نزولی'} مطابق قواعد ثابت ساختار هفتگی، روزانه و چهار‌ساعته.`):tr(e.description+'.',e.id==='trend'?'ورود پس از شکست تأییدشده در جهت روند.':'ورود برای بازگشت قیمت به میانگین پس از افت.')}</p>
    </article>`;
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
    const r=report(data,e.id,cohort),a=r?.account;
    const refresh=`<button class="btn" type="button" data-engine-refresh ${loading?'disabled':''}>${loading?'Refreshing…':'Refresh evidence ↻'}</button>`;
    const header=`<section class="panel engine-intro"><div class="engine-intro-top"><div><span class="eyebrow">PAPER EXPERIMENT</span><h2>${tr('Three engines. One research desk.','سه موتور؛ یک میز تحقیق')}</h2><p class="copy">${tr('Track independent strategies and their recorded positions.','وضعیت استراتژی‌های مستقل و پوزیشن‌های ثبت‌شدهٔ آن‌ها.')}</p></div>${refresh}</div><p class="copy">${tr('Positions below include every market. Market buttons select account statistics only.','فهرست پوزیشن‌ها همهٔ بازارها را پوشش می‌دهد. دکمه‌های بازار فقط آمار حساب را انتخاب می‌کنند.')}</p><button class="btn" data-engine-tab="all" aria-pressed="${engine==='all'}">${tr('All engines','همهٔ موتورها')}</button><div class="engine-market-tabs" role="group" aria-label="Research market">${markets.map(([id,name])=>`<button type="button" data-engine-market="${id}" aria-pressed="${id===cohort}" class="${id===cohort?'active':''}">${name}</button>`).join('')}</div></section>`;
    if(!data)return header+`<div class="engine-notice" role="status">${error?'Evidence is unavailable. Try refreshing.':'Loading recorded engine evidence…'}</div>`;
    const cards=`<div class="engine-overviews">${engines.map(x=>overview(report(data,x.id,cohort),x,x.id===engine)).join('')}</div>`;
    const compare=comparison(report(data,'mean',cohort));
    const sources=(data.reports||[]).filter(x=>engine==='all'||x.engine===engine);
    const available=sources.filter(x=>x.status==='available');
    const collect=status=>available.flatMap(x=>(status==='closed'?x.account.closed:status==='pending'?x.pending||[]:x.account.open).map(t=>({...t,_engine:x.engine,_cohort:x.cohort,_snapshot:x.generatedAt,_overdue:x.reportOverdue})));
    const trades=collect(mode);
    const positions=`<section class="panel engine-all-positions"><div class="sectionhead"><div><h2>${tr('Positions · all markets','پوزیشن‌ها · همهٔ بازارها')}</h2><p>${engine==='all'?tr('All three independent engines','هر سه موتور مستقل'):e.name} · ${tr('Recorded paper positions; prices are completed-bar observations.','پوزیشن‌های آزمایشی ثبت‌شده؛ قیمت‌ها از آخرین کندل کامل هستند.')}</p></div></div><div class="engine-trade-tabs" role="group" aria-label="Position status">${['open','closed','pending'].map(status=>`<button type="button" data-engine-mode="${status}" aria-pressed="${mode===status}">${status==='open'?tr('Open','باز'):status==='closed'?tr('Closed','بسته'):tr('Pending','منتظر ورود')} (${collect(status).length})</button>`).join('')}</div>${error?'<div class="engine-notice">'+tr('Refresh failed. Showing the previous snapshot.','به‌روزرسانی ناموفق بود؛ تصویر قبلی نمایش داده می‌شود.')+'</div>':''}${sources.some(x=>x.status!=='available'||x.reportOverdue||x.failures?.length)?'<div class="engine-notice">'+tr('Some evidence is missing, overdue or incomplete; this list may be incomplete.','برخی گزارش‌ها قدیمی، ناقص یا در دسترس نیستند؛ ممکن است فهرست کامل نباشد.')+'</div>':''}<div class="engine-positions">${trades.length?trades.map(t=>tradeCard(t,mode==='closed',engines.find(x=>x.id===t._engine),t._cohort)).join(''):`<div class="engine-empty">${mode==='pending'?tr('No recorded pending signals.','سیگنال در انتظار ثبت نشده است.'):mode==='closed'?tr('No settled paper trades in this account yet.','معاملهٔ بسته‌شده ثبت نشده است.'):tr('No recorded open position. Waiting for this engine’s own entry conditions.','پوزیشن بازی ثبت نشده است؛ موتور منتظر شروط مستقل خود است.')}</div>`}</div></section>`;
    if(!a)return header+cards+positions+compare+'<div class="engine-notice">'+tr('This account’s evidence is unavailable. Missing results are not zero.','اطلاعات این حساب در دسترس نیست؛ دادهٔ ناموجود به معنی صفر نیست.')+'</div>';
    const warnings=[r.reportOverdue?'The report is over six hours old. Positions reflect the last snapshot.':'',
      error?'Refresh failed. Showing the previous snapshot.':'',
      r.failures.length?`${r.failures.length} instrument(s) could not be evaluated in this run.`:'',
      r.legacyCount?`${r.legacyCount} SMC records have unknown original provenance. Full-period results include those records.`:'',
      a.markQuality!=='fresh'?`Valuation quality: ${a.markQuality}. Missing valuations stay unavailable.`:''].filter(Boolean);
    return header+cards+positions+compare+`<section class="panel engine-account"><div class="sectionhead"><div><h2>${e.name} · Full period · ${esc(markets.find(m=>m[0]===cohort)?.[1])}</h2><p>Started ${esc(date(r.forwardStart))} · Snapshot ${esc(date(r.generatedAt))}</p></div></div>
      <div class="engine-account-metrics">${metric('Starting capital',num(a.startingCapital))}${metric('Settled equity',num(a.realizedEquity))}${metric('Settled return',pct(a.realizedReturn),tone(a.realizedReturn))}${metric('Cash',num(a.cash))}${metric('Initial open risk',num(a.openRiskAmount))}${metric('Closed trades',num(a.closedCount))}</div>
      <p class="engine-footnote">Account amounts use nominal paper units. Each market has a separate account. Open P/L uses recorded completed-bar marks; ${num(a.costR)}R cost is charged on settlement.</p>
      ${warnings.length?'<div class="engine-notice">'+warnings.map(esc).join('<br>')+'</div>':''}
      <details class="engine-source"><summary>Evidence and coverage</summary><p><a href="${esc(r.source.url)}" target="_blank" rel="noopener">Open source snapshot ↗</a> · ${r.diagnosticCount} data diagnostics</p>${r.failures.length?'<p>'+r.failures.map(f=>esc(f.symbol)+' · '+esc(f.error)).join('<br>')+'</p>':''}${r.provenance?'<p>'+Object.entries(r.provenance).map(([key,v])=>`${esc(key)}: ${v.closed??'—'} closed`).join(' · ')+'</p>':''}</details></section>`;
  }
  return {html,badges,confirmation};
})();
