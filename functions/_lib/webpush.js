const enc=new TextEncoder();
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const fromB64u=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const join=(...parts)=>{const n=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;};
async function hkdf(ikm,salt,info,length){const k=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},k,length*8));}
async function vapidToken(endpoint,env){
 const origin=new URL(endpoint).origin,now=Math.floor(Date.now()/1000),head=b64u(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'}))),body=b64u(enc.encode(JSON.stringify({aud:origin,exp:now+43200,sub:env.PUSH_SUBJECT||'mailto:support@mishwark.app'}))),data=head+'.'+body;
 const key=await crypto.subtle.importKey('pkcs8',fromB64u(env.PUSH_VAPID_PRIVATE_KEY),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 return data+'.'+b64u(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(data)));
}
async function encryptPayload(subscription,payload){
 const userPub=fromB64u(subscription.p256dh),auth=fromB64u(subscription.auth),pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']),serverPub=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey)),receiver=await crypto.subtle.importKey('raw',userPub,{name:'ECDH',namedCurve:'P-256'},false,[]),shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:receiver},pair.privateKey,256)),keyInfo=join(enc.encode('WebPush: info\0'),userPub,serverPub),ikm=await hkdf(shared,auth,keyInfo,32),salt=crypto.getRandomValues(new Uint8Array(16)),cek=await hkdf(ikm,salt,enc.encode('Content-Encoding: aes128gcm\0'),16),nonce=await hkdf(ikm,salt,enc.encode('Content-Encoding: nonce\0'),12),aes=await crypto.subtle.importKey('raw',cek,{name:'AES-GCM'},false,['encrypt']),plain=join(enc.encode(JSON.stringify(payload)),new Uint8Array([2])),cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},aes,plain)),header=join(salt,new Uint8Array([0,0,16,0]),new Uint8Array([serverPub.length]),serverPub);
 return join(header,cipher);
}
export async function sendPushToUser(env,userId,payload){
 if(!env.PUSH_VAPID_PRIVATE_KEY||!env.VAPID_PUBLIC_KEY)return;
 const rows=await env.DB.prepare('SELECT id,endpoint,p256dh,auth_secret FROM push_subscriptions WHERE user_id=?').bind(userId).all();
 await Promise.all((rows.results||[]).map(async s=>{try{const body=await encryptPayload({p256dh:s.p256dh,auth:s.auth_secret},payload),token=await vapidToken(s.endpoint,env),response=await fetch(s.endpoint,{method:'POST',headers:{Authorization:'vapid t='+token+', k='+env.VAPID_PUBLIC_KEY,'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream','TTL':'86400','Urgency':'high'},body});if(response.status===404||response.status===410)await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(s.id).run();}catch(error){console.error('[push] delivery failed',String(error?.message||error));}}));
}
export async function sendPushToMany(env,userIds,payload){await Promise.all([...new Set(userIds)].map(id=>sendPushToUser(env,id,payload)));}
