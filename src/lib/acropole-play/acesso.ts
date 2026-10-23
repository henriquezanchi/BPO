import "server-only";
import { db } from "@/lib/db";
import { cifrarLinkPlay, decifrarLinkPlay, hashEmailPlay, normalizarEmailPlay, normalizarNomePlay } from "./core";
import { createHash } from "node:crypto";

type IdentidadePortal = {id:string;mercurioId:string|null;email:string|null;name:string;mercurioAtivo:boolean;responsavelId:string|null};
/** Só associa um futuro usuário após sua identidade acadêmica e email
 * confirmado concordarem. E-mails familiares/duplicados exigem revisão. */
export async function encontrarOuVincularPlay(member:IdentidadePortal, chave:Buffer) {
  if(!member.mercurioAtivo||!member.mercurioId||!member.email||member.responsavelId)return null;
  const emailHash=hashEmailPlay(member.email),nameHash=createHash("sha256").update(normalizarNomePlay(member.name)).digest("hex");
  const duplicados=await db.$queryRaw<{total:bigint}[]>`SELECT count(*) AS total FROM "Member" WHERE lower(btrim("email"))=${normalizarEmailPlay(member.email)}`;
  if(Number(duplicados[0]?.total)!==1)return null;
  const fontes=await db.acropolePlayStudent.findMany({where:{emailHash},take:2});
  if(fontes.length!==1)return null;
  let acesso=await db.acropolePlayAccess.findUnique({where:{memberId:member.id},include:{source:true}});
  if(!acesso){
    const source=fontes[0];
    if(source.reconciliationStatus!=="matched_active"||source.mercurioId!==member.mercurioId||source.nameHash!==nameHash)return null;
    const link=decifrarLinkPlay(source.loginCiphertext,{memberId:"catalog",sourceStudentId:source.sourceStudentId,emailHash},chave);
    const loginCiphertext=cifrarLinkPlay(link,{memberId:member.id,sourceStudentId:source.sourceStudentId,emailHash},chave);
    // A unique de sourceStudentId impede transferir acesso para outra pessoa.
    acesso=await db.acropolePlayAccess.create({data:{memberId:member.id,sourceStudentId:source.sourceStudentId,emailHash,loginCiphertext},include:{source:true}});
  }
  if(acesso.emailHash!==emailHash||acesso.source.emailHash!==emailHash||acesso.source.nameHash!==nameHash||
     acesso.source.mercurioId!==member.mercurioId||acesso.source.reconciliationStatus!=="matched_active")return null;
  if(acesso.source.updatedAt>acesso.updatedAt){
    const link=decifrarLinkPlay(acesso.source.loginCiphertext,{memberId:"catalog",sourceStudentId:acesso.sourceStudentId,emailHash},chave);
    acesso=await db.acropolePlayAccess.update({where:{memberId:member.id},data:{loginCiphertext:cifrarLinkPlay(link,{memberId:member.id,sourceStudentId:acesso.sourceStudentId,emailHash},chave)},include:{source:true}});
  }
  return acesso;
}
