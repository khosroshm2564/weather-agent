import { TOOLS, runTool, json } from './_lib.js';

export async function onRequestPost({ request, env }) {
  if (!env.AI_API_KEY) return json({ error: 'متغیر AI_API_KEY در Cloudflare تنظیم نشده' }, 500);
  const body = await request.json().catch(() => ({}));
  const place = body.place || null;
  const base = (env.AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const model = env.AI_MODEL || 'anthropic/claude-sonnet-4.5';
  const today = new Date().toISOString().slice(0, 10);

  const system = `تو «دستیار هواشناسی» هستی؛ یک agent که با ابزارها داده‌ی واقعی می‌گیرد و تحلیل می‌کند.
امروز ${today} است.${place ? ` شهر انتخاب‌شده کاربر: ${place.name}${place.country ? '، ' + place.country : ''} (lat=${place.lat}, lon=${place.lon}, cc=${place.cc || ''}).` : ''}
قوانین:
1. هر عدد و واقعیت آب‌وهوایی را فقط از خروجی ابزارها بگو؛ هیچ عددی را از خودت نساز. اگر داده نبود، صادقانه بگو.
2. برای شهر دیگر، اول search_city را صدا بزن. برای گذشته get_history (حداکثر ۹۲ روز)، برای ۱۶ روز آینده get_forecast، برای ماه آینده get_long_range.
3. دقت را شفاف بگو: ۱ تا ۳ روز بسیار دقیق، ۴ تا ۷ روز خوب، ۸ تا ۱۶ روز تقریبی، بعد از آن فقط روند نسبت به نرمال است و نه پیش‌بینی روزانه.
4. اگر مدل رسمی کشور (national_model) با مدل اصلی اختلاف محسوس داشت، به آن اشاره کن.
5. فارسی، خودمانی و کوتاه جواب بده؛ توصیه عملی بده (لباس، چتر، سفر). برای پرسش‌های مقایسه‌ای چند ابزار را با هم صدا بزن.`;

  const msgs = [{ role: 'system', content: system },
    ...(body.messages || []).filter((m) => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-4)];
  const used = [];

  for (let step = 0; step < 3; step++) {
    const r = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.AI_API_KEY },
      body: JSON.stringify({ model, messages: msgs, tools: TOOLS, tool_choice: 'auto', temperature: 0.2, max_tokens: 500 }),
    });
    if (!r.ok) return json({ error: `AI ${r.status}: ${(await r.text()).slice(0, 300)}` }, 502);
    const msg = (await r.json()).choices?.[0]?.message;
    if (!msg) return json({ error: 'پاسخ خالی از AI' }, 502);
    if (!msg.tool_calls?.length) return json({ reply: msg.content || '', tools: used });

    msgs.push(msg);
    for (const call of msg.tool_calls) {
      let out;
      try { out = await runTool(call.function.name, JSON.parse(call.function.arguments || '{}')); used.push(call.function.name); }
      catch (e) { out = { error: String(e.message || e) }; }
      msgs.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(out).slice(0, 24000) });
    }
  }
  return json({ reply: 'نتونستم در تعداد مرحله‌های مجاز به جواب برسم؛ سؤال رو کمی ساده‌تر بپرس.', tools: used });
}
