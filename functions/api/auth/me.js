import { json, sessionUser } from '../../_lib/core.js';
export async function onRequestGet({request,env}) { const user=await sessionUser(request,env); return user?json({ok:true,user}):json({ok:false,user:null},401); }
