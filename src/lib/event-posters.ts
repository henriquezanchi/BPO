import {supabaseAdmin} from '@/lib/supabase/admin';
import {unstable_cache} from 'next/cache';
export const EVENT_POSTERS_BUCKET='event-posters';

async function assinar(path:string){
 const {data,error}=await supabaseAdmin.storage.from(EVENT_POSTERS_BUCKET).createSignedUrl(path,3600);
 if(error)throw error; // falha não fica guardada
 return data.signedUrl;
}

// Link do cartaz reaproveitado por 40 min (01/11/2026): antes cada abertura do Portal pedia um link novo ao Supabase
// para cada cartaz (2.000 aberturas x 10 eventos = 20 mil pedidos num pico). O link vale 1 h, então quem recebe o
// guardado ainda tem pelo menos 20 min. Cartaz novo tem caminho novo, então não fica preso ao antigo.
const assinarGuardado=unstable_cache(assinar,['cartaz-evento-url'],{revalidate:40*60});

export async function eventPosterUrl(path:string|null|undefined){
 if(!path)return null;
 try{return await assinarGuardado(path);}catch{return assinar(path).catch(()=>null);}
}
