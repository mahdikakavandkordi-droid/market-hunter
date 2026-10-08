// Read-only pilot. No imports from scanner, portfolio or paper-engine code.
import fs from 'node:fs';
export const ISSUERS = Object.freeze(JSON.parse(fs.readFileSync(new URL('../data/fundamental-issuers.json',import.meta.url),'utf8')));
export const PILOT = Object.freeze(ISSUERS.filter(issuer=>issuer.source==='sec'));

const DEFINITIONS = {
  revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues'],
  operatingIncome: ['OperatingIncomeLoss'],
  netIncome: ['NetIncomeLoss'],
  continuingNetIncome: ['NetIncomeLossFromContinuingOperationsAvailableToCommonShareholdersDiluted'],
  operatingCash: ['NetCashProvidedByUsedInOperatingActivities'],
  continuingOperatingCash: ['NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  propertyEquipmentPayments: ['PaymentsToAcquirePropertyPlantAndEquipment'],
  cash: ['CashAndCashEquivalentsAtCarryingValue'],
  currentLongTermDebt: ['LongTermDebtCurrent'],
  noncurrentLongTermDebt: ['LongTermDebtNoncurrent'],
};
const INSTANT = new Set(['cash', 'currentLongTermDebt', 'noncurrentLongTermDebt']);
const CASHFLOW = new Set(['operatingCash', 'continuingOperatingCash', 'propertyEquipmentPayments']);
const dateOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const validInstant = value => typeof value === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));

export function chooseFiling(submissions, spec, asOf) {
  if (!validInstant(asOf)) throw new Error('asOf must be an explicit ISO timestamp');
  if (String(submissions.cik).padStart(10, '0') !== spec.cik || submissions.name !== (spec.filingName ?? spec.name)) throw new Error('Issuer identity mismatch');
  const recent = submissions.filings?.recent;
  if (!recent) throw new Error('Missing submissions history');
  const rows = recent.accessionNumber.map((accession, i) => ({
    accession, form: recent.form[i], filed: recent.filingDate[i], acceptedAt: recent.acceptanceDateTime[i],
    reportDate: recent.reportDate[i], document: recent.primaryDocument[i],
  })).filter(row => ['10-Q', '10-K', '10-Q/A', '10-K/A'].includes(row.form)
    && validInstant(row.acceptedAt) && Date.parse(row.acceptedAt) <= Date.parse(asOf)
    && dateOnly(row.reportDate) && row.reportDate <= asOf.slice(0, 10)
    && dateOnly(row.filed) && row.filed <= asOf.slice(0, 10)
    && /^\d{10}-\d{2}-\d{6}$/.test(row.accession) && /^[\w.-]+$/.test(row.document));
  rows.sort((a, b) => b.reportDate.localeCompare(a.reportDate) || Date.parse(b.acceptedAt) - Date.parse(a.acceptedAt));
  if (!rows.length) throw new Error('No eligible filing');
  const filing = rows[0];
  if (filing.form.endsWith('/A')) throw new Error('Amended filing requires explicit review');
  if (rows[1]?.reportDate === filing.reportDate && rows[1]?.acceptedAt === filing.acceptedAt && rows[1]?.accession !== filing.accession) throw new Error('Ambiguous filing');
  return { ...filing, url: `https://www.sec.gov/Archives/edgar/data/${Number(spec.cik)}/${filing.accession.replaceAll('-', '')}/${filing.document}` };
}

function pickFact(facts, proofs, filing, metric, start, end, retrievedAt) {
  const instant = INSTANT.has(metric);
  const matches = [];
  for (const tag of DEFINITIONS[metric]) {
    for (const raw of facts.facts?.['us-gaap']?.[tag]?.units?.USD ?? []) {
      if (raw.accn !== filing.accession || raw.end !== end || (instant ? raw.start != null : raw.start !== start)) continue;
      if (raw.form !== filing.form || raw.filed !== filing.filed || typeof raw.val !== 'number' || !Number.isFinite(raw.val)) continue;
      matches.push({ tag, raw });
    }
  }
  if (!matches.length) return { status: 'missing', reason: 'No exact USD fact in the selected filing and period' };
  const values = new Set(matches.map(x => x.raw.val));
  if (values.size !== 1) return { status: 'conflict', reason: 'Conflicting facts require manual review' };
  const { tag, raw } = matches[0];
  const original = proofs?.facts?.filter(p => p.tag === `us-gaap:${tag}` && p.unit === 'USD' && p.start === (instant ? null : start) && p.end === end) ?? [];
  if (new Set(original.map(p => p.value)).size > 1) return { status: 'conflict', reason: 'Conflicting original-document facts require review' };
  const proof = original.find(p => p.value === raw.val);
  const reconciled = proof && proofs.accession === filing.accession && proofs.sourceUrl === filing.url && /^[a-f0-9]{64}$/.test(proofs.sha256 ?? '');
  return {
    status: reconciled ? 'verified' : 'unverified', value: raw.val, unit: 'USD', scale: 1,
    periodStart: instant ? null : start, periodEnd: end, basis: instant ? 'instant' : CASHFLOW.has(metric) ? 'filing-to-date' : filing.form === '10-K' ? 'fiscal-year' : 'quarter',
    taxonomy: 'us-gaap', tag, sourceUrl: filing.url, accession: filing.accession,
    filed: filing.filed, acceptedAt: filing.acceptedAt, retrievedAt,
    reconciliation: reconciled ? { sourceSha256: proofs.sha256, inlineFactId: proof.id, contextId: proof.contextId } : null,
  };
}

export function buildSnapshot({ spec, facts, submissions, proofs, asOf, retrievedAt }) {
  if (!validInstant(retrievedAt)) throw new Error('Invalid retrieval timestamp');
  if (String(facts.cik).padStart(10, '0') !== spec.cik || facts.entityName !== spec.name) throw new Error('Company Facts identity mismatch');
  const filing = chooseFiling(submissions, spec, asOf);
  if(Date.parse(retrievedAt)<Date.parse(filing.acceptedAt))throw new Error('Invalid retrieval timestamp before source publication');
  const end = filing.reportDate;
  const annual = filing.form === '10-K';
  const startsFor = keys => [...new Set(keys.flatMap(key=>DEFINITIONS[key].flatMap(tag=>(facts.facts?.['us-gaap']?.[tag]?.units?.USD??[])
    .filter(r=>r.accn===filing.accession&&r.form===filing.form&&r.filed===filing.filed&&r.end===end&&dateOnly(r.start)&&typeof r.val==='number'&&Number.isFinite(r.val))
    .map(r=>r.start))))];
  const duration = start => (Date.parse(end)-Date.parse(start))/86400000+1;
  const incomeStarts = startsFor(['revenue','operatingIncome']).filter(start=>annual?duration(start)>=330&&duration(start)<=400:duration(start)>=60&&duration(start)<=110);
  if(incomeStarts.length!==1)throw new Error('Missing or ambiguous reporting period; review required');
  const start=incomeStarts[0];
  const cashStarts=startsFor(['operatingCash']).filter(s=>duration(s)>=duration(start)&&duration(s)<=400).sort();
  const cashStart=cashStarts[0]??start;
  const period = annual?'fiscal-year':'quarter';
  const metrics = Object.fromEntries(Object.keys(DEFINITIONS).map(metric => [metric, pickFact(facts, proofs, filing, metric, CASHFLOW.has(metric) ? cashStart : start, end, retrievedAt)]));
  const yearBefore = date => {const d=new Date(date+'T00:00:00Z');d.setUTCFullYear(d.getUTCFullYear()-1);return d.toISOString().slice(0,10);};
  const priorStart=yearBefore(start),priorEnd=yearBefore(end);
  metrics.priorRevenue = pickFact(facts, proofs, filing, 'revenue', priorStart, priorEnd, retrievedAt);
  metrics.priorOperatingIncome = pickFact(facts, proofs, filing, 'operatingIncome', priorStart, priorEnd, retrievedAt);
  const complete = ['revenue', 'operatingIncome', 'operatingCash', 'cash'].every(key => metrics[key].status === 'verified');
  return {
    version: 'fundamental-pilot-v1', symbol: spec.symbol, issuer: spec.name, cik: spec.cik, businessLens: spec.lens,
    instrument: spec.instrument ?? 'Common equity', reportingCurrency: 'USD', asOf, retrievedAt, filing,
    financialPeriod: { start, end, basis: period }, status: complete ? 'complete' : 'partial', metrics,
    gaps: Object.entries(metrics).filter(([, value]) => value.status !== 'verified').map(([metric, value]) => ({ metric, status: value.status, reason: value.reason ?? 'Original-document reconciliation unavailable' })),
  };
}

export function replaceCompleteSnapshot(previous, attempt) {
  if (previous && previous.symbol !== attempt.symbol) throw new Error('Snapshot issuer mismatch');
  if (attempt.status !== 'complete') return { current: previous ?? null, lastAttempt: attempt };
  if (previous && (attempt.filing.reportDate < previous.filing.reportDate || Date.parse(attempt.filing.acceptedAt) < Date.parse(previous.filing.acceptedAt))) return { current: previous, lastAttempt: attempt };
  return { current: attempt, lastAttempt: null };
}

const value = (snapshot, key) => snapshot.metrics[key]?.status === 'verified' ? snapshot.metrics[key].value : null;
const money = (number, language) => new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', { maximumFractionDigits: 2 }).format(number / 1e9);

export function narrative(snapshot, language = 'en') {
  if (!['en', 'fa'].includes(language)) throw new Error('Unsupported language');
  if (snapshot.status !== 'complete') return { status: 'unavailable', summary: language === 'fa' ? 'داده‌های مالی هنوز کامل و تطبیق‌شده نیستند.' : 'Financial evidence is not yet complete and reconciled.', monitoring: [], evidence: [] };
  const fa = language === 'fa';
  const currency=snapshot.reportingCurrency??'USD';
  const m = key => money(value(snapshot, key), language);
  const basis = snapshot.financialPeriod.basis === 'fiscal-year' ? (fa ? 'سال مالی' : 'fiscal year') : (fa ? 'سه‌ماهه' : 'quarter');
  const cashStart=snapshot.metrics.operatingCash.periodStart,cashEnd=snapshot.metrics.operatingCash.periodEnd;
  const cashBasis = `${cashStart} → ${cashEnd}`;
  let core = fa
    ? `در ${basis} منتهی به ${snapshot.financialPeriod.end}، درآمد ${m('revenue')} و سود عملیاتی ${m('operatingIncome')} میلیارد ${currency==='CAD'?'دلار کانادا':'دلار آمریکا'} بود. جریان نقد عملیاتی ${cashBasis} ${m('operatingCash')} میلیارد ${currency==='CAD'?'دلار کانادا':'دلار آمریکا'} ثبت شد؛ این رقم با سود حسابداری متفاوت است.`
    : `For the ${basis} ended ${snapshot.financialPeriod.end}, revenue was ${currency} ${m('revenue')} billion and operating income was ${currency} ${m('operatingIncome')} billion. Operating cash flow for the ${cashBasis} was ${currency} ${m('operatingCash')} billion; it is distinct from accounting profit.`;
  const revenue = value(snapshot, 'revenue');
  const priorRevenue = value(snapshot, 'priorRevenue');
  const priorOperating = value(snapshot, 'priorOperatingIncome');
  const evidence = ['revenue', 'operatingIncome', 'operatingCash'];
  let comparison = null;
  const samePeriod=(a,b)=>a?.periodStart===b?.periodStart&&a?.periodEnd===b?.periodEnd;
  if (revenue > 0 && priorRevenue > 0 && priorOperating !== null&&samePeriod(snapshot.metrics.priorRevenue,snapshot.metrics.priorOperatingIncome)) {
    const growth = (revenue / priorRevenue - 1) * 100;
    const margin = value(snapshot, 'operatingIncome') / revenue * 100;
    const priorMargin = priorOperating / priorRevenue * 100;
    const pct = n => new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US', { maximumFractionDigits: 1 }).format(Math.abs(n));
    const direction = growth >= 0 ? (fa ? 'رشد کرد' : 'rose') : (fa ? 'کاهش یافت' : 'fell');
    const marginDirection = margin > priorMargin ? (fa ? 'افزایش' : 'increased') : margin < priorMargin ? (fa ? 'کاهش' : 'decreased') : (fa ? 'بدون تغییر بود' : 'was unchanged');
    const signedPct = n => `${n < 0 ? '-' : ''}${pct(n)}`;
    core = fa
      ? `در ${basis} منتهی به ${snapshot.financialPeriod.end}، درآمد نسبت به دورهٔ مشابه سال قبل ${pct(growth)}٪ ${direction}. حاشیهٔ سود عملیاتی از ${signedPct(priorMargin)}٪ به ${signedPct(margin)}٪ رسید (${marginDirection})؛ جریان نقد عملیاتی ${cashBasis} ${m('operatingCash')} میلیارد ${currency==='CAD'?'دلار کانادا':'دلار آمریکا'} بود.`
      : `For the ${basis} ended ${snapshot.financialPeriod.end}, revenue ${direction} ${pct(growth)}% versus the comparable prior-year period. Operating margin ${marginDirection} from ${signedPct(priorMargin)}% to ${signedPct(margin)}%; operating cash flow for the ${cashBasis} was ${currency} ${m('operatingCash')} billion.`;
    comparison = { revenueGrowthPercent: growth, operatingMarginPercent: margin, priorOperatingMarginPercent: priorMargin, method: 'Same-filing, same-duration prior-year comparison; operating income / revenue' };
    evidence.push('priorRevenue', 'priorOperatingIncome');
  }
  const content = {
    pharmaceuticals: {
      en: ['Bausch Health is reviewed on its consolidated pharmaceutical and eye-health reporting basis.', 'Debt maturities and product/patent exposure still need contextual review; operating profit alone does not establish financial resilience.', ['Debt maturities and liquidity in the next filing.', 'Product revenue concentration and patent-related disclosures.']],
      fa: ['باوش هلث بر اساس گزارش تلفیقی دارو و سلامت چشم بررسی شده است.', 'سررسید بدهی و ریسک محصولات و پتنت‌ها هنوز به بررسی زمینه‌ای نیاز دارند؛ سود عملیاتی به‌تنهایی نشان‌دهندهٔ استحکام مالی نیست.', ['سررسید بدهی و نقدینگی در گزارش بعدی.', 'تمرکز درآمد محصولات و افشاهای مربوط به پتنت‌ها.']],
    },
    mining: {
      en: ['SSR Mining is reviewed as a gold and silver producer.', 'Total-company profit and cash flow can differ from continuing-operation figures. Mining cost and commodity-price context is not normalized in this pilot.', ['Continuing versus discontinued-operation results.', 'Production and the source-defined mining-cost measures.']],
      fa: ['SSR Mining به‌عنوان تولیدکنندهٔ طلا و نقره بررسی شده است.', 'سود و جریان نقد کل شرکت ممکن است با عملیات ادامه‌دار متفاوت باشد. هزینهٔ استخراج و اثر قیمت فلزات در این پایلوت استانداردسازی نشده است.', ['تفکیک نتایج عملیات ادامه‌دار و متوقف‌شده.', 'تولید و هزینه‌های استخراج با تعریف دقیق منبع.']],
    },
    'digital-platforms': {
      en: ['The business reviewed is Meta Platforms, the company underlying the CAD-hedged CDR.', 'Infrastructure spending and commitments need separate review; positive operating cash flow alone does not establish cash available after investment.', ['Operating-margin changes in the next comparable quarter.', 'Infrastructure spending and contractual commitments.']],
      fa: ['کسب‌وکار بررسی‌شده Meta Platforms، شرکت پایهٔ CDR با پوشش ارزی دلار کانادا است.', 'مخارج زیرساخت و تعهدات به بررسی جداگانه نیاز دارند؛ جریان نقد عملیاتی مثبت به‌تنهایی نقد باقی‌مانده پس از سرمایه‌گذاری را نشان نمی‌دهد.', ['تغییر حاشیهٔ سود عملیاتی در سه‌ماههٔ قابل‌مقایسهٔ بعدی.', 'مخارج زیرساخت و تعهدات قراردادی.']],
    },
    'software-cloud': {
      en: ['The business reviewed is Microsoft, the company underlying the CAD-hedged CDR.', 'Annual snapshots contain fiscal-year facts, not Q4-only figures. Investment spending and non-operating gains require separate interpretation.', ['Cloud operating performance in the next filing.', 'Investment spending and the distinction between operating and non-operating earnings.']],
      fa: ['کسب‌وکار بررسی‌شده Microsoft، شرکت پایهٔ CDR با پوشش ارزی دلار کانادا است.', 'تصویر سالانه شامل ارقام کل سال مالی است، نه فقط فصل چهارم. مخارج سرمایه‌گذاری و سودهای غیرعملیاتی به تفسیر جداگانه نیاز دارند.', ['عملکرد عملیاتی بخش ابری در گزارش بعدی.', 'مخارج سرمایه‌گذاری و تفکیک سود عملیاتی از غیرعملیاتی.']],
    },
  }[snapshot.businessLens]?.[language]??[fa?`گزارش مالی ${snapshot.issuer} بر مبنای منبع رسمی بازبینی شده است.`:`Financial context for ${snapshot.issuer} uses a reviewed issuer report.`,fa?'معیارهای تخصصی این صنعت هنوز تأیید نشده‌اند؛ این خلاصه ارزیابی جامع شرکت نیست.':'Sector-specific operating measures have not been verified; this summary is not a comprehensive company assessment.',fa?['تغییر درآمد در دورهٔ قابل‌مقایسهٔ بعدی.','افشاهای تخصصی صنعت و دامنهٔ حسابداری گزارش بعدی.']:['Revenue changes in the next comparable period.','Sector-specific disclosures and accounting scope in the next report.']];
  if (!content) throw new Error('Unreviewed business lens');
  let uncertainty=content[1],monitoring=[...content[2]];
  const cash=value(snapshot,'cash'),currentDebt=value(snapshot,'currentLongTermDebt'),noncurrentDebt=value(snapshot,'noncurrentLongTermDebt');
  if(snapshot.businessLens==='pharmaceuticals'&&currentDebt!==null&&noncurrentDebt!==null){
    uncertainty=fa
      ? `بخش جاری بدهی بلندمدت ${m('currentLongTermDebt')} و بخش غیرجاری ${m('noncurrentLongTermDebt')} میلیارد ${currency==='CAD'?'دلار کانادا':'دلار آمریکا'} است؛ نقد ${m('cash')} میلیارد است. این اجزا معادل کل بدهی نیستند و برنامهٔ سررسید و محدودیت نقدینگی هنوز باید بررسی شود.`
      : `Current long-term debt is ${currency} ${m('currentLongTermDebt')} billion and the noncurrent component is ${currency} ${m('noncurrentLongTermDebt')} billion, alongside ${currency} ${m('cash')} billion cash. These components are not total debt; maturity terms and cash restrictions still require review.`;
    evidence.push('currentLongTermDebt','noncurrentLongTermDebt','cash');
    monitoring[0]=fa?'تغییر بخش جاری بدهی و نقد در گزارش بعدی، همراه با سررسیدهای افشاشده.':'Changes in current long-term debt and cash, alongside disclosed maturity terms.';
  }
  const operatingCash=value(snapshot,'operatingCash'),capex=value(snapshot,'propertyEquipmentPayments');
  const comparableCapex=capex!==null&&snapshot.metrics.propertyEquipmentPayments.periodStart===snapshot.metrics.operatingCash.periodStart&&snapshot.metrics.propertyEquipmentPayments.periodEnd===snapshot.metrics.operatingCash.periodEnd;
  if(['digital-platforms','software-cloud'].includes(snapshot.businessLens)&&comparableCapex){
    const residual=operatingCash-capex;
    uncertainty=fa
      ? `پرداخت خرید دارایی ثابت ${m('propertyEquipmentPayments')} میلیارد ${currency==='CAD'?'دلار کانادا':'دلار آمریکا'} در همان دوره بود؛ جریان نقد عملیاتی منهای این پرداخت‌ها ${money(residual,language)} میلیارد است. این محاسبه، جریان نقد آزاد با تعریف شرکت نیست و سایر سرمایه‌گذاری‌ها و تعهدات اجاره را پوشش نمی‌دهد.`
      : `Cash payments for property and equipment were ${currency} ${m('propertyEquipmentPayments')} billion over the same period. Operating cash less these payments is ${currency} ${money(residual,language)} billion. This is not issuer-defined free cash flow and excludes other investment outflows and lease commitments.`;
    if(snapshot.financialPeriod.basis==='fiscal-year')uncertainty+=(fa?' این ارقام سالانه‌اند، نه فقط فصل چهارم.':' These are annual facts, not Q4-only figures.');
    evidence.push('propertyEquipmentPayments');
    monitoring[1]=fa?'تغییر مخارج دارایی ثابت نسبت به جریان نقد عملیاتی، با دورهٔ زمانی یکسان.':'Changes in property/equipment cash spending relative to operating cash, over matching periods.';
  }
  const continuingCash=value(snapshot,'continuingOperatingCash');
  if(snapshot.businessLens==='mining'&&continuingCash!==null&&samePeriod(snapshot.metrics.continuingOperatingCash,snapshot.metrics.operatingCash)){
    uncertainty=fa
      ? `جریان نقد عملیاتی کل شرکت ${m('operatingCash')} و عملیات ادامه‌دار ${m('continuingOperatingCash')} میلیارد ${currency==='CAD'?'دلار کانادا':'دلار آمریکا'} است؛ این دو دامنه نباید یکسان فرض شوند. هزینهٔ هر اونس و اثر قیمت فلزات هنوز بررسی نشده‌اند.`
      : `Total operating cash is ${currency} ${m('operatingCash')} billion versus ${currency} ${m('continuingOperatingCash')} billion from continuing operations. These scopes must not be treated as equivalent. Per-ounce costs and commodity-price effects have not been assessed.`;
    evidence.push('continuingOperatingCash');
  }
  return { status: 'pilot', context: content[0], summary: core, uncertainty, monitoring, evidence, comparison, contextReviewRequired: true, dateLabel: snapshot.filing.reportDate, instrumentNote: snapshot.instrument === 'CAD-hedged CDR' ? (fa ? 'ارقام مالی مربوط به شرکت پایه و به دلار آمریکا هستند؛ ارزش‌گذاری هر واحد CDR محاسبه نشده است.' : 'Financial figures describe the underlying company in USD; no per-CDR valuation is calculated.') : null };
}
