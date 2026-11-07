export async function onRequestGet({ env }) {
  const checks = { api: 'ok', database: 'not_configured', schema: 'not_checked', private_storage: 'not_configured' };
  if (!env.DB) return Response.json({ status: 'degraded', checks, notes: 'D1 binding DB is not configured for this deployment.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  try {
    await env.DB.prepare('SELECT 1').first();
    checks.database = 'ok';
    const requiredTables = ['users','sessions','rate_limits','rides','ride_offers','captain_profiles','captain_documents','app_settings','fixed_routes','ride_ledger','audit_log','subscription_offers','captain_subscriptions','captain_restrictions','user_notifications','push_subscriptions'];
    const found = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN (${requiredTables.map(() => '?').join(',')})`).bind(...requiredTables).all();
    const names = new Set((found.results || []).map(row => row.name));
    const missingTables = requiredTables.filter(name => !names.has(name));
    const requiredColumns = {
      users: ['deleted_at'],
      captain_profiles: ['vehicle_type','profile_photo_data','profile_photo_mime','profile_photo_status'],
      captain_documents: ['file_data','mime_type','file_size']
    };
    const missingColumns = [];
    for (const [table, columns] of Object.entries(requiredColumns)) {
      if (!names.has(table)) continue;
      for (const column of columns) {
        try { await env.DB.prepare(`SELECT ${column} FROM ${table} LIMIT 0`).all(); }
        catch { missingColumns.push(`${table}.${column}`); }
      }
    }
    const schemaReady = missingTables.length === 0 && missingColumns.length === 0;
    checks.schema = schemaReady ? 'ok' : { status: 'incomplete', missing_tables: missingTables, missing_columns: missingColumns };
    checks.private_storage = schemaReady ? 'd1-private' : 'unavailable';
    return Response.json({
      status: schemaReady ? 'ready' : 'degraded',
      checks,
      notes: schemaReady ? 'API, D1 and required application tables/columns are available.' : 'Apply the current db/schema.sql and any required migrations to this deployment database before testing.'
    }, { status: schemaReady ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[health] D1 readiness check failed', { message: error?.message || 'unknown error' });
    checks.database = 'error'; checks.schema = 'unavailable'; checks.private_storage = 'unavailable';
    return Response.json({ status: 'degraded', checks, notes: 'D1 readiness check failed.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
