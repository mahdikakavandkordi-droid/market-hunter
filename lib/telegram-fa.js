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

function directionFa(x){
  const v=String(x||'').toLowerCase();
  if(v==='up')return 'صعودی';
  if(v==='down')return 'نزولی';
  if(v==='mixed')return 'ترکیبی';
  if(v==='flat')return 'خنثی';
  return x||'نامشخص';
}

function marketInterpretation(m){
  const state=m?.descriptiveState||{}, r=m?.returns||{}, t=m?.trend||{}, mo=m?.momentum||{};
  const parts=[];
  const regime=String(state.regime||'');
  const condition=String(state.condition||'');
  if(['Strong Bull','Bull'].includes(regime)){
    parts.push('ساختار اصلی بازار هنوز سازنده است');
  }else if(['Strong Bear','Bear'].includes(regime)){
    parts.push('ساختار اصلی بازار فعلاً تحت فشار است');
  }else{
    parts.push('بازار فعلاً جهت یک‌دست و شفافی ندارد');
  }
  if(condition==='Weakening')parts.push('و کوتاه‌مدت نشانه‌های تضعیف دیده می‌شود');
  else if(condition==='Pullback')parts.push('و حرکت فعلی بیشتر شبیه پول‌بک داخل ساختار موجود است');
  else if(condition==='Positive Momentum')parts.push('و مومنتوم کوتاه‌مدت با روند همراه است');
  else if(condition==='Recovery Attempt')parts.push('و نشانه‌های اولیه‌ی تلاش برای برگشت دیده می‌شود');
  else if(condition==='Extended')parts.push('اما حرکت کوتاه‌مدت کمی کشیده شده');
  else if(condition==='Breakout / Near High')parts.push('و بازار نزدیک ناحیه‌ی سقف/شکست معامله می‌شود');
  else parts.push('و شرایط کوتاه‌مدت هنوز ترکیبی است');
  if(t.daily&&t.weekly&&String(t.daily)!==String(t.weekly))parts.push('؛ روزانه و هفتگی هم‌جهت نیستند، پس تأیید روند ضعیف‌تر است');
  if(Number.isFinite(Number(mo.rsi14))&&Number(mo.rsi14)>=68)parts.push('؛ RSI هم نشان می‌دهد بازار به ناحیه‌ی داغ نزدیک شده');
  if(Number.isFinite(Number(mo.rsi14))&&Number(mo.rsi14)<=38)parts.push('؛ RSI نشان می‌دهد فشار فروش بالاست و باید کیفیت برگشت را دید');
  if(Number.isFinite(Number(r.d20))&&Number(r.d20)>0&&Number(r.d5)<0)parts.push('؛ افت چند روز اخیر هنوز رشد ۲۰روزه را کاملاً از بین نبرده');
  return parts.join('')+'.';
}

function marketWatchLine(m){
  const state=m?.descriptiveState||{}, lv=m?.levels||{}, t=m?.trend||{};
  if(state.condition==='Weakening'||state.condition==='Pullback'){
    return `مهم‌ترین چیز برای پیگیری: واکنش قیمت به حمایت ${num(lv.support)} و اینکه فاصله از MA20 دوباره بهتر می‌شود یا نه.`;
  }
  if(state.condition==='Recovery Attempt'){
    return `مهم‌ترین چیز برای پیگیری: حفظ کف‌های اخیر و عبور پایدار از مقاومت ${num(lv.resistance)}.`;
  }
  if(state.condition==='Extended'||state.condition==='Breakout / Near High'){
    return `مهم‌ترین چیز برای پیگیری: اینکه حرکت بدون افت شدید مومنتوم بالای MA20 بماند؛ فاصله فعلی از MA20 حدود ${pct(t.dist20)} است.`;
  }
  return `مهم‌ترین چیز برای پیگیری: جهت روزانه/هفتگی و واکنش بین حمایت ${num(lv.support)} و مقاومت ${num(lv.resistance)}.`;
}

function stockTemperature(x){
  const ms=Number(x?.momentumShift), r5=Number(x?.ret5), rs=Number(x?.rs20);
  if(Number.isFinite(ms)&&ms>=3)return '🔥 مومنتوم در حال جان‌گرفتن است';
  if(Number.isFinite(ms)&&ms<=-3)return '🧊 مومنتوم کوتاه‌مدت در حال سردشدن است';
  if(Number.isFinite(r5)&&r5>0&&Number.isFinite(rs)&&rs>0)return '🟢 حرکت کوتاه‌مدت هنوز سازنده است';
  return '🟡 مومنتوم فعلاً نیاز به تأیید بیشتر دارد';
}

function stockInterpretation(x){
  const stage=x?.stage;
  const parts=[];
  if(stage==='Early Watch'){
    parts.push('فشار نزولی دارد آرام می‌شود، اما سهم هنوز در مرحله‌ی خیلی اولیه است و برگشت کامل تأیید نشده');
  }else if(stage==='Recovery'){
    parts.push('نشانه‌های برگشت اولیه شکل گرفته و سهم دارد از فاز ضعف خارج می‌شود، اما ساختار هنوز باید پایدار بماند');
  }else if(stage==='Attractive Growth'){
    parts.push('روند، قدرت نسبی و ساختار قیمت فعلاً هم‌جهت‌تر شده‌اند؛ این سهم در فاز رشد سالم‌تری قرار گرفته');
  }else if(stage==='Established Move'){
    parts.push('روند میان‌مدت جا افتاده‌تر است؛ تمرکز اصلی دیگر روی شروع حرکت نیست، روی دوام روند و کیفیت پول‌بک‌هاست');
  }else{
    parts.push('این سهم بخشی از شرایط ساختاری اسکن را پاس کرده');
  }
  if(Number(x?.rsi14)>=70)parts.push('ولی RSI بالا رفته و ریسک کشیده‌شدن کوتاه‌مدت بیشتر است');
  if(Number(x?.pullback60)<=-12)parts.push('و فاصله از سقف ۶۰روزه هنوز قابل توجه است');
  if(Number(x?.rs20)>0)parts.push('قدرت نسبی ۲۰روزه نسبت به بازار هم مثبت است');
  else if(Number.isFinite(Number(x?.rs20)))parts.push('قدرت نسبی ۲۰روزه هنوز از بازار عقب‌تر است');
  return parts.join('؛ ')+'.';
}

function stockWatchLine(x){
  if(x?.stage==='Early Watch')return 'برای ادامه‌ی اعتبار این وضعیت، بهتر است افت فروش ادامه پیدا کند، کف محلی حفظ شود و مومنتوم/MA20 بهتر شوند.';
  if(x?.stage==='Recovery')return 'برای ادامه‌ی ریکاوری، حفظ کف بالاتر و ادامه‌ی بهبود قدرت نسبی مهم‌تر از یک روز سبز است.';
  if(x?.stage==='Attractive Growth')return 'برای سالم ماندن این فاز، ادامه‌ی HH/HL و حفظ قدرت نسبی مهم است؛ کشیده‌شدن زیاد از MA20 کیفیت را پایین می‌آورد.';
  if(x?.stage==='Established Move')return 'برای سالم ماندن حرکت، پول‌بک‌ها باید کنترل‌شده بمانند و شیب میانگین‌ها/قدرت نسبی تخریب نشود.';
  return 'برای ادامه‌ی پیگیری، ثبات ساختار و مومنتوم مهم‌تر از یک حرکت تک‌روزه است.';
}

function briefInterpretation(d){
  const order=new Map(STAGES.map((s,i)=>[s,i]));
  const forward=d.moved.filter(x=>(order.get(x.to)??0)>(order.get(x.from)??0)).length;
  const backward=d.moved.filter(x=>(order.get(x.to)??0)<(order.get(x.from)??0)).length;
  if(d.added.length>d.removed.length&&forward>=backward){
    return `جریان کاندیداهای Hunter نسبت به اسکن قبل کمی گسترده‌تر شده؛ ${d.added.length} نماد تازه وارد شده و حرکت بین مراحل بیشتر رو به جلو بوده تا عقب.`;
  }
  if(d.removed.length>d.added.length&&backward>forward){
    return `جریان کاندیداها ضعیف‌تر شده؛ خروجی‌ها از ورودی‌های تازه بیشترند و بخشی از نمادها به مراحل ابتدایی‌تر برگشته‌اند.`;
  }
  return `تصویر Hunter ترکیبی است؛ ورودی/خروجی و جابه‌جایی مراحل هنوز یک جهت غالب و تمیز نمی‌دهند.`;
}

function portfolioItemInterpretation(x){
  const e=x?.entryStats||{};
  const parts=[];
  if(Number.isFinite(e.returnPct))parts.push(e.returnPct>0?'این دارایی از زمان ورود در سود است':'این دارایی از زمان ورود زیر قیمت خرید قرار دارد');
  if(Number.isFinite(e.excessVsBenchmarkPct))parts.push(e.excessVsBenchmarkPct>0?'و در این بازه از Benchmark جلوتر بوده':'و در این بازه از Benchmark عقب‌تر بوده');
  if(x?.stage)parts.push(`مرحله فعلی Hunter آن «${STAGE_FA[x.stage]||x.stage}» است`);
  if(Number(x?.rs20)>0)parts.push('قدرت نسبی اخیر مثبت است');
  else if(Number.isFinite(Number(x?.rs20)))parts.push('قدرت نسبی اخیر ضعیف‌تر از بازار است');
  return parts.length?parts.join('؛ ')+'.':'برای این دارایی هنوز داده‌ی کافی برای جمع‌بندی تفسیری نداریم.';
}

function portfolioInterpretation(a,items){
  const parts=[];
  if(Number.isFinite(a?.betaVsTsx))parts.push(a.betaVsTsx>1.1?'پورتفولیو نسبت به TSX حساس‌تر و پرنوسان‌تر حرکت می‌کند':a.betaVsTsx<0.9?'پورتفولیو نسبت به TSX حساسیت پایین‌تری دارد':'حساسیت پورتفولیو به TSX نزدیک به بازار است');
  if(Number.isFinite(a?.excessReturnPct))parts.push(a.excessReturnPct>0?'در بازه‌ی اندازه‌گیری از TSX جلوتر بوده':'در بازه‌ی اندازه‌گیری از TSX عقب‌تر بوده');
  if(Number(a?.topRiskContributor?.riskContributionPct)>=40)parts.push(`${a.topRiskContributor.symbol} سهم بزرگی از ریسک مدل‌شده را می‌سازد، پس تمرکز ریسک قابل توجه است`);
  if(items?.length===1)parts.push('با یک دارایی، تنوع واقعی پورتفولیو هنوز شکل نگرفته');
  return parts.length?parts.join('؛ ')+'.':'فعلاً داده‌ی کافی برای یک جمع‌بندی قوی از ریسک و تنوع وجود ندارد.';
}

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
    '',
    '<b>🧠 برداشت امروز</b>',
    esc(marketInterpretation(m)),
    esc(marketWatchLine(m)),
    '',
    '<b>شواهدی که این برداشت روی آن‌هاست</b>',
    `• امروز ${signedIcon(r.d1)} <code>${esc(pct(r.d1))}</code> · ۲۰روزه <code>${esc(pct(r.d20))}</code> · ۶۰روزه <code>${esc(pct(r.d60))}</code>`,
    `• روند روزانه: ${esc(directionFa(t.daily))} · هفتگی: ${esc(directionFa(t.weekly))}`,
    `• RSI <code>${esc(num(mo.rsi14,1))}</code> · فاصله از MA20 <code>${esc(pct(t.dist20))}</code>`,
    `• محدوده‌ی پیگیری: حمایت <code>${esc(num(lv.support))}</code> / مقاومت <code>${esc(num(lv.resistance))}</code>`,
    '',
    `<i>داده تا ${esc(m.asOf||'—')}؛ این تحلیل توصیفی است و سیگنال خرید/فروش نیست.</i>`
  ];
  return {text:lines.join('\n'),keyboard:backPulse()};
}

export function allMarketsReport(report,pulse){
  const groups=report?.groups||[];
  const markets=(pulse?.markets||[]);
  const constructive=markets.filter(m=>['Strong Bull','Bull'].includes(m?.descriptiveState?.regime)).length;
  const weak=markets.filter(m=>['Strong Bear','Bear'].includes(m?.descriptiveState?.regime)).length;
  const weakening=markets.filter(m=>m?.descriptiveState?.condition==='Weakening').length;
  const recovering=markets.filter(m=>m?.descriptiveState?.condition==='Recovery Attempt').length;
  let read='تصویر بین بازارها هنوز ترکیبی است و یک جهت واحد غالب نیست.';
  if(constructive>=Math.ceil(markets.length*.6)&&weakening<=2)read='بیشتر بازارهای اصلی ساختار سازنده دارند؛ با این حال باید دید این همراهی در کوتاه‌مدت حفظ می‌شود یا نه.';
  else if(weak>=Math.ceil(markets.length*.5))read='فشار نزولی در چند بازار اصلی هم‌زمان دیده می‌شود و فضای بین‌بازاری دفاعی‌تر شده.';
  else if(weakening>=3)read='ساختار بلندتر هنوز لزوماً خراب نشده، اما ضعف کوتاه‌مدت در چند بازار هم‌زمان بیشتر شده.';
  else if(recovering>=3)read='چند بازار هم‌زمان وارد فاز تلاش برای برگشت شده‌اند؛ کیفیت ادامه‌ی این برگشت از خود جهش اولیه مهم‌تر است.';
  const lines=[
    '<b>📊 گزارش کلی بازار</b>',
    '',
    '<b>🧠 برداشت کلی</b>',
    esc(read),
    ''
  ];
  for(const g of groups){
    const label=g.label==='Equities'?'سهام':g.label==='Metals'?'فلزات':'کریپتو';
    const states=(g.markets||[]).map(m=>`${marketLabel(m.key)}: ${regimeFa(m.regime)} / ${conditionFa(m.condition)}`);
    lines.push(`<b>${esc(label)}</b>`);
    lines.push(esc(states.join(' · ')));
    lines.push('');
  }
  const dev=(report?.keyDevelopments||[]).slice(0,3);
  if(dev.length){
    lines.push('<b>چرا این برداشت شکل گرفته؟</b>');
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
  const buttons=items.slice(0,24).map(x=>[{text:`${review.has(x.symbol)?'⭐ ':''}${x.symbol}`,callback_data:'stock:'+x.symbol}]);
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

export function stockReport(scan,symbol,live=null){
  const base=(scan?.all||[]).find(v=>v.symbol===symbol);
  const x=base?{...base,dayChangePct:live?.dayChangePct,livePrice:live?.price,liveAsOf:live?.asOf}:null;
  if(!x)return {text:'این نماد در اسکن فعلی پیدا نشد.',keyboard:backHunter()};
  const ev=(x.evidence||[]).map(evidenceFa);
  const risk=x.riskFlags||[];
  const lines=[
    `<b>${esc(x.name||x.symbol)}</b> · <code>${esc(x.symbol)}</code>`,
    `${STAGE_ICON[x.stage]||'•'} <b>${esc(STAGE_FA[x.stage]||x.stage)}</b> · ${stockTemperature(x)}`,
    '',
    '<b>🧠 برداشت من از این سهم</b>',
    esc(stockInterpretation(x)),
    esc(stockWatchLine(x)),
    '',
    '<b>چرا Hunter بهش توجه کرده؟</b>',
    ...(ev.length?ev.slice(0,4).map(v=>'• '+esc(v)):['• شرایط ساختاری این مرحله را پاس کرده'])
  ];
  if(risk.length){
    lines.push('','<b>⚠️ چیزی که کیفیت این setup را پایین می‌آورد</b>',...risk.slice(0,3).map(v=>'• '+esc(v)));
  }
  lines.push(
    '',
    '<b>شواهد عددی، فقط برای کنترل برداشت</b>',
    `• قیمت <code>${esc(num(Number.isFinite(x.livePrice)?x.livePrice:x.price))}</code>${Number.isFinite(x.dayChangePct)?` · امروز ${signedIcon(x.dayChangePct)} <code>${esc(pct(x.dayChangePct))}</code>`:''}`,
    `• ۲۰روزه <code>${esc(pct(x.ret20))}</code> · RS20 <code>${esc(pct(x.rs20))}</code> · RSI <code>${esc(num(x.rsi14,1))}</code>`,
    `• فاصله از MA20 <code>${esc(pct(x.dist20))}</code> · از سقف ۶۰روزه <code>${esc(pct(x.pullback60))}</code>`,
    '',
    `<i>آخرین داده: ${esc(x.liveAsOf||x.date||scan?.marketAsOf||'—')} · این گزارش برای اولویت بررسی چارت است، نه سیگنال معامله.</i>`
  );
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
