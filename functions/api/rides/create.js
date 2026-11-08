import { sendPushToMany } from '../../_lib/webpush.js';
import { json, fail, body, id, clean, requireUser, setting, requireOrigin } from '../../_lib/core.js';
export async function onRequestPost({request,env}) {
 const oe=requireOrigin(request); if(oe) return oe; const auth=await requireUser(request,env,'passenger'); if(auth.error) return auth.error;
 const d=await body(request); if(!d) return fail('بيانات غير صالحة'); const method=d.payment_method;
 if(!['cash','vodafone_cash','orange_cash','instapay'].includes(method)) return fail('طريقة الدفع غير مدعومة');
 const routeType=d.route_type==='fixed'?'fixed':'negotiated'; let price=0, fixedId=null;
 if(routeType==='fixed') { fixedId=clean(d.fixed_route_id,64); const r=await env.DB.prepare('SELECT id,price_piasters FROM fixed_routes WHERE id=? AND active=1').bind(fixedId).first(); if(!r) return fail('الرحلة الثابتة غير متاحة',404); price=r.price_piasters; }
 else { const min=Number(await setting(env,'negotiation_min_piasters','2500')), max=Number(await setting(env,'negotiation_max_piasters','5000')); price=Number(d.initial_price_piasters); if(!Number.isInteger(price)||price<min||price>max) return fail(`السعر يجب أن يكون بين ${min/100} و${max/100} جنيه`); }
 const rid=id();
 await env.DB.prepare(`INSERT INTO rides(id,passenger_id,route_type,fixed_route_id,pickup_label,destination_label,agreed_price_piasters,payment_method,status) VALUES(?,?,?,?,?,?,?,?,?)`).bind(rid,auth.user.id,routeType,fixedId,clean(d.pickup_label,160)||null,clean(d.destination_label,160)||null,price,method,'requested').run();
 if (routeType === 'negotiated') {
  const captains = await env.DB.prepare("SELECT user_id FROM captain_profiles p JOIN users u ON u.id=p.user_id WHERE p.availability='online' AND u.role='captain' AND u.status='active'").all();
  await sendPushToMany(env,(captains.results||[]).map(x=>x.user_id),{title:'طلب مشوار جديد — مِشوارك',body:'فيه راكب طلب مشوار جديد. افتح التطبيق وشوف التفاصيل.',url:'/'});
 }
 return json({ok:true,ride_id:rid,status:'requested',price_piasters:price},201);
}
