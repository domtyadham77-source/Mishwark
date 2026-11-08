import { json, fail, body, requireUser, id, requireOrigin } from '../../_lib/core.js';
export async function onRequestGet({request,env}) {
 const a=await requireUser(request,env,'admin'); if(a.error) return a.error;
 const docs=await env.DB.prepare("SELECT d.id,d.captain_id,d.document_type,d.side,d.review_status,d.uploaded_at,u.full_name,p.vehicle_type,CASE WHEN d.file_data IS NULL THEN 0 ELSE 1 END AS has_file FROM captain_documents d JOIN users u ON u.id=d.captain_id LEFT JOIN captain_profiles p ON p.user_id=u.id WHERE d.file_data IS NOT NULL ORDER BY d.uploaded_at DESC LIMIT 300").all();
 const photos=await env.DB.prepare("SELECT 'profile:'||p.user_id AS id,p.user_id AS captain_id,'profile_photo' AS document_type,'front' AS side,p.profile_photo_status AS review_status,u.created_at AS uploaded_at,u.full_name,p.vehicle_type,CASE WHEN p.profile_photo_data IS NULL THEN 0 ELSE 1 END AS has_file FROM captain_profiles p JOIN users u ON u.id=p.user_id WHERE p.profile_photo_data IS NOT NULL ORDER BY u.created_at DESC LIMIT 200").all();
 return json({ok:true,documents:[...(photos.results||[]),...(docs.results||[])]});
}
export async function onRequestPost({request,env}) {
 const oe=requireOrigin(request); if(oe) return oe;
 const a=await requireUser(request,env,'admin'); if(a.error) return a.error;
 const d=await body(request); if(!d?.document_id||!['approved','rejected'].includes(d.status)) return fail('الطلب غير صحيح');
 if(d.document_id.startsWith('profile:')) {
  const cid=d.document_id.slice(8), row=await env.DB.prepare('SELECT user_id FROM captain_profiles WHERE user_id=? AND profile_photo_data IS NOT NULL').bind(cid).first();
  if(!row) return fail('الصورة الشخصية غير موجودة',404);
  await env.DB.batch([env.DB.prepare('UPDATE captain_profiles SET profile_photo_status=? WHERE user_id=?').bind(d.status,cid),env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,target_id,details_json) VALUES(?,?,?,?,?,?)').bind(id(),a.user.id,'document.review','profile_photo',cid,JSON.stringify({status:d.status}))]);
  return json({ok:true});
 }
 const doc=await env.DB.prepare('SELECT id,captain_id FROM captain_documents WHERE id=?').bind(d.document_id).first(); if(!doc) return fail('المستند غير موجود',404);
 await env.DB.batch([env.DB.prepare('UPDATE captain_documents SET review_status=? WHERE id=?').bind(d.status,doc.id),env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,target_id,details_json) VALUES(?,?,?,?,?,?)').bind(id(),a.user.id,'document.review','document',doc.id,JSON.stringify({status:d.status,captain_id:doc.captain_id}))]);
 return json({ok:true});
}
