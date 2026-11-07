import { json, fail, sessionUser, clean, requireOrigin } from '../../_lib/core.js';

export async function onRequestPost({request,env}) {
  const originError=requireOrigin(request); if(originError) return originError;
  const user=await sessionUser(request,env);
  if(!user) return fail('سجل الدخول أولاً',401);
  if(user.role!=='captain'||!['active','pending'].includes(user.status)) return fail('غير مصرح',403);
  let data; try { data=await request.json(); } catch { return fail('بيانات الطلب غير صحيحة'); }
  const type=data?.vehicle_type;
  if(!['motorcycle','car'].includes(type)) return fail('اختار نوع مركبة صحيح');
  const make=clean(data.vehicle_make,60), model=clean(data.vehicle_model,60), color=clean(data.vehicle_color,40), plate=clean(data.vehicle_plate,30), year=Number(data.vehicle_year);
  if(!make||!model||!color||!plate||!Number.isInteger(year)||year<1980||year>2035) return fail('أكمل بيانات المركبة قبل تغيير النوع');
  const current=await env.DB.prepare('SELECT vehicle_type FROM captain_profiles WHERE user_id=?').bind(user.id).first();
  if(!current) return fail('ملف الكابتن غير موجود',404);
  if(current.vehicle_type===type) return json({ok:true,message:'نوع المركبة هو نفسه بالفعل'});
  const activeRide=await env.DB.prepare("SELECT id FROM rides WHERE captain_id=? AND status IN ('accepted','in_progress') LIMIT 1").bind(user.id).first();
  if(activeRide) return fail('لا يمكن تغيير نوع المركبة أثناء وجود رحلة نشطة. أنهِ الرحلة أولاً.',409);
  await env.DB.batch([
    env.DB.prepare("UPDATE captain_profiles SET vehicle_type=?,vehicle_make=?,vehicle_model=?,vehicle_color=?,vehicle_plate=?,vehicle_year=?,availability='offline',approved_at=NULL WHERE user_id=?").bind(type,make,model,color,plate,year,user.id),
    env.DB.prepare("DELETE FROM captain_documents WHERE captain_id=? AND document_type IN ('vehicle_license','vehicle_photo')").bind(user.id),
    env.DB.prepare("UPDATE users SET status='pending',updated_at=CURRENT_TIMESTAMP WHERE id=? AND role='captain'").bind(user.id)
  ]);
  return json({ok:true,message:'تم تغيير نوع المركبة وحفظ بياناتها. الحساب الآن في انتظار مراجعة الإدارة؛ ارفع رخصة وصورة المركبة الجديدة من ملفك الشخصي.'});
}
