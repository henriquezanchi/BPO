import {db} from '@/lib/db';
import {sincronizarAberturasEscola} from '@/lib/aberturas/sincronizacao';
import {autorizadoCron,executarRotina} from '@/lib/rotinas';
export const maxDuration=120;
export const dynamic='force-dynamic';
export async function GET(req:Request){
 if(!autorizadoCron(req))return Response.json({erro:'Não autorizado.'},{status:401});
 const r=await executarRotina('aberturas',{sincronizacao:async()=>{
  const escolas=await db.aberturaTurma.findMany({where:{status:{in:['planejada','em_curso','concluida']},primeiraAula:{gte:new Date(Date.now()-120*86400000)}},distinct:['schoolId'],select:{schoolId:true}});
  let atualizadas=0;const pendentes:string[]=[];
  for(let inicio=0;inicio<escolas.length;inicio+=3){await Promise.all(escolas.slice(inicio,inicio+3).map(async escola=>{try{await sincronizarAberturasEscola(escola.schoolId);atualizadas++;}catch(e){pendentes.push(`${escola.schoolId}: ${e instanceof Error?e.message:String(e)}`);}}));}
  if(pendentes.length)throw new Error(`${pendentes.length} filial(is) sem sincronizar: ${pendentes.join('; ')}`);
  return {atualizadas};
 }});
 return Response.json(r,{headers:{'Cache-Control':'no-store'}});
}
