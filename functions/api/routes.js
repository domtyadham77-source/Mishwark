import { json } from '../_lib/core.js';

export async function onRequestGet({ env }) {
  const rows = await env.DB.prepare(
    'SELECT id, route_name, price_piasters FROM fixed_routes WHERE active=1 ORDER BY sort_order, route_name'
  ).all();
  return json({ ok: true, routes: rows.results || [] });
}
