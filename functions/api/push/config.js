import { json } from '../../_lib/core.js';
export async function onRequestGet({env}) { return json({ok:true,public_key:env.VAPID_PUBLIC_KEY||null,enabled:!!(env.VAPID_PUBLIC_KEY&&env.PUSH_VAPID_PRIVATE_KEY)}); }
