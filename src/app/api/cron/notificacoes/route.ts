import { avisosDeEncontros, avisosDeEventosNovos, avisosDePedidosNovos, avisosDeVencimento } from "@/lib/notificacoes-agendadas";
import { pushConfigurado } from "@/lib/push";
import crypto from "node:crypto";

/**
 * Avisos push agendados (vercel.json, a cada 5 minutos): encontros dos
 * grupos, pedidos novos para a Escolástica e a Economia, evento novo e
 * vencimento da contribuição. Cada tipo roda isolado: uma falha num não
 * impede os outros. A Vercel chama com "Authorization: Bearer $CRON_SECRET".
 */
export const maxDuration = 120;

function autorizado(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
}

async function rodar<T>(nome: string, tarefa: () => Promise<T>) {
  try {
    return await tarefa();
  } catch (e) {
    console.error(`Avisos agendados (${nome}) falharam:`, e);
    return { erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  if (!pushConfigurado()) return Response.json({ ok: true, aviso: "Chaves VAPID não configuradas; nada enviado." });

  const resultado = {
    encontros: await rodar("encontros", avisosDeEncontros),
    pedidos: await rodar("pedidos", avisosDePedidosNovos),
    eventos: await rodar("eventos", avisosDeEventosNovos),
    vencimento: await rodar("vencimento", avisosDeVencimento),
  };
  console.log(JSON.stringify({ notificacoes: resultado }));
  return Response.json({ ok: true, ...resultado });
}
