export async function onRequestGet({ env }) {
 const checks={api:'ok',database:'not_configured',private_storage:env.DOCUMENTS?'configured':'not_configured'};
 try { if(env.DB){await env.DB.prepare('SELECT 1').first();checks.database='ok';} } catch { checks.database='error'; }
 const ready=checks.database==='ok';
 return Response.json({status:ready?'ready':'degraded',checks,notes:checks.private_storage==='not_configured'?'Captain identity-document uploads are disabled until a private storage binding is configured.':undefined},{status:ready?200:503,headers:{'Cache-Control':'no-store'}});
}
