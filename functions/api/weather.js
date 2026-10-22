import { getForecast, getNational, getHistory, getLongRange, json } from './_lib.js';
export async function onRequestGet({ request }) {
  const u = new URL(request.url);
  const lat = +u.searchParams.get('lat'), lon = +u.searchParams.get('lon'), cc = (u.searchParams.get('cc') || '').toUpperCase();
  if (!isFinite(lat) || !isFinite(lon)) return json({ error: 'lat/lon نامعتبر' }, 400);
  const [f, n, h, l] = await Promise.allSettled([getForecast(lat, lon, 16), getNational(lat, lon, cc), getHistory(lat, lon), getLongRange(lat, lon)]);
  if (f.status !== 'fulfilled') return json({ error: 'دریافت پیش‌بینی ممکن نشد: ' + f.reason.message }, 502);
  const v = (x) => (x.status === 'fulfilled' ? x.value : null);
  return json({
    timezone: f.value.timezone, elevation: f.value.elevation,
    current: f.value.current, hourly: f.value.hourly, daily: f.value.daily,
    national: v(n), history: v(h), longRange: v(l),
  });
}
