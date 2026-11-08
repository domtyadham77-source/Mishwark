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
  if (action === 'split_defaults') {
    const definitions = [
      ['مشوار أكوا بارك',7000,0],
      ['مشوار أكاديمية المستقبل',7000,1],
      ['مشوار مدرسة الكنانة',7000,2]
    ];
    const all = await env.DB.prepare('SELECT id,route_name FROM fixed_routes').all();
    const rows = all.results || [];
    const compound = rows.find(x => /أكوا بارك/.test(x.route_name) && /أكاديمية المستقبل|الكنانة/.test(x.route_name));
    const statements = [];
    if (compound) statements.push(env.DB.prepare('UPDATE fixed_routes SET route_name=?,price_piasters=7000,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind('مشوار أكوا بارك',0,compound.id));
    let created = 0;
    for (const [name,price,order] of definitions) {
      const exists = rows.some(x => x.id !== compound?.id && x.route_name.trim() === name);
      if (!exists && !(name === 'مشوار أكوا بارك' && compound)) {
        statements.push(env.DB.prepare('INSERT INTO fixed_routes(id,route_name,price_piasters,active,sort_order) VALUES(?,?,?,?,?)').bind(id(),name,price,1,order));
        created++;
      }
    }
    if (statements.length) {
      statements.push(env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,details_json) VALUES(?,?,?,?,?)').bind(id(),auth.user.id,'routes.split_defaults','fixed_routes',JSON.stringify({created,updated:!!compound})));
      await env.DB.batch(statements);
    }
    return json({ok:true,created,updated:!!compound,message:'تم فصل أكوا بارك وأكاديمية المستقبل ومدرسة الكنانة إلى مشاوير مستقلة.'});
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
