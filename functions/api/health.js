export async function onRequestGet({ env }) {
  const checks = { api: 'ok', database: 'not_configured', schema: 'not_checked', private_storage: 'not_configured' };
  if (!env.DB) return Response.json({ status: 'degraded', checks, notes: 'D1 binding DB is not configured for this deployment.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  try {
    await env.DB.prepare('SELECT 1').first();
    checks.database = 'ok';
    const required = ['users','sessions','rate_limits','rides','ride_offers','captain_profiles','captain_documents','app_settings','fixed_routes','ride_ledger','audit_log','subscription_offers','captain_subscriptions','captain_restrictions','user_notifications','push_subscriptions'];
    const found = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN (${required.map(() => '?').join(',')})`).bind(...required).all();
    const names = new Set((found.results || []).map(row => row.name));
    const missing = required.filter(name => !names.has(name));
    checks.schema = missing.length ? { status: 'incomplete', missing } : 'ok';
    checks.private_storage = names.has('captain_documents') && names.has('captain_profiles') ? 'd1-private' : 'unavailable';
    const ready = missing.length === 0;
    return Response.json({ status: ready ? 'ready' : 'degraded', checks, notes: ready ? 'API, D1 and required application tables are available.' : 'Apply the current db/schema.sql to this deployment database before testing.' }, { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[health] D1 readiness check failed', { message: error?.message || 'unknown error' });
    checks.database = 'error'; checks.schema = 'unavailable'; checks.private_storage = 'unavailable';
    return Response.json({ status: 'degraded', checks, notes: 'D1 readiness check failed.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
