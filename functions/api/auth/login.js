import { json, fail, body, clean, verifyPassword, id, sha256, cookie, requireOrigin, rateLimit } from '../../_lib/core.js';
export async function onRequestPost({request,env}) {
 const oe=requireOrigin(request); if(oe) return oe; if(await rateLimit(request,env,'login',8,600)) return fail('محاولات كثيرة. انتظر 10 دقائق ثم حاول مرة أخرى',429); const d=await body(request); if(!d) return fail('بيانات غير صالحة');
 const role=['passenger','captain'].includes(d.role)?d.role:'passenger';
 if(d.role==='admin') return fail('استخدم شاشة دخول الإدارة المخصصة',403); const login=clean(d.login,180).toLowerCase(), password=typeof d.password==='string'?d.password:'';
 const user=await env.DB.prepare('SELECT * FROM users WHERE role=? AND (lower(email)=? OR phone=?)').bind(role,login,clean(d.login,24)).first();
 if(!user || !(await verifyPassword(password,user.password_hash))) return fail('بيانات الدخول غير صحيحة',401);
 if(user.status!=='active' && !(user.role==='captain'&&user.status==='pending')) return fail('الحساب غير متاح حالياً',403);
 const token=crypto.randomUUID()+crypto.randomUUID(), hash=await sha256(token), sid=id();
 await env.DB.prepare('INSERT INTO sessions(id, user_id, token_hash, expires_at) VALUES(?,?,?,datetime(\'now\',\'+14 days\'))').bind(sid,user.id,hash).run();
 return json({ok:true,user:{id:user.id,full_name:user.full_name,email:user.email,phone:user.phone,role:user.role,status:user.status}},200,{'set-cookie':cookie('ride_session',token,1209600)});
}
