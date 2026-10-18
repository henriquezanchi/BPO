"use server";

import { requireEconomiaOuDirecao } from "@/lib/auth";
import { db } from "@/lib/db";
import { paymentReviewStage } from "@/lib/contribution-position";

/** Consulta paginada e restrita à escola. Não dá baixa nem reenvia lançamentos. */
export async function getPaymentReview(schoolId: string, options: {cursor?:string; status?:"pago"|"pendente"} = {}) {
  const actor = await requireEconomiaOuDirecao(schoolId);
  if (!actor.mercurioAtivo) throw new Error("Acesso indisponível para cadastro inativo.");
  if(options.status && !["pago","pendente"].includes(options.status)) throw new Error("Situação inválida.");
  if(options.cursor && (typeof options.cursor !== "string" || options.cursor.length > 100)) throw new Error("Página inválida.");
  const rows = await db.paymentCharge.findMany({
    where:{member:{schoolId},status:options.status ?? "pago"},
    select:{id:true,memberId:true,member:{select:{name:true}},referenceYear:true,referenceMonth:true,amount:true,billingType:true,status:true,paidAt:true,createdAt:true},
    orderBy:[{createdAt:"desc"},{id:"desc"}],take:51,
    ...(options.cursor ? {cursor:{id:options.cursor},skip:1} : {}),
  });
  const page = rows.slice(0,50);
  const tasks = page.length ? await db.mercurioSyncTask.findMany({
    where:{member:{schoolId},taskType:"lancar_contribuicao_paga",OR:page.map(row=>({payload:{path:["chargeId"],equals:row.id}}))},
    select:{payload:true,status:true,attempts:true,syncedAt:true},
  }) : [];
  return {items:page.map(row=>{
    const related=tasks.filter(task=>(task.payload as {chargeId?:string})?.chargeId === row.id);
    return {id:row.id,name:row.member.name,year:row.referenceYear,month:row.referenceMonth,amount:Number(row.amount),method:row.billingType,receivedAt:row.paidAt?.toISOString()??null,stage:paymentReviewStage(row.status,related),attempts:related.reduce((sum,task)=>sum+task.attempts,0)};
  }),nextCursor:rows.length>50?page[49].id:null};
}
