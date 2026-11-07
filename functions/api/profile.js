import { json, fail, sessionUser, clean, validEmail, validPhone, requireOrigin } from '../_lib/core.js';

const MAX = 1800000;
function toBase64(value) {
  if (!value) return null;
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let out = '';
  for (let i=0;i<bytes.length;i+=0x8000) out += String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(out);
}
function validImage(bytes, type) {
  if (type === 'image/jpeg') return bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  if (type === 'image/png') return bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71;
  if (type === 'image/webp') return String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  return false;
}
export async function onRequestGet({request,env}) {
  const user = await sessionUser(request,env);
  if (!user) return fail('سجل الدخول أولاً',401);
  if (user.role === 'captain') {
    const profile = await env.DB.prepare('SELECT vehicle_type,vehicle_make,vehicle_model,vehicle_year,vehicle_plate,vehicle_color,profile_photo_data,profile_photo_mime,profile_photo_status,availability FROM captain_profiles WHERE user_id=?').bind(user.id).first();
    const docs = await env.DB.prepare('SELECT document_type,side,review_status,uploaded_at FROM captain_documents WHERE captain_id=? ORDER BY document_type,side').bind(user.id).all();
    return json({ok:true,user,profile:profile?{...profile,profile_photo_data:toBase64(profile.profile_photo_data)}:null,documents:docs.results||[]});
  }
  const photo = await env.DB.prepare('SELECT profile_photo_data,profile_photo_mime FROM users WHERE id=?').bind(user.id).first();
  return json({ok:true,user,profile:{profile_photo_data:toBase64(photo?.profile_photo_data),profile_photo_mime:photo?.profile_photo_mime||null},documents:[]});
}
export async function onRequestPost({request,env}) {
  const originError = requireOrigin(request); if (originError) return originError;
  const user = await sessionUser(request,env);
  if (!user) return fail('سجل الدخول أولاً',401);
  if (!['passenger','captain'].includes(user.role) || !['active','pending'].includes(user.status)) return fail('لا يمكن تعديل هذا الحساب حالياً',403);
  const form = await request.formData();
  const fullName = clean(form.get('full_name'),100);
  const email = clean(form.get('email'),180).toLowerCase();
  const phone = clean(form.get('phone'),24);
  if (fullName.split(/\s+/).length < 2) return fail('اكتب الاسم بشكل صحيح');
  if (!validEmail(email) || !validPhone(phone)) return fail('راجع البريد الإلكتروني ورقم الهاتف');
  const duplicate = await env.DB.prepare('SELECT id FROM users WHERE id<>? AND role=? AND (email=? OR phone=?)').bind(user.id,user.role,email,phone).first();
  if (duplicate) return fail('البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل لحساب آخر',409);
  const file = form.get('photo');
  let bytes = null, mime = null;
  if (file && typeof file.arrayBuffer === 'function' && file.size > 0) {
    if (file.size > MAX || !['image/jpeg','image/png','image/webp'].includes(file.type)) return fail('ارفع صورة JPG أو PNG أو WebP لا تتجاوز 1.8 ميجابايت');
    bytes = new Uint8Array(await file.arrayBuffer()); mime = file.type;
    if (!validImage(bytes,mime)) return fail('محتوى الملف لا يطابق نوع الصورة');
  }
  let captainProfile = null, vehicleChanged = false;
  if (user.role === 'captain') {
    const make=clean(form.get('vehicle_make'),60), model=clean(form.get('vehicle_model'),60), color=clean(form.get('vehicle_color'),40), plate=clean(form.get('vehicle_plate'),30), year=Number(form.get('vehicle_year'));
    if (!make || !model || !color || !plate || !Number.isInteger(year) || year<1980 || year>2035) return fail('راجع بيانات المركبة وسنة الصنع');
    captainProfile = {make,model,color,plate,year};
    const old=await env.DB.prepare('SELECT vehicle_make,vehicle_model,vehicle_color,vehicle_plate,vehicle_year FROM captain_profiles WHERE user_id=?').bind(user.id).first();
    vehicleChanged = !!old && (old.vehicle_make!==make || old.vehicle_model!==model || old.vehicle_color!==color || old.vehicle_plate!==plate || Number(old.vehicle_year)!==year);
  }
  try {
    await env.DB.prepare('UPDATE users SET full_name=?,email=?,phone=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(fullName,email,phone,user.id).run();
    if (user.role === 'passenger' && bytes) {
      await env.DB.prepare('UPDATE users SET profile_photo_data=?,profile_photo_mime=? WHERE id=?').bind(bytes,mime,user.id).run();
    }
    if (user.role === 'captain') {
      await env.DB.prepare('UPDATE captain_profiles SET vehicle_make=?,vehicle_model=?,vehicle_color=?,vehicle_plate=?,vehicle_year=?,profile_photo_data=COALESCE(?,profile_photo_data),profile_photo_mime=COALESCE(?,profile_photo_mime),profile_photo_status=CASE WHEN ? IS NULL THEN profile_photo_status ELSE \'pending\' END,availability=CASE WHEN ?=1 THEN \'offline\' ELSE availability END,approved_at=CASE WHEN ?=1 THEN NULL ELSE approved_at END WHERE user_id=?')
        .bind(captainProfile.make,captainProfile.model,captainProfile.color,captainProfile.plate,captainProfile.year,bytes,mime,bytes,vehicleChanged?1:0,vehicleChanged?1:0,user.id).run();
      if (bytes || vehicleChanged) await env.DB.prepare("UPDATE users SET status='pending',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(user.id).run();
    }
    return json({ok:true,message:user.role==='captain'&&(bytes||vehicleChanged)?'تم حفظ البيانات. الحساب متوقف عن استقبال الرحلات مؤقتًا لحين مراجعة التعديلات من الإدارة.':'تم حفظ بيانات الملف الشخصي بنجاح.'});
  } catch (error) {
    if (/UNIQUE constraint failed/i.test(String(error?.message||''))) return fail('البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل',409);
    console.error('[profile] update failed',{message:error?.message||'unknown'});
    return fail('تعذر حفظ التعديلات حالياً',500);
  }
}
