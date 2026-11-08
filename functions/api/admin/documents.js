import { fail, requireUser } from '../../_lib/core.js';
export async function onRequestGet({request,env}) {
 const a=await requireUser(request,env,'admin'); if(a.error) return a.error;
 const docId=new URL(request.url).searchParams.get('id'); if(!docId) return fail('المستند غير محدد');
 let row;
 if(docId.startsWith('profile:')) row=await env.DB.prepare('SELECT profile_photo_data AS file_data,profile_photo_mime AS mime_type FROM captain_profiles WHERE user_id=? AND profile_photo_data IS NOT NULL').bind(docId.slice(8)).first();
 else row=await env.DB.prepare('SELECT file_data,mime_type FROM captain_documents WHERE id=?').bind(docId).first();
 if(!row?.file_data) return fail('ملف الصورة غير موجود',404);
 return new Response(row.file_data,{headers:{'content-type':row.mime_type||'image/jpeg','cache-control':'private, no-store','content-disposition':'inline','x-content-type-options':'nosniff'}});
}
