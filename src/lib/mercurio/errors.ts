/**
 * Isolado longe de browser-session.ts DE PROPÓSITO — esse arquivo não pode
 * importar "playwright" (nem transitivamente). Web-facing (sync-queue.ts,
 * usado por Server Actions rodando no Vercel) precisa checar
 * `e instanceof RodadaEmAndamentoError` sem herdar o pacote inteiro do
 * Playwright, que quebra em serverless (bug real encontrado ao vivo:
 * "Cannot find module .../playwright-core/browsers.json").
 */
export class RodadaEmAndamentoError extends Error {}
