import { db } from "@/lib/db";

const JANELA_DEDUPE_MIN = 20;

interface ErroParaNotificar {
  message: string;
  digest?: string;
  stack?: string;
  path?: string;
  routeType?: string;
}

function gerarFingerprint({ path, message }: ErroParaNotificar): string {
  return `${path ?? "?"}::${message}`.slice(0, 300);
}

/**
 * Ponto único de notificação de erro pro suporte (decisão do usuário
 * 2026-09-22: quer saber de erros reais o quanto antes, não só quando o
 * usuário reclama) — chamado automaticamente por src/instrumentation.ts
 * (onRequestError, cobre Server Actions/Route Handlers/render) pra
 * qualquer erro NÃO tratado. Dedupe por fingerprint (rota + mensagem) via
 * ErrorNotification — evita floodar o WhatsApp com o mesmo erro repetido
 * (ex: um cron falhando a cada 10min).
 *
 * best-effort: nunca lança — uma falha aqui não pode derrubar o fluxo de
 * erro original que estava sendo tratado.
 */
export async function notificarErroSuporte(erro: ErroParaNotificar): Promise<void> {
  const fingerprint = gerarFingerprint(erro);
  let deveEnviar = true;

  try {
    const agora = new Date();
    const existente = await db.errorNotification.findUnique({ where: { fingerprint } });
    if (existente) {
      const minutosDesdeUltimoAviso = (agora.getTime() - existente.lastNotifiedAt.getTime()) / 60000;
      deveEnviar = minutosDesdeUltimoAviso >= JANELA_DEDUPE_MIN;
      await db.errorNotification.update({
        where: { fingerprint },
        data: { count: { increment: 1 }, ...(deveEnviar ? { lastNotifiedAt: agora } : {}) },
      });
    } else {
      await db.errorNotification.create({ data: { fingerprint, message: erro.message, lastNotifiedAt: agora } });
    }
  } catch (e) {
    // Se o próprio dedupe falhar (banco fora do ar etc.), prefere mandar o
    // aviso duplicado a arriscar perder um erro real de vista.
    console.error("[error-notify] Falha no dedupe — enviando mesmo assim:", e);
  }

  if (!deveEnviar) return;
  await enviarAlertaWhatsApp(erro);
}

async function enviarAlertaWhatsApp(erro: ErroParaNotificar): Promise<void> {
  const phone = process.env.CALLMEBOT_PHONE;
  const apikey = process.env.CALLMEBOT_APIKEY;
  if (!phone || !apikey) {
    console.error("[error-notify] CALLMEBOT_PHONE/CALLMEBOT_APIKEY não configurados — erro não notificado:", erro.message);
    return;
  }

  const texto = [
    "🔴 Erro no Portal NA",
    erro.routeType && erro.path ? `${erro.routeType}: ${erro.path}` : erro.path,
    erro.message.slice(0, 300),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch(`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&apikey=${encodeURIComponent(apikey)}&text=${encodeURIComponent(texto)}`);
    if (!res.ok) console.error(`[error-notify] CallMeBot respondeu HTTP ${res.status}: ${await res.text()}`);
  } catch (e) {
    console.error("[error-notify] Falha ao enviar alerta WhatsApp:", e);
  }
}
