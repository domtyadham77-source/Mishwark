import { json, fail, sessionUser, captainSubscription, requireOrigin } from '../../_lib/core.js';
export async function onRequestGet({request,env}) {
 const oe=requireOrigin(request); if(oe) return oe;
 const user=await sessionUser(request,env); if(!user) return fail('سجل الدخول أولاً',401);
 if(user.role!=='captain') return fail('الخدمة للكابتن فقط',403);
 const sub=await captainSubscription(env,user.id);
 const settings=await env.DB.prepare("SELECT setting_key,setting_value FROM app_settings WHERE setting_key IN ('captain_monthly_fee_piasters','captain_subscription_wallet_number','captain_subscription_wallet_provider','captain_subscription_instapay','captain_subscription_payment_note')").all();
 const config=Object.fromEntries((settings.results||[]).map(x=>[x.setting_key,x.setting_value]));
 if(sub.active&&sub.ends_at) { const days=Math.ceil((Date.parse(sub.ends_at)-Date.now())/86400000); if(days===2) await env.DB.prepare("INSERT OR IGNORE INTO user_notifications(id,user_id,notification_type,title,message,dedupe_key) VALUES(?,?,'subscription_reminder','متبقي يومان على انتهاء اشتراكك','فاضل يومين على انتهاء اشتراكك. قيمة التجديد وبيانات الدفع موجودة في صفحة الاشتراك.','subscription-2day-'||?)").bind(crypto.randomUUID(),user.id,user.id).run(); }
 const notices=await env.DB.prepare('SELECT id,notification_type,title,message,created_at,read_at FROM user_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 20').bind(user.id).all();
 return json({ok:true,subscription:sub,settings:config,notifications:notices.results||[]});
}
