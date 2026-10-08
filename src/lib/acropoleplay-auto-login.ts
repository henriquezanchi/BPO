// URL e nomes de campo confirmados ao vivo em 2026-10-08 (inspecionado
// direto no HTML de https://membros.acropoleplay.com/auth/login) — é um
// form Laravel-like, mas a rota NÃO valida de verdade o token CSRF (testado
// ao vivo: POST com _token proposital errado, numa janela anônima sem
// nenhuma sessão prévia, ainda assim loga e redireciona pra /area/vitrine/
// home) — por isso um valor fixo/qualquer no campo _token é suficiente.
const LOGIN_URL = "https://membros.acropoleplay.com/auth/login";
const DESTINO_URL = "https://membros.acropoleplay.com/area/vitrine/home";
const CAMPO_EMAIL = "Acesso[email]";
const CAMPO_SENHA = "Acesso[senha]";
const CAMPO_TOKEN = "_token";
const JANELA_NOME = "acropoleplay_login";

/**
 * Monta e submete um form escondido no PRÓPRIO navegador do membro — é o
 * navegador dele que precisa logar de verdade, não o nosso servidor (cookie
 * de sessão é por domínio, não dá pra "transferir" de outro jeito).
 *
 * Achado ao vivo 2026-10-08: o login em si funciona (a sessão fica
 * autenticada de verdade), mas a resposta deles pra um POST vindo de outro
 * domínio às vezes renderiza uma tela de "erro inesperado" em vez do
 * redirecionamento normal — confirmado que é só cosmético, porque clicar em
 * "ir pra página inicial" nessa tela de erro já leva pro vitrine logado.
 * Contorno: abrir uma janela NOMEADA (não um "_blank" anônimo), mandar o
 * form de login pra ela, e depois de um respiro forçar essa MESMA janela a
 * navegar pro destino certo — `.location` cross-origin pode ser setado
 * mesmo sem poder ser lido, então isso funciona sem violar same-origin.
 */
export function autoSubmeterLoginAcropolePlay(email: string, senha: string) {
  const janela = window.open("", JANELA_NOME);

  const form = document.createElement("form");
  form.method = "POST";
  form.action = LOGIN_URL;
  form.target = JANELA_NOME;

  const campos: [string, string][] = [
    [CAMPO_TOKEN, "portal-na"],
    [CAMPO_EMAIL, email],
    [CAMPO_SENHA, senha],
  ];
  for (const [nome, valor] of campos) {
    const campo = document.createElement("input");
    campo.type = "hidden";
    campo.name = nome;
    campo.value = valor;
    form.appendChild(campo);
  }

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);

  setTimeout(() => {
    if (janela && !janela.closed) janela.location.href = DESTINO_URL;
  }, 1800);
}
