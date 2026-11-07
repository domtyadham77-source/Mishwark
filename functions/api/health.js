export async function onRequestGet({ env }) {
 const checks={api:'ok',database:'not_configured',private_storage:'not_configured'};
 try {
  if(env.DB){await env.DB.prepare('SELECT 1').first();checks.database='ok';checks.private_storage='d1-private';}
 } catch { checks.database='error';checks.private_storage='unavailable'; }
 const ready=checks.database==='ok';
 return Response.json({status:ready?'ready':'degraded',checks,notes:ready?'Private captain images are stored in D1 and served only through authenticated admin endpoints.':'D1 is not available.'},{status:ready?200:503,headers:{'Cache-Control':'no-store'}});
}
