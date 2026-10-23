import {timingSafeEqual} from 'node:crypto';
import {db} from '@/lib/db';
import {sincronizarAberturasEscola} from '@/lib/aberturas/sincronizacao';
export const maxDuration=120;
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const segredo=process.env.CRON_SECRET,recebido=Buffer.from(req.headers.get('authorization')||''),esperado=Buffer.from(`Bearer ${segredo}`);
 if(!segredo||recebido.length!==esperado.length||!timingSafeEqual(recebido,esperado))return Response.json({erro:'Não autorizado.'},{status:401});
 const escolas=await db.aberturaTurma.findMany({where:{status:{in:['planejada','em_curso','concluida']},primeiraAula:{gte:new Date(Date.now()-120*86400000)}},distinct:['schoolId'],select:{schoolId:true}});
 let atualizadas=0,pendentes=0;
 for(let inicio=0;inicio<escolas.length;inicio+=3){await Promise.all(escolas.slice(inicio,inicio+3).map(async escola=>{try{await sincronizarAberturasEscola(escola.schoolId);atualizadas++;}catch{pendentes++;}}));}
 return Response.json({ok:pendentes===0,atualizadas,pendentes},{headers:{'Cache-Control':'no-store'}});
}
