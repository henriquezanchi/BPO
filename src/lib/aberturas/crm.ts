import 'server-only';
import {db} from '@/lib/db';
// A chave do CRM não vai para variáveis públicas nem para propriedades React.
export async function consultarCrmAberturas(schoolId:string,body?:unknown){
 const school=await db.school.findUnique({where:{id:schoolId},select:{mercurioUnidade:true}});
 if(!school?.mercurioUnidade)throw Error('Filial sem código oficial do Mercúrio.');
 const rows=await db.$queryRaw<{chave:string|null}[]>`SELECT public.aberturas_crm_chave() AS chave`;
 if(!rows[0]?.chave)throw Error('A integração da base de interessados ainda não foi configurada.');
 const url=new URL('https://eovgljcowblwoxmobeno.supabase.co/functions/v1/bpo-aberturas');url.searchParams.set('filial',school.mercurioUnidade);
 const res=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${rows[0].chave}`,apikey:rows[0].chave,'Content-Type':'application/json'},...(body?{body:JSON.stringify({...body as object,filial:school.mercurioUnidade})}:{}),cache:'no-store',signal:AbortSignal.timeout(25000)});
 if(!res.ok)throw Error('Não foi possível atualizar os interessados. Os dados anteriores foram preservados.');
 return res.json();
}
