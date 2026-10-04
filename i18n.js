window.MHI18n=(()=>{
  let lang='en';try{lang=localStorage.getItem('mh-language')==='fa'?'fa':'en'}catch{}
  const t=(en,fa)=>lang==='fa'?fa:en;
  function apply(){document.documentElement.lang=lang;document.documentElement.dataset.language=lang;const b=document.getElementById('languageBtn');if(b){b.textContent=lang==='fa'?'EN':'فارسی';b.setAttribute('aria-label',t('Read Persian explanations','نمایش توضیحات انگلیسی'));}document.getElementById('installBtn').textContent=t('Install','نصب');const labels={home:['Home','خانه'],shortlist:['Charts to Review','بررسی سهم‌ها'],portfolio:['Portfolio','پورتفولیو'],watchlist:['Watchlist','دیده‌بان'],engines:['Paper Engines','موتورها']};document.querySelectorAll('.navbtn[data-view]').forEach(button=>{const pair=labels[button.dataset.view],small=button.querySelector('small');if(small)small.textContent=t(pair[0]==='Charts to Review'?'Review':pair[0]==='Paper Engines'?'Engines':pair[0],button.dataset.view==='shortlist'?'بررسی':pair[1]);else{const text=[...button.childNodes].find(n=>n.nodeType===3);if(text)text.textContent=t(...pair)}});}
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
    if(Number.isFinite(x.rs20)){if(x.rs20>=3)now.push(t('20-day performance is ahead of TSX.','عملکرد ۲۰روزه بهتر از شاخص TSX است.'));else if(x.rs20<=-3)now.push(t('20-day performance is behind TSX.','عملکرد ۲۰روزه ضعیف‌تر از شاخص TSX است.'));}
    if(x.lowBroken===true)watch.push(t('The recent local low has broken.','کف اخیر شکسته شده است.'));
    if(Number.isFinite(x.dist20)&&x.dist20>=10)watch.push(t('Price is very extended above its 20-day average.','قیمت فاصلهٔ زیادی بالای میانگین ۲۰روزه دارد.'));else if(Number.isFinite(x.dist20)&&x.dist20>=6)watch.push(t('Price is extended above its 20-day average.','قیمت از میانگین ۲۰روزه فاصله گرفته است.'));
    if(Number.isFinite(x.rsi14)&&x.rsi14>=80)watch.push(t('RSI is extremely elevated.','RSI بسیار بالاست.'));else if(Number.isFinite(x.rsi14)&&x.rsi14>=72)watch.push(t('RSI is elevated.','RSI بالاست.'));
    return {lead,now:now.slice(0,2),watch:watch.slice(0,2)};
  }
  function stockFa(x){const r=read(x);return [r.lead,...r.now,...r.watch].join(' ');}
  document.addEventListener('DOMContentLoaded',apply);
  return {t,stockFa,read,stageLabel,language:()=>lang,toggle(){lang=lang==='fa'?'en':'fa';try{localStorage.setItem('mh-language',lang)}catch{}apply();}};
})();
