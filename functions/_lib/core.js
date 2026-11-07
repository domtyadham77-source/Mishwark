const enc = new TextEncoder();
export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
export const fail = (message, status = 400) => json({ ok: false, error: message }, status);
export async function body(request) { try { return await request.json(); } catch { return null; } }
export function id() { return crypto.randomUUID(); }
export function clean(v, max = 180) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
export function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
export function validPhone(v) { return /^\+?[0-9]{8,15}$/.test(v.replace(/[\s()-]/g, '')); }
export async function sha256(value) { const b = await crypto.subtle.digest('SHA-256', enc.encode(value)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join(''); }
export async function passwordHash(password, salt = crypto.getRandomValues(new Uint8Array(16))) { const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']); const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt, iterations:210000, hash:'SHA-256' }, key, 256); const b64 = btoa(String.fromCharCode(...new Uint8Array(bits))); const s64 = btoa(String.fromCharCode(...salt)); return `pbkdf2$210000$${s64}$${b64}`; }
export async function verifyPassword(password, stored) { try { const [kind, rounds, salt64, expected] = stored.split('$'); if (kind !== 'pbkdf2' || Number(rounds) !== 210000) return false; const salt = Uint8Array.from(atob(salt64), c => c.charCodeAt(0)); const actual = await passwordHash(password, salt); return constantTime(actual.split('$')[3], expected); } catch { return false; } }
function constantTime(a,b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let n=0; for(let i=0;i<a.length;i++) n |= a.charCodeAt(i)^b.charCodeAt(i); return n===0; }
export function cookie(name, value, maxAge) { return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
export function getCookie(request, name) { const raw=request.headers.get('Cookie')||''; const item=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'=')); return item ? item.slice(name.length+1) : null; }
export async function sessionUser(request, env) { const token=getCookie(request,'ride_session'); if(!token) return null; const hash=await sha256(token); const row=await env.DB.prepare(`SELECT u.id,u.full_name,u.email,u.phone,u.role,u.status,p.vehicle_type FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN captain_profiles p ON p.user_id=u.id WHERE s.token_hash=? AND s.expires_at > datetime('now')`).bind(hash).first(); return row || null; }
export async function requireUser(request, env, role) { const user=await sessionUser(request,env); if(!user) return { error:fail('سجل الدخول أولاً',401) }; if(role && user.role!==role) return { error:fail('غير مصرح لك بتنفيذ العملية',403) }; if(user.status!=='active') return { error:fail('الحساب غير مفعل حالياً',403) }; return { user }; }
export function cairoDate() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export async function setting(env,key,fallback) { const r=await env.DB.prepare('SELECT setting_value FROM app_settings WHERE setting_key=?').bind(key).first(); return r?.setting_value ?? fallback; }
export function isSameOrigin(request) { const origin=request.headers.get('Origin'); if(!origin) return true; try { return new URL(origin).host===new URL(request.url).host; } catch { return false; } }
export function requireOrigin(request) { return isSameOrigin(request) ? null : fail('طلب غير موثوق',403); }

export async function rateLimit(request, env, action, limit = 10, windowSeconds = 600) {
 const ip=request.headers.get('CF-Connecting-IP')||'unknown'; const key=await sha256(`${action}:${ip}`);
 const row=await env.DB.prepare(`INSERT INTO rate_limits(rate_key,hits,window_start) VALUES(?,1,unixepoch()) ON CONFLICT(rate_key) DO UPDATE SET hits=CASE WHEN window_start <= unixepoch()-? THEN 1 ELSE hits+1 END, window_start=CASE WHEN window_start <= unixepoch()-? THEN unixepoch() ELSE window_start END RETURNING hits`).bind(key,windowSeconds,windowSeconds).first();
 return (row?.hits||0)>limit;
}

export async function clearRateLimit(request, env, action) {
 const ip=request.headers.get('CF-Connecting-IP')||'unknown'; const key=await sha256(`${action}:${ip}`);
 await env.DB.prepare('DELETE FROM rate_limits WHERE rate_key=?').bind(key).run();
}

export function addCalendarMonths(date, months) { const d=new Date(date); const day=d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+months); const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(); d.setUTCDate(Math.min(day,last)); return d.toISOString(); }
export function addDays(date, days) { return new Date(new Date(date).getTime()+days*86400000).toISOString(); }
export async function captainSubscription(env, captainId) {
 const row=await env.DB.prepare(`SELECT s.*,r.ends_at AS restriction_ends_at,r.reason AS restriction_reason FROM captain_subscriptions s LEFT JOIN captain_restrictions r ON r.captain_id=s.captain_id WHERE s.captain_id=?`).bind(captainId).first();
 if(!row) return {status:'expired',active:false,reason:'لا يوجد اشتراك مسجل لهذا الحساب'};
 const now=Date.now(); const expiry=row.status==='trial'?row.trial_ends_at:row.period_ends_at; const active=['trial','active'].includes(row.status)&&expiry&&Date.parse(expiry)>now;
 const restricted=row.restriction_ends_at&&Date.parse(row.restriction_ends_at)>now;
 return {...row,status:!active&&row.status!=='cancelled'?'expired':row.status,active:!!active&&!restricted,expired:!active,restricted:!!restricted,ends_at:expiry||null};
}
export async function requireCaptainSubscription(env,captainId) { const sub=await captainSubscription(env,captainId); if(sub.restricted) return {subscription:sub,error:fail(`الحساب موقوف مؤقتًا حتى ${sub.restriction_ends_at}. ${sub.restriction_reason||''}`,403)}; if(!sub.active) return {subscription:sub,error:fail('انتهت فترة اشتراكك. جدّد الاشتراك من خلال الإدارة للعودة لاستقبال الرحلات.',402)}; return {subscription:sub}; }
