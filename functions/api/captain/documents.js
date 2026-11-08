import { json, fail, sessionUser, id, requireOrigin } from '../../_lib/core.js';
const TYPES=['driving_license','vehicle_license','vehicle_photo'];
const MAX=1800000;
export async function onRequestPost({request,env}) {
 const oe=requireOrigin(request); if(oe) return oe;
 const user=await sessionUser(request,env); if(!user) return fail('سجل الدخول أولاً',401);
 if(user.role!=='captain'||!['pending','active'].includes(user.status)) return fail('غير مصرح',403);
 const form=await request.formData(), type=form.get('document_type'), side=form.get('side'), file=form.get('file');
 if(!file||typeof file.arrayBuffer!=='function'||file.size<1||file.size>MAX) return fail('الصورة بعد الضغط يجب ألا تتجاوز 1.8 ميجابايت');
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)) return fail('ارفع صورة JPG أو PNG أو WebP فقط');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255, png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71, webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!(jpeg||png||webp)) return fail('محتوى الملف لا يطابق نوع الصورة');
 if(type==='profile_photo') {
  if(side!=='front') return fail('الصورة الشخصية لا تحتاج وجهًا خلفيًا');
  await env.DB.batch([env.DB.prepare("UPDATE captain_profiles SET profile_photo_data=?,profile_photo_mime=?,profile_photo_status='pending',availability='offline',approved_at=NULL WHERE user_id=?").bind(bytes,file.type,user.id),env.DB.prepare("UPDATE users SET status='pending',updated_at=CURRENT_TIMESTAMP WHERE id=? AND role='captain'").bind(user.id)]);
 } else {
  if(!TYPES.includes(type)||!['front','back'].includes(side)||(type==='vehicle_photo'&&side!=='front')) return fail('نوع المستند أو الوجه غير صحيح');
  const profile=await env.DB.prepare('SELECT vehicle_type FROM captain_profiles WHERE user_id=?').bind(user.id).first();
  if(!profile||!['motorcycle','car'].includes(profile.vehicle_type)) return fail('نوع المركبة غير محدد للحساب',409);
  await env.DB.batch([env.DB.prepare("INSERT INTO captain_documents(id,captain_id,document_type,side,object_key,file_data,mime_type,file_size,review_status) VALUES(?,?,?,?, '',?,?,?,'pending') ON CONFLICT(captain_id,document_type,side) DO UPDATE SET object_key='',file_data=excluded.file_data,mime_type=excluded.mime_type,file_size=excluded.file_size,review_status='pending',uploaded_at=CURRENT_TIMESTAMP").bind(id(),user.id,type,side,bytes,file.type,bytes.byteLength),env.DB.prepare("UPDATE users SET status='pending',updated_at=CURRENT_TIMESTAMP WHERE id=? AND role='captain'").bind(user.id),env.DB.prepare("UPDATE captain_profiles SET availability='offline',approved_at=NULL WHERE user_id=?").bind(user.id)]);
 }
 return json({ok:true,message:'تم إرسال الصورة إلى لوحة الإدارة للمراجعة'},201);
}
