const $ = (id) => document.getElementById(id);
const boot = $('boot'), app = $('app'), offline = $('offline');
let deferredInstallPrompt = null, selectedRole = 'passenger', authMode = 'register';
function showOnlineState() { const online=navigator.onLine; offline.hidden=online; app.hidden=!online; boot.hidden=true; }
window.addEventListener('online',showOnlineState); window.addEventListener('offline',showOnlineState);
$('retryBtn').addEventListener('click',async()=>{try{const r=await fetch('/api/health',{cache:'no-store'});if(r.ok)showOnlineState();}catch{offline.hidden=false;}});
function setMode(mode){authMode=mode;$('showRegister').classList.toggle('active',mode==='register');$('showLogin').classList.toggle('active',mode==='login');$('authTitle').textContent=mode==='register'?'إنشاء حساب جديد':'تسجيل الدخول';$('authSubmit').textContent=mode==='register'?'إنشاء الحساب':'دخول';$('authForm').elements.full_name.closest('label').hidden=mode==='login';$('authForm').elements.email.closest('label').hidden=mode==='login';$('authForm').elements.phone.closest('label').hidden=false;$('authForm').elements.full_name.required=mode==='register';$('authForm').elements.email.required=mode==='register';$('authForm').elements.phone.required=true;$('captainFields').hidden=mode==='login'||selectedRole!=='captain';['vehicle_type','vehicle_make','vehicle_model','vehicle_color','vehicle_plate','vehicle_year'].forEach(n=>{$('authForm').elements[n].required=mode==='register'&&selectedRole==='captain';});$('captainUpload').hidden=true;$('authForm').elements.password.autocomplete=mode==='login'?'current-password':'new-password';$('authMessage').textContent='';}
document.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>{selectedRole=button.dataset.go;$('auth').hidden=false;$('authRole').textContent=selectedRole==='captain'?'حساب كابتن':'حساب راكب';$('authHint').textContent=selectedRole==='captain'?'بيانات الكابتن تخضع لمراجعة الإدارة قبل التفعيل.':'سجل بياناتك علشان تبدأ تستخدم التطبيق.';setMode('register');$('auth').scrollIntoView({behavior:'smooth',block:'start'});}));
$('backBtn').addEventListener('click',()=>$('auth').hidden=true); $('showRegister').addEventListener('click',()=>setMode('register')); $('showLogin').addEventListener('click',()=>setMode('login'));
$('authForm').addEventListener('submit',async e=>{e.preventDefault();const submittedMode=authMode, f=new FormData(e.currentTarget), payload={role:selectedRole,password:f.get('password')}; if(submittedMode==='register'){payload.full_name=f.get('full_name');payload.email=f.get('email');payload.phone=f.get('phone');if(selectedRole==='captain')payload.profile={vehicle_type:f.get('vehicle_type'),vehicle_make:f.get('vehicle_make'),vehicle_model:f.get('vehicle_model'),vehicle_color:f.get('vehicle_color'),vehicle_plate:f.get('vehicle_plate'),vehicle_year:f.get('vehicle_year')};}else payload.login=f.get('phone')||f.get('email');$('authSubmit').disabled=true;$('authMessage').textContent='جاري الإرسال...';try{const r=await fetch(`/api/auth/${submittedMode}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const data=await r.json();const responseMessage=data.message||data.error||(r.ok?'تم بنجاح':'تعذر تنفيذ الطلب');if(r.ok&&submittedMode==='register'){setMode('login');$('authMessage').textContent=responseMessage;}else if(r.ok&&submittedMode==='login'){if(data.user.role==='captain'&&$('authForm').elements.vehicle_type)$('authForm').elements.vehicle_type.value=data.user.vehicle_type||'car';updateCaptainDocumentLabels();$('authMessage').textContent=`أهلاً ${data.user.full_name} — تم تسجيل الدخول.`;$('captainUpload').hidden=!(data.user.role==='captain'&&data.user.status==='pending');if(data.user.role==='captain'){if(data.user.status==='active')$('authMessage').textContent+=' حسابك مفعل.';showCaptainMaps(data.user);loadCaptainSubscription();if(data.user.status==='active')window.initRideFlow?.('captain');}else if(data.user.role==='passenger'){$('passengerRide').hidden=false;window.initRideMap?.();window.initRideFlow?.('passenger');$('passengerRide').scrollIntoView({behavior:'smooth',block:'start'});}}else $('authMessage').textContent=responseMessage;}catch{$('authMessage').textContent='تعذر الاتصال بالسيرفر. لم يتم تأكيد العملية.';}finally{$('authSubmit').disabled=false;}});
$('year').textContent=new Date().getFullYear();
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;$('installBtn').hidden=false;if($('captainInstall'))$('captainInstall').hidden=false;});
$('installBtn').addEventListener('click',async()=>{if(!deferredInstallPrompt)return;await deferredInstallPrompt.prompt();deferredInstallPrompt=null;$('installBtn').hidden=true;});
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('/sw.js').catch(()=>{}); showOnlineState();

function updateCaptainDocumentLabels(){
 const type=$('authForm').elements.vehicle_type?.value||'car', name=type==='motorcycle'?'الموتوسيكل':'العربية';
 const vehicleLicense=[...$('documentType').options].find(o=>o.value==='vehicle_license');if(vehicleLicense)vehicleLicense.textContent='رخصة '+name;
 const vehiclePhoto=[...$('documentType').options].find(o=>o.value==='vehicle_photo');if(vehiclePhoto)vehiclePhoto.textContent='صورة '+name;
 const hint=$('captainUpload').querySelector('p');if(hint)hint.textContent='ارفع صورة شخصية، ورخصة القيادة الشخصية من الوجهين، ورخصة '+name+' من الوجهين، وصورة واضحة لـ'+name+'.';
}
$('authForm').elements.vehicle_type?.addEventListener('change',updateCaptainDocumentLabels);
updateCaptainDocumentLabels();$('documentType').dispatchEvent(new Event('change'));
$('documentType').addEventListener('change',()=>{const back=$('documentSide').querySelector('option[value="back"]');const profile=$('documentType').value==='profile_photo'||$('documentType').value==='vehicle_photo';back.hidden=profile;if(profile)$('documentSide').value='front';});
$('documentForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);$('documentMessage').textContent='جاري ضغط الصورة وإرسالها...';try{const original=f.get('file');const compressed=await compressDocumentImage(original);f.set('file',compressed,compressed.name);const r=await fetch('/api/captain/documents',{method:'POST',body:f});const d=await r.json();$('documentMessage').textContent=d.message||d.error||'تعذر رفع الملف';if(r.ok){e.currentTarget.reset();$('documentType').dispatchEvent(new Event('change'));}}catch(err){$('documentMessage').textContent=err.message||'تعذر ضغط الصورة أو رفعها. حاول مرة أخرى.';}});

async function loadCaptainSubscription(){
 const panel=$('captainSubscription'); if(!panel)return;
 try{
  const r=await fetch('/api/captain/subscription',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'تعذر تحميل الاشتراك');
  panel.hidden=false;$('captainInstall').hidden=false;const s=d.subscription||{},cfg=d.settings||{};
  const labels={trial:'فترة مجانية',active:'اشتراك مدفوع ساري',expired:'الاشتراك منتهي',cancelled:'الاشتراك ملغي'};
  $('subscriptionStatus').textContent=s.restricted?'حالة الحساب: موقوف مؤقتًا':`حالة اشتراكك: ${labels[s.status]||s.status||'غير معروف'}`;
  $('subscriptionEnds').textContent=s.restricted&&s.restriction_ends_at?`ينتهي الإيقاف المؤقت: ${new Date(s.restriction_ends_at).toLocaleDateString('ar-EG')}`:s.ends_at?`تاريخ انتهاء الفترة: ${new Date(s.ends_at).toLocaleDateString('ar-EG')}`:'لا توجد فترة سارية حاليًا';
  $('subscriptionPrice').textContent=`سعر التجديد الشهري: ${(Number(cfg.captain_monthly_fee_piasters||10000)/100).toLocaleString('ar-EG')} جنيه`;
  $('subscriptionPayment').textContent=`${cfg.captain_subscription_payment_note||''} رقم المحفظة: ${cfg.captain_subscription_wallet_number||'غير محدد بعد'}. نوع المحفظة: ${cfg.captain_subscription_wallet_provider||'—'}. InstaPay: ${cfg.captain_subscription_instapay||'غير محدد بعد'}.`;
  $('captainNotifications').innerHTML=(d.notifications||[]).map(n=>`<article class="notice"><b>${String(n.title||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</b><p>${String(n.message||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</p></article>`).join('')||'<p class="muted">لا توجد إشعارات حاليًا.</p>';
 }catch(e){panel.hidden=false;$('subscriptionStatus').textContent=e.message;}
}

$('captainInstall')?.addEventListener('click',async()=>{if(deferredInstallPrompt){await deferredInstallPrompt.prompt();deferredInstallPrompt=null;$('captainInstall').hidden=true;}else{$('authMessage').textContent='من قائمة المتصفح اختار «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق».';}});

async function compressDocumentImage(file){
 if(!(file instanceof File)||!file.type.startsWith('image/')) throw Error('اختار صورة من فضلك');
 const bitmap=await createImageBitmap(file), scale=Math.min(1,2200/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
 canvas.getContext('2d',{alpha:false}).drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 let quality=.94, blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
 while(blob&&blob.size>1750000&&quality>.72){quality-=.05;blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));}
 if(!blob||blob.size>1800000) throw Error('الصورة كبيرة حتى بعد الضغط. صوّرها بدقة أقل وحاول تاني');
 return new File([blob],(file.name.replace(/\.[^.]+$/,'')||'document')+'.jpg',{type:'image/jpeg',lastModified:Date.now()});
}

function showCaptainMaps(user){
 const panel=$('captainMaps');if(!panel||!user||user.role!=='captain')return;
 panel.hidden=false;
 const key='mishwark_city_maps_intro_'+String(user.id||user.phone||'captain');
 let seen=false;try{seen=localStorage.getItem(key)==='1';}catch{}
 $('mapsWelcome').hidden=seen;
 if(!seen){try{localStorage.setItem(key,'1');}catch{}}
}

document.addEventListener('click',e=>{const b=e.target.closest('[data-download-map]');if(b)window.downloadRideSectorMap?.(b.dataset.downloadMap);});
