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
 * Abre a aba/janela ANTES de qualquer await (chamar isso direto no onClick,
 * de forma síncrona) — navegador só trata window.open como ação confiável
 * do usuário quando ela acontece no mesmo tick do clique; esperar a busca
 * da credencial (Server Action) antes de abrir faz o Chrome tratar como
 * pop-up "não confiável", o que pode mudar como cookies de sessão são
 * aceitos na resposta (achado ao vivo 2026-10-08: tela de erro persistia
 * mesmo com os campos certos até isso ser corrigido).
 */
export function abrirJanelaAcropolePlay(): Window | null {
  return window.open("", JANELA_NOME);
}

/**
 * Monta e submete um form escondido NA JANELA JÁ ABERTA (ver
 * abrirJanelaAcropolePlay) — é o navegador do próprio membro que precisa
 * logar de verdade, não o nosso servidor (cookie de sessão é por domínio,
 * não dá pra "transferir" de outro jeito).
 *
 * Achado ao vivo 2026-10-08: o login em si funciona (a sessão fica
 * autenticada de verdade), mas a resposta deles pra um POST vindo de outro
 * domínio às vezes renderiza uma tela de "erro inesperado" em vez do
 * redirecionamento normal — confirmado que é só cosmético, porque clicar em
 * "ir pra página inicial" nessa tela de erro já leva pro vitrine logado.
 * Contorno: depois de um respiro, forçar essa MESMA janela a navegar pro
 * destino certo — `.location` cross-origin pode ser setado mesmo sem poder
 * ser lido, então isso funciona sem violar same-origin.
 */
export function autoSubmeterLoginAcropolePlay(email: string, senha: string, janela: Window | null) {
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
