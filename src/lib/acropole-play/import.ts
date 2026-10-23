import { createHash } from "node:crypto";
import { hashEmailPlay, normalizarEmailPlay, normalizarNomePlay, validarLinkPlay } from "./core";
export type AlunoPlay = { linha: number; id: string; nome: string; email: string; link: string };
export type MembroImportacaoPlay = { id: string; name: string; email: string | null; mercurioAtivo: boolean; responsavelId: string | null };
export type AcessoExistentePlay = { memberId: string; sourceStudentId: string; emailHash: string };
export type RevisaoPlay = { linha: number; sourceStudentId: string; motivo: string };
export function lerExportacaoPlay(bytes: Buffer): AlunoPlay[] {
  if (bytes.length > 32 * 1024 * 1024) throw new Error("Arquivo acima do limite de 32 MiB.");
  if (bytes.subarray(0,2).equals(Buffer.from([0xd0,0xcf])) || bytes.subarray(0,2).equals(Buffer.from("PK"))) throw new Error("Este importador espera a exportação tabulada da plataforma, mesmo com extensão .xls.");
  const texto = (bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.toString("utf16le") : bytes.toString("utf8")).replace(/^\uFEFF/, "");
  const linhas: string[][] = []; let linha: string[] = [], campo = "", aspas = false;
  for (let i=0; i<texto.length; i++) {
    const c=texto[i];
    if (c==='"') {
      if (aspas && texto[i+1]==='"') { campo+='"'; i++; }
      else if (aspas || campo==='') aspas=!aspas;
      else campo+=c;
    } else if (!aspas && (c==='\t' || c==='\n' || c==='\r')) {
      linha.push(campo); campo="";
      if (c!=='\t') { if(c==='\r' && texto[i+1]==='\n') i++; if(linha.some(v=>v!==""))linhas.push(linha); linha=[]; }
    } else campo+=c;
    if (campo.length>16384 || linhas.length>100000) throw new Error("Exportação acima dos limites permitidos.");
  }
  if (aspas) throw new Error("Exportação com aspas incompletas.");
  linha.push(campo);if(linha.some(v=>v!==""))linhas.push(linha);
  const cab=linhas.shift()?.map(v=>v.trim());
  if (!cab || new Set(cab).size!==cab.length || !["id","nome","email","login_auto"].every(c=>cab.includes(c))) throw new Error("Faltam colunas obrigatórias ou há cabeçalhos duplicados.");
  return linhas.map((l,i)=>{
    if(l.length!==cab.length)throw new Error(`Quantidade de colunas inválida na linha ${i+2}.`);
    const get=(c:string)=>l[cab.indexOf(c)].trim();
    return {linha:i+2,id:get("id"),nome:get("nome"),email:normalizarEmailPlay(get("email")),link:get("login_auto")};
  });
}
function repetidos(valores: string[]) { const m=new Map<string,number>(); for(const v of valores)if(v)m.set(v,(m.get(v)||0)+1);return new Set([...m].filter(([,n])=>n>1).map(([v])=>v)); }
export function planejarImportacaoPlay(alunos: AlunoPlay[], membros: MembroImportacaoPlay[], existentes: AcessoExistentePlay[]) {
  const ids=repetidos(alunos.map(a=>a.id)), emails=repetidos(alunos.map(a=>a.email));
  const fingerprint=(s:string)=>createHash("sha256").update(s).digest("hex");
  const links=repetidos(alunos.map(a=>a.link?fingerprint(a.link):""));
  const porEmail=new Map<string,MembroImportacaoPlay[]>();
  for(const m of membros)if(m.email){const e=normalizarEmailPlay(m.email);porEmail.set(e,[...(porEmail.get(e)||[]),m]);}
  const porMembro=new Map(existentes.map(a=>[a.memberId,a])), porId=new Map(existentes.map(a=>[a.sourceStudentId,a]));
  const revisar: RevisaoPlay[]=[];
  const aceitos: {aluno:AlunoPlay;memberId:string;emailHash:string}[]=[];
  for(const aluno of alunos){
    const recusar=(motivo:string)=>revisar.push({linha:aluno.linha,sourceStudentId:/^\d{1,20}$/.test(aluno.id)?aluno.id:"",motivo});
    if(!/^\d{1,20}$/.test(aluno.id)||!aluno.nome||!/^\S+@\S+\.\S+$/.test(aluno.email)){recusar("identificacao_invalida");continue;}
    try{validarLinkPlay(aluno.link);}catch{recusar("link_invalido");continue;}
    if(ids.has(aluno.id)||emails.has(aluno.email)||links.has(fingerprint(aluno.link))){recusar("duplicidade_na_exportacao");continue;}
    const candidatos=porEmail.get(aluno.email)||[];
    if(candidatos.length!==1){recusar(candidatos.length?"email_compartilhado_no_portal":"sem_correspondencia_no_portal");continue;}
    const membro=candidatos[0];
    if(!membro.mercurioAtivo||membro.responsavelId){recusar("portal_inativo_ou_dependente");continue;}
    if(normalizarNomePlay(membro.name)!==normalizarNomePlay(aluno.nome)){recusar("nome_divergente_revisar");continue;}
    const hash=hashEmailPlay(aluno.email), atual=porMembro.get(membro.id), anterior=porId.get(aluno.id);
    if((atual&&(atual.sourceStudentId!==aluno.id||atual.emailHash!==hash))||(anterior&&anterior.memberId!==membro.id)){recusar("vinculo_existente_conflitante");continue;}
    aceitos.push({aluno,memberId:membro.id,emailHash:hash});
  }
  return {aceitos,revisar};
}
