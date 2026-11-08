import { json, fail, body, clean, id, sha256, cookie, requireOrigin, rateLimit, clearRateLimit } from '../../_lib/core.js';

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const aa = enc.encode(a), bb = enc.encode(b);
  let diff = aa.length ^ bb.length;
  const length = Math.max(aa.length, bb.length);
  for (let i = 0; i < length; i++) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  const originError = requireOrigin(request);
  if (originError) return originError;
    const configuredPassword = env.ADMIN_PANEL_PASSWORD || env.ADMIN_PIN;
  if (typeof configuredPassword !== 'string' || configuredPassword.length === 0) {
    return fail('كلمة مرور لوحة الإدارة غير مضبوطة. راجع ADMIN_PANEL_PASSWORD أو ADMIN_PIN في Cloudflare.', 503);
  }

  const data = await body(request);
  const password = typeof data?.password === 'string' ? data.password : '';
  if (!constantTimeEqual(password, configuredPassword)) {
    if (await rateLimit(request, env, 'admin-panel-login', 5, 900)) return fail('محاولات كثيرة. تم إيقاف المحاولات مؤقتًا لمدة 15 دقيقة.', 429);
    return fail('كلمة مرور الإدارة غير صحيحة.', 401);
  }
  await clearRateLimit(request, env, 'admin-panel-login');

  const admin = await env.DB.prepare("SELECT id,full_name,email,phone,role,status FROM users WHERE role='admin' AND status='active' LIMIT 1").first();
  if (!admin) return fail('حساب الإدارة الأول غير مُنشأ بعد. أكمل إعداد الأدمن أولًا.', 503);

  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const tokenHash = await sha256(token);
  const sessionId = id();
  await env.DB.prepare("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,datetime('now','+8 hours'))")
    .bind(sessionId, admin.id, tokenHash).run();

  return json({ ok: true, user: admin }, 200, {
    'set-cookie': cookie('ride_session', token, 28800),
    'cache-control': 'no-store'
  });
}
