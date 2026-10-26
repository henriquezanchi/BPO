import {getAuthenticatedMember} from '@/lib/auth';
import {instagramDasFiliais,SECRETARIA_DIFUSAO} from '@/lib/redes-filial';
import {carregarContextoSecretaria,chaveSecretaria,podeAcessarSecretaria} from '@/lib/secretarias-rede/acesso';
import {carregarBibliotecaSecretarias} from '@/lib/secretarias-rede/dados';
import {OfertaInstagram} from './oferta-instagram';
import {SecretariasRede} from './secretarias-rede';
import {redirect,notFound} from 'next/navigation';
import {Suspense} from 'react';
export async function AreaSecretaria({secretaria}:{secretaria:string}){
 const member=await getAuthenticatedMember();
 if(!member)redirect('/login');
 if(!member.mercurioAtivo)redirect('/portal');
 const ctx=await carregarContextoSecretaria(member);
 if(!podeAcessarSecretaria(ctx,secretaria))notFound();
 // Instagram da filial (pacote opcional, 2026-10-26): só para quem pode contratar, na Difusão e Comunicação.
 const instagram=chaveSecretaria(decodeURIComponent(secretaria))===chaveSecretaria(SECRETARIA_DIFUSAO)?await instagramDasFiliais(member):[];
 return <>
  {instagram.length>0&&<Suspense><OfertaInstagram filiais={instagram}/></Suspense>}
  <SecretariasRede key={secretaria} data={await carregarBibliotecaSecretarias(member,secretaria)}/>
 </>;
}
