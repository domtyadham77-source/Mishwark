import { json, fail, body, requireUser, requireOrigin, id } from '../../_lib/core.js';
const KEYS=['captain_monthly_fee_piasters','captain_trial_enabled','captain_trial_months','captain_subscription_wallet_number','captain_subscription_wallet_provider','captain_subscription_instapay','captain_subscription_payment_note'];
export async function onRequestGet({request,env}) {
 const a=await requireUser(request,env,'admin'); if(a.error) return a.error;
 const rows=await env.DB.prepare(`SELECT setting_key,setting_value FROM app_settings WHERE setting_key IN (${KEYS.map(()=>'?').join(',')})`).bind(...KEYS).all();
 const offers=await env.DB.prepare('SELECT * FROM subscription_offers ORDER BY created_at DESC').all();
 return json({ok:true,settings:Object.fromEntries((rows.results||[]).map(x=>[x.setting_key,x.setting_value])),offers:offers.results||[]});
}
export async function onRequestPost({request,env}) {
 const oe=requireOrigin(request); if(oe) return oe; const a=await requireUser(request,env,'admin'); if(a.error) return a.error;
 const d=await body(request); if(!d) return fail('بيانات غير صالحة');
 if(d.action==='settings') {
  const values=d.settings||{}; const stmts=[];
  if(values.monthly_fee_egp!==undefined){const v=Number(values.monthly_fee_egp);if(!Number.isFinite(v)||v<0||v>100000)return fail('قيمة الاشتراك غير صحيحة');stmts.push(['captain_monthly_fee_piasters',String(Math.round(v*100))]);}
  if(values.trial_enabled!==undefined)stmts.push(['captain_trial_enabled',values.trial_enabled?'1':'0']);
  if(values.trial_months!==undefined){const v=Number(values.trial_months);if(!Number.isInteger(v)||v<0||v>24)return fail('مدة العرض يجب أن تكون من صفر إلى 24 شهرًا');stmts.push(['captain_trial_months',String(v)]);stmts.push(['__default_offer_months',String(v)]);}
  for(const [input,key,max] of [['wallet_number','captain_subscription_wallet_number',40],['wallet_provider','captain_subscription_wallet_provider',40],['instapay','captain_subscription_instapay',120],['payment_note','captain_subscription_payment_note',500]]) if(values[input]!==undefined) stmts.push([key,String(values[input]).trim().slice(0,max)]);
  await env.DB.batch([...stmts.filter(([k])=>k!=='__default_offer_months').map(([k,v])=>env.DB.prepare('INSERT INTO app_settings(setting_key,setting_value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP').bind(k,v)),...(stmts.some(([k])=>k==='__default_offer_months')?[env.DB.prepare("UPDATE subscription_offers SET trial_months=? WHERE id='launch-three-months'").bind(Number(values.trial_months))]:[]),env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,details_json) VALUES(?,?,?,?,?)').bind(id(),a.user.id,'subscription.settings','settings',JSON.stringify(values))]); return json({ok:true});
 }
 if(d.action==='create_offer') {
  const title=String(d.title||'').trim().slice(0,120), months=Number(d.trial_months); if(!title||!Number.isInteger(months)||months<0||months>24)return fail('راجع اسم العرض ومدته');
  const offerId=id(); await env.DB.prepare('INSERT INTO subscription_offers(id,title,trial_months,active,starts_at,ends_at) VALUES(?,?,?,?,?,?)').bind(offerId,title,months,d.active===false?0:1,d.starts_at||null,d.ends_at||null).run();
  await env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,target_id,details_json) VALUES(?,?,?,?,?,?)').bind(id(),a.user.id,'subscription.offer.create','offer',offerId,JSON.stringify({title,months})).run(); return json({ok:true,offer_id:offerId},201);
 }
 if(d.action==='toggle_offer') {
  if(!d.offer_id||![0,1].includes(Number(d.active)))return fail('بيانات العرض غير صحيحة');
  await env.DB.prepare('UPDATE subscription_offers SET active=? WHERE id=?').bind(Number(d.active),d.offer_id).run(); await env.DB.prepare('INSERT INTO audit_log(id,admin_id,action,target_type,target_id,details_json) VALUES(?,?,?,?,?,?)').bind(id(),a.user.id,'subscription.offer.toggle','offer',d.offer_id,JSON.stringify({active:Number(d.active)})).run(); return json({ok:true});
 }
 return fail('الإجراء غير معروف');
}
