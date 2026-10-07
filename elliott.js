export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=x=>Number.isFinite(x)?x.toLocaleString('en-CA',{maximumSignificantDigits:7}):'—';
const words={
  fa:{heading:'ساختار موجی سهمت را بررسی کن',intro:'شمارش احتمالی الیوت، همراه با سطح تأیید و ابطال. این صفحه سفارش ایجاد نمی‌کند.',market:'بازار',symbol:'نماد',analyze:'بررسی نماد',idle:'نماد را وارد کن؛ مثلاً AAPL، RY یا BTC.',loading:'در حال دریافت کندل‌های کامل و بررسی ساختار…',footer:'فقط موج پنج‌تایی استاندارد و اصلاح سادهٔ ABC بررسی می‌شود. نبود ساختار مشخص، یک نتیجهٔ معتبر است.',confirm:'سطح تأیید · B',invalidate:'ابطال شمارش · مبدأ',stop:'حد ضرر فرضی',target:'هدف فرضی',main:'سناریوی اصلی',alternative:'سناریوی جایگزین',long:'صعودی / Long',short:'نزولی / Short',empty:'ساختار قابل‌قبول در چارچوب این مدل پیدا نشد.',quality:'داده برای تحلیل فعلی قابل‌استفاده نیست؛ نمودار قیمت صرفاً برای مشاهده نمایش داده می‌شود.',gaps:'در سابقهٔ داده شکاف وجود دارد؛ شمارش فقط از بخش پیوستهٔ بعد از شکاف استفاده می‌کند.',past:'این تأیید متعلق به گذشته است و پوزیشن باز یا پیشنهاد ورود فعلی نیست.',provisional:'سطوح تا تأیید ورود فرضی‌اند. حد ضرر معامله با سطح ابطال کل شمارش متفاوت است.',details:'جزئیات داده و مومنتوم',daily:'روزانه',data:'آخرین کندل کامل',observed:'زمان دریافت',error:'دریافت تحلیل ممکن نشد. نماد و بازار را بررسی کن و دوباره تلاش کن.',badSymbol:'نماد و بازار با هم سازگار نیستند یا نماد معتبر نیست.',noOrders:'تحلیل پژوهشی · بدون سفارش',origin:'0',candle:'کندل',close:'بسته‌شدن',historical:'تأیید تاریخی'},
  en:{heading:'Read the wave structure',intro:'A potential Elliott count, with confirmation and invalidation levels. This page does not place orders.',market:'Market',symbol:'Symbol',analyze:'Analyze symbol',idle:'Enter a symbol, such as AAPL, RY or BTC.',loading:'Loading completed candles and analyzing structure…',footer:'Standard five-leg impulses and simple ABC corrections only. No supported structure is a valid result.',confirm:'Confirmation · B',invalidate:'Count invalidation · origin',stop:'Hypothetical stop',target:'Hypothetical target',main:'Primary scenario',alternative:'Alternative scenario',long:'Bullish / Long',short:'Bearish / Short',empty:'No supported structure was found under this model.',quality:'The source is not usable for current analysis. The price chart is for observation only.',gaps:'History contains a data gap. Counts use only a continuous segment following the gap.',past:'This is a historical confirmation, not an open position or a current entry recommendation.',provisional:'Levels are provisional until an entry signal. The trade stop differs from full count invalidation.',details:'Data and momentum details',daily:'Daily',data:'Last completed candle',observed:'Observed at',error:'Analysis is unavailable. Check the symbol and market and try again.',badSymbol:'Invalid symbol or a mismatch between symbol and market.',noOrders:'Research analysis · no orders',origin:'0',candle:'Candle',close:'Close',historical:'Historical confirmation'}
};
const statuses={fa:{waiting_correction:'منتظر اصلاح ABC',waiting_breakout:'منتظر شکست سطح B',signal_confirmed:'تأیید تاریخی ورود',invalidated:'سناریوی باطل‌شده',unsupported:'ساختار خارج از مدل',rejected_reward_risk:'ردشده؛ سود به زیان ناکافی'},en:{waiting_correction:'Waiting for ABC correction',waiting_breakout:'Waiting for B-level breakout',signal_confirmed:'Historical entry confirmation',invalidated:'Invalidated scenario',unsupported:'Unsupported structure',rejected_reward_risk:'Rejected: insufficient reward/risk'}};
export function chartSVG(bars,scenario,{lang='en',signal=null}={}) {
  const w=words[lang],points=[...(scenario?.impulse||[]),...(scenario?.correction||[])];
  const first=points[0]?.t,originIndex=bars.findIndex(b=>b.t===first);
  const start=originIndex>=0?Math.max(0,Math.min(bars.length-180,originIndex-8)):Math.max(0,bars.length-180);
  const shown=bars.slice(start);if(!shown.length)return '';
  const levels=[{name:w.confirm,value:scenario?.trigger,color:'#66d6e3'},
    {name:w.invalidate,value:points[0]?.price,color:'#f4c575'},
    {name:w.stop,value:signal?.stop??scenario?.preview?.stop,color:'#ff8290'},
    {name:w.target,value:signal?.target??scenario?.preview?.target,color:'#65d7a0'}].filter(x=>Number.isFinite(x.value));
  const values=shown.flatMap(b=>[b.l,b.h]).concat(levels.map(x=>x.value));
  let low=Math.min(...values),high=Math.max(...values);const pad=Math.max((high-low)*.07,high*.002);low-=pad;high+=pad;
  const WIDTH=980,HEIGHT=410,L=65,R=120,T=25,B=35,pw=WIDTH-L-R,ph=HEIGHT-T-B;
  const x=i=>L+(i+.5)*pw/shown.length,y=price=>T+(high-price)*ph/(high-low);
  const lookup=new Map(shown.map((b,i)=>[b.t,i]));
  let svg=`<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeHTML(lang==='fa'?'نمودار قیمت و شمارش احتمالی موج‌ها':'Price chart and potential wave count')}" data-start="${start}" data-count="${shown.length}"><title>${escapeHTML(w.daily+' · '+w.noOrders)}</title>`;
  for(let i=0;i<=4;i++) {
    const v=low+(high-low)*i/4,yy=y(v);
    svg+=`<line class="chart-grid" x1="${L}" x2="${WIDTH-R}" y1="${yy}" y2="${yy}"/><text class="chart-label" x="${L-8}" y="${yy+4}" text-anchor="end">${number(v)}</text>`;
  }
  const bw=Math.max(.7,Math.min(7,pw/shown.length*.65));
  shown.forEach((b,i)=>{const xx=x(i),color=b.c>=b.o?'#65d7a0':'#ff8290',top=y(Math.max(b.o,b.c)),height=Math.max(1,Math.abs(y(b.o)-y(b.c)));
    svg+=`<line x1="${xx}" x2="${xx}" y1="${y(b.h)}" y2="${y(b.l)}" stroke="${color}"/><rect x="${xx-bw/2}" y="${top}" width="${bw}" height="${height}" fill="${color}"/>`;
  });
  levels.forEach(level=>{const yy=y(level.value);svg+=`<line x1="${L}" x2="${WIDTH-R}" y1="${yy}" y2="${yy}" stroke="${level.color}" stroke-dasharray="5 5" opacity=".7"/><text x="${WIDTH-R+8}" y="${yy+4}" fill="${level.color}" font-size="11">${number(level.value)}</text>`});
  const visible=points.filter(p=>lookup.has(p.t));
  if(visible.length)svg+=`<polyline class="wave-line" points="${visible.map(p=>`${x(lookup.get(p.t))},${y(p.price)}`).join(' ')}"/>`;
  const labels=['0','1','2','3','4','5','A','B','C'];
  points.forEach((p,i)=>{if(!lookup.has(p.t))return;const xx=x(lookup.get(p.t)),yy=y(p.price),dy=p.type==='high'?-12:20;
    svg+=`<circle class="wave-point" cx="${xx}" cy="${yy}" r="4"/><text class="wave-label" x="${xx}" y="${yy+dy}" text-anchor="middle">${labels[i]}</text>`});
  for(const i of [...new Set([0,Math.floor(shown.length/2),shown.length-1])])svg+=`<text class="chart-label" x="${x(i)}" y="${HEIGHT-10}" text-anchor="middle">${escapeHTML(shown[i].date||new Date(shown[i].t).toISOString().slice(0,10))}</text>`;
  svg+='<line id="crosshair" y1="25" y2="375" stroke="#99aec5" stroke-dasharray="3 4" visibility="hidden"/></svg>';
  return svg;
}

export function renderAnalysis(data,{lang='en',selected=0}={}) {
  const w=words[lang],analysis=data.analysis;
  const active=analysis?.current||[],others=(analysis?.candidates||[]).filter(c=>!active.some(a=>a.id===c.id));
  const scenarios=[...active,...others].slice(0,2),scenario=scenarios[selected]||scenarios[0]||null;
  const signal=analysis?.decisions?.find(s=>s.structureId===scenario?.id)||null;
  const date=x=>x?new Date(x).toLocaleString(lang==='fa'?'fa-IR':'en-CA'): '—';
  const esc=escapeHTML;
  let html=`<div class="result-head"><div><h2 dir="ltr">${esc(data.symbol)} <span class="meta">${esc(data.currency||'')}</span></h2><div class="meta">${esc(data.name)} · ${w.daily}</div></div><span class="badge">${w.noOrders}</span></div>`;
  html+=`<div class="meta">${w.data}: <bdi>${esc(date(data.dataAsOf))}</bdi> · ${w.observed}: <bdi>${esc(date(data.generatedAt))}</bdi></div>`;
  if(!data.quality.usable)html+=`<div class="warning">${w.quality} <bdi>${esc(data.quality.reasons.join(', '))}</bdi></div>`;
  else if(data.quality.knownGaps)html+=`<div class="warning">${w.gaps}</div>`;
  if(scenarios.length)html+=`<div class="scenario-tabs">${scenarios.map((c,i)=>`<button type="button" data-scenario="${i}" aria-pressed="${i===selected}">${i?w.alternative:w.main} · ${c.dir===1?w.long:w.short}</button>`).join('')}</div>`;
  html+=`<div class="chart-shell">${chartSVG(data.bars,scenario,{lang,signal})}<div class="chart-readout" id="chartReadout" dir="ltr">${esc(data.symbol)} · 1D</div></div>`;
  if(scenario) {
    html+=`<p class="scenario-copy">${esc(statuses[lang][scenario.status]||scenario.status)}</p>`;
    if(signal)html+=`<p class="warning">${w.past} <bdi>${esc(date(signal.signalCompletedAt))}</bdi></p>`;
    else html+=`<p class="meta">${w.provisional}</p>`;
    const levels=[[w.confirm,scenario.trigger,'confirm'],[w.invalidate,scenario.impulse[0].price,''],[w.stop,signal?.stop??scenario.preview?.stop,'stop'],[w.target,signal?.target??scenario.preview?.target,'target']];
    html+=`<div class="levels">${levels.map(([name,value,cls])=>`<div class="level ${cls}"><small>${name}</small><strong>${number(value)}</strong></div>`).join('')}</div>`;
    if(scenario.reason)html+=`<div class="meta"><bdi>${esc(scenario.reason)}</bdi></div>`;
  } else if(data.quality.usable)html+=`<div class="empty">${w.empty}</div>`;
  const v=signal?.indicators||scenario?.preview?.indicators||data.indicators;
  html+=`<details class="details"><summary>${w.details}</summary><p dir="ltr">${esc(data.source)} · ${esc(data.quality.calendarConvention)} · ${esc(data.quality.completionConvention)}</p>`;
  if(v)html+=`<div class="indicator-row" dir="ltr"><span>RSI(14): ${number(v.rsi14)}</span><span>RVOL(20): ${number(v.rvol20)}</span><span>ATR(14): ${number(v.atr14)}</span></div><p class="meta">${signal?(lang==='fa'?'مقادیر مربوط به زمان تأیید تاریخی هستند.':'Values at the historical confirmation time.'):(lang==='fa'?'مقادیر مربوط به آخرین کندل کامل هستند.':'Values at the latest completed candle.')}</p>`;
  html+=`<p dir="ltr">${esc(data.limitations.join(' · '))}</p></details>`;
  return {html,scenarios};
}

if(typeof document!=='undefined') {
  let lang='fa',latest=null,selected=0,request=0,controller=null;
  const el=id=>document.getElementById(id);
  function render() {
    const w=words[lang];document.documentElement.lang=lang;document.documentElement.dir=lang==='fa'?'rtl':'ltr';
    for(const [id,key] of [['heading','heading'],['intro','intro'],['marketLabel','market'],['symbolLabel','symbol'],['analyze','analyze'],['footer','footer']])el(id).textContent=w[key];
    el('language').textContent=lang==='fa'?'English':'فارسی';
    if(!latest)return;
    const result=renderAnalysis(latest,{lang,selected});el('result').innerHTML=result.html;
    el('result').querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>{selected=Number(button.dataset.scenario);render()}));
    const svg=el('result').querySelector('svg');
    if(svg) {
      const update=event=>{
        const rect=svg.getBoundingClientRect(),local=(event.clientX-rect.left)*980/rect.width;
        const n=Number(svg.dataset.count),i=Math.max(0,Math.min(n-1,Math.floor((local-65)/(980-65-120)*n)));
        const b=latest.bars[Number(svg.dataset.start)+i];if(!b)return;
        const cross=el('crosshair'),x=65+(i+.5)*(980-65-120)/n;
        cross.setAttribute('x1',x);cross.setAttribute('x2',x);cross.setAttribute('visibility','visible');
        el('chartReadout').textContent=`${b.date} · O ${number(b.o)} H ${number(b.h)} L ${number(b.l)} C ${number(b.c)}`;
      };
      svg.addEventListener('pointermove',update);svg.addEventListener('pointerleave',()=>el('crosshair')?.setAttribute('visibility','hidden'));
    }
  }
  el('language').addEventListener('click',()=>{lang=lang==='fa'?'en':'fa';render();if(!latest)el('message').textContent=words[lang].idle});
  el('market').addEventListener('change',()=>{el('symbol').placeholder={us:'AAPL',ca:'RY',crypto:'BTC',metals:'GLD'}[el('market').value]});
  el('symbolForm').addEventListener('submit',async event=>{
    event.preventDefault();const id=++request;controller?.abort();controller=new AbortController();
    latest=null;selected=0;el('result').hidden=true;el('result').innerHTML='';el('message').className='';el('message').textContent=words[lang].loading;el('analyze').disabled=true;
    try {
      const params=new URLSearchParams({symbol:el('symbol').value,market:el('market').value});
      const response=await fetch('/api/elliott?'+params,{signal:controller.signal,cache:'no-store'}),data=await response.json();
      if(id!==request)return;
      if(!response.ok)throw new Error(data.error||'analysis_source_unavailable');
      latest=data;el('message').textContent='';render();el('result').hidden=false;
    }catch(e){if(id!==request||e.name==='AbortError')return;el('message').className='error';el('message').textContent=['invalid_symbol','invalid_market','market_symbol_mismatch'].includes(e.message)?words[lang].badSymbol:words[lang].error}
    finally{if(id===request)el('analyze').disabled=false}
  });
  render();
}
