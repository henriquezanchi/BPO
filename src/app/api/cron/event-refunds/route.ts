import { timingSafeEqual } from "node:crypto";
import { processEventRefundQueue } from "@/lib/event-refunds";
export const maxDuration=300;
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret)return Response.json({erro:"Agendamento não configurado."},{status:503});
 const received=Buffer.from(req.headers.get("authorization")??""),expected=Buffer.from(`Bearer ${secret}`);
 if(received.length!==expected.length||!timingSafeEqual(received,expected))return Response.json({erro:"Não autorizado."},{status:401});
 return Response.json(await processEventRefundQueue());
}
