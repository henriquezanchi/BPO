const MENSAGEM_GENERICA = "Ocorreu um erro inesperado. Nossa equipe de suporte já foi avisada e está verificando — tente novamente em alguns instantes.";

/**
 * Em produção, o Next.js REDACTA a mensagem real de erros não tratados que
 * cruzam a fronteira de uma Server Action, virando um texto genérico em
 * inglês (algo como "An error occurred in the Server Components render...",
 * às vezes exibido como "Minified React error #441") — confirmado ao vivo
 * 2026-09-22. Isso deixa `catch (e) { setErro(e.message) }` inútil pro
 * usuário. Esta função detecta esse padrão e troca por uma mensagem
 * amigável em português — o erro REAL já foi capturado do lado do servidor
 * por onRequestError (ver instrumentation.ts/error-notify.ts) e já virou um
 * alerta pro suporte, então é seguro dizer isso ao usuário.
 */
export function mensagemErroAmigavel(e: unknown): string {
  const mensagem = e instanceof Error ? e.message : String(e);
  if (/error occurred in the server components render|minified react error/i.test(mensagem)) {
    return MENSAGEM_GENERICA;
  }
  return mensagem;
}
