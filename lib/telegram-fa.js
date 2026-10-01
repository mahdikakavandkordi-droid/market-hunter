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

function finite(v){return Number.isFinite(Number(v))}

function sourceFa(source){
  const s=String(source||'').toLowerCase();
  if(s==='market-hunter')return 'Market Hunter';
  if(s==='manual')return 'دستی / خارج از Hunter';
  return source||'نامشخص';
}

function swingFa(x){
  const s=String(x||'');
  if(/lower highs \+ lower lows/i.test(s))return 'سقف و کف پایین‌تر؛ ساختار نزولی';
  if(/structure improving/i.test(s))return 'ساختار در حال بهبود';
  if(/higher highs? \+ higher lows?/i.test(s))return 'سقف و کف بالاتر؛ ساختار صعودی';
  return s||'نامشخص';
}

function portfolioTone(x){
  const ms=Number(x?.momentumShift),rs=Number(x?.rs20),rsi=Number(x?.rsi14),dist20=Number(x?.dist20);
  if(x?.lowBroken||/lower highs \+ lower lows/i.test(String(x?.swingTrend||''))||(finite(ms)&&ms<=-8))return 'warn';
  if((finite(ms)&&ms<=-3)||(finite(rs)&&rs<-3)||(finite(rsi)&&rsi<40)||(finite(dist20)&&dist20<-3))return 'watch';
  return 'good';
}

function portfolioRows(snapshot){
  const items=Array.isArray(snapshot?.items)?snapshot.items:[];
  const rows=items.map(x=>{
    const p=x?.position||{};
    const qty=Number(p.quantity),entry=Number(p.entryPrice),price=Number(x?.price);
    const value=finite(qty)&&finite(price)&&qty>0&&price>0?qty*price:null;
    const cost=finite(qty)&&finite(entry)&&qty>0&&entry>0?qty*entry:null;
    const pnl=finite(value)&&finite(cost)?value-cost:null;
    const pnlPct=finite(pnl)&&finite(cost)&&cost>0?pnl/cost*100:null;
    const sinceEntry=finite(x?.entryStats?.sinceEntryReturn)?Number(x.entryStats.sinceEntryReturn):pnlPct;
    return {
      x,p,qty,entry,price,value,cost,pnl,pnlPct,sinceEntry,
      currency:x?.currency||'CAD',
      group:x?.exposure?.group||x?.sector||'Unknown',
      tone:portfolioTone(x)
    };
  });
  const valued=rows.filter(r=>finite(r.value)&&r.value>0);
  const currencies=new Set(valued.map(r=>r.currency));
  const singleCurrency=valued.length===rows.length&&currencies.size===1;
  const totalValue=singleCurrency?valued.reduce((s,r)=>s+r.value,0):null;
  const totalCost=singleCurrency&&rows.every(r=>finite(r.cost))?rows.reduce((s,r)=>s+r.cost,0):null;
  const totalPnl=finite(totalValue)&&finite(totalCost)?totalValue-totalCost:null;
  const totalPnlPct=finite(totalPnl)&&finite(totalCost)&&totalCost>0?totalPnl/totalCost*100:null;
  for(const r of rows)r.weight=finite(totalValue)&&finite(r.value)&&totalValue>0?r.value/totalValue*100:null;

  const exposure=new Map();
  for(const r of rows){
    if(!finite(r.weight))continue;
    exposure.set(r.group,(exposure.get(r.group)||0)+r.weight);
  }
  const exposureRows=[...exposure.entries()].map(([group,weight])=>({group,weight})).sort((a,b)=>b.weight-a.weight);
  const sortedByWeight=[...rows].filter(r=>finite(r.weight)).sort((a,b)=>b.weight-a.weight);
  const top1=sortedByWeight[0]||null;
  const top3=sortedByWeight.slice(0,3).reduce((s,r)=>s+(r.weight||0),0);
  const weakWeight=rows.filter(r=>r.tone==='warn').reduce((s,r)=>s+(r.weight||0),0);
  const watchWeight=rows.filter(r=>r.tone==='watch').reduce((s,r)=>s+(r.weight||0),0);
  const healthyWeight=rows.filter(r=>r.tone==='good').reduce((s,r)=>s+(r.weight||0),0);
  const ranked=[...rows].filter(r=>finite(r.sinceEntry)).sort((a,b)=>b.sinceEntry-a.sinceEntry);
  return {
    rows,totalValue,totalCost,totalPnl,totalPnlPct,
    currency:singleCurrency&&valued[0]?valued[0].currency:null,
    exposureRows,top1,top3,weakWeight,watchWeight,healthyWeight,
    best:ranked[0]||null,worst:ranked.at(-1)||null
  };
}

function portfolioItemInterpretation(x,snapshot=null){
  const e=x?.entryStats||{};
  const p=x?.position||{};
  const parts=[];
  const since=finite(e.sinceEntryReturn)?Number(e.sinceEntryReturn):null;
  if(finite(since))parts.push(since>=0?`از زمان ورود حدود ${pct(since)} بالاتر از قیمت خرید است`:`از زمان ورود حدود ${pct(since)} پایین‌تر از قیمت خرید است`);
  if(finite(e.excessVsBenchmarkPct))parts.push(e.excessVsBenchmarkPct>=0?`در همین بازه ${pct(e.excessVsBenchmarkPct)} از Benchmark جلوتر بوده`:`در همین بازه ${pct(e.excessVsBenchmarkPct)} از Benchmark عقب‌تر بوده`);
  if(x?.stage)parts.push(`فعلاً در مرحله «${STAGE_FA[x.stage]||x.stage}» Hunter قرار دارد`);
  else parts.push('فعلاً در چهار مرحله منتخب Hunter نیست');
  if(/lower highs \+ lower lows/i.test(String(x?.swingTrend||'')))parts.push('ساختار قیمت هنوز نزولی است');
  else if(/structure improving/i.test(String(x?.swingTrend||'')))parts.push('ساختار قیمت نسبت به قبل در حال بهبود است');
  if(finite(x?.momentumShift)&&Number(x.momentumShift)<=-5)parts.push('مومنتوم کوتاه‌مدت به‌وضوح سرد شده');
  else if(finite(x?.momentumShift)&&Number(x.momentumShift)>=3)parts.push('مومنتوم کوتاه‌مدت در حال تقویت است');
  if(finite(x?.rs20))parts.push(Number(x.rs20)>=0?'قدرت نسبی ۲۰روزه از TSX بهتر است':'قدرت نسبی ۲۰روزه از TSX ضعیف‌تر است');
  if(x?.lowBroken)parts.push('کف محلی شکسته شده و این مهم‌ترین هشدار فعلی است');
  if(p?.source)parts.push(`منبع ورود: ${sourceFa(p.source)}`);
  return parts.join('؛ ')+'.';
}

function portfolioWatchText(x){
  const support=finite(x?.support)?num(x.support):null;
  const resistance=finite(x?.resistance)?num(x.resistance):null;
  if(x?.lowBroken){
    return `برای بهترشدن وضعیت، اول باید شکست کف محلی خنثی شود و قیمت دوباره بالای ناحیه حمایت ${support||'قبلی'} تثبیت شود؛ بعد بهبود مومنتوم و RS اهمیت دارد.`;
  }
  if(finite(x?.momentumShift)&&Number(x.momentumShift)<=-5){
    return `کف محلی فعلاً حفظ شده، اما مومنتوم سرد است. پیگیری اصلی: حفظ حمایت ${support||'—'} و برگشت momentum/RS پیش از حمله به مقاومت ${resistance||'—'}.`;
  }
  if(x?.stage==='Recovery'){
    return `سناریوی ریکاوری وقتی معتبرتر می‌شود که کف بالاتر حفظ شود، RS مثبت بماند و قیمت بتواند مقاومت ${resistance||'—'} را با کیفیت پس بگیرد.`;
  }
  return `مهم‌ترین چیز برای پیگیری، حفظ حمایت ${support||'—'}، رفتار مومنتوم و واکنش قیمت به مقاومت ${resistance||'—'} است.`;
}

function portfolioStrengths(x){
  const out=[];
  if(x?.higherLow)out.push('کف بالاتر دیده می‌شود');
  if(x?.higherHigh)out.push('سقف بالاتر ثبت شده');
  if(finite(x?.rs20)&&Number(x.rs20)>0)out.push(`RS20 مثبت است (${pct(x.rs20)})`);
  if(finite(x?.dist20)&&Number(x.dist20)>0)out.push('قیمت بالای MA20 است');
  if(finite(x?.ret20)&&Number(x.ret20)>0)out.push(`بازده ۲۰روزه مثبت است (${pct(x.ret20)})`);
  if(x?.stage)out.push(`Hunter: ${STAGE_FA[x.stage]||x.stage}`);
  return out;
}

function portfolioRisks(x){
  const out=[];
  if(x?.lowBroken)out.push('کف محلی شکسته شده');
  if(/lower highs \+ lower lows/i.test(String(x?.swingTrend||'')))out.push('ساختار سقف/کف نزولی است');
  if(finite(x?.momentumShift)&&Number(x.momentumShift)<=-3)out.push(`Momentum shift منفی است (${num(x.momentumShift,1)}pp)`);
  if(finite(x?.rs20)&&Number(x.rs20)<0)out.push(`RS20 منفی است (${pct(x.rs20)})`);
  if(finite(x?.rsi14)&&Number(x.rsi14)<35)out.push(`RSI پایین است (${num(x.rsi14,1)})`);
  if(finite(x?.dist20)&&Number(x.dist20)<-3)out.push(`قیمت ${pct(x.dist20)} زیر MA20 است`);
  return out;
}

function portfolioInterpretation(snapshot){
  const s=portfolioRows(snapshot);
  if(!s.rows.length)return 'فعلاً چیزی داخل پورتفولیو نیست که بشود ازش جمع‌بندی ساخت.';
  const parts=[];
  if(finite(s.totalPnlPct)){
    parts.push(s.totalPnlPct>=0
      ?`در مجموع پورتفولیو نسبت به قیمت‌های خرید حدود ${pct(s.totalPnlPct)} بالاتر است`
      :`در مجموع پورتفولیو نسبت به قیمت‌های خرید حدود ${pct(s.totalPnlPct)} پایین‌تر است`);
  }
  if(s.top1&&finite(s.top1.weight))parts.push(`بیشترین وزن دست ${s.top1.x.symbol} است و حدود ${pct(s.top1.weight)} از کل پورتفولیو را می‌سازد`);
  if(s.exposureRows[0])parts.push(`از نظر نوع دارایی/صنعت هم بیشترین تمرکز روی ${s.exposureRows[0].group} با حدود ${pct(s.exposureRows[0].weight)} است`);
  if(s.weakWeight+s.watchWeight>=50)parts.push(`از نظر تکنیکال، حدود ${pct(s.weakWeight+s.watchWeight)} از ارزش پورتفولیو الان یا هشدار دارد یا نیاز به پیگیری نزدیک‌تر دارد`);
  else parts.push(`از نظر تکنیکال، بخش بزرگ‌تری از پورتفولیو فعلاً ساختار قابل‌قبول‌تری دارد`);
  return parts.join('. ')+'.';
}

function portfolioHoldingCommentary(row){
  const x=row.x;
  const bits=[];
  if(finite(row.sinceEntry)){
    bits.push(row.sinceEntry>=0
      ?`${pct(Math.abs(row.sinceEntry))} بالاتر از قیمت خرید`
      :`${pct(Math.abs(row.sinceEntry))} پایین‌تر از قیمت خرید`);
  }

  if(x?.stage)bits.push(`Hunter: ${STAGE_FA[x.stage]||x.stage}`);
  else bits.push('فعلاً خارج از چهار مرحله منتخب Hunter');

  if(/lower highs \+ lower lows/i.test(String(x?.swingTrend||''))){
    bits.push('ساختار هنوز نزولی است');
  }else if(/structure improving/i.test(String(x?.swingTrend||''))){
    bits.push('ساختار در حال بهبود است');
  }

  if(x?.lowBroken)bits.push('کف محلی شکسته شده');
  else if(finite(x?.support)&&finite(x?.price)&&Number(x.price)>=Number(x.support))bits.push(`حمایت ${num(x.support)} فعلاً حفظ شده`);

  if(finite(x?.momentumShift)&&Number(x.momentumShift)<=-6){
    bits.push('مومنتوم کوتاه‌مدت واضحاً سرد شده');
  }else if(finite(x?.momentumShift)&&Number(x.momentumShift)>=2){
    bits.push('مومنتوم کوتاه‌مدت کمی بهتر شده');
  }

  if(finite(x?.rs20)){
    if(Number(x.rs20)>=3)bits.push('RS20 نسبت به TSX خوب است');
    else if(Number(x.rs20)<=-3)bits.push('RS20 از TSX عقب‌تر است');
  }

  if(finite(x?.rsi14)&&Number(x.rsi14)<30)bits.push(`RSI پایین است (${num(x.rsi14,1)})`);
  if(finite(x?.dist20)&&Number(x.dist20)<-5)bits.push(`حدود ${pct(Math.abs(x.dist20))} زیر MA20 است`);

  const watch=[];
  if(x?.lowBroken&&finite(x?.support))watch.push(`پس‌گرفتن ${num(x.support)}`);
  else if(finite(x?.support))watch.push(`حفظ ${num(x.support)}`);
  if(finite(x?.resistance))watch.push(`واکنش به ${num(x.resistance)}`);
  if((finite(x?.momentumShift)&&Number(x.momentumShift)<0)||(finite(x?.rs20)&&Number(x.rs20)<0))watch.push('بهبود مومنتوم/RS');

  return {
    headline:`${x?.name||x?.symbol||''}`,
    body:bits.slice(0,5).join('؛ ')+'.'+(watch.length?` پیگیری: ${watch.slice(0,2).join(' و ')}.`:'')
  };
}



function selectedPicks(scan){
  if(Array.isArray(scan?.integratedSurfacePicks))return scan.integratedSurfacePicks.filter(Boolean);
  if(scan?.surfacePicks&&typeof scan.surfacePicks==='object'){
    return STAGES.flatMap(stage=>Array.isArray(scan.surfacePicks[stage])?scan.surfacePicks[stage]:[]);
  }
  return STAGES.flatMap(stage=>Array.isArray(scan?.byStage?.[stage])?scan.byStage[stage]:[]);
}

function selectedByStage(scan,stage){
  return selectedPicks(scan).filter(x=>x?.stage===stage);
}

function tradingViewChartUrl(symbol){
  const raw=String(symbol||'').trim().toUpperCase();
  if(!raw)return 'https://www.tradingview.com/';
  let exchange='';
  let ticker=raw;
  if(raw.endsWith('.TO')){
    exchange='TSX';
    ticker=raw.slice(0,-3);
  }else if(raw.endsWith('.V')){
    exchange='TSXV';
    ticker=raw.slice(0,-2);
  }
  const tvSymbol=exchange?`${exchange}:${ticker}`:ticker;
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`;
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
  const selected=selectedPicks(scan);
  const rows=STAGES.map((stage,i)=>{
    const count=selected.filter(x=>x?.stage===stage).length;
    return [{text:`${STAGE_ICON[stage]} ${STAGE_FA[stage]} (${count})`,callback_data:'stage:'+i}];
  });
  return {
    text:`<b>🎯 Market Hunter</b>\nاسکن ${esc(scan?.marketAsOf||'—')} · <b>${selected.length} سهم منتخب نهایی امروز</b>.\nاینجا فقط سهم‌هایی نمایش داده می‌شوند که وارد خروجی روزانه‌ی Review First شده‌اند؛ بقیه‌ی سهم‌های طبقه‌بندی‌شده داخل بات نشان داده نمی‌شوند.`,
    keyboard:{inline_keyboard:[
      ...rows,
      [{text:'🧭 تغییرات منتخب‌ها نسبت به اسکن قبل',callback_data:'brief:hunter'}],
      [{text:'⬅️ منوی اصلی',callback_data:'m:home'}]
    ]}
  };
}

export function stageMenu(scan,stageIndex){
  const stage=STAGES[stageIndex]||STAGES[0];
  const items=selectedByStage(scan,stage);
  const text=[
    `<b>${STAGE_ICON[stage]} ${STAGE_FA[stage]}</b>`,
    items.length
      ?`امروز <b>${items.length}</b> سهم از این مرحله وارد لیست منتخب نهایی شده.`
      :'امروز از این مرحله سهمی وارد لیست منتخب نهایی نشده.',
    items.length?'روی نماد بزن تا تفسیر همان سهم را ببینی.':''
  ].filter(Boolean).join('\n');
  const buttons=items.map(x=>[
    {text:`⭐ ${x.symbol}`,callback_data:'stock:'+x.symbol},
    {text:'📈 چارت',url:tradingViewChartUrl(x.symbol)}
  ]);
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
    [{text:'📈 مشاهده چارت در TradingView',url:tradingViewChartUrl(x.symbol)}],
    [{text:'⬅️ مرحله',callback_data:'stage:'+Math.max(0,STAGES.indexOf(x.stage))},{text:'🏠 خانه',callback_data:'m:home'}]
  ]}};
}

function stageMap(scan){
  const m=new Map();
  for(const x of selectedPicks(scan)){
    if(x?.symbol&&x?.stage)m.set(x.symbol,x.stage);
  }
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

function shortSessionDate(date){
  const s=String(date||'');
  return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(5).replace('-','/'):s||'—';
}

function recentSelectionHistory(current,history=[]){
  const byDate=new Map();
  for(const scan of [...history,current].filter(Boolean)){
    const date=String(scan?.marketAsOf||'');
    if(date)byDate.set(date,scan);
  }
  const scans=[...byDate.entries()]
    .sort((a,b)=>a[0].localeCompare(b[0]))
    .slice(-5)
    .map(([,scan])=>scan);
  const currentSymbols=selectedPicks(current).map(x=>x.symbol).filter(Boolean);
  return {
    scans,
    rows:currentSymbols.map(symbol=>{
      const observations=scans.map(scan=>({
        date:String(scan?.marketAsOf||''),
        stage:stageMap(scan).get(symbol)||null
      }));
      const seen=observations.filter(x=>x.stage);
      let streak=0;
      for(let i=observations.length-1;i>=0;i--){
        if(observations[i].stage)streak++;
        else break;
      }
      const compressedStages=[];
      for(const x of seen){
        if(compressedStages.at(-1)!==x.stage)compressedStages.push(x.stage);
      }
      const returned=seen.length>streak;
      const first=seen[0]?.date||null;
      return {
        symbol,
        appearances:seen.length,
        window:scans.length,
        streak,
        returned,
        first,
        currentStage:seen.at(-1)?.stage||null,
        stagePath:compressedStages
      };
    })
  };
}

function historyLineFa(row){
  const stageNow=STAGE_FA[row.currentStage]||row.currentStage||'—';
  if(row.appearances===1&&row.streak===1){
    return `🆕 تازه‌وارد امروز · مرحله: ${stageNow}`;
  }

  const parts=[`👁 ${row.appearances} جلسه از ${row.window} جلسه اخیر`];

  if(row.streak>=2)parts.push(`🔗 ${row.streak} جلسه پشت‌سرهم`);
  else if(row.returned)parts.push('↩️ امروز دوباره برگشته');

  if(row.stagePath.length>1){
    parts.push(`🔁 ${row.stagePath.map(s=>STAGE_FA[s]||s).join(' → ')}`);
  }else{
    parts.push(`↔️ مرحله ثابت: ${stageNow}`);
  }

  if(row.returned||row.streak>=2){
    parts.push(`از ${shortSessionDate(row.first)}`);
  }

  return parts.join(' · ');
}


export function marketBrief(current,previous,history=[]){
  if(!previous)return {text:'برای مقایسه هنوز اسکن قبلی در دسترس نیست.',keyboard:backHunter()};
  const d=diffScans(current,previous);
  const tracking=recentSelectionHistory(current,history);

  const lines=[
    '<b>🧭 Market Brief</b>',
    `<code>${esc(previous.marketAsOf||'اسکن قبل')}</code> → <code>${esc(current.marketAsOf||'امروز')}</code>`,
    '',
    '<b>🧠 امروز چه عوض شد؟</b>',
    esc(briefInterpretation(d)),
    '',
    `🆕 تازه‌وارد <b>${d.added.length}</b> · ↔️ بدون تغییر <b>${d.stayed.length}</b> · 🔁 تغییر مرحله <b>${d.moved.length}</b> · ❌ خروج <b>${d.removed.length}</b>`
  ];

  if(d.added.length){
    lines.push('','<b>🆕 تازه‌واردهای امروز</b>');
    for(const x of d.added.slice(0,6)){
      lines.push(`<code>${esc(x.symbol)}</code> — ${esc(STAGE_FA[x.stage]||x.stage)}`);
    }
  }

  if(d.moved.length){
    lines.push('','<b>🔁 مرحله عوض کرده‌اند</b>');
    for(const x of d.moved.slice(0,6)){
      lines.push(
        `<code>${esc(x.symbol)}</code>`,
        `${esc(STAGE_FA[x.from]||x.from)} → ${esc(STAGE_FA[x.to]||x.to)}`
      );
    }
  }

  if(d.removed.length){
    lines.push('','<b>❌ از منتخب‌های امروز خارج شده‌اند</b>');
    for(const x of d.removed.slice(0,6)){
      lines.push(`<code>${esc(x.symbol)}</code> — جلسه قبل: ${esc(STAGE_FA[x.stage]||x.stage)}`);
    }
  }

  if(tracking.rows.length){
    lines.push(
      '',
      `<b>🗓 ردگیری کوتاه — ${tracking.scans.length} جلسه معاملاتی اخیر</b>`
    );

    for(const row of tracking.rows.slice(0,6)){
      lines.push(
        '',
        `<code>${esc(row.symbol)}</code>`,
        esc(historyLineFa(row))
      );
    }
  }

  lines.push(
    '',
    '<i>فقط مسیر منتخب‌های نهایی Hunter در حداکثر ۵ جلسه معاملاتی اخیر دنبال می‌شود.</i>'
  );

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

export function portfolioEmpty(reason='پورتفولیوی سایت هنوز به بات وصل نشده.',pairUrl=null){
  const rows=[];
  if(pairUrl)rows.push([{text:'🔗 اتصال پورتفولیوی سایت',url:pairUrl}]);
  rows.push([{text:'🏠 منوی اصلی',callback_data:'m:home'}]);
  return {
    text:`<b>💼 پورتفولیو</b>\n${esc(reason)}\n\nیک‌بار روی «اتصال پورتفولیوی سایت» بزن. صفحه Market Hunter باز می‌شود و پورتفولیوی همین دستگاه به بات وصل می‌شود؛ بعد از آن تغییرات بعدی هم خودکار Sync می‌شوند.`,
    keyboard:{inline_keyboard:rows}
  };
}

export function portfolioMenu(snapshot){
  const items=snapshot?.items||[];
  if(!items.length)return portfolioEmpty('در آخرین Snapshot پورتفولیو دارایی قابل نمایش وجود ندارد.');
  const s=portfolioRows(snapshot);
  const headline=[];
  if(finite(s.totalValue))headline.push(`ارزش فعلی <code>${esc(num(s.totalValue))} ${esc(s.currency||'')}</code>`);
  if(finite(s.totalPnlPct))headline.push(`از قیمت خرید ${signedIcon(s.totalPnlPct)} <code>${esc(pct(s.totalPnlPct))}</code>`);
  const rows=items.slice(0,20).map(x=>[{
    text:`${portfolioTone(x)==='warn'?'🔴':portfolioTone(x)==='watch'?'🟡':'🟢'} ${x.symbol}  ${pct(x?.entryStats?.sinceEntryReturn)}`,
    callback_data:'pf:'+x.symbol
  }]);
  return {
    text:[
      '<b>💼 پورتفولیو</b>',
      `داده تا <code>${esc(snapshot.marketAsOf||snapshot?.meta?.marketAsOf||items[0]?.asOf||'—')}</code>`,
      headline.join(' · '),
      '',
      '<b>🧠 خلاصه‌ی وضعیت</b>',
      esc(portfolioInterpretation(snapshot)),
      '',
      'برای تصویر کامل‌تر روی «تحلیل کامل پورتفولیو» بزن؛ برای هر سهم هم تحلیل جداگانه داری.'
    ].filter(Boolean).join('\n'),
    keyboard:{inline_keyboard:[
      [{text:'📊 تحلیل کامل پورتفولیو',callback_data:'pf:all'}],
      ...rows,
      [{text:'🏠 منوی اصلی',callback_data:'m:home'}]
    ]}
  };
}

export function portfolioItemReport(snapshot,symbol){
  const x=(snapshot?.items||[]).find(v=>v.symbol===symbol);
  if(!x)return portfolioEmpty('این دارایی در Snapshot فعلی پیدا نشد.');
  const s=portfolioRows(snapshot);
  const row=s.rows.find(r=>r.x.symbol===symbol);
  const e=x.entryStats||{},p=x.position||{},ex=x.exposure||{};
  const strengths=portfolioStrengths(x),risks=portfolioRisks(x);
  const tone=portfolioTone(x);
  const lines=[
    `<b>${esc(x.name||x.symbol)}</b> · <code>${esc(x.symbol)}</code>`,
    tone==='warn'?'🔴 فعلاً بخش‌هایی از ساختار هشدار می‌دهند':tone==='watch'?'🟡 وضعیت خراب نیست، ولی چند چیز نیاز به پیگیری دارد':'🟢 فعلاً ساختار کلی قابل‌قبول است',
    '',
    '<b>🧠 اگر بخوام ساده بگم</b>',
    esc(portfolioItemInterpretation(x,snapshot)),
    '',
    '<b>💼 پوزیشن تو</b>'
  ];
  const positionBits=[];
  if(finite(p.quantity))positionBits.push(`${num(p.quantity,4)} واحد`);
  if(finite(p.entryPrice))positionBits.push(`میانگین خرید ${num(p.entryPrice)} ${x.currency||''}`);
  if(p.boughtAt)positionBits.push(`از ${p.boughtAt}`);
  if(positionBits.length)lines.push('• '+esc(positionBits.join(' · ')));
  if(row&&finite(row.value)){
    const valueText=`ارزش فعلی حدود ${num(row.value)} ${x.currency||''}`;
    const weightText=finite(row.weight)?` و ${pct(row.weight)} از کل پورتفولیو`:'';
    lines.push('• '+esc(valueText+weightText));
  }
  if(row&&finite(row.pnl)){
    const direction=row.pnl>=0?'بالاتر':'پایین‌تر';
    lines.push(`• الان نسبت به قیمت خرید <b>${esc(pct(Math.abs(row.pnlPct)))}</b> ${direction} است؛ حدود <code>${esc(num(Math.abs(row.pnl)))} ${esc(x.currency||'')}</code> اختلاف.`);
  }
  if(finite(e.excessVsBenchmarkPct)){
    lines.push(`• در بازه‌ی نگهداری، نسبت به Benchmark حدود <code>${esc(pct(e.excessVsBenchmarkPct))}</code> اختلاف داشته.`);
  }

  const chartSentence=[
    `ساختار فعلی: ${swingFa(x.swingTrend)}`,
    finite(x.momentumShift)?`مومنتوم ${Number(x.momentumShift)>=0?'رو به بهبود':'رو به ضعف'} است (${num(x.momentumShift,1)}pp)`:null,
    finite(x.rs20)?`RS20 ${Number(x.rs20)>=0?'مثبت':'منفی'} است (${pct(x.rs20)})`:null,
    finite(x.rsi14)?`RSI روی ${num(x.rsi14,1)} قرار دارد`:null
  ].filter(Boolean).join('؛ ');
  lines.push(
    '',
    '<b>📈 چارت چه می‌گوید؟</b>',
    esc(chartSentence+'.'),
    `• امروز <code>${esc(pct(x.dayChangePct))}</code> · ۵روزه <code>${esc(pct(x.ret5))}</code> · ۲۰روزه <code>${esc(pct(x.ret20))}</code> · ۶۰روزه <code>${esc(pct(x.ret60))}</code>`,
    `• نسبت به MA20 <code>${esc(pct(x.dist20))}</code> · نسبت به MA50 <code>${esc(pct(x.dist50))}</code>`,
    `• حمایت مهم <code>${esc(num(x.support))}</code> · مقاومت مهم <code>${esc(num(x.resistance))}</code>`,
    `• گروه/Exposure: ${esc(ex.group||x.sector||'Unknown')} · ${esc(ex.assetClass||'—')}`
  );

  if(strengths.length)lines.push('','<b>✅ چه چیزهایی به نفعش است؟</b>',...strengths.slice(0,4).map(v=>'• '+esc(v)));
  if(risks.length)lines.push('','<b>⚠️ چه چیزهایی منو محتاط می‌کند؟</b>',...risks.slice(0,4).map(v=>'• '+esc(v)));

  lines.push(
    '',
    '<b>👀 دفعه‌ی بعد چی رو چک کنیم؟</b>',
    esc(portfolioWatchText(x))
  );

  if(finite(e.maxDrawdownPct)||finite(e.maxGainPct)){
    lines.push('',`<i>از زمان خرید: بهترین حرکت ${esc(pct(e.maxGainPct))} · بیشترین افت ${esc(pct(e.maxDrawdownPct))}. داده تا ${esc(x.asOf||snapshot?.marketAsOf||'—')}.</i>`);
  }else{
    lines.push('',`<i>داده تا ${esc(x.asOf||snapshot?.marketAsOf||'—')}؛ هدف این گزارش اینه که بدون شلوغ‌کاری بفهمیم وضعیت پوزیشن بهتر شده یا بدتر.</i>`);
  }
  return {text:lines.join('\n').slice(0,4050),keyboard:{inline_keyboard:[
    [{text:'📈 مشاهده چارت در TradingView',url:tradingViewChartUrl(x.symbol)}],
    [{text:'⬅️ پورتفولیو',callback_data:'m:portfolio'},{text:'🏠 خانه',callback_data:'m:home'}]
  ]}};
}

export function portfolioSummaryReport(snapshot){
  const items=snapshot?.items||[];
  if(!items.length)return portfolioEmpty();
  const s=portfolioRows(snapshot);
  const a=snapshot?.portfolioAnalytics||snapshot?.analytics||{};
  const lines=[
    '<b>📊 تحلیل کامل پورتفولیو</b>',
    `داده تا <code>${esc(snapshot.marketAsOf||'—')}</code>`,
    '',
    '<b>🧠 تصویر کلی</b>',
    esc(portfolioInterpretation(snapshot))
  ];

  const moneyParts=[];
  if(finite(s.totalValue))moneyParts.push(`ارزش فعلی حدود ${num(s.totalValue)} ${s.currency||''}`);
  if(finite(s.totalCost))moneyParts.push(`بهای تمام‌شده حدود ${num(s.totalCost)} ${s.currency||''}`);
  if(finite(s.totalPnlPct))moneyParts.push(`در مجموع ${pct(Math.abs(s.totalPnlPct))} ${s.totalPnlPct>=0?'بالاتر':'پایین‌تر'} از قیمت‌های خرید`);
  if(moneyParts.length)lines.push('','<b>💰 از نظر پولی</b>',esc(moneyParts.join('؛ ')+'.'));
  if(finite(s.totalPnl))lines.push(`• اختلاف ریالی/دلاری فعلی: ${signedIcon(s.totalPnl)} <code>${esc(num(s.totalPnl))} ${esc(s.currency||'')}</code>`);

  const weighted=[...s.rows].filter(r=>finite(r.weight)).sort((a,b)=>b.weight-a.weight);
  if(weighted.length){
    lines.push('','<b>⚖️ وزن‌ها و تمرکز</b>');
    const topText=weighted.slice(0,3).map(r=>`${r.x.symbol} ${pct(r.weight)}`).join(' · ');
    lines.push(esc(`سه وزن بزرگ‌تر: ${topText}.`));
    if(s.top1)lines.push(esc(`سه دارایی بزرگ روی‌هم حدود ${pct(s.top3)} از کل پورتفولیو را ساخته‌اند.`));
  }

  if(s.exposureRows.length){
    const main=s.exposureRows[0];
    lines.push(
      '',
      '<b>🧩 ترکیب پورتفولیو</b>',
      esc(`بزرگ‌ترین تمرکز فعلی روی ${main.group} است؛ حدود ${pct(main.weight)} از کل پورتفولیو.`)
    );
    for(const e of s.exposureRows.slice(0,5))lines.push(`• ${esc(e.group)} <code>${esc(pct(e.weight))}</code>`);
  }

  lines.push(
    '',
    '<b>🚦 از نظر تکنیکال</b>',
    esc(`حدود ${pct(s.healthyWeight)} از ارزش پورتفولیو وضعیت نسبتاً سالم‌تری دارد، ${pct(s.watchWeight)} نیازمند پیگیری است و ${pct(s.weakWeight)} در محدوده‌ی هشدار قرار گرفته.`)
  );

  lines.push('','<b>🧾 دارایی به دارایی</b>');
  for(const row of s.rows){
    const note=portfolioHoldingCommentary(row);
    lines.push(
      `<code>${esc(row.x.symbol)}</code> · <b>${esc(note.headline)}</b>`,
      esc(note.body)
    );
  }

  if(s.best||s.worst){
    lines.push('','<b>🏁 از زمان خرید</b>');
    if(s.best)lines.push(`• بهترین عملکرد فعلی: <code>${esc(s.best.x.symbol)}</code> با <code>${esc(pct(s.best.sinceEntry))}</code>`);
    if(s.worst)lines.push(`• ضعیف‌ترین عملکرد فعلی: <code>${esc(s.worst.x.symbol)}</code> با <code>${esc(pct(s.worst.sinceEntry))}</code>`);
  }

  const warnings=s.rows.filter(r=>r.tone!=='good').sort((a,b)=>(b.weight||0)-(a.weight||0));
  if(warnings.length){
    lines.push('','<b>⚠️ الان کجاها بیشتر حواسمون باشه؟</b>');
    for(const r of warnings.slice(0,4)){
      const why=portfolioRisks(r.x)[0]||'مومنتوم یا ساختار نیاز به بررسی دارد';
      lines.push(`• <code>${esc(r.x.symbol)}</code>${finite(r.weight)?` (${esc(pct(r.weight))})`:''}: ${esc(why)}`);
    }
  }

  if(finite(a?.portfolioReturnPct)||finite(a?.betaVsTsx)||finite(a?.annualizedVolatilityPct)){
    lines.push('','<b>📐 چند عدد ریسک برای کنترل تصویر</b>');
    if(finite(a.portfolioReturnPct))lines.push(`• بازده پنجره‌ی مشترک <code>${esc(pct(a.portfolioReturnPct))}</code> در برابر TSX <code>${esc(pct(a.benchmarkReturnPct))}</code>`);
    if(finite(a.betaVsTsx))lines.push(`• Beta نسبت به TSX <code>${esc(num(a.betaVsTsx,2))}</code>`);
    if(finite(a.annualizedVolatilityPct))lines.push(`• نوسان سالانه‌شده <code>${esc(pct(a.annualizedVolatilityPct))}</code>`);
    if(finite(a.maxDrawdownPct))lines.push(`• بیشترین افت مدل‌شده <code>${esc(pct(a.maxDrawdownPct))}</code>`);
  }

  const actionRead=s.exposureRows[0]?.weight>=45
    ?`چیزی که فعلاً بیشتر از همه ارزش پیگیری دارد تمرکز بالای ${s.exposureRows[0].group} است. چون حدود ${pct(s.exposureRows[0].weight)} از پورتفولیو به این بخش وابسته است، تغییر جهت همین گروه می‌تواند روی کل حساب اثر محسوسی بگذارد.`
    :'تمرکز خیلی افراطی دیده نمی‌شود؛ بنابراین مهم‌تر از همه باید دارایی‌های زرد و قرمز را دنبال کنیم و ببینیم مومنتوم‌شان بهتر می‌شود یا ضعف‌شان به ساختار بلندتر سرایت می‌کند.';
  lines.push(
    '',
    '<b>🔎 جمع‌بندی برای پیگیری بعدی</b>',
    esc(actionRead),
    '',
    '<i>این گزارش برای اینه که سریع بفهمیم کجای پورتفولیو قوی‌تر یا آسیب‌پذیرتر شده؛ نه اینکه خودش تصمیم معامله بگیرد.</i>'
  );

  return {text:lines.join('\n').slice(0,4050),keyboard:{inline_keyboard:[
    [{text:'⬅️ پورتفولیو',callback_data:'m:portfolio'},{text:'🏠 خانه',callback_data:'m:home'}]
  ]}};
}

function backPulse(){return {inline_keyboard:[[{text:'⬅️ بازارها',callback_data:'m:pulse'},{text:'🏠 خانه',callback_data:'m:home'}]]}}
function backHunter(){return {inline_keyboard:[[{text:'⬅️ Hunter',callback_data:'m:hunter'},{text:'🏠 خانه',callback_data:'m:home'}]]}}
