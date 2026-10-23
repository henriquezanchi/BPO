import { chaveSecretaria } from './regras';
export function caminhoSecretaria(nome:string){
 const rotas:Record<string,string>={ECONOMIA:'/economia',ESCOLASTICA:'/escolastica',EVENTOS:'/voluntario/eventos',CAFE:'/voluntario/cafe','ABERTURA DE TURMA':'/voluntario/aberturas'};
 return rotas[chaveSecretaria(nome)]?`${rotas[chaveSecretaria(nome)]}?aba=orientacoes`:`/secretarias/${encodeURIComponent(nome)}`;
}
