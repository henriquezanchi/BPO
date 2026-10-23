import 'server-only';
import {db} from '@/lib/db';
import {consultarCrmAberturas} from './crm';
import type {Prisma} from '@prisma/client';
export async function sincronizarAberturasEscola(schoolId:string){
 const aberturas=await db.aberturaTurma.findMany({where:{schoolId},include:{registros:{where:{tipo:'avaliacao'},orderBy:{createdAt:'asc'}}}});
 for(const abertura of aberturas){
  let lote:{leadId:string;sinais:unknown[];snapshot:unknown}[]=[];
  const enviar=async()=>{if(!lote.length)return;await consultarCrmAberturas(schoolId,{aberturaId:abertura.id,abertura:{id:abertura.id,diaSemana:abertura.diaSemana,inicioMinuto:abertura.inicioMinuto,primeiraAula:abertura.primeiraAula.toISOString()},avaliacoes:lote});lote=[];};
  for(const r of abertura.registros){const snapshot=r.dados as Record<string,unknown>,leadId=String(snapshot.leadId);if(lote.length>=25||lote.some(a=>a.leadId===leadId))await enviar();
   const sinais=Array.isArray(snapshot.sinais)?snapshot.sinais.filter(s=>s&&typeof s==='object'&&(s as Record<string,unknown>).aberturaId===abertura.id):[];
   lote.push({leadId,sinais,snapshot});
  }await enviar();
 }
 const dados=await consultarCrmAberturas(schoolId);
 await db.aberturaCrmCache.upsert({where:{schoolId},create:{schoolId,dados},update:{dados,sincronizadoEm:new Date()}});
 let incorporadas=0;
 const matriculas=Array.isArray(dados.matriculas)?dados.matriculas as Record<string,unknown>[]:[];
 for(const a of aberturas.filter(a=>a.mercurioTurmaId&&a.status!=='cancelada')){
  const de=a.primeiraAula.getTime()-90*86400000,ate=a.inscricoesAte?.getTime()??a.primeiraAula.getTime()+30*86400000;
  const rows=matriculas.filter(m=>String(m.turmaId)===a.mercurioTurmaId&&typeof m.data==='string'&&Date.parse(m.data.slice(0,10)+'T00:00:00-03:00')>=de&&Date.parse(m.data.slice(0,10)+'T00:00:00-03:00')<=ate&&m.mercurioId).map(m=>({id:`crm-${a.id}-${m.mercurioId}-${String(m.data).slice(0,10)}`,aberturaId:a.id,autorId:'sistema:crm',tipo:'resultado',dados:{mercurioId:String(m.mercurioId),...(m.leadId?{leadId:String(m.leadId)}:{}),turmaId:a.mercurioTurmaId,data:String(m.data).slice(0,10),status:'matriculado',fonte:'mercurio',confirmadoEm:new Date().toISOString()} as Prisma.InputJsonValue}));
  if(rows.length){const result=await db.$transaction(async tx=>{const inserted=await tx.aberturaRegistro.createMany({data:rows,skipDuplicates:true});if(inserted.count)await tx.aberturaTurma.update({where:{id:a.id},data:{revisao:{increment:1}}});return inserted;});incorporadas+=result.count;}
 }
 return {incorporadas};
}
