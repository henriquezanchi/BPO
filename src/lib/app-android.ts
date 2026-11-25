/**
 * Versão do app Android (Trusted Web Activity em android/). Mantenha igual a android/app/build.gradle.
 * O APK abre o site em /portal?apk=<versionCode>; o site guarda esse número no aparelho e, quando ele fica menor
 * que APK_VERSION_CODE, mostra o aviso de atualização (src/components/member/aviso-atualizacao-app.tsx).
 * Versões 1.0 a 1.2 abriam sem o parâmetro: para elas o número guardado é 0 e o aviso aparece na primeira abertura.
 */
export const APK_VERSION_CODE = 4;
export const APK_VERSAO = "1.3";
export const APK_CAMINHO = "/app/portal-nova-acropole.apk";

/** Chaves no localStorage do aparelho. */
export const CHAVE_APP_ANDROID = "na-app-android"; // "1" quando o site já foi aberto pelo APK neste aparelho
export const CHAVE_APK_VERSAO = "na-apk-versao"; // último versionCode visto na URL de abertura
export const CHAVE_APK_AVISO_DISPENSADO = "na-apk-aviso-dispensado"; // versionCode cujo aviso a pessoa fechou
