import { json, fail, body, requireUser, id, requireOrigin, addCalendarMonths, addDays } from '../../_lib/core.js';
export async function onRequestGet({request,env}) {
 const a=await requireUser(request,env,'admin'); if(a.error) return a.error;
 const rows=await env.DB.prepare(`SELECT u.id,u.full_name,u.email,u.phone,u.status,u.created_at,p.vehicle_make,p.vehicle_model,p.vehicle_year,p.vehicle_plate,s.trial_started_at,s.trial_ends_at,s.period_started_at,s.period_ends_at,s.monthly_fee_piasters,r.ends_at AS restriction_ends_at,CASE WHEN s.status='trial' AND julianday(s.trial_ends_at)<=julianday('now') THEN 'expired' WHEN s.status='active' AND julianday(s.period_ends_at)<=julianday('now') THEN 'expired' ELSE s.status END AS subscription_status FROM users u LEFT JOIN captain_profiles p ON p.user_id=u.id LEFT JOIN captain_subscriptions s ON s.captain_id=u.id LEFT JOIN captain_restrictions r ON r.captain_id=u.id WHERE u.role='captain' AND u.deleted_at IS NULL ORDER BY u.created_at DESC LIMIT 2000`).all();
 return json({ok:true,captains:rows.results||[]});
}
export async function onRequestPost({request,env}) {
 const oe=requireOrigin(request); if(oe) return oe; const a=await requireUser(request,env,'admin'); if(a.error) return a.error;
 const d=await body(request); if(!d?.captain_id) return fail('حدد الكابتن');
 const captain=await env.DB.prepare("SELECT id FROM users WHERE id=? AND role='captain'").bind(d.captain_id).first(); if(!captain) return fail('الكابتن غير موجود',404);
 if(d.action==='status') {
  if(!['active','rejected','suspended'].includes(d.status)) return fail('الحالة غير صحيحة');
  if(d.status==='active'){const docs=await env.DB.prepare("SELECT COUNT(*) AS n FROM captain_documents WHERE captain_id=? AND review_status='approved'").bind(d.captain_id).first(); if((docs?.n||0)<6) return fail('لا يمكن تفعيل الكابتن قبل اعتماد المستندات الستة المطلوبة',409);}
  await env.DB.batch([env.DB.prepare('UPDATE users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(d.status,d.captain_id),env.DB.prepare("UPDATE captain_profiles SET approved_at=CASE WHEN ?='active' THEN CURRENT_TIMESTAMP ELSE approved_at END,availability='offline' WHERE user_id=?").bind(d.status,d.captain_id),env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,target_id,details_json) VALUES(?,?,?,?,?,?)').bind(id(),a.user.id,'captain.status','captain',d.captain_id,JSON.stringify({status:d.status}))]);
  return json({ok:true});
 }
 if(d.action==='renew') {
  const fee=await env.DB.prepare("SELECT setting_value FROM app_settings WHERE setting_key='captain_monthly_fee_piasters'").first(); const now=new Date().toISOString(), ends=addCalendarMonths(now,1);
  await env.DB.batch([env.DB.prepare("UPDATE captain_subscriptions SET status='active',period_started_at=?,period_ends_at=?,monthly_fee_piasters=?,updated_at=CURRENT_TIMESTAMP WHERE captain_id=?").bind(now,ends,Number(fee?.setting_value)||10000,d.captain_id),env.DB.prepare("INSERT INTO user_notifications(id,user_id,notification_type,title,message,dedupe_key) VALUES(?,?,'subscription_renewed','تم تجديد اشتراكك',?,'renew-'||?)").bind(id(),d.captain_id,`تم تجديد اشتراكك لمدة شهر حتى ${ends.slice(0,10)}. تقدر ترجع تستقبل الرحلات.`,now),env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,target_id,details_json) VALUES(?,?,?,?,?,?)').bind(id(),a.user.id,'subscription.renew','captain',d.captain_id,JSON.stringify({starts_at:now,ends_at:ends,fee_piasters:Number(fee?.setting_value)||10000}))]);
  return json({ok:true,period_ends_at:ends});
 }
 if(d.action==='cancel') {
  await env.DB.batch([env.DB.prepare("UPDATE captain_subscriptions SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE captain_id=?").bind(d.captain_id),env.DB.prepare("UPDATE captain_profiles SET availability='offline' WHERE user_id=?").bind(d.captain_id),env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,target_id) VALUES(?,?,?,?,?)').bind(id(),a.user.id,'subscription.cancel','captain',d.captain_id)]); return json({ok:true});
 }
 if(d.action==='suspend') {
  const days=Number(d.days); if(![1,7,14,30].includes(days)) return fail('مدة الإيقاف يجب أن تكون يومًا أو أسبوعًا أو أسبوعين أو شهرًا');
  const now=new Date().toISOString(), ends=addDays(now,days), reason=String(d.reason||'إيقاف مؤقت بقرار الإدارة').slice(0,240);
  await env.DB.batch([env.DB.prepare('INSERT INTO captain_restrictions(captain_id,reason,starts_at,ends_at,created_by) VALUES(?,?,?,?,?) ON CONFLICT(captain_id) DO UPDATE SET reason=excluded.reason,starts_at=excluded.starts_at,ends_at=excluded.ends_at,created_by=excluded.created_by').bind(d.captain_id,reason,now,ends,a.user.id),env.DB.prepare("UPDATE captain_profiles SET availability='offline' WHERE user_id=?").bind(d.captain_id),env.DB.prepare('INSERT INTO user_notifications(id,user_id,notification_type,title,message) VALUES(?,?,\'account_suspended\',?,?)').bind(id(),d.captain_id,'تم إيقاف حسابك مؤقتًا',`تم إيقاف حسابك لمدة ${days} يوم. السبب: ${reason}`),env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,target_id,details_json) VALUES(?,?,?,?,?,?)').bind(id(),a.user.id,'captain.suspend','captain',d.captain_id,JSON.stringify({days,reason,ends_at:ends}))]); return json({ok:true,ends_at:ends});
 }
 if(d.action==='warn') {
  const message=String(d.message||'يرجى مراجعة الإدارة بخصوص حسابك.').slice(0,500);
  await env.DB.batch([env.DB.prepare('INSERT INTO user_notifications(id,user_id,notification_type,title,message) VALUES(?,?,\'admin_warning\',?,?)').bind(id(),d.captain_id,'تنبيه من الإدارة',message),env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,target_id,details_json) VALUES(?,?,?,?,?,?)').bind(id(),a.user.id,'captain.warn','captain',d.captain_id,JSON.stringify({message}))]); return json({ok:true});
 }
 if(d.action==='delete') {
  const deletedEmail=`deleted-${d.captain_id}@deleted.invalid`, deletedPhone=`deleted-${d.captain_id.slice(0,12)}`;
  await env.DB.batch([env.DB.prepare("UPDATE users SET full_name='حساب محذوف',email=?,phone=?,password_hash='disabled-account',status='rejected',deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND role='captain'").bind(deletedEmail,deletedPhone,d.captain_id),env.DB.prepare("UPDATE captain_profiles SET availability='offline',wallet_number=NULL,wallet_owner_name=NULL,instapay_address=NULL,instapay_owner_name=NULL,vehicle_make=NULL,vehicle_model=NULL,vehicle_year=NULL,vehicle_plate=NULL,vehicle_color=NULL WHERE user_id=?").bind(d.captain_id),env.DB.prepare("UPDATE captain_subscriptions SET status='cancelled' WHERE captain_id=?").bind(d.captain_id),env.DB.prepare('DELETE FROM captain_documents WHERE captain_id=?').bind(d.captain_id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(d.captain_id),env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id=?').bind(d.captain_id),env.DB.prepare('DELETE FROM user_notifications WHERE user_id=?').bind(d.captain_id),env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,target_id,details_json) VALUES(?,?,?,?,?,?)').bind(id(),a.user.id,'captain.delete','captain',d.captain_id,'{\"mode\":\"anonymized_to_preserve_ride_ledger\"}')]); return json({ok:true});
 }
 return fail('الإجراء غير معروف');
}
