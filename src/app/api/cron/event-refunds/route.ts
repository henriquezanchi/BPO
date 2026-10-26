import { processEventRefundQueue } from "@/lib/event-refunds";
import { autorizadoCron, executarRotina } from "@/lib/rotinas";
export const maxDuration=300;
export async function GET(req:Request){
 if(!process.env.CRON_SECRET)return Response.json({erro:"Agendamento não configurado."},{status:503});
 if(!autorizadoCron(req))return Response.json({erro:"Não autorizado."},{status:401});
 const r=await executarRotina("event-refunds",{reembolsos:()=>processEventRefundQueue()});
 return Response.json(r.tarefas.reembolsos??r);
}
