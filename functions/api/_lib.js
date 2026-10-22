// Shared helpers: all weather data comes from Open-Meteo (free for non-commercial use),
// which republishes the national weather services' own models (DWD, Météo-France, Met Office, NOAA, JMA, ...).

// کشور -> مدل رسمی سازمان هواشناسی همان کشور (در Open-Meteo)
export const NATIONAL = {
  DE: { model: 'icon_seamless', name: 'DWD آلمان' },
  FR: { model: 'meteofrance_seamless', name: 'Météo-France' },
  GB: { model: 'ukmo_seamless', name: 'Met Office بریتانیا' },
  US: { model: 'gfs_seamless', name: 'NOAA / NWS آمریکا' },
  CA: { model: 'gem_seamless', name: 'Environment Canada' },
  JP: { model: 'jma_seamless', name: 'JMA ژاپن' },
  AU: { model: 'bom_access_global', name: 'BOM استرالیا' },
  NO: { model: 'metno_seamless', name: 'MET Norway' },
  SE: { model: 'metno_seamless', name: 'MET Nordic (سوئد)' },
  DK: { model: 'metno_seamless', name: 'MET Nordic (دانمارک)' },
  FI: { model: 'metno_seamless', name: 'MET Nordic (فنلاند)' },
  IR: { model: 'ecmwf_ifs025', name: 'ECMWF (سازمان هواشناسی ایران API عمومی ندارد)' },
  TR: { model: 'ecmwf_ifs025', name: 'ECMWF (MGM ترکیه API عمومی ندارد)' },
};

const CUR = 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day';
const HOUR = 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m';
const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset';
const HDAILY = 'weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max';

const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null)).toString();

export async function j(url) {
  const r = await fetch(url, { cf: { cacheTtl: 900, cacheEverything: true } });
  if (!r.ok) throw new Error(`upstream ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

export const zip = (o) => o.time.map((t, i) => Object.fromEntries(Object.keys(o).map((k) => [k, o[k][i]])));
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

export async function geocode(name, count = 10) {
  const d = await j('https://geocoding-api.open-meteo.com/v1/search?' + q({ name, count, language: 'fa', format: 'json' }));
  return (d.results || []).map((p) => ({
    name: p.name, lat: p.latitude, lon: p.longitude, cc: p.country_code, country: p.country,
    admin1: p.admin1, timezone: p.timezone, population: p.population, elevation: p.elevation,
  }));
}

export async function getForecast(lat, lon, days = 16) {
  return j('https://api.open-meteo.com/v1/forecast?' + q({
    latitude: lat, longitude: lon, timezone: 'auto', forecast_days: Math.min(days, 16),
    forecast_hours: 48, current: CUR, hourly: HOUR, daily: DAILY,
  }));
}

export async function getNational(lat, lon, cc) {
  const n = NATIONAL[cc];
  if (!n) return null;
  try {
    const d = await j('https://api.open-meteo.com/v1/forecast?' + q({
      latitude: lat, longitude: lon, timezone: 'auto', forecast_days: 7, models: n.model,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
    }));
    return { ...n, daily: d.daily };
  } catch { return { ...n, daily: null }; }
}

// آرشیو ۹۲ روز گذشته (حداکثر مجاز past_days) تا امروز
export async function getHistory(lat, lon) {
  const d = await j('https://api.open-meteo.com/v1/forecast?' + q({
    latitude: lat, longitude: lon, timezone: 'auto', past_days: 92, forecast_days: 1, daily: HDAILY,
  }));
  return d.daily;
}

const ens = (daily, name) => {
  const ks = Object.keys(daily).filter((k) => k === name || k.startsWith(name + '_member'));
  return daily.time.map((_, i) => {
    const v = ks.map((k) => daily[k][i]).filter((x) => x != null);
    if (!v.length) return { m: null, sd: null };
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    return { m, sd: Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) };
  });
};

// میانگین اقلیمی ۶ سال اخیر برای هر روز سال (مبنای مقایسه «نرمال»)
async function climatology(lat, lon) {
  const y = new Date().getUTCFullYear();
  const d = await j('https://archive-api.open-meteo.com/v1/archive?' + q({
    latitude: lat, longitude: lon, timezone: 'auto', start_date: `${y - 6}-01-01`, end_date: `${y - 1}-12-31`,
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
  })).then((x) => x.daily);
  const acc = {};
  d.time.forEach((t, i) => {
    const k = t.slice(5);
    const a = (acc[k] ||= { n: 0, tx: 0, tn: 0, p: 0 });
    if (d.temperature_2m_max[i] == null) return;
    a.n++; a.tx += d.temperature_2m_max[i]; a.tn += d.temperature_2m_min[i]; a.p += d.precipitation_sum[i] || 0;
  });
  return (t) => { const a = acc[t.slice(5)]; return a && a.n ? { tx: a.tx / a.n, tn: a.tn / a.n, p: a.p / a.n } : null; };
}

// پیش‌بینی فصلی ECMWF (میانگین اعضای ensemble) برای ~۳۰ روز آینده + مقایسه با نرمال
export async function getLongRange(lat, lon) {
  const [s, clim] = await Promise.allSettled([
    j('https://seasonal-api.open-meteo.com/v1/seasonal?' + q({
      latitude: lat, longitude: lon, timezone: 'auto', forecast_days: 46,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    })),
    climatology(lat, lon),
  ]);
  const normal = clim.status === 'fulfilled' ? clim.value : () => null;
  if (s.status !== 'fulfilled') {
    // پشتیبان: فقط اقلیم‌شناسی
    const out = [];
    for (let i = 1; i <= 30; i++) {
      const t = new Date(Date.now() + i * 864e5).toISOString().slice(0, 10);
      const c = normal(t);
      if (c) out.push({ date: t, tmax: null, tmin: null, precip: null, sd: null, nTmax: r1(c.tx), nTmin: r1(c.tn), nPrecip: r1(c.p) });
    }
    return { rows: out, climatologyOnly: true };
  }
  const d = s.value.daily;
  const tx = ens(d, 'temperature_2m_max'), tn = ens(d, 'temperature_2m_min'), pr = ens(d, 'precipitation_sum');
  const rows = d.time.slice(0, 31).map((t, i) => {
    const c = normal(t);
    return { date: t, tmax: r1(tx[i].m), tmin: r1(tn[i].m), sd: r1(tx[i].sd), precip: r1(pr[i].m),
      nTmax: c ? r1(c.tx) : null, nTmin: c ? r1(c.tn) : null, nPrecip: c ? r1(c.p) : null };
  });
  return { rows, climatologyOnly: false };
}

// ---------- ابزارهای Agent ----------
export const TOOLS = [
  { type: 'function', function: { name: 'search_city', description: 'جستجوی شهر/روستا در سراسر دنیا و گرفتن مختصات', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } },
  { type: 'function', function: { name: 'get_forecast', description: 'پیش‌بینی روزانه تا ۱۶ روز آینده (دما، بارش، باد، UV) + مقایسه با مدل رسمی کشور', parameters: { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number' }, cc: { type: 'string', description: 'کد دوحرفی کشور' }, days: { type: 'integer' } }, required: ['lat', 'lon'] } } },
  { type: 'function', function: { name: 'get_history', description: 'داده واقعی/آنالیز روزانه گذشته. حداکثر ۹۲ روز اخیر.', parameters: { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number' }, start_date: { type: 'string', description: 'YYYY-MM-DD' }, end_date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['lat', 'lon', 'start_date', 'end_date'] } } },
  { type: 'function', function: { name: 'get_long_range', description: 'پیش‌بینی روند ۳۰ روز آینده (ECMWF seasonal) نسبت به میانگین اقلیمی', parameters: { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number' } }, required: ['lat', 'lon'] } } },
];

export async function runTool(name, a) {
  if (name === 'search_city') return (await geocode(a.name, 5));
  if (name === 'get_forecast') {
    const [f, n] = await Promise.all([getForecast(a.lat, a.lon, a.days || 16), getNational(a.lat, a.lon, a.cc)]);
    return { timezone: f.timezone, daily: zip(f.daily).map(({ sunrise, sunset, ...x }) => x),
      national_model: n ? { name: n.name, daily: n.daily ? zip(n.daily) : null } : null };
  }
  if (name === 'get_history') {
    const h = zip(await getHistory(a.lat, a.lon));
    const today = new Date().toISOString().slice(0, 10);
    const rows = h.filter((r) => r.time >= a.start_date && r.time <= (a.end_date < today ? a.end_date : today));
    return { note: 'حداکثر ۹۲ روز گذشته در دسترس است', rows };
  }
  if (name === 'get_long_range') return getLongRange(a.lat, a.lon);
  return { error: 'unknown tool' };
}

export const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
