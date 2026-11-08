import { json, setting } from '../_lib/core.js';
export async function onRequestGet({env}) {
 const min=Number(await setting(env,'negotiation_min_piasters','2500'));
 const max=Number(await setting(env,'negotiation_max_piasters','5000'));
 return json({ok:true,min_piasters:min,max_piasters:max});
}
