# Market Hunter

داشبورد شخصی و مستقل برای شکار سهم‌های قابل بررسی در بازار کانادا.

این پروژه عمداً و کاملاً از Investing DNA جدا نگه داشته شده است.

## Product principle: reduce bias, do not learn the user's taste

Market Hunter exists to reduce discretionary selection bias. The scanner must surface candidates from explicit market-data rules, not from whether the user previously liked, disliked, opened, ignored, saved, or manually rated a stock.

**Guardrails for future development (including AI/coding agents):**

- Do not use subjective user feedback to suppress, promote, blacklist, whitelist, or reweight stocks.
- Watchlist/favorite actions are personal tracking only and must not affect scanner score, stage, eligibility, or ranking.
- Chart opens/clicks must not affect scanner logic.
- Do not train/tune the scanner from the user's discretionary judgments.
- Scanner changes must be justified by reproducible market data and evaluated statistically across a broad sample, including lower-ranked and excluded names where possible.
- Historical evaluation should be automatic and objective: preserve each session's scanner snapshot and compare subsequent 1D / 3D / 5D / 10D outcomes, stage transitions, and relevant structure/momentum changes.
- Evaluation data is diagnostic. It must **not automatically change weights, filters, stages, or ranking**. Any model/rule change is a separate explicit development decision followed by a new frozen evaluation period.
- During a defined evaluation window, keep the tested rules/version frozen so results are comparable and avoid outcome-driven rule changes.
- The goal is **candidate discovery quality**, not a BUY/SELL signal and not hindsight optimization for a fixed return target.

## منطق فعلی

- Liquidity gate با میانگین Dollar Volume بیست‌روزه
- Weekly + Daily trend
- 5D / 20D / 60D momentum
- Relative Volume و رفتار حجم اخیر
- کم‌شدن فشار حجم فروش
- Relative Strength نسبت به benchmark مناسب
- Pullback و فاصله از MA20 / MA50
- RSI14 فقط context است و فیلتر/امتیاز مستقل نیست
- Daily local high/low structure فعلاً informational است و در score/stage دخالت ندارد

خروجی در چهار مرحله نمایش داده می‌شود:

1. Early Watch — شکار قبل از برگشت؛ هنوز ضعیف و برگشت تأیید نشده
2. Recovery — برگشت در حال شکل‌گیری
3. Attractive Growth — روند سازنده و هنوز ارزش بررسی دارد
4. Established Move — حرکت واضح‌تر و بالغ‌تر شده است

Score داخلی فقط برای رتبه‌بندی کاندیداهای هر مرحله استفاده می‌شود و عدد آن در UI نمایش داده نمی‌شود.

هدف ابزار BUY/SELL signal نیست؛ فقط تعداد زیادی سهم را به چند نمودار ارزشمند برای بررسی دستی Weekly / Daily / 4H کاهش می‌دهد.

## Evaluation protocol

برای ارزیابی نسخه فعلی، قواعد scanner در یک بازه از پیش تعیین‌شده ثابت می‌مانند. Snapshot هر جلسه باید امکان مقایسه آماری خروجی همان روز با آینده را بدهد. ارزیابی اصلی باید بدون رأی دستی کاربر انجام شود تا feedback loop سلیقه‌ای وارد scanner نشود.

حداقل خروجی مورد انتظار برای هر candidate snapshot:

- stage و rank/score داخلی در روز انتخاب
- برای Hunter Top 5: رتبه 1–5، Cross-Stage Score و تمام entry metrics باید دقیقاً از خروجی backend همان جلسه ذخیره شوند
- Top 5 باید به‌عنوان cohort مستقل ارزیابی شود: forward return هر عضو و همچنین median/average cohort در 1 / 3 / 5 / 10 جلسه
- علاوه بر بازده، باید بررسی شود هر عضو بعداً در چه Stageای قرار گرفته و Momentum/Structure آن نسبت به entry چه تغییری کرده
- Top 5 روز انتخاب بعداً بازنویسی نشود؛ ارزیابی باید روی انتخاب واقعی همان روز انجام شود تا survivorship/hindsight bias وارد نشود
- قیمت/metricهای همان روز
- forward return در 1 / 3 / 5 / 10 جلسه معاملاتی
- تغییر stage در جلسات بعد
- تغییر momentum و structure در صورت موجود بودن
- مقایسه Top 3 با رتبه‌های پایین‌تر، نه فقط بررسی winnerها

هر تغییر بعدی در الگوریتم باید versioned باشد تا داده قبل و بعد از تغییر با هم قاطی نشوند.

## ساختار

- `index.html`: داشبورد
- `api/scan.js`: موتور اسکن و رتبه‌بندی
- `data/history.json`: snapshotهای تاریخی مورد استفاده برای ارزیابی
- `vercel.json`: تنظیمات Vercel

دیتای ناموجود ساخته یا حدس زده نمی‌شود و در صورت خطا به‌صورت unavailable برمی‌گردد.
