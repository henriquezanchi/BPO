/**
 * Versão do app Android (Trusted Web Activity em android/). Mantenha igual a android/app/build.gradle.
 * O APK abre o site em /portal?apk=<versionCode>; o site guarda esse número no aparelho e, quando ele fica menor
 * que APK_VERSION_CODE, mostra o aviso de atualização (src/components/member/aviso-atualizacao-app.tsx).
 * Versões 1.0 a 1.2 abriam sem o parâmetro: para elas o número guardado é 0 e o aviso aparece na primeira abertura.
 */
export const APK_VERSION_CODE = 5;
export const APK_VERSAO = "1.4";
export const APK_CAMINHO = "/app/portal-nova-acropole.apk";

/** Chaves no localStorage do aparelho. */
export const CHAVE_APP_ANDROID = "na-app-android"; // "1" quando o site já foi aberto pelo APK neste aparelho
export const CHAVE_APK_VERSAO = "na-apk-versao"; // último versionCode visto na URL de abertura
export const CHAVE_APK_AVISO_DISPENSADO = "na-apk-aviso-dispensado"; // versionCode cujo aviso a pessoa fechou

let sinaisRegistrados = false;
/**
 * Guarda no aparelho que o site foi aberto pelo APK (só no navegador). O APK abre /portal?apk=<versionCode>; o Android
 * manda o referrer "android-app://<pacote>" na primeira navegação (APKs 1.0 a 1.2, sem o parâmetro). Chamar antes de
 * qualquer leitura de abertoPeloApp(); é barato e roda uma vez por carregamento.
 */
export function registrarSinaisApp() {
  if (sinaisRegistrados || typeof window === "undefined") return;
  sinaisRegistrados = true;
  try {
    const apk = new URLSearchParams(window.location.search).get("apk");
    if (apk && /^\d+$/.test(apk)) {
      localStorage.setItem(CHAVE_APP_ANDROID, "1");
      localStorage.setItem(CHAVE_APK_VERSAO, apk);
    } else if (document.referrer.startsWith("android-app://")) {
      localStorage.setItem(CHAVE_APP_ANDROID, "1");
      if (!localStorage.getItem(CHAVE_APK_VERSAO)) localStorage.setItem(CHAVE_APK_VERSAO, "0");
    }
  } catch {
    /* sem localStorage: sem sinal */
  }
}

/** Este aparelho abre o Portal pelo APK Android (sinal guardado por registrarSinaisApp). */
export function abertoPeloApp(): boolean {
  registrarSinaisApp();
  try {
    return localStorage.getItem(CHAVE_APP_ANDROID) === "1";
  } catch {
    return false;
  }
}
