import 'server-only';
import { db } from '@/lib/db';
import { getAuthenticatedMember } from '@/lib/auth';
import { areasNaFilial } from '@/lib/areas-filial';
import { escolasChefiadas } from '@/lib/acesso-voluntario';
import type { Member } from '@prisma/client';

export async function escolasAberturas(member: Member) {
  if (!member.mercurioAtivo) return [];
  const [chefia, responsabilidades, mandatos, areas] = await Promise.all([
    escolasChefiadas(member),
    db.classMembership.findMany({where:{memberId:member.id,role:'professor',classGroup:{tipo:'SEC',arquivadoEm:null}},select:{classGroup:{select:{schoolId:true,name:true}}}}),
    db.secretariaMandato.findMany({where:{memberId:member.id,ativo:true}}),
    areasNaFilial(member,member.schoolId),
  ]);
  const ids=new Set(chefia);
  if(areas.includes('direcao')) ids.add(member.schoolId);
  for(const r of responsabilidades) if(/abertura/i.test(r.classGroup.name)) ids.add(r.classGroup.schoolId);
  const relevantes=mandatos.filter(m=>/abertura/i.test(m.secretaria));
  for(const m of relevantes){
    if(m.escopo==='nacional')return db.school.findMany({select:{id:true,name:true},orderBy:{name:'asc'}});
    if(m.escopo==='local'){m.schoolIds.forEach(id=>ids.add(id));continue;}
    if(m.escopo==='regional'&&(m.schoolIds.length||m.ufs.length)){const schools=await db.school.findMany({where:{...(m.schoolIds.length?{id:{in:m.schoolIds}}:{}),...(m.ufs.length?{uf:{in:m.ufs}}:{})},select:{id:true}});schools.forEach(s=>ids.add(s.id));}
  }
  return db.school.findMany({where:{id:{in:[...ids]}},select:{id:true,name:true},orderBy:{name:'asc'}});
}
export async function exigirAberturas(schoolId?:string){
  const member=await getAuthenticatedMember();
  if(!member?.mercurioAtivo)throw Error('Entre com uma conta ativa para continuar.');
  const escolas=await escolasAberturas(member);
  const id=schoolId||escolas.find(s=>s.id===member.schoolId)?.id||escolas[0]?.id;
  if(!id||!escolas.some(s=>s.id===id))throw Error('Sem permissão para gerenciar aberturas desta filial.');
  return {member,escolas,schoolId:id};
}
