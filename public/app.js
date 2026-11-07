const $ = (id) => document.getElementById(id);
const boot = $('boot'), app = $('app'), offline = $('offline');
let deferredInstallPrompt = null, selectedRole = 'passenger', authMode = 'register';
function showOnlineState() { const online=navigator.onLine; offline.hidden=online; app.hidden=!online; boot.hidden=true; }
window.addEventListener('online',showOnlineState); window.addEventListener('offline',showOnlineState);
$('retryBtn').addEventListener('click',async()=>{try{const r=await fetch('/api/health',{cache:'no-store'});if(r.ok)showOnlineState();}catch{offline.hidden=false;}});
function setMode(mode){authMode=mode;$('showRegister').classList.toggle('active',mode==='register');$('showLogin').classList.toggle('active',mode==='login');$('authTitle').textContent=mode==='register'?'إنشاء حساب جديد':'تسجيل الدخول';$('authSubmit').textContent=mode==='register'?'إنشاء الحساب':'دخول';$('authForm').elements.full_name.closest('label').hidden=mode==='login';$('authForm').elements.email.closest('label').hidden=mode==='login';$('authForm').elements.phone.closest('label').hidden=false;$('authForm').elements.full_name.required=mode==='register';$('authForm').elements.email.required=mode==='register';$('authForm').elements.phone.required=true;$('authForm').elements.phone.type=mode==='login'?'text':'tel';$('authForm').elements.phone.autocomplete=mode==='login'?'username':'tel';$('authForm').elements.phone.placeholder=mode==='login'?'اكتب رقم الهاتف أو البريد الإلكتروني':'اكتب رقم هاتفك';const phoneLabel=$('authForm').elements.phone.closest('label');if(phoneLabel?.firstChild)phoneLabel.firstChild.textContent=mode==='login'?'رقم الهاتف أو البريد الإلكتروني':'رقم الهاتف';$('captainFields').hidden=mode==='login'||selectedRole!=='captain';['vehicle_type','vehicle_make','vehicle_model','vehicle_color','vehicle_plate','vehicle_year'].forEach(n=>{$('authForm').elements[n].required=mode==='register'&&selectedRole==='captain';});$('captainUpload').hidden=true;$('authForm').elements.password.autocomplete=mode==='login'?'current-password':'new-password';$('authMessage').textContent='';}
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
  panel.hidden=(window.__mishwarkScreen!=='captainSubscription');$('captainInstall').hidden=false;const s=d.subscription||{},cfg=d.settings||{};
  const labels={trial:'فترة مجانية',active:'اشتراك مدفوع ساري',expired:'الاشتراك منتهي',cancelled:'الاشتراك ملغي'};
  $('subscriptionStatus').textContent=s.restricted?'حالة الحساب: موقوف مؤقتًا':`حالة اشتراكك: ${labels[s.status]||s.status||'غير معروف'}`;
  $('subscriptionEnds').textContent=s.restricted&&s.restriction_ends_at?`ينتهي الإيقاف المؤقت: ${new Date(s.restriction_ends_at).toLocaleDateString('ar-EG')}`:s.ends_at?`تاريخ انتهاء الفترة: ${new Date(s.ends_at).toLocaleDateString('ar-EG')}`:'لا توجد فترة سارية حاليًا';
  $('subscriptionPrice').textContent=`سعر التجديد الشهري: ${(Number(cfg.captain_monthly_fee_piasters||10000)/100).toLocaleString('ar-EG')} جنيه`;
  $('subscriptionPayment').textContent=`${cfg.captain_subscription_payment_note||''} رقم المحفظة: ${cfg.captain_subscription_wallet_number||'غير محدد بعد'}. نوع المحفظة: ${cfg.captain_subscription_wallet_provider||'—'}. InstaPay: ${cfg.captain_subscription_instapay||'غير محدد بعد'}.`;
  $('captainNotifications').innerHTML=(d.notifications||[]).map(n=>`<article class="notice"><b>${String(n.title||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</b><p>${String(n.message||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</p></article>`).join('')||'<p class="muted">لا توجد إشعارات حاليًا.</p>';
 }catch(e){panel.hidden=(window.__mishwarkScreen!=='captainSubscription');$('subscriptionStatus').textContent=e.message;}
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
 panel.hidden=(window.__mishwarkScreen==='captainMaps');
 const key='mishwark_city_maps_intro_'+String(user.id||user.phone||'captain');
 let seen=false;try{seen=localStorage.getItem(key)==='1';}catch{}
 $('mapsWelcome').hidden=seen;
 if(!seen){try{localStorage.setItem(key,'1');}catch{}}
}

document.addEventListener('click',e=>{const b=e.target.closest('[data-download-map]');if(b)window.downloadRideSectorMap?.(b.dataset.downloadMap);});


/* App-like screen flow: authentication is the entry screen; role dashboards are separate screens. */
let mishwarkUser=null;
window.__mishwarkScreen='landing';
const screenIds=['auth','passengerRide','captainMaps','captainRideBoard','passengerOffers','captainSubscription','profileScreen'];
const escText=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function roleScreens(){
 return mishwarkUser?.role==='captain'
  ?[{id:'captainRideBoard',icon:'⌂',label:'الرئيسية'},{id:'captainMaps',icon:'▦',label:'الخرائط'},{id:'captainSubscription',icon:'◷',label:'الاشتراك'}]
  :[{id:'passengerRide',icon:'⌖',label:'اطلب مشوار'},{id:'passengerOffers',icon:'▤',label:'رحلاتي'}];
}
function setAppScreen(id){
 if(!screenIds.includes(id))return;
 window.__mishwarkScreen=id;
 document.body.classList.toggle('is-authenticated',!!mishwarkUser);
 $('hero')?.classList.toggle('screen-hidden',!!mishwarkUser);
 const landing=(id==='landing');
 document.querySelector('.hero')?.toggleAttribute('hidden',!landing);
 document.querySelector('.features')?.toggleAttribute('hidden',!landing);
 screenIds.forEach(x=>{const el=$(x);if(el)el.hidden=x!==id;});
 $('menuBtn').hidden=!mishwarkUser;
 $('bottomNav').hidden=!mishwarkUser;
 if(mishwarkUser){
  $('bottomNav').innerHTML=roleScreens().map(x=>'<button type="button" class="nav-item '+(x.id===id?'active':'')+'" data-screen="'+x.id+'"><span class="nav-ico">'+x.icon+'</span><span>'+x.label+'</span></button>').join('');
  const drawerLinks=roleScreens().map(x=>'<button type="button" class="drawer-item" data-screen="'+x.id+'">'+x.icon+' '+x.label+'</button>').join('');
  $('drawerLinks').innerHTML=drawerLinks;
  $('drawerName').textContent=mishwarkUser.full_name||'حسابي';
  $('drawerRole').textContent=mishwarkUser.role==='captain'?'حساب كابتن':'حساب راكب';
 }else{
  $('bottomNav').innerHTML='';$('drawerLinks').innerHTML='';
 }
 $('appDrawer').classList.remove('open');$('appDrawer').setAttribute('aria-hidden','true');$('menuBtn').setAttribute('aria-expanded','false');
 if(id==='profileScreen')loadProfile();
 if(id==='captainMaps'&&mishwarkUser?.role==='captain')showCaptainMaps(mishwarkUser);
 if(id==='captainSubscription'&&mishwarkUser?.role==='captain')loadCaptainSubscription();
}
function showLanding(){
 mishwarkUser=null;window.__mishwarkScreen='landing';document.body.classList.remove('is-authenticated');
 screenIds.forEach(x=>{const el=$(x);if(el)el.hidden=true;});
 document.querySelector('.hero')?.removeAttribute('hidden');document.querySelector('.features')?.removeAttribute('hidden');
 $('menuBtn').hidden=true;$('bottomNav').hidden=true;$('appDrawer').classList.remove('open');
}
function openAuthenticatedApp(user){
 mishwarkUser=user;selectedRole=user.role;
 document.body.classList.add('is-authenticated');
 $('authForm').reset();
 if(user.role==='captain'){
  $('authForm').elements.vehicle_type.value=user.vehicle_type||'car';
  updateCaptainDocumentLabels();showCaptainMaps(user);
  setAppScreen('captainRideBoard');
  if(user.status==='active'){window.initRideFlow?.('captain');loadCaptainSubscription();}
 }else{
  setAppScreen('passengerRide');window.initRideMap?.();window.initRideFlow?.('passenger');
 }
}
async function restoreMishwarkSession(){
 try{
  const r=await fetch('/api/auth/me',{cache:'no-store'});
  if(!r.ok){showLanding();return;}
  const d=await r.json();if(d?.ok&&d.user)openAuthenticatedApp(d.user);else showLanding();
 }catch{showLanding();}
}
function setAuthRole(role){
 selectedRole=role;
 $('authRole').textContent=role==='captain'?'حساب كابتن':'حساب راكب';
 $('authHint').textContent=role==='captain'?'بيانات الكابتن تخضع لمراجعة الإدارة قبل التفعيل.':'سجل بياناتك علشان تبدأ تستخدم التطبيق.';
 $('auth').hidden=false;setMode('register');setAppScreen('auth');
}
document.addEventListener('click',e=>{
 const roleBtn=e.target.closest('[data-go]');
 if(roleBtn){e.preventDefault();e.stopImmediatePropagation();setAuthRole(roleBtn.dataset.go);return;}
 if(e.target.closest('#backBtn')){e.preventDefault();e.stopImmediatePropagation();showLanding();return;}
 if(e.target.closest('#menuBtn')){const open=!$('appDrawer').classList.contains('open');$('appDrawer').classList.toggle('open',open);$('appDrawer').setAttribute('aria-hidden',String(!open));$('menuBtn').setAttribute('aria-expanded',String(open));return;}
 if(e.target.closest('[data-close-drawer]')){$('appDrawer').classList.remove('open');$('appDrawer').setAttribute('aria-hidden','true');$('menuBtn').setAttribute('aria-expanded','false');return;}
 const screenBtn=e.target.closest('[data-screen]');
 if(screenBtn){e.preventDefault();setAppScreen(screenBtn.dataset.screen);return;}
 if(e.target.closest('[data-back-home]')){setAppScreen(mishwarkUser?.role==='captain'?'captainRideBoard':'passengerRide');return;}
 if(e.target.closest('#logoutBtn')){e.preventDefault();fetch('/api/auth/logout',{method:'POST'}).catch(()=>{}).finally(showLanding);}
},true);

/* Intercept auth submit before the legacy one-page handler. */
document.addEventListener('submit',async e=>{
 if(e.target?.id!=='authForm')return;
 e.preventDefault();e.stopImmediatePropagation();
 const form=e.target, mode=authMode, fd=new FormData(form);
 const payload={role:selectedRole,password:fd.get('password')};
 if(mode==='register'){
  payload.full_name=fd.get('full_name');payload.email=fd.get('email');payload.phone=fd.get('phone');
  if(selectedRole==='captain')payload.profile={vehicle_type:fd.get('vehicle_type'),vehicle_make:fd.get('vehicle_make'),vehicle_model:fd.get('vehicle_model'),vehicle_color:fd.get('vehicle_color'),vehicle_plate:fd.get('vehicle_plate'),vehicle_year:fd.get('vehicle_year')};
 }else payload.login=fd.get('phone');
 $('authSubmit').disabled=true;$('authMessage').textContent='جاري الإرسال...';
 try{
  const r=await fetch('/api/auth/'+mode,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json();if(!r.ok)throw Error(d.error||'تعذر تنفيذ الطلب');
  if(mode==='register'){setMode('login');$('authMessage').textContent=d.message||'تم إنشاء الحساب. سجّل دخولك للمتابعة.';}
  else{
   const me=await fetch('/api/auth/me',{cache:'no-store'});const session=await me.json();
   if(!me.ok||!session.user)throw Error('تم تسجيل الدخول لكن تعذر تحميل بيانات الحساب. حاول تحديث الصفحة.');
   $('authMessage').textContent='';openAuthenticatedApp(session.user);
  }
 }catch(err){$('authMessage').textContent=err.message||'تعذر الاتصال بالسيرفر. لم يتم تأكيد العملية.';}
 finally{$('authSubmit').disabled=false;}
},true);

/* Move captain document upload into the dedicated profile screen. */
const captainUploadPanel=$('captainUpload');
if(captainUploadPanel){captainUploadPanel.hidden=false;$('profileDocuments').appendChild(captainUploadPanel);$('profileDocuments').hidden=true;}
async function loadProfile(){
 $('profileMessage').textContent='جاري تحميل بياناتك...';
 try{
  const r=await fetch('/api/profile',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'تعذر تحميل الملف الشخصي');
  mishwarkUser=d.user;const u=d.user||{},p=d.profile||{};
  $('profileName').value=u.full_name||'';$('profileEmail').value=u.email||'';$('profilePhone').value=u.phone||'';
  const image=p.profile_photo_data?( 'data:'+(p.profile_photo_mime||'image/jpeg')+';base64,'+p.profile_photo_data):'';
  $('profilePhotoPreview').innerHTML=image?'<img alt="الصورة الشخصية" src="'+image+'">':escText((u.full_name||'م').trim().slice(0,1));
  $('drawerAvatar').innerHTML=image?'<img alt="" src="'+image+'">':escText((u.full_name||'م').trim().slice(0,1));
  $('drawerName').textContent=u.full_name||'حسابي';
  const captain=u.role==='captain';$('captainProfileFields').hidden=!captain;$('profileDocuments').hidden=!captain;
  if(captain&&p){
   $('profileVehicleMake').value=p.vehicle_make||'';$('profileVehicleModel').value=p.vehicle_model||'';$('profileVehicleColor').value=p.vehicle_color||'';$('profileVehiclePlate').value=p.vehicle_plate||'';$('profileVehicleYear').value=p.vehicle_year||'';$('profileVehicleType').value=p.vehicle_type||'car';
   $('authForm').elements.vehicle_type.value=p.vehicle_type||'car';updateCaptainDocumentLabels();
   const labels={driving_license:'رخصة القيادة',vehicle_license:'رخصة المركبة',vehicle_photo:'صورة المركبة',national_id:'بطاقة الهوية'};
   $('documentStatusList').innerHTML=(d.documents||[]).map(x=>'<div class="document-status"><span>'+ (labels[x.document_type]||x.document_type)+' · '+(x.side==='front'?'الأمام':'الخلف')+'</span><small>'+(x.review_status==='approved'?'معتمد':x.review_status==='rejected'?'مرفوض':'قيد المراجعة')+'</small></div>').join('')||'<p class="muted">لم يتم رفع مستندات بعد.</p>';
  }
  $('profileStatus').textContent=captain?(u.status==='active'?'حسابك نشط.':'حسابك يحتاج مراجعة الإدارة بعد أي تعديل على المستندات أو المركبة.'):'تقدر تعدّل بياناتك وصورتك الشخصية من هنا.';
  $('profileMessage').textContent='';
 }catch(err){$('profileMessage').textContent=err.message||'تعذر تحميل الملف الشخصي';}
}
$('profilePhoto').addEventListener('change',()=>{
 const file=$('profilePhoto').files?.[0];if(!file)return;
 if(!file.type.startsWith('image/')){ $('profileMessage').textContent='اختار صورة صحيحة';return; }
 const reader=new FileReader();reader.onload=()=>{$('profilePhotoPreview').innerHTML='<img alt="معاينة الصورة" src="'+reader.result+'">';};reader.readAsDataURL(file);
});
$('profileForm').addEventListener('submit',async e=>{
 e.preventDefault();const fd=new FormData(e.currentTarget);const captain=mishwarkUser?.role==='captain';
 const oldType=$('profileVehicleType').value;
 $('profileSave').disabled=true;$('profileMessage').textContent='جاري حفظ التعديلات...';
 try{
  const r=await fetch('/api/profile',{method:'POST',body:fd});const d=await r.json();if(!r.ok)throw Error(d.error||'تعذر حفظ البيانات');
  if(captain){
   const current=(await (await fetch('/api/profile',{cache:'no-store'})).json()).profile;
   if(current&&current.vehicle_type!==oldType){
    const v=await fetch('/api/captain/vehicle',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vehicle_type:oldType,vehicle_make:fd.get('vehicle_make'),vehicle_model:fd.get('vehicle_model'),vehicle_color:fd.get('vehicle_color'),vehicle_plate:fd.get('vehicle_plate'),vehicle_year:fd.get('vehicle_year')})});
    const vd=await v.json();if(!v.ok)throw Error(vd.error||'تعذر تغيير نوع المركبة');$('profileMessage').textContent=vd.message;
   }else $('profileMessage').textContent=d.message;
  }else $('profileMessage').textContent=d.message;
  const me=await fetch('/api/auth/me',{cache:'no-store'});const md=await me.json();if(md.user)mishwarkUser=md.user;
  await loadProfile();
  if(captain&&oldType!==(current?.vehicle_type||oldType))$('profileMessage').textContent='تم تغيير نوع المركبة. ارفع رخصة وصورة المركبة الجديدة، ثم انتظر مراجعة الإدارة.';
 }catch(err){$('profileMessage').textContent=err.message||'تعذر حفظ التعديلات';}
 finally{$('profileSave').disabled=false;}
});
/* Restore a previously authenticated session so reopening the PWA lands on the correct dashboard. */
restoreMishwarkSession();
