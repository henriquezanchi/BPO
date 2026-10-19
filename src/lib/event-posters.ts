import {supabaseAdmin} from '@/lib/supabase/admin';
export const EVENT_POSTERS_BUCKET='event-posters';
export async function eventPosterUrl(path:string|null|undefined){
 if(!path)return null;
 const {data,error}=await supabaseAdmin.storage.from(EVENT_POSTERS_BUCKET).createSignedUrl(path,3600);
 return error?null:data.signedUrl;
}
