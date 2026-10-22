import { geocode, json } from './_lib.js';
export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return json([]);
  try { return json(await geocode(q, 10)); } catch (e) { return json({ error: String(e.message || e) }, 502); }
}
