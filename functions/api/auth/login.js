import { json, fail, body, clean, verifyPassword, id, sha256, cookie, requireOrigin, rateLimit, clearRateLimit } from '../../_lib/core.js';
export async function onRequestPost({request,env}) {
 const oe=requireOrigin(request); if(oe) return oe; const d=await body(request); if(!d) return fail('بيانات غير صالحة');
 const role=['passenger','captain'].includes(d.role)?d.role:'passenger';
 if(d.role==='admin') return fail('استخدم شاشة دخول الإدارة المخصصة',403); const login=clean(d.login,180).toLowerCase(), password=typeof d.password==='string'?d.password:'';
 const user=await env.DB.prepare('SELECT u.*,p.vehicle_type FROM users u LEFT JOIN captain_profiles p ON p.user_id=u.id WHERE u.role=? AND (lower(u.email)=? OR u.phone=?)').bind(role,login,clean(d.login,24)).first();
 if(!user || !(await verifyPassword(password,user.password_hash))) { if(await rateLimit(request,env,'login',5,900)) return fail('محاولات كثيرة. تم إيقاف المحاولات مؤقتًا لمدة 15 دقيقة.',429); return fail('بيانات الدخول غير صحيحة',401); }
 await clearRateLimit(request,env,'login');
 if(user.status!=='active' && !(user.role==='captain'&&user.status==='pending')) return fail('الحساب غير متاح حالياً',403);
 const token=crypto.randomUUID()+crypto.randomUUID(), hash=await sha256(token), sid=id();
 await env.DB.prepare('INSERT INTO sessions(id, user_id, token_hash, expires_at) VALUES(?,?,?,datetime(\'now\',\'+14 days\'))').bind(sid,user.id,hash).run();
 return json({ok:true,user:{id:user.id,full_name:user.full_name,email:user.email,phone:user.phone,role:user.role,status:user.status,vehicle_type:user.vehicle_type}},200,{'set-cookie':cookie('ride_session',token,1209600)});
}
