import { json, fail, body, requireUser, id, requireOrigin } from '../../_lib/core.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env, 'admin');
  if (auth.error) return auth.error;
  const rows = await env.DB.prepare(
    'SELECT id, route_name, price_piasters, active, sort_order, updated_at FROM fixed_routes ORDER BY sort_order, route_name'
  ).all();
  return json({ ok: true, routes: rows.results || [] });
}

export async function onRequestPost({ request, env }) {
  const originError = requireOrigin(request);
  if (originError) return originError;
  const auth = await requireUser(request, env, 'admin');
  if (auth.error) return auth.error;
  const data = await body(request);
  if (!data || typeof data !== 'object') return fail('بيانات الطلب غير صحيحة');

  const action = data.action || 'create';
  if (action === 'seed_defaults') {
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM fixed_routes').first();
    if ((count?.n || 0) > 0) return fail('يوجد بالفعل مشاوير محفوظة. أضف الناقص يدويًا حتى لا تتكرر البيانات.', 409);
    const defaults = [
      ['مشوار المطار — شامل الكارتة',35000],['مشوار مدرسة غريباني',6000],['مشوار نرمين إسماعيل',7000],
      ['مشوار أكوا بارك أو أكاديمية المستقبل ومدرسة الكنانة',7000],['مشوار مدرسة رجال',7000],
      ['كارفور الشروق',9000],['كارفور العبور',10000],['جامعة مصر الدولية',9000],['محطة عدلي منصور',13000]
    ];
    const statements = defaults.map(([name, price], index) => env.DB.prepare('INSERT INTO fixed_routes(id,route_name,price_piasters,active,sort_order) VALUES(?,?,?,?,?)').bind(id(), name, price, 1, index));
    statements.push(env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,details_json) VALUES(?,?,?,?,?)').bind(id(), auth.user.id, 'routes.seed', 'fixed_routes', JSON.stringify({ count: defaults.length })));
    await env.DB.batch(statements);
    return json({ ok: true, created: defaults.length }, 201);
  }
  if (action === 'create' || action === 'update') {
    const routeName = typeof data.route_name === 'string' ? data.route_name.trim().slice(0, 120) : '';
    const price = Number(data.price_piasters);
    const sortOrder = Number.isInteger(Number(data.sort_order)) ? Number(data.sort_order) : 0;
    if (routeName.length < 3) return fail('اسم المسار يجب ألا يقل عن 3 أحرف');
    if (!Number.isSafeInteger(price) || price < 0 || price > 100000000) return fail('سعر المسار غير صحيح');
    if (action === 'create') {
      const routeId = id();
      await env.DB.batch([
        env.DB.prepare('INSERT INTO fixed_routes(id,route_name,price_piasters,active,sort_order) VALUES(?,?,?,?,?)')
          .bind(routeId, routeName, price, data.active === false ? 0 : 1, sortOrder),
        env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,target_id,details_json) VALUES(?,?,?,?,?,?)')
          .bind(id(), auth.user.id, 'route.create', 'fixed_route', routeId, JSON.stringify({ route_name: routeName, price_piasters: price }))
      ]);
      return json({ ok: true, route_id: routeId }, 201);
    }
    if (typeof data.route_id !== 'string' || !data.route_id) return fail('معرّف المسار مطلوب');
    const result = await env.DB.prepare('UPDATE fixed_routes SET route_name=?,price_piasters=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .bind(routeName, price, sortOrder, data.route_id).run();
    if (!result.meta.changes) return fail('المسار غير موجود', 404);
    await env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,target_id,details_json) VALUES(?,?,?,?,?,?)')
      .bind(id(), auth.user.id, 'route.update', 'fixed_route', data.route_id, JSON.stringify({ route_name: routeName, price_piasters: price })).run();
    return json({ ok: true });
  }

  if (action === 'toggle') {
    if (typeof data.route_id !== 'string' || !data.route_id || ![0, 1].includes(Number(data.active))) return fail('بيانات تفعيل المسار غير صحيحة');
    const result = await env.DB.prepare('UPDATE fixed_routes SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .bind(Number(data.active), data.route_id).run();
    if (!result.meta.changes) return fail('المسار غير موجود', 404);
    await env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,target_id,details_json) VALUES(?,?,?,?,?,?)')
      .bind(id(), auth.user.id, 'route.toggle', 'fixed_route', data.route_id, JSON.stringify({ active: Number(data.active) })).run();
    return json({ ok: true });
  }

  if (action === 'delete') {
    if (typeof data.route_id !== 'string' || !data.route_id) return fail('معرّف المسار مطلوب');
    const used = await env.DB.prepare('SELECT COUNT(*) AS n FROM rides WHERE fixed_route_id=?').bind(data.route_id).first();
    if ((used?.n || 0) > 0) return fail('لا يمكن حذف مسار مرتبط برحلات سابقة. يمكنك إيقافه بدلاً من ذلك.', 409);
    const result = await env.DB.prepare('DELETE FROM fixed_routes WHERE id=?').bind(data.route_id).run();
    if (!result.meta.changes) return fail('المسار غير موجود', 404);
    await env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,target_id) VALUES(?,?,?,?,?)')
      .bind(id(), auth.user.id, 'route.delete', 'fixed_route', data.route_id).run();
    return json({ ok: true });
  }

  return fail('العملية المطلوبة غير مدعومة');
}
