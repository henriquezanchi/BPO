// URL e nomes de campo confirmados ao vivo em 2026-10-08 (inspecionado
// direto no HTML de https://membros.acropoleplay.com/auth/login).
const LOGIN_URL = "https://membros.acropoleplay.com/auth/login";
const DESTINO_URL = "https://membros.acropoleplay.com/area/vitrine/home";
const CAMPO_EMAIL = "Acesso[email]";
const CAMPO_SENHA = "Acesso[senha]";
const CAMPO_TOKEN = "_token";
const JANELA_NOME = "acropoleplay_login";

/**
 * Abre a aba/janela ANTES de qualquer await (chamar isso direto no onClick,
 * de forma síncrona) — navegador só trata window.open como ação confiável
 * do usuário quando ela acontece no mesmo tick do clique.
 */
export function abrirJanelaAcropolePlay(): Window | null {
  return window.open("", JANELA_NOME);
}

/**
 * Loga de verdade por trás (fetch, não navegação de formulário) e só então
 * manda a janela já aberta (ver abrirJanelaAcropolePlay) pro destino final.
 *
 * Achado ao vivo 2026-10-08: submeter um <form> de verdade (navegação de
 * página inteira) pra essa rota, vindo de outro domínio, dá erro 500 no
 * servidor deles — provavelmente o login real deles é feito por JavaScript
 * (fetch/AJAX) no dia a dia, e esse caminho de "formulário clássico" é uma
 * rota alternativa pouco testada do lado deles. O login EM SI funciona
 * mesmo com o 500 (a sessão fica autenticada antes de quebrar) — então
 * convertido pra fetch, que deve bater no mesmo caminho AJAX de verdade que
 * o front deles usa, evitando esse erro por completo.
 *
 * `mode: "no-cors"` — não precisamos ler a resposta (não temos como, é
 * cross-origin e eles não liberam isso pro nosso domínio), só que o
 * navegador PROCESSE o Set-Cookie da resposta, que acontece
 * independentemente do JS conseguir ler o corpo ou não.
 */
export async function autoLoginAcropolePlay(email: string, senha: string, janela: Window | null) {
  try {
    await fetch(LOGIN_URL, {
      method: "POST",
      mode: "no-cors",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ [CAMPO_TOKEN]: "portal-na", [CAMPO_EMAIL]: email, [CAMPO_SENHA]: senha }).toString(),
    });
  } catch {
    // Resposta opaca/falha de rede não impede o cookie de já ter sido
    // processado — segue pro destino de qualquer forma.
  }

  if (janela && !janela.closed) janela.location.href = DESTINO_URL;
}
