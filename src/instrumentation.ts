import type { Instrumentation } from "next";

/**
 * Captura TODO erro não tratado do lado do servidor (render de Server
 * Component, Route Handler, ou Server Action — ver context.routeType) num
 * ponto só, sem precisar mexer em cada action/rota individualmente. Decisão
 * do usuário 2026-09-22: quer ser avisado o quanto antes de erros reais no
 * Portal, não só quando um membro reclama. Ver notificarErroSuporte
 * (WhatsApp via CallMeBot, com dedupe pra não floodar o mesmo erro
 * repetido).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === "edge") return; // notificarErroSuporte usa Prisma — só roda no runtime Node

  try {
    const message = error instanceof Error ? error.message : String(error);
    const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : undefined;
    const stack = error instanceof Error ? error.stack : undefined;

    const { notificarErroSuporte } = await import("./lib/error-notify");
    await notificarErroSuporte({ message, digest, stack, path: request.path, routeType: context.routeType });
  } catch {
    // Nunca deixa a notificação quebrar o fluxo de erro original do Next.
  }
};
