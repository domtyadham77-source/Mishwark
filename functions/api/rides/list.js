import { json, requireUser } from '../../_lib/core.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;
  const user = auth.user;

  if (user.role === 'passenger') {
    const rows = await env.DB.prepare(
      'SELECT * FROM rides WHERE passenger_id=? ORDER BY requested_at DESC LIMIT 100'
    ).bind(user.id).all();
    return json({ ok: true, rides: rows.results || [] });
  }

  if (user.role === 'captain') {
    const profile = await env.DB.prepare(
      'SELECT availability FROM captain_profiles WHERE user_id=?'
    ).bind(user.id).first();
    const online = profile?.availability === 'online';
    const rows = await env.DB.prepare(
      `SELECT * FROM rides
       WHERE captain_id=?
          OR (?=1 AND captain_id IS NULL AND status IN ('requested','negotiating'))
       ORDER BY CASE WHEN captain_id=? THEN 0 ELSE 1 END, requested_at DESC
       LIMIT 100`
    ).bind(user.id, online ? 1 : 0, user.id).all();
    return json({
      ok: true,
      rides: rows.results || [],
      notice: online ? null : 'أنت غير متاح حاليًا. ستظل رحلاتك الحالية ظاهرة هنا.'
    });
  }

  const rows = await env.DB.prepare(
    'SELECT * FROM rides ORDER BY requested_at DESC LIMIT 200'
  ).all();
  return json({ ok: true, rides: rows.results || [] });
}
