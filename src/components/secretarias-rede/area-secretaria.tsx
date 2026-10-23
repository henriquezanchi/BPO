import {getAuthenticatedMember} from '@/lib/auth';
import {carregarContextoSecretaria,podeAcessarSecretaria} from '@/lib/secretarias-rede/acesso';
import {carregarBibliotecaSecretarias} from '@/lib/secretarias-rede/dados';
import {SecretariasRede} from './secretarias-rede';
import {redirect,notFound} from 'next/navigation';
export async function AreaSecretaria({secretaria}:{secretaria:string}){
 const member=await getAuthenticatedMember();
 if(!member)redirect('/login');
 if(!member.mercurioAtivo)redirect('/portal');
 const ctx=await carregarContextoSecretaria(member);
 if(!podeAcessarSecretaria(ctx,secretaria))notFound();
 return <SecretariasRede key={secretaria} data={await carregarBibliotecaSecretarias(member,secretaria)}/>;
}
