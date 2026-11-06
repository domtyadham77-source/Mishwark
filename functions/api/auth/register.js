import { json, fail, body, id, clean, validEmail, validPhone, passwordHash, cookie, sha256, requireOrigin, rateLimit, addCalendarMonths } from '../../_lib/core.js';
export async function onRequestPost({request,env}) {
 const originError=requireOrigin(request); if(originError) return originError; if(await rateLimit(request,env,'register',5,3600)) return fail('محاولات تسجيل كثيرة. حاول لاحقاً',429);
 const data=await body(request); if(!data) return fail('بيانات غير صالحة');
 const role=data.role; if(!['passenger','captain'].includes(role)) return fail('نوع الحساب غير صحيح');
 const full_name=clean(data.full_name,100), email=clean(data.email,180).toLowerCase(), phone=clean(data.phone,24), password=typeof data.password==='string'?data.password:'';
 if(full_name.split(/\s+/).length<3) return fail('اكتب الاسم الثلاثي');
 if(!validEmail(email)||!validPhone(phone)) return fail('راجع البريد الإلكتروني ورقم الهاتف');
 if(password.length<10 || password.length>128) return fail('كلمة المرور يجب ألا تقل عن 10 أحرف');
 const exists=await env.DB.prepare('SELECT id FROM users WHERE (email=? OR phone=?) AND role=?').bind(email,phone,role).first(); if(exists) return fail('يوجد حساب بهذا الهاتف أو البريد لنفس نوع الحساب',409);
 const p=data.profile||{}; if(role==='captain'&&(!clean(p.vehicle_make,60)||!clean(p.vehicle_model,60)||!clean(p.vehicle_color,40)||!clean(p.vehicle_plate,30)||(!Number.isInteger(Number(p.vehicle_year))||Number(p.vehicle_year)<1980||Number(p.vehicle_year)>2035))) return fail('بيانات المركبة الأساسية مطلوبة');
 const uid=id(), hash=await passwordHash(password);
 try {
  await env.DB.prepare('INSERT INTO users(id,full_name,email,phone,password_hash,role,status) VALUES(?,?,?,?,?,?,?)').bind(uid,full_name,email,phone,hash,role,role==='captain'?'pending':'active').run();
  if(role==='captain') {
   const wallet=['vodafone_cash','orange_cash'].includes(p.wallet_provider)?p.wallet_provider:null;
   await env.DB.prepare(`INSERT INTO captain_profiles(user_id,wallet_provider,wallet_number,wallet_owner_name,instapay_address,instapay_owner_name,vehicle_make,vehicle_model,vehicle_year,vehicle_plate,vehicle_color) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(uid,wallet,clean(p.wallet_number,30)||null,clean(p.wallet_owner_name,100)||null,clean(p.instapay_address,100)||null,clean(p.instapay_owner_name,100)||null,clean(p.vehicle_make,60)||null,clean(p.vehicle_model,60)||null,Number(p.vehicle_year)||null,clean(p.vehicle_plate,30)||null,clean(p.vehicle_color,40)||null).run();
   const enabled=await env.DB.prepare("SELECT setting_value FROM app_settings WHERE setting_key='captain_trial_enabled'").first();
   const offer=await env.DB.prepare("SELECT id,trial_months FROM subscription_offers WHERE active=1 AND (starts_at IS NULL OR julianday(starts_at)<=julianday('now')) AND (ends_at IS NULL OR julianday(ends_at)>julianday('now')) ORDER BY created_at DESC,rowid DESC LIMIT 1").first();
   const trialOn=(enabled?.setting_value??'1')==='1' && !!offer;
   const months=trialOn?Math.max(0,Math.min(24,Number(offer.trial_months))):0;
   const now=new Date().toISOString(), ends=months?addCalendarMonths(now,months):now;
   const fee=await env.DB.prepare("SELECT setting_value FROM app_settings WHERE setting_key='captain_monthly_fee_piasters'").first();
   await env.DB.prepare(`INSERT INTO captain_subscriptions(captain_id,status,offer_id,trial_started_at,trial_ends_at,monthly_fee_piasters) VALUES(?,?,?,?,?,?)`).bind(uid,months?'trial':'expired',trialOn?offer.id:null,now,ends,Number(fee?.setting_value)||10000).run();
   if(months) await env.DB.prepare("INSERT INTO user_notifications(id,user_id,notification_type,title,message,dedupe_key) VALUES(?,?,'trial_started','مبروك! عندك فترة مجانية',?,'trial-start-'||?)").bind(id(),uid,`مبروك! عندك ${months} شهور مجانًا تقدر تشتغل بيهم بصافي 100% من قيمة مشاويرك، من غير اشتراك خلال الفترة المجانية. الفترة بدأت من تاريخ تسجيلك وتنتهي ${ends.slice(0,10)}.`,uid).run();
  }
  let message='تم إنشاء الحساب، يمكنك تسجيل الدخول.';
  if(role==='captain') { const sub=await env.DB.prepare('SELECT s.status,s.trial_ends_at,o.trial_months FROM captain_subscriptions s LEFT JOIN subscription_offers o ON o.id=s.offer_id WHERE s.captain_id=?').bind(uid).first(); message=sub?.status==='trial'?`مبروك! عندك ${sub.trial_months||3} شهور مجانية من تاريخ تسجيلك، حتى ${String(sub.trial_ends_at).slice(0,10)}. ثبّت التطبيق لمتابعة مدة العرض وبيانات التجديد. تنبيهات الهاتف الفورية ستعمل بعد استكمال خدمة الإشعارات. حسابك سيبدأ استقبال الرحلات بعد اعتماد الإدارة.`:'تم إنشاء حسابك. العرض المجاني غير متاح حاليًا؛ يمكنك متابعة الاشتراك بعد تسجيل الدخول. حسابك في انتظار مراجعة الإدارة.'; }
  return json({ok:true,message},201);
 } catch(e) { await env.DB.prepare('DELETE FROM users WHERE id=?').bind(uid).run().catch(()=>{}); return fail('تعذر إنشاء الحساب. راجع البيانات وحاول مرة أخرى.',500); }
}
