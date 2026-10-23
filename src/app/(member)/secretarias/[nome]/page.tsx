import {AreaSecretaria} from '@/components/secretarias-rede/area-secretaria';
import {ShellTrabalho} from '@/components/trabalho/shell-trabalho';
export const dynamic='force-dynamic';
export default async function SecretariaPage({params}:{params:Promise<{nome:string}>}){
 const {nome}=await params;
 return <ShellTrabalho><AreaSecretaria secretaria={nome}/></ShellTrabalho>;
}
