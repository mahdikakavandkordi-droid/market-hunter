window.MHI18n=(()=>{
  let lang='en';try{lang=localStorage.getItem('mh-language')==='fa'?'fa':'en'}catch{}
  const t=(en,fa)=>lang==='fa'?fa:en;
  function apply(){document.documentElement.lang=lang;document.documentElement.dataset.language=lang;const b=document.getElementById('languageBtn');if(b){b.textContent=lang==='fa'?'EN':'فارسی';b.setAttribute('aria-label',t('Read Persian explanations','نمایش توضیحات انگلیسی'));}document.getElementById('installBtn').textContent=t('Install','نصب');const labels={home:['Home','خانه'],shortlist:['Charts to Review','بررسی سهم‌ها'],portfolio:['Portfolio','پورتفولیو'],watchlist:['Watchlist','دیده‌بان'],engines:['Paper Engines','موتورها']};document.querySelectorAll('.navbtn[data-view]').forEach(button=>{const pair=labels[button.dataset.view],small=button.querySelector('small');if(small)small.textContent=t(pair[0]==='Charts to Review'?'Review':pair[0]==='Paper Engines'?'Engines':pair[0],pair[1]);else{const text=[...button.childNodes].find(n=>n.nodeType===3);if(text)text.textContent=t(...pair)}});}
  function stockFa(x){
    if(!x)return 'دادهٔ فعلی در دسترس نیست؛ ارزیابی معتبر ممکن نیست.';
    const stages={'Early Watch':'فشار فروش نزدیک کف اخیر رو به کاهش است، اما هنوز برگشت روند تأیید نشده است.','Recovery':'سهم پس از ضعف قبلی در حال بازسازی است و نشانه‌هایی از بهبود ساختار و شتاب دیده می‌شود.','Attractive Growth':'روند کلی سازنده است و قیمت در مرحلهٔ رشد قوی‌تری قرار دارد.','Established Move':'روند صعودی بلندمدت جا افتاده و هنوز پابرجاست؛ باید دید بدون فاصله‌گرفتن زیاد از میانگین‌ها ادامه پیدا می‌کند یا نه.'};
    const out=[stages[x.stage]||'سهم خارج از مراحل فعال هانتر است؛ بررسی بر اساس ساختار، شتاب و قدرت نسبی انجام می‌شود.'];
    const swing={'Higher highs + higher lows':'سقف‌ها و کف‌های بالاتر حفظ شده‌اند.','Structure improving':'ساختار نوسان‌ها رو به بهبود است.','Lower highs + lower lows':'سقف‌ها و کف‌های پایین‌تر، ضعف ساختار را نشان می‌دهند.','Structure weakening':'ساختار نوسان‌ها رو به ضعف است.'};if(swing[x.swingTrend])out.push(swing[x.swingTrend]);
    if(Number.isFinite(x.momentumShift)){if(x.momentumShift>=4)out.push('شتاب حرکت به‌وضوح بهتر شده است.');else if(x.momentumShift>=1)out.push('شتاب حرکت رو به بهبود است.');else if(x.momentumShift<=-4)out.push('شتاب حرکت به‌طور محسوسی کاهش یافته است.');else if(x.momentumShift<0)out.push('شتاب حرکت کمی ضعیف‌تر شده است.');}
    if(Number.isFinite(x.rs20)){if(x.rs20>=8)out.push('قدرت نسبی ۲۰روزه به‌وضوح جلوتر از شاخص TSX است.');else if(x.rs20>=3)out.push('قدرت نسبی ۲۰روزه جلوتر از TSX است.');else if(x.rs20<=-8)out.push('قدرت نسبی ۲۰روزه به‌وضوح عقب‌تر از TSX است.');else if(x.rs20<=-3)out.push('قدرت نسبی ۲۰روزه عقب‌تر از TSX است.');}
    if(x.lowBroken===true)out.push('احتیاط: کف محلی اخیر شکسته شده است.');
    if(x.dist20>=10)out.push('قیمت فاصلهٔ زیادی بالای میانگین ۲۰روزه دارد.');else if(x.dist20>=6)out.push('قیمت بالاتر از میانگین ۲۰روزه کشیده شده است.');
    if(x.rsi14>=80)out.push('RSI بسیار بالاست.');else if(x.rsi14>=72)out.push('RSI بالاست.');
    return out.join(' ');
  }
  document.addEventListener('DOMContentLoaded',apply);
  return {t,stockFa,language:()=>lang,toggle(){lang=lang==='fa'?'en':'fa';try{localStorage.setItem('mh-language',lang)}catch{}apply();}};
})();
