const LRI='\u2066', PDI='\u2069';

export const STAGES=Object.freeze([
  'Early Watch',
  'Recovery',
  'Attractive Growth',
  'Established Move'
]);

export const STAGE_FA=Object.freeze({
  'Early Watch':'ارلی واچ',
  'Recovery':'ریکاوری',
  'Attractive Growth':'رشد جذاب',
  'Established Move':'حرکت تثبیت‌شده'
});

const STAGE_ICON=Object.freeze({
  'Early Watch':'👀',
  'Recovery':'🔄',
  'Attractive Growth':'🌱',
  'Established Move':'🚀'
});

const MARKET_FA=Object.freeze({
  TSX:'TSX',
  SP500:'S&P 500',
  NASDAQ100:'Nasdaq-100',
  GOLD:'طلا',
  SILVER:'نقره',
  BTC:'بیت‌کوین',
  ETH:'اتریوم'
});

const CONDITION_FA=Object.freeze({
  'Weakening':'در حال ضعیف‌شدن',
  'Pullback':'پول‌بک',
  'Positive Momentum':'مومنتوم مثبت',
  'Recovery Attempt':'تلاش برای ریکاوری',
  'Extended':'کشیده / داغ',
  'Breakout / Near High':'نزدیک شکست یا سقف',
  'Range / Mixed':'رنج / ترکیبی'
});

const REGIME_FA=Object.freeze({
  'Strong Bull':'روند صعودی قوی',
  'Bull':'روند صعودی',
  'Mixed':'ترکیبی',
  'Bear':'روند نزولی',
  'Strong Bear':'روند نزولی قوی',
  'Unavailable':'ناموجود'
});

const EVIDENCE_FA=Object.freeze({
  'downside decelerating':'سرعت افت کمتر شده',
  'volume shock near recent low':'حجم غیرعادی نزدیک کف اخیر',
  'fresh low reclaim':'پس‌گرفتن کف اخیر',
  'selling volume fading':'حجم فروش در حال کاهش',
  'relative strength recovered':'قدرت نسبی بهتر شده',
  'momentum improving':'مومنتوم در حال بهبود',
  'higher low':'کف بالاتر ساخته',
  'rising MA20':'میانگین ۲۰روزه رو به بالا',
  'positive relative strength':'قدرت نسبی مثبت',
  'strong 20-session trend':'روند ۲۰جلسه‌ای قوی',
  'durable MA50 slope':'شیب میانگین ۵۰روزه پایدار',
  'mature 60-session advance':'رشد ۶۰جلسه‌ای بالغ'
});

export const esc=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
export const ltr=s=>LRI+String(s??'—')+PDI;
export const num=(n,d=2)=>Number.isFinite(Number(n))?Number(n).toLocaleString('en-CA',{maximumFractionDigits:d}):'—';
export const pct=(n,d=1)=>Number.isFinite(Number(n))?`${Number(n)>0?'+':''}${Number(n).toFixed(d)}%`:'—';
export const signedIcon=n=>Number(n)>0?'🟢':Number(n)<0?'🔴':'⚪️';

function marketLabel(key){return MARKET_FA[key]||key}
function regimeFa(x){return REGIME_FA[x]||x||'نامشخص'}
function conditionFa(x){return CONDITION_FA[x]||x||'نامشخص'}
function evidenceFa(x){return EVIDENCE_FA[x]||x}

export function mainMenu(){
  return {
    text:'<b>Market Hunter فارسی</b>\nبازار، سهام‌های Hunter و پورتفولیو از یک منو.',
    keyboard:{inline_keyboard:[
      [{text:'🌍 بازار و شاخص‌ها',callback_data:'m:pulse'}],
      [{text:'🎯 سهام Market Hunter',callback_data:'m:hunter'}],
      [{text:'🧭 Market Brief',callback_data:'brief:hunter'},{text:'💼 پورتفولیو',callback_data:'m:portfolio'}],
      [{text:'🔄 آخرین بروزرسانی',callback_data:'m:status'}]
    ]}
  };
}

export function pulseMenu(pulse){
  const byKey=new Map((pulse?.markets||[]).map(x=>[x.key,x]));
  const button=key=>{
    const m=byKey.get(key);
    const change=m?.returns?.d1;
    return {text:`${marketLabel(key)} ${Number.isFinite(change)?pct(change):''}`.trim(),callback_data:'pulse:'+key};
  };
  return {
    text:`<b>🌍 بازار و شاخص‌ها</b>\nآخرین بسته: ${esc(pulse?.generatedAt?.slice(0,16)?.replace('T',' ')||'—')} UTC\nروی هر بازار بزن یا گزارش کلی را ببین.`,
    keyboard:{inline_keyboard:[
      [{text:'📊 گزارش کلی همه بازارها',callback_data:'pulse:all'}],
      [button('TSX'),button('SP500')],
      [button('NASDAQ100'),button('GOLD')],
      [button('SILVER'),button('BTC')],
      [button('ETH')],
      [{text:'⬅️ منوی اصلی',callback_data:'m:home'}]
    ]}
  };
}

export function marketReport(m){
  if(!m)return {text:'داده‌ی این بازار فعلاً موجود نیست.',keyboard:backPulse()};
  const state=m.descriptiveState||{};
  const lv=m.levels||{};
  const r=m.returns||{};
  const t=m.trend||{};
  const mo=m.momentum||{};
  const lines=[
    `<b>${esc(marketLabel(m.key))}</b> · ${esc(m.name||'')}`,
    `قیمت: <code>${esc(num(m.price))} ${esc(m.currency||'')}</code>  ${signedIcon(r.d1)} امروز <code>${esc(pct(r.d1))}</code>`,
    `۵ روز: <code>${esc(pct(r.d5))}</code> · ۲۰ روز: <code>${esc(pct(r.d20))}</code> · ۶۰ روز: <code>${esc(pct(r.d60))}</code>`,
    '',
    `<b>وضعیت:</b> ${esc(regimeFa(state.regime))} · ${esc(conditionFa(state.condition))}`,
    `روند روزانه: ${esc(t.daily||'—')} · هفتگی: ${esc(t.weekly||'—')}`,
    `RSI: <code>${esc(num(mo.rsi14,1))}</code> · فاصله از MA20: <code>${esc(pct(t.dist20))}</code>`,
    '',
    '<b>سطوح قابل پیگیری</b>',
    `حمایت: <code>${esc(num(lv.support))}</code> · مقاومت: <code>${esc(num(lv.resistance))}</code>`,
    `هشدار روند حوالی: <code>${esc(num(lv.warningLevel))}</code>`,
    `ریسک ساختاری زیر: <code>${esc(num(lv.bearishTrigger))}</code>`,
    '',
    `<i>داده تا ${esc(m.asOf||'—')}؛ این توضیح توصیفی است و سیگنال خرید/فروش نیست.</i>`
  ];
  return {text:lines.join('\n'),keyboard:backPulse()};
}

export function allMarketsReport(report,pulse){
  const groups=report?.groups||[];
  const lines=[
    '<b>📊 گزارش کلی بازار</b>',
    esc(report?.headline||'گزارش کلی فعلاً آماده نیست.'),
    ''
  ];
  for(const g of groups){
    lines.push(`<b>${esc(g.label==='Equities'?'سهام':g.label==='Metals'?'فلزات':'کریپتو')} — ${esc(conditionFa(g.state)||g.state)}</b>`);
    for(const m of g.markets||[]){
      lines.push(`• ${esc(marketLabel(m.key))}: ${esc(regimeFa(m.regime))} · ${esc(conditionFa(m.condition))} · ۵روزه <code>${esc(pct(m.d5))}</code>`);
    }
    lines.push('');
  }
  const dev=(report?.keyDevelopments||[]).slice(0,4);
  if(dev.length){
    lines.push('<b>نکات مهم امروز</b>');
    for(const x of dev)lines.push(`• ${esc(marketLabel(x.market))}: ${esc(translateSentence(x.text))}`);
  }
  if(report?.asOf?.mixedDates)lines.push('',`<i>تاریخ داده‌ها یکسان نیست؛ بازه‌ی این گزارش ${esc(report.asOf.earliest)} تا ${esc(report.asOf.latest)} است.</i>`);
  return {text:lines.join('\n').slice(0,3900),keyboard:backPulse()};
}

function translateSentence(s){
  return String(s||'')
    .replace('short-term structure is weakening','ساختار کوتاه‌مدت ضعیف شده')
    .replace('primary trend remains constructive','روند اصلی هنوز سازنده است')
    .replace('the pullback is unresolved','پول‌بک هنوز حل نشده')
    .replace('rebound should be confirmed rather than assumed','بهتر است برگشت تأیید شود، نه اینکه فرض شود');
}

export function hunterMenu(scan){
  const rows=STAGES.map((stage,i)=>{
    const count=(scan?.byStage?.[stage]||[]).length;
    return [{text:`${STAGE_ICON[stage]} ${STAGE_FA[stage]} (${count})`,callback_data:'stage:'+i}];
  });
  return {
    text:`<b>🎯 Market Hunter</b>\nاسکن ${esc(scan?.marketAsOf||'—')} · ${esc(scan?.classifiedCount??0)} سهم در چهار مرحله طبقه‌بندی شده.\nستاره ⭐ یعنی در سطح «Review First» قرار گرفته.`,
    keyboard:{inline_keyboard:[
      ...rows,
      [{text:'🧭 تغییرات نسبت به اسکن قبل',callback_data:'brief:hunter'}],
      [{text:'⬅️ منوی اصلی',callback_data:'m:home'}]
    ]}
  };
}

export function stageMenu(scan,stageIndex){
  const stage=STAGES[stageIndex]||STAGES[0];
  const items=scan?.byStage?.[stage]||[];
  const review=new Set((scan?.surfacePicks?.[stage]||[]).map(x=>x.symbol));
  const buttons=items.slice(0,24).map(x=>[{text:`${review.has(x.symbol)?'⭐ ':''}${x.symbol} · ${pct(x.ret20)}`,callback_data:'stock:'+x.symbol}]);
  const hidden=Math.max(0,items.length-buttons.length);
  const text=[
    `<b>${STAGE_ICON[stage]} ${STAGE_FA[stage]}</b>`,
    `${items.length} سهم در این مرحله دیده شده${review.size?` · ${review.size} مورد Review First`:''}.`,
    hidden?`${hidden} مورد پایین‌تر برای جلوگیری از شلوغی در این منو نمایش داده نشده.`:'',
    'روی نماد بزن تا گزارش همان سهم را ببینی.'
  ].filter(Boolean).join('\n');
  return {text,keyboard:{inline_keyboard:[
    ...buttons,
    [{text:'⬅️ چهار مرحله',callback_data:'m:hunter'},{text:'🏠 خانه',callback_data:'m:home'}]
  ]}};
}

export function stockReport(scan,symbol){
  const x=(scan?.all||[]).find(v=>v.symbol===symbol);
  if(!x)return {text:'این نماد در اسکن فعلی پیدا نشد.',keyboard:backHunter()};
  const ev=(x.evidence||[]).map(evidenceFa);
  const risk=x.riskFlags||[];
  const lines=[
    `<b>${esc(x.name||x.symbol)}</b> · <code>${esc(x.symbol)}</code>`,
    `${STAGE_ICON[x.stage]||'•'} مرحله: <b>${esc(STAGE_FA[x.stage]||x.stage)}</b> · امتیاز مرحله <code>${esc(num(x.score,1))}</code>`,
    `قیمت: <code>${esc(num(x.price))}</code> · ۵روز <code>${esc(pct(x.ret5))}</code> · ۲۰روز <code>${esc(pct(x.ret20))}</code> · ۶۰روز <code>${esc(pct(x.ret60))}</code>`,
    '',
    `RSI: <code>${esc(num(x.rsi14,1))}</code> · RS20: <code>${esc(pct(x.rs20))}</code> · Momentum shift: <code>${esc(num(x.momentumShift,1))}pp</code>`,
    `فاصله از MA20: <code>${esc(pct(x.dist20))}</code> · از MA50: <code>${esc(pct(x.dist50))}</code>`,
    `فاصله از سقف ۶۰روزه: <code>${esc(pct(x.pullback60))}</code> · ATR: <code>${esc(pct(x.atr14Pct))}</code>`,
    `ساختار: ${esc(x.swingTrend||'—')} · کف محلی <code>${esc(num(x.localLow))}</code> · سقف محلی <code>${esc(num(x.localHigh))}</code>`,
    '',
    '<b>چرا در این مرحله دیده شده؟</b>',
    ...(ev.length?ev.map(v=>'• '+esc(v)):['• شرایط ساختاری این مرحله را پاس کرده'])
  ];
  if(risk.length)lines.push('','<b>موارد احتیاط</b>',...risk.slice(0,4).map(v=>'• '+esc(v)));
  lines.push('',`<i>آخرین داده: ${esc(x.date||scan?.marketAsOf||'—')} · این رتبه‌بندی برای اولویت بررسی چارت است، نه سیگنال.</i>`);
  return {text:lines.join('\n').slice(0,3900),keyboard:{inline_keyboard:[
    [{text:'⬅️ مرحله',callback_data:'stage:'+Math.max(0,STAGES.indexOf(x.stage))},{text:'🏠 خانه',callback_data:'m:home'}]
  ]}};
}

function stageMap(scan){
  const m=new Map();
  for(const stage of STAGES)for(const x of scan?.byStage?.[stage]||[])m.set(x.symbol,stage);
  return m;
}

export function diffScans(current,previous){
  const now=stageMap(current),prev=stageMap(previous);
  const added=[],removed=[],moved=[],stayed=[];
  for(const [symbol,stage] of now){
    if(!prev.has(symbol))added.push({symbol,stage});
    else if(prev.get(symbol)!==stage)moved.push({symbol,from:prev.get(symbol),to:stage});
    else stayed.push({symbol,stage});
  }
  for(const [symbol,stage] of prev)if(!now.has(symbol))removed.push({symbol,stage});
  return {added,removed,moved,stayed};
}

export function marketBrief(current,previous){
  if(!previous)return {text:'برای مقایسه هنوز اسکن قبلی در دسترس نیست.',keyboard:backHunter()};
  const d=diffScans(current,previous);
  const lines=[
    '<b>🧭 Market Brief — تغییرات Hunter</b>',
    `${esc(previous.marketAsOf||'اسکن قبل')} → ${esc(current.marketAsOf||'امروز')}`,
    '',
    `🆕 جدید: <b>${d.added.length}</b> · 🔁 جابه‌جایی مرحله: <b>${d.moved.length}</b> · ❌ خارج‌شده: <b>${d.removed.length}</b> · 👀 باقی‌مانده: <b>${d.stayed.length}</b>`
  ];
  if(d.added.length){
    lines.push('','<b>🆕 تازه اضافه‌شده</b>');
    for(const x of d.added.slice(0,8))lines.push(`• <code>${esc(x.symbol)}</code> → ${esc(STAGE_FA[x.stage]||x.stage)}`);
    if(d.added.length>8)lines.push(`… و ${d.added.length-8} مورد دیگر`);
  }
  if(d.moved.length){
    lines.push('','<b>🔁 تغییر مرحله</b>');
    for(const x of d.moved.slice(0,8))lines.push(`• <code>${esc(x.symbol)}</code>: ${esc(STAGE_FA[x.from]||x.from)} → ${esc(STAGE_FA[x.to]||x.to)}`);
    if(d.moved.length>8)lines.push(`… و ${d.moved.length-8} مورد دیگر`);
  }
  if(d.removed.length){
    lines.push('','<b>❌ دیگر در چهار مرحله نیست</b>');
    for(const x of d.removed.slice(0,8))lines.push(`• <code>${esc(x.symbol)}</code> · قبلاً ${esc(STAGE_FA[x.stage]||x.stage)}`);
    if(d.removed.length>8)lines.push(`… و ${d.removed.length-8} مورد دیگر`);
  }
  const top=(current?.integratedSurfacePicks||[]).slice(0,6);
  if(top.length){
    lines.push('','<b>⭐ اولویت‌های Review امروز</b>');
    for(const x of top)lines.push(`• <code>${esc(x.symbol)}</code> · ${esc(STAGE_FA[x.stage]||x.stage)} · امتیاز ${esc(num(x.score,1))}`);
  }
  return {text:lines.join('\n').slice(0,3900),keyboard:backHunter()};
}

export function statusReport(scan,pulse){
  return {
    text:[
      '<b>🔄 وضعیت بروزرسانی</b>',
      `Hunter: <code>${esc(scan?.marketAsOf||'—')}</code> · ساخته‌شده ${esc(scan?.generatedAt||'—')}`,
      `Market Pulse: <code>${esc(pulse?.markets?.[0]?.asOf||'—')}</code> · ساخته‌شده ${esc(pulse?.generatedAt||'—')}`,
      `Engine: <code>${esc(scan?.version||'—')}</code>`,
      '',
      '<i>بات خودش محاسبات اسکنر را تغییر نمی‌دهد؛ همین خروجی‌های انجین اصلی را می‌خواند.</i>'
    ].join('\n'),
    keyboard:{inline_keyboard:[[{text:'🏠 منوی اصلی',callback_data:'m:home'}]]}
  };
}

export function portfolioEmpty(reason='Cloud Portfolio هنوز برای بات قابل خواندن نیست.'){
  return {
    text:`<b>💼 پورتفولیو</b>\n${esc(reason)}\n\nبعد از اینکه Cloud Portfolio سایت واقعاً Sync شود، همین منو دارایی‌ها و تحلیل کل پورتفولیو را از همان منبع می‌خواند؛ اطلاعات پورتفولیو داخل GitHub ذخیره نمی‌شود.`,
    keyboard:{inline_keyboard:[[{text:'🏠 منوی اصلی',callback_data:'m:home'}]]}
  };
}

export function portfolioMenu(snapshot){
  const items=snapshot?.items||[];
  if(!items.length)return portfolioEmpty('در آخرین Snapshot پورتفولیو دارایی قابل نمایش وجود ندارد.');
  const rows=items.slice(0,20).map(x=>[{text:`${x.symbol} ${signedIcon(x.dayChangePct)} ${pct(x.dayChangePct)}`,callback_data:'pf:'+x.symbol}]);
  return {
    text:`<b>💼 پورتفولیو</b>\nآخرین Snapshot: ${esc(snapshot.marketAsOf||snapshot?.meta?.marketAsOf||items[0]?.asOf||'—')}\nروی هر دارایی بزن یا تحلیل کل را ببین.`,
    keyboard:{inline_keyboard:[
      [{text:'📊 تحلیل کل پورتفولیو',callback_data:'pf:all'}],
      ...rows,
      [{text:'🏠 منوی اصلی',callback_data:'m:home'}]
    ]}
  };
}

export function portfolioItemReport(snapshot,symbol){
  const x=(snapshot?.items||[]).find(v=>v.symbol===symbol);
  if(!x)return portfolioEmpty('این دارایی در Snapshot فعلی پیدا نشد.');
  const e=x.entryStats||{};
  const ex=x.exposure||{};
  const lines=[
    `<b>${esc(x.name||x.symbol)}</b> · <code>${esc(x.symbol)}</code>`,
    `قیمت: <code>${esc(num(x.price))} ${esc(x.currency||'')}</code> · امروز ${signedIcon(x.dayChangePct)} <code>${esc(pct(x.dayChangePct))}</code>`,
    `مرحله فعلی Hunter: <b>${esc(STAGE_FA[x.stage]||x.stage||'خارج از چهار مرحله')}</b>`,
    `بازده ۲۰روزه: <code>${esc(pct(x.ret20))}</code> · RS20: <code>${esc(pct(x.rs20))}</code> · RSI: <code>${esc(num(x.rsi14,1))}</code>`,
    `Exposure: ${esc(ex.assetClass||'—')} · ${esc(ex.group||x.sector||'—')}`
  ];
  if(Number.isFinite(e.returnPct))lines.push(`از زمان خرید: <code>${esc(pct(e.returnPct))}</code> · نسبت به Benchmark: <code>${esc(pct(e.excessVsBenchmarkPct))}</code>`);
  if(Number.isFinite(e.maxDrawdownPct))lines.push(`بیشترین افت از زمان خرید: <code>${esc(pct(e.maxDrawdownPct))}</code> · بهترین حرکت: <code>${esc(pct(e.maxGainPct))}</code>`);
  lines.push('',`<i>داده تا ${esc(x.asOf||snapshot?.marketAsOf||'—')}.</i>`);
  return {text:lines.join('\n'),keyboard:{inline_keyboard:[[{text:'⬅️ پورتفولیو',callback_data:'m:portfolio'},{text:'🏠 خانه',callback_data:'m:home'}]]}};
}

export function portfolioSummaryReport(snapshot){
  const a=snapshot?.portfolioAnalytics||snapshot?.analytics||{};
  const items=snapshot?.items||[];
  if(!items.length)return portfolioEmpty();
  const lines=[
    '<b>📊 تحلیل کل پورتفولیو</b>',
    `تعداد دارایی‌های پوشش‌داده‌شده: <b>${items.length}</b>`
  ];
  if(Number.isFinite(a.portfolioReturnPct))lines.push(`بازده دوره: <code>${esc(pct(a.portfolioReturnPct))}</code> · TSX: <code>${esc(pct(a.benchmarkReturnPct))}</code> · Excess: <code>${esc(pct(a.excessReturnPct))}</code>`);
  if(Number.isFinite(a.annualizedVolatilityPct))lines.push(`نوسان سالانه‌شده اخیر: <code>${esc(pct(a.annualizedVolatilityPct))}</code>`);
  if(Number.isFinite(a.betaVsTsx))lines.push(`Beta نسبت به TSX: <code>${esc(num(a.betaVsTsx,2))}</code>`);
  if(Number.isFinite(a.maxDrawdownPct))lines.push(`Max drawdown نمونه اخیر: <code>${esc(pct(a.maxDrawdownPct))}</code>`);
  if(a.diversificationRead)lines.push(`تنوع حرکتی: ${esc(a.diversificationRead)}`);
  if(a.topRiskContributor?.symbol)lines.push(`بزرگ‌ترین مشارکت مدل‌شده در ریسک: <code>${esc(a.topRiskContributor.symbol)}</code> · ${esc(pct(a.topRiskContributor.riskContributionPct))}`);
  lines.push('','<i>این بخش توصیف تاریخی و پایش پورتفولیو است، نه پیشنهاد معامله.</i>');
  return {text:lines.join('\n'),keyboard:{inline_keyboard:[[{text:'⬅️ پورتفولیو',callback_data:'m:portfolio'},{text:'🏠 خانه',callback_data:'m:home'}]]}};
}

function backPulse(){return {inline_keyboard:[[{text:'⬅️ بازارها',callback_data:'m:pulse'},{text:'🏠 خانه',callback_data:'m:home'}]]}}
function backHunter(){return {inline_keyboard:[[{text:'⬅️ Hunter',callback_data:'m:hunter'},{text:'🏠 خانه',callback_data:'m:home'}]]}}
