import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { APK_CAMINHO, APK_VERSAO } from "@/lib/app-android";

/**
 * Página pública de download do app (23/11/2026). Android: APK (Trusted Web Activity, projeto em android/, gerado por
 * scripts/gerar-apk.ts). iPhone: não há APK; o Portal é instalado pelo Safari ("Adicionar à Tela de Início").
 */
export const metadata: Metadata = { title: "Baixar o app · Portal Nova Acrópole" };

const APK = APK_CAMINHO;

export default function BaixarApp() {
  const passo = "grid grid-cols-[1.75rem_1fr] gap-3 text-sm text-gray-700 dark:text-gray-300";
  const num = "flex size-7 items-center justify-center rounded-full bg-na-green text-xs font-black text-white";
  return (
    <main className="flex min-h-screen justify-center bg-na-bg px-5 py-8 dark:bg-gray-950">
      <div className="grid w-full max-w-[420px] content-start gap-5">
        <div className="grid justify-items-center gap-3 rounded-[28px] border border-gray-200 bg-white p-6 text-center shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <Image src="/na-logo.png" alt="Nova Acrópole" width={160} height={104} className="h-auto w-32 dark:brightness-0 dark:invert" priority />
          <h1 className="text-lg font-black text-na-green-dark dark:text-emerald-400">Portal Nova Acrópole no celular</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Contribuição, carteira Fortuna, agenda e eventos da sua escola, com um toque.</p>
          <a href={APK} download className="mt-1 flex min-h-12 w-full items-center justify-center rounded-2xl bg-na-green px-5 text-base font-bold text-white shadow-sm">
            Baixar para Android
          </a>
          <p className="text-xs text-gray-500">Versão {APK_VERSAO} · arquivo de 0,5 MB · Android 5 ou mais novo. Já tem o app? Instale por cima: nada se perde.</p>
        </div>

        <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900" aria-labelledby="android-h">
          <h2 id="android-h" className="text-sm font-black text-gray-900 dark:text-gray-100">Como instalar no Android</h2>
          <div className={passo}><span className={num}>1</span><p>Toque em <b>Baixar para Android</b> e abra o arquivo quando o download terminar.</p></div>
          <div className={passo}><span className={num}>2</span><p>Se o celular pedir, permita <b>instalar apps desta fonte</b> (o navegador ou o gerenciador de arquivos) e volte.</p></div>
          <div className={passo}><span className={num}>3</span><p>Se aparecer um aviso do Play Protect, toque em <b>Mais detalhes → Instalar assim mesmo</b>. O app é do Portal e não fica na Play Store.</p></div>
          <div className={passo}><span className={num}>4</span><p>Abra o app <b>Nova Acrópole</b> e entre com o <b>login Acrópole</b>, usando o e-mail cadastrado na secretaria.</p></div>
        </section>

        <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900" aria-labelledby="iphone-h">
          <h2 id="iphone-h" className="text-sm font-black text-gray-900 dark:text-gray-100">No iPhone</h2>
          <div className={passo}><span className={num}>1</span><p>Abra o Portal no <b>Safari</b>.</p></div>
          <div className={passo}><span className={num}>2</span><p>Toque em <b>Compartilhar</b> (o quadrado com a seta) e depois em <b>Adicionar à Tela de Início</b>.</p></div>
        </section>

        <Link href="/portal" className="text-center text-sm font-semibold text-na-green underline dark:text-emerald-400">
          Prefiro usar pelo navegador
        </Link>
      </div>
    </main>
  );
}
