# Market Hunter

داشبورد شخصی و مستقل برای شکار سهم‌های قابل بررسی در بازار کانادا.

این پروژه عمداً و کاملاً از Investing DNA جدا نگه داشته شده است.

## منطق فعلی

- Liquidity gate با میانگین Dollar Volume بیست‌روزه
- Weekly + Daily trend
- 5D / 20D / 60D momentum
- Relative Volume
- کم‌شدن فشار حجم فروش
- Relative Strength نسبت به TSX
- Pullback و فاصله از MA20 / MA50

خروجی فقط در سه گروه نمایش داده می‌شود:

1. Recovery — مشکوک به تغییر / ریکاوری
2. Attractive Growth — در حال رشد ولی جذاب
3. Established Move — رشد کرده

هدف ابزار BUY/SELL signal نیست؛ فقط تعداد زیادی سهم را به چند نمودار ارزشمند برای بررسی دستی Weekly / Daily / 4H کاهش می‌دهد.

## ساختار

- `index.html`: داشبورد
- `api/scan.js`: موتور اسکن و رتبه‌بندی
- `vercel.json`: تنظیمات Vercel

دیتای ناموجود ساخته یا حدس زده نمی‌شود و در صورت خطا به‌صورت unavailable برمی‌گردد.
