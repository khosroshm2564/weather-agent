# هواشناسی هوشمند (Agent)

## ساختار
- `index.html` رابط کاربری (PWA)
- `functions/api/geo.js` جستجوی همه‌ی شهرها
- `functions/api/weather.js` پیش‌بینی ۱۶ روزه + آرشیو ۹۲ روز + روند ۳۰ روز آینده
- `functions/api/agent.js` دستیار هوشمند با tool-calling
- `functions/api/_lib.js` لایه‌ی داده و ابزارهای agent

## دیپلوی روی Cloudflare Pages
1. داخل پوشه‌ی پروژه: `npx wrangler pages deploy . --project-name weather-agent`
   (آپلود drag-and-drop در داشبورد، پوشه‌ی functions را نمی‌شناسد؛ حتماً wrangler یا اتصال به GitHub.)
2. در داشبورد: Pages → پروژه → Settings → Variables and secrets، این‌ها را (Secret) اضافه کن:
   - `AI_API_KEY` کلید OpenRouter (یا هر سرویس سازگار با OpenAI)
   - `AI_MODEL` اختیاری، پیش‌فرض `anthropic/claude-sonnet-4.5`
   - `AI_BASE_URL` اختیاری، پیش‌فرض `https://openrouter.ai/api/v1`
3. یک بار دوباره deploy کن تا متغیرها اعمال شوند.

## تست لوکال
فایل `.dev.vars` بساز با `AI_API_KEY=...` و اجرا کن: `npx wrangler pages dev .`

## نصب روی گوشی بدون نشان مرورگر
با Chrome/Samsung Internet آدرس را باز کن و گزینه‌ی «Install app» را بزن (نه Add to home screen). آیکن‌های PNG داخل پروژه باعث می‌شوند به‌صورت WebAPK نصب شود.
