/** Execute no mesmo ambiente confiável que já acessa o Ulisses; não contorna Cloudflare. */
import 'dotenv/config';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {db} from '../src/lib/db';
import {ulissesOccurrences,type UlissesEvent} from '../src/lib/ulisses/events';

async function main(){
 const clientPath=process.env.ULISSES_CLIENT_MODULE;
 if(!clientPath)throw Error('Configure ULISSES_CLIENT_MODULE com o caminho do cliente oficial já utilizado pelo CRM.');
 const mapping=JSON.parse(process.env.ULISSES_SCHOOL_MAP??'{}') as Record<string,number>;
 if(!Object.keys(mapping).length)throw Error('Configure ULISSES_SCHOOL_MAP: JSON de School.id do Portal para filialId do Ulisses. Não inferir por nome.');
 // Nomes separados impedem enviar a chave do projeto Portal ao Supabase do CRM.
 const crmUrl=process.env.CRM_SUPABASE_URL,crmKey=process.env.CRM_SUPABASE_SERVICE_ROLE_KEY,crmCipher=process.env.CRM_CREDENCIAIS_SCRAPER_CHAVE;
 if(!crmUrl||!crmKey||!crmCipher)throw Error('Configure as três variáveis CRM_* no contexto seguro do job existente; nunca reutilize a chave do Portal.');
 if(new URL(crmUrl).hostname==='lefahgczkonbqcppyftg.supabase.co')throw Error('O cliente Ulisses precisa do projeto CRM, não do projeto Portal.');
 process.env.SUPABASE_URL=crmUrl;process.env.SUPABASE_SERVICE_ROLE_KEY=crmKey;process.env.CREDENCIAIS_SCRAPER_CHAVE=crmCipher;
 const client=await import(pathToFileURL(resolve(clientPath)).href) as {listarTodosEventos:(id:number)=>Promise<{id:number}[]>;evento:(id:number)=>Promise<UlissesEvent>};
 if(typeof client.listarTodosEventos!=='function'||typeof client.evento!=='function')throw Error('Cliente incompatível: faltam listarTodosEventos e evento.');
 let updated=0,errors=0;
 for(const [schoolId,branchId] of Object.entries(mapping)){
  try {
   if(!Number.isSafeInteger(branchId)||branchId<=0)throw Error('Mapeamento de filial inválido.');
   await db.school.findUniqueOrThrow({where:{id:schoolId},select:{id:true}});
   const catalog=await client.listarTodosEventos(branchId);
   if(!Array.isArray(catalog))throw Error('Resposta de catálogo incompatível.');
   // Deduplicação por ID oficial; nunca cancelar em massa por ausência numa resposta parcial.
   for(const id of new Set(catalog.map(item=>item.id))){
    const detail=await client.evento(id);
    const occurrences=ulissesOccurrences(detail,branchId,schoolId);
    for(const row of occurrences){
     if(row.startsAt.getTime()<Date.now()-86400000)continue;
     const {externalUid,...data}=row;
     await db.event.upsert({where:{externalUid},create:{...data,externalUid},update:data});updated++;
    }
   }
  }catch{errors++;console.error('Falha na sincronização de uma filial do Ulisses. Conferir permissões, rede e contrato da API. Nenhum catálogo foi apagado.');}
 }
 console.log(JSON.stringify({ocorrenciasSincronizadas:updated,filiaisComFalha:errors}));
 if(errors)process.exitCode=1;
}
main().catch(()=>{console.error('Sincronização não iniciada: confira cliente oficial, mapeamento seguro e acesso à API.');process.exitCode=1;}).finally(()=>db.$disconnect());
