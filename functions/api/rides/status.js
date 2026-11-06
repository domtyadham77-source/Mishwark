import { json, fail, body, requireUser, cairoDate, requireOrigin, requireCaptainSubscription } from '../../_lib/core.js';
export async function onRequestPost({request,env}) {
 const oe=requireOrigin(request); if(oe) return oe; const a=await requireUser(request,env); if(a.error) return a.error;
 const d=await body(request); const ride=await env.DB.prepare('SELECT * FROM rides WHERE id=?').bind(d?.ride_id).first(); if(!ride) return fail('الرحلة غير موجودة',404);
 if(a.user.role==='passenger'&&ride.passenger_id!==a.user.id) return fail('غير مصرح',403);
 if(a.user.role==='captain'&&ride.captain_id!==a.user.id) return fail('غير مصرح',403);
 let result, next;
 if(d.action==='start'&&a.user.role==='captain'&&ride.status==='accepted') { const gate=await requireCaptainSubscription(env,a.user.id); if(gate.error)return gate.error; result=await env.DB.prepare("UPDATE rides SET status='in_progress',started_at=CURRENT_TIMESTAMP WHERE id=? AND status='accepted'").bind(ride.id).run(); next='in_progress'; }
 else if(d.action==='complete'&&a.user.role==='captain'&&ride.status==='in_progress') {
  const date=cairoDate();
  const results=await env.DB.batch([
   env.DB.prepare("UPDATE rides SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=? AND status='in_progress'").bind(ride.id),
   env.DB.prepare(`INSERT OR IGNORE INTO ride_ledger(id,ride_id,captain_id,amount_piasters,payment_method,local_service_date) SELECT ?,id,captain_id,agreed_price_piasters,payment_method,? FROM rides WHERE id=? AND status='completed'`).bind(crypto.randomUUID(),date,ride.id)
  ]);
  result=results[0]; next='completed';
 } else if(d.action==='cancel'&&['passenger','captain'].includes(a.user.role)&&['requested','negotiating','accepted'].includes(ride.status)) { result=await env.DB.prepare("UPDATE rides SET status='cancelled',cancelled_at=CURRENT_TIMESTAMP,cancellation_reason=? WHERE id=? AND status IN ('requested','negotiating','accepted')").bind(String(d.reason||'').slice(0,240),ride.id).run(); next='cancelled'; }
 else return fail('الانتقال المطلوب غير مسموح',409);
 if(!result?.meta?.changes) return fail('تغيرت حالة الرحلة. حدّث البيانات',409);
 return json({ok:true,status:next});
}
