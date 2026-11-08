import { json, fail, body, requireUser, id, passwordHash, requireOrigin } from '../../_lib/core.js';

function temporaryPassword() {
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
 const bytes=crypto.getRandomValues(new Uint8Array(24));
 return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
}

export async function onRequestGet({request,env}) {
 const a=await requireUser(request,env,'admin'); if(a.error) return a.error;
 const url=new URL(request.url), q=(url.searchParams.get('q')||'').trim().slice(0,100);
 const like='%'+q+'%';
 const rows=await env.DB.prepare(`SELECT id,full_name,email,phone,role,status,created_at FROM users WHERE deleted_at IS NULL AND role IN ('passenger','captain') AND (?='' OR full_name LIKE ? OR email LIKE ? ESCAPE '\\\\' OR phone LIKE ? ESCAPE '\\\\') ORDER BY created_at DESC LIMIT 100`).bind(q,like,like,like).all();
 return json({ok:true,users:rows.results||[]});
}

export async function onRequestPost({request,env}) {
 const oe=requireOrigin(request); if(oe) return oe;
 const a=await requireUser(request,env,'admin'); if(a.error) return a.error;
 const d=await body(request), userId=String(d?.user_id||'');
 if(!userId) return fail('حدد المستخدم');
 const user=await env.DB.prepare("SELECT id,role,status FROM users WHERE id=? AND role IN ('passenger','captain') AND deleted_at IS NULL").bind(userId).first();
 if(!user) return fail('المستخدم غير موجود',404);
 const next=temporaryPassword(), hash=await passwordHash(next);
 await env.DB.batch([
  env.DB.prepare('UPDATE users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(hash,userId),
  env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId),
  env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,target_id,details_json) VALUES(?,?,?,?,?,?)').bind(id(),a.user.id,'user.password_reset','user',userId,JSON.stringify({method:'admin_generated_temporary_password',sessions_revoked:true}))
 ]);
 return json({ok:true,temporary_password:next,message:'تم تغيير كلمة المرور وإلغاء كل جلسات المستخدم. سلّم كلمة المرور المؤقتة له بشكل خاص.'});
}
