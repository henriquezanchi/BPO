import {getAuthenticatedMember} from '@/lib/auth';
import {carregarContextoSecretaria} from '@/lib/secretarias-rede/acesso';
import {caminhoSecretaria} from '@/lib/secretarias-rede/destinos';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
/** Compatibilidade com links antigos; não há mais área central de secretarias. */
export default async function AntigaRedePage(){
 const member=await getAuthenticatedMember();if(!member?.mercurioAtivo)redirect('/login');
 const ctx=await carregarContextoSecretaria(member);
 const nome=ctx.mandatos.find(m=>m.ativo)?.secretaria||ctx.responsabilidades[0]?.secretaria;
 redirect(nome?caminhoSecretaria(nome):'/voluntario');
}
