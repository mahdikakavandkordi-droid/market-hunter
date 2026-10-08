window.MHI18n=(()=>{
  let lang='en';try{lang=localStorage.getItem('mh-language')==='fa'?'fa':'en'}catch{}
  const t=(en,fa)=>lang==='fa'?fa:en;
  function apply(){document.documentElement.lang=lang;document.documentElement.dataset.language=lang;const b=document.getElementById('languageBtn');if(b){b.textContent=lang==='fa'?'EN':'فارسی';b.setAttribute('aria-label',t('Read Persian explanations','نمایش توضیحات انگلیسی'));}const labels={home:['Home','خانه'],shortlist:['Charts to Review','بررسی سهم‌ها'],portfolio:['Portfolio','پورتفولیو'],watchlist:['Watchlist','دیده‌بان'],engines:['Paper Engines','موتورها']};document.querySelectorAll('.navbtn[data-view]').forEach(button=>{const pair=labels[button.dataset.view],small=button.querySelector('small');if(small)small.textContent=t(pair[0]==='Charts to Review'?'Review':pair[0]==='Paper Engines'?'Engines':pair[0],button.dataset.view==='shortlist'?'بررسی':pair[1]);else{const text=[...button.childNodes].find(n=>n.nodeType===3);if(text)text.textContent=t(...pair)}});}
  const stageFa={'Early Watch':'نشانه‌های اولیه',Recovery:'بازیابی','Attractive Growth':'رشد قوی','Established Move':'روند جاافتاده'};
  function stageLabel(stage){return t(stage,stageFa[stage]||stage);}
  function read(x){
    if(!x)return {lead:t('Market data unavailable.','دادهٔ سهم در دسترس نیست.'),now:[],watch:[]};
    const leads={
      'Early Watch':['Selling pressure is easing; a reversal is not confirmed.','فشار فروش کمتر شده؛ برگشت روند هنوز تأیید نشده.'],
      Recovery:['The chart is rebuilding after earlier weakness.','سهم پس از افت قبلی در حال بازسازی است.'],
      'Attractive Growth':['Price is participating in a stronger uptrend.','قیمت در یک روند صعودی قوی‌تر حرکت می‌کند.'],
      'Established Move':['The uptrend is established; watch for an overstretched move.','روند صعودی جا افتاده؛ فاصلهٔ زیاد از میانگین‌ها را زیر نظر بگیر.']};
    const lead=t(...(leads[x.stage]||['Outside the active Hunter stages.','خارج از مراحل فعال هانتر.']));
    const now=[],watch=[];
    const swing={'Higher highs + higher lows':['Higher highs and higher lows are intact.','سقف‌ها و کف‌های بالاتر حفظ شده‌اند.'],'Structure improving':['Swing structure is improving.','ساختار قیمت بهتر شده است.'],'Lower highs + lower lows':['Lower highs and lower lows still show weakness.','سقف‌ها و کف‌های پایین‌تر هنوز نشانهٔ ضعف هستند.'],'Structure weakening':['Swing structure is weakening.','ساختار قیمت ضعیف‌تر شده است.']};
    if(swing[x.swingTrend])now.push(t(...swing[x.swingTrend]));
    if(Number.isFinite(x.momentumShift)){if(x.momentumShift>=4)now.push(t('Momentum has improved clearly.','شتاب حرکت به‌وضوح بهتر شده.'));else if(x.momentumShift>=1)now.push(t('Momentum is improving.','شتاب حرکت رو به بهبود است.'));else if(x.momentumShift<=-4)now.push(t('Momentum has cooled noticeably.','شتاب حرکت به‌طور محسوسی کاهش یافته.'));else if(x.momentumShift<0)now.push(t('Momentum is slightly softer.','شتاب حرکت کمی ضعیف‌تر شده.'));}
    if(Number.isFinite(x.rs20)){if(x.rs20>=3)now.push(t('20-day performance is '+x.rs20.toFixed(1)+' percentage points ahead of the benchmark.','بازده ۲۰روزه، '+x.rs20.toFixed(1)+' واحد درصد بهتر از شاخص مبناست.'));else if(x.rs20<=-3)now.push(t('20-day performance is '+Math.abs(x.rs20).toFixed(1)+' percentage points behind the benchmark.','بازده ۲۰روزه، '+Math.abs(x.rs20).toFixed(1)+' واحد درصد ضعیف‌تر از شاخص مبناست.'));}
    if(x.lowBroken===true||x.lowState==='local_low_broken')watch.push(t('The recent local low has broken.','کف اخیر شکسته شده است.'));
    if(Number.isFinite(x.dist20)&&x.dist20>=10)watch.push(t('Price is very extended above its 20-day average.','قیمت فاصلهٔ زیادی بالای میانگین ۲۰روزه دارد.'));else if(Number.isFinite(x.dist20)&&x.dist20>=6)watch.push(t('Price is extended above its 20-day average.','قیمت از میانگین ۲۰روزه فاصله گرفته است.'));
    if(Number.isFinite(x.rsi14)&&x.rsi14>=80)watch.push(t('RSI is very high; the move may be stretched.','شاخص قدرت حرکت (RSI) بسیار بالاست؛ حرکت ممکن است بیش از حد کشیده شده باشد.'));else if(Number.isFinite(x.rsi14)&&x.rsi14>=72)watch.push(t('RSI is high; watch for a pause in momentum.','شاخص قدرت حرکت (RSI) بالاست؛ احتمال مکث حرکت را زیر نظر بگیر.'));
    return {lead,now:now.slice(0,3),watch:watch.slice(0,2)};
  }
  function technical(x){
    const r=read(x),monitor=[];
    const finite=v=>typeof v==='number'&&Number.isFinite(v);
    const lowBroken=x?.lowBroken===true||x?.lowState==='local_low_broken';
    const negative=r.now.filter(v=>v===t('Swing structure is weakening.','ساختار قیمت ضعیف‌تر شده است.')||v===t('Lower highs and lower lows still show weakness.','سقف‌ها و کف‌های پایین‌تر هنوز نشانهٔ ضعف هستند.')||v===t('Momentum has cooled noticeably.','شتاب حرکت به‌طور محسوسی کاهش یافته.')||v===t('Momentum is slightly softer.','شتاب حرکت کمی ضعیف‌تر شده.')||(finite(x?.rs20)&&x.rs20<=-3&&v===r.now.at(-1)));
    const support=r.now.find(v=>!negative.includes(v));
    const weakness=r.watch[0]||negative[0];
    const summary=[r.lead,support,weakness].filter(Boolean);
    if(!r.now.length&&!r.watch.length&&x)summary.push(t('Supporting metrics are unavailable; the stage label alone is not enough to assess this setup.','معیارهای پشتیبان موجود نیستند؛ برچسب مرحله به‌تنهایی برای ارزیابی این وضعیت کافی نیست.'));
    const invalidLevels=finite(x?.localLow)&&finite(x?.localHigh)&&x.localLow>=x.localHigh;
    if(!invalidLevels&&finite(x?.localLow)&&x.localLow>0)monitor.push({kind:'local-low',level:x.localLow,text:lowBroken?t('Watch whether price reclaims the recorded local low.','بازگشت قیمت بالای کف ثبت‌شده را دنبال کن.'):t('Watch whether the recorded local low holds or breaks.','حفظ یا شکسته‌شدن کف ثبت‌شده را دنبال کن.')});
    if(!invalidLevels&&finite(x?.localHigh)&&x.localHigh>0)monitor.push({kind:'local-high',level:x.localHigh,text:x.highBroken===true?t('Watch whether price holds above the recorded local high.','حفظ قیمت بالای سقف ثبت‌شده را دنبال کن.'):t('Watch whether price clears the recorded local high.','عبور قیمت از سقف ثبت‌شده را دنبال کن.')});
    if(monitor.length<2&&finite(x?.rs20))monitor.push({kind:'relative-strength',level:null,text:x.rs20>0?t('Watch whether outperformance versus the benchmark persists.','تداوم عملکرد بهتر از شاخص مبنا را دنبال کن.'):x.rs20<0?t('Watch whether the performance gap behind the benchmark narrows.','کمترشدن عقب‌ماندگی از شاخص مبنا را دنبال کن.'):t('Watch whether relative performance improves or deteriorates.','بهتر یا ضعیف‌ترشدن عملکرد نسبت به شاخص مبنا را دنبال کن.')});
    if(monitor.length<2&&finite(x?.momentumShift))monitor.push({kind:'momentum',level:null,text:x.momentumShift>0?t('Watch whether improving momentum persists or cools.','ادامهٔ بهبود یا کاهش شتاب حرکت را دنبال کن.'):t('Watch whether momentum recovers from its recorded level.','بهبود شتاب حرکت نسبت به وضعیت ثبت‌شده را دنبال کن.')});
    return {summary:summary.slice(0,3),monitor:monitor.slice(0,2),completedSession:/^\d{4}-\d{2}-\d{2}$/.test(x?.date||'')&&Number.isFinite(Date.parse(x.date))?x.date:null,evidence:r.now,cautions:r.watch};
  }
  // Presentation only: retain backend classifications, evidence and levels.
  const words={
    'Strong Bull':'صعودی قوی','Bull':'صعودی','Mixed':'ترکیبی','Bear':'نزولی','Strong Bear':'نزولی قوی',
    'Weakening':'رو به ضعف','Pullback':'عقب‌نشینی قیمت','Breakout / Near High':'شکست مقاومت / نزدیک سقف','Positive Momentum':'شتاب مثبت','Recovery Attempt':'تلاش برای بازیابی','Extended':'فاصلهٔ زیاد از میانگین','Range / Mixed':'نوسانی / بدون جهت روشن',
    'Equities':'شاخص‌های سهام','Metals':'فلزات','Crypto':'رمزارزها','Constructive but uneven':'مثبت، با قدرت متفاوت','Strong trend · Pullback':'روند قوی همراه با عقب‌نشینی','Strong trend':'روند قوی','Unavailable':'داده موجود نیست',
    'Historically Favorable':'عملکرد تاریخی بهتر از معمول','Historically Weaker':'عملکرد تاریخی ضعیف‌تر از معمول','Mixed / Near Baseline':'نتایج ترکیبی / نزدیک معمول','Long-term Favorable · Recent Weaker':'سابقهٔ کلی بهتر؛ نمونه‌های اخیر ضعیف‌تر','Long-term Weaker · Recent Better':'سابقهٔ کلی ضعیف‌تر؛ نمونه‌های اخیر بهتر',
    'High':'بالا','Medium':'متوسط','Low':'پایین','Unknown':'نامشخص','Exact State':'وضعیت دقیق مشابه','State Family':'گروه وضعیت‌های مشابه','Regime':'روند کلی','Condition':'وضعیت کوتاه‌مدت','Market Baseline':'سابقهٔ عمومی بازار',
    'Most tracked markets remain constructive, but leadership is not uniform.':'بیشتر شاخص‌ها وضعیت مثبتی دارند، اما قدرت حرکتشان یکسان نیست.',
    'Most tracked markets in this group show weakening short-term conditions.':'بیشتر بازارهای این گروه در کوتاه‌مدت ضعیف‌تر شده‌اند.',
    'All tracked markets in this group remain in a strong bull regime.':'روند اصلی همهٔ بازارهای این گروه همچنان صعودی قوی است.',
    'Signals are mixed across the tracked markets.':'بازارهای این گروه جهت یکسانی نشان نمی‌دهند.','No data.':'داده‌ای موجود نیست.', 'Update required':'نیازمند بروزرسانی', 'Current assessment unavailable; one or more completed-session inputs are not verified fresh.':'ارزیابی فعلی در دسترس نیست؛ تازگی دادهٔ یک یا چند بازار تأیید نشده است.'
  };
  function text(value){return lang==='fa'?(words[value]||value||'—'):(value||'—');}
  function marketRead(m){
    if(window.MarketHunterStatus&&!window.MarketHunterStatus.freshness(m).usable)return t('Current trend assessment unavailable. Last completed session: ','ارزیابی فعلی روند در دسترس نیست. آخرین جلسهٔ کامل: ')+(m?.asOf||'—');
    const trends={'Strong Bull':['The main trend is strongly upward.','روند اصلی صعودی قوی است.'],Bull:['The main trend is upward.','روند اصلی صعودی است.'],Mixed:['The main trend has no clear direction.','روند اصلی جهت روشنی ندارد.'],Bear:['The main trend is downward.','روند اصلی نزولی است.'],'Strong Bear':['The main trend is strongly downward.','روند اصلی نزولی قوی است.']};
    const conditions={Weakening:['Short-term price structure is weakening.','ساختار قیمت در کوتاه‌مدت ضعیف‌تر شده.'],Pullback:['Price is pulling back within that trend.','قیمت در دل این روند عقب‌نشینی کرده.'],'Breakout / Near High':['Price is breaking out or trading near its recent high.','قیمت در حال شکست مقاومت یا نزدیک سقف اخیر است.'],'Positive Momentum':['Short-term momentum is positive.','شتاب کوتاه‌مدت مثبت است.'],'Recovery Attempt':['Price is attempting to recover; confirmation is still needed.','قیمت در تلاش برای بازیابی است؛ هنوز به تأیید نیاز دارد.'],Extended:['Price is stretched; a pause or pullback remains a risk.','قیمت کشیده شده؛ احتمال توقف یا عقب‌نشینی را زیر نظر بگیر.'],'Range / Mixed':['Short-term movement is mixed or range-bound.','حرکت کوتاه‌مدت نوسانی و بدون جهت روشن است.']};
    return [trends[m?.regime]?t(...trends[m.regime]):t('Trend assessment unavailable.','ارزیابی روند موجود نیست.'),conditions[m?.condition]?t(...conditions[m.condition]):text(m?.condition)].filter(Boolean).join(' ');
  }
  function headline(value){
    const pieces={
      'Current cross-market assessment is incomplete; some inputs require an update.':'ارزیابی فعلی بازار کامل نیست؛ بعضی داده‌ها نیاز به بروزرسانی دارند.',
      'Risk-on but uneven: U.S. equities and crypto retain strong primary trends while Canada lags and metals are not confirming.':'سهام آمریکا و رمزارزها روند اصلی قوی دارند؛ کانادا عقب‌تر است و فلزات این قدرت را تأیید نمی‌کنند.',
      'Broadly risk-on, led by U.S. equities and crypto, with confirmation varying across other groups.':'سهام آمریکا و رمزارزها پیشتاز فضای مثبت بازارند؛ وضعیت سایر گروه‌ها یکسان نیست.',
      'Mixed cross-market environment.':'جهت بازارها یکسان نیست.',
      'Precious metals are currently in a weakening short-term phase.':'طلا و نقره در کوتاه‌مدت ضعیف‌تر شده‌اند.'
    };
    if(lang!=='fa')return value||'Market summary unavailable.';
    let result=value||'خلاصهٔ بازار در دسترس نیست.';
    for(const [en,fa] of Object.entries(pieces))result=result.replace(en,fa);
    return result;
  }
const outlookFa={
  "Primary trend remains constructive, and the broader pullback family is reasonably supported, but the exact current setup has shown materially weaker recent follow-through. Treat rebound expectations cautiously until price confirms.": "روند اصلی مثبت است، اما نمونه‌های اخیرِ دقیقاً مشابه، ادامهٔ حرکت ضعیف‌تری داشته‌اند. برگشت قیمت هنوز به تأیید نیاز دارد.",
  "Primary trend remains constructive, but recent historical pullback analogs have been weaker than the market's normal baseline. Treat this as an intact trend with elevated continuation risk, not an automatic rebound signal.": "روند اصلی مثبت است، اما عقب‌نشینی‌های مشابه در نمونه‌های اخیر ضعیف‌تر از عملکرد معمول بازار بوده‌اند. برگشت قیمت قطعی نیست.",
  "Primary trend remains constructive and recent pullback analogs have generally held up better than baseline. Continuation is supported historically, but confirmation still matters.": "روند اصلی مثبت است و عقب‌نشینی‌های مشابه اخیر عموماً بهتر از عملکرد معمول بازار بوده‌اند. ادامهٔ صعود همچنان به تأیید قیمت نیاز دارد.",
  "Primary trend remains constructive, while pullback analogs are mixed. Expect a two-sided setup until support or resistance resolves.": "روند اصلی مثبت است، اما نتایج عقب‌نشینی‌های مشابه یکدست نیست. واکنش به حمایت یا مقاومت تعیین‌کننده است.",
  "Trend is strong, but advance/near-high analogs have recently produced less follow-through than the market baseline. Consolidation or slower continuation is a meaningful base case.": "روند قوی است، اما حرکت‌های مشابه اخیر، ادامهٔ ضعیف‌تری از عملکرد معمول بازار داشته‌اند. مکث یا رشد آهسته‌تر محتمل است.",
  "Trend and location are constructive. Historical advance behavior does not remove pullback risk, so follow-through above resistance matters more than the headline trend label.": "روند و موقعیت قیمت مثبت‌اند؛ احتمال عقب‌نشینی باقی است. ادامهٔ حرکت بالای مقاومت را دنبال کن.",
  "Short-term structure is soft, but similar recent analogs have still produced positive forward returns. This is better framed as a damaged or uncertain setup than a clean bearish call.": "ساختار کوتاه‌مدت ضعیف است، اما نمونه‌های مشابه اخیر بازده بعدی مثبت داشته‌اند. نتیجه هنوز نامطمئن است.",
  "Short-term structure is soft and recent analogs have underperformed baseline. Risk remains elevated until the market reclaims nearby trend levels.": "ساختار کوتاه‌مدت ضعیف است و نمونه‌های مشابه اخیر از عملکرد معمول بازار عقب مانده‌اند. بازگشت قیمت به سطوح روند اهمیت دارد.",
  "Short-term structure is soft, but historical follow-through is mixed. Confirmation from support/resistance is more useful than assuming immediate continuation lower.": "ساختار کوتاه‌مدت ضعیف است، اما نتایج تاریخی یکدست نیست. واکنش قیمت به حمایت و مقاومت را دنبال کن.",
  "The market is attempting to recover from a weaker regime. Historical follow-through should be treated as conditional on reclaiming resistance and improving structure.": "بازار در تلاش برای بازیابی است. عبور از مقاومت و بهترشدن ساختار قیمت برای ادامهٔ این حرکت اهمیت دارد.",
  "Trend is constructive but stretched. Historical context favors separating trend strength from entry timing; consolidation risk is elevated.": "روند مثبت اما کشیده است. قدرت روند به‌تنهایی زمان مناسب ورود را مشخص نمی‌کند؛ احتمال مکث بیشتر شده.",
  "Current analogs have historically outperformed this market's baseline across the tested horizons.": "وضعیت‌های مشابه در بازه‌های بررسی‌شده بهتر از عملکرد معمول این بازار بوده‌اند.",
  "Current analogs have historically underperformed this market's baseline across the tested horizons.": "وضعیت‌های مشابه در بازه‌های بررسی‌شده ضعیف‌تر از عملکرد معمول این بازار بوده‌اند.",
  "Historical analogs are mixed across horizons, so scenario levels matter more than a single directional forecast.": "نتایج تاریخی در بازه‌های مختلف یکسان نیست؛ واکنش به سطوح قیمت مهم‌تر از یک پیش‌بینی یک‌طرفه است."
};
  function outlook(value){return lang==='fa'?(outlookFa[value]||value||'توضیحی موجود نیست.'):(value||'No assessment available.');}
  function stockFa(x){const r=read(x);return [r.lead,...r.now,...r.watch].join(' ');}
  document.addEventListener('DOMContentLoaded',apply);
  return {t,text,marketRead,headline,outlook,stockFa,read,technical,stageLabel,language:()=>lang,toggle(){lang=lang==='fa'?'en':'fa';try{localStorage.setItem('mh-language',lang)}catch{}apply();}};
})();
