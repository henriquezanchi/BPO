"use client";

import { APK_CAMINHO, APK_VERSAO, APK_VERSION_CODE, CHAVE_APK_AVISO_DISPENSADO, CHAVE_APK_VERSAO, abertoPeloApp } from "@/lib/app-android";
import { RefreshCw, X } from "lucide-react";
import { useSyncExternalStore } from "react";

/**
 * Aviso "nova versão do app" para quem abre o Portal pelo APK Android (25/11/2026).
 * O APK abre /portal?apk=<versionCode> e o Android manda o referrer "android-app://<pacote>" na primeira navegação.
 * Guardamos os dois sinais no aparelho; se o número guardado for menor que a versão atual, o aviso aparece.
 * Quem usa pelo navegador nunca tem o sinal do APK e não vê nada. Não depende de push.
 */
const ouvintes = new Set<() => void>();
function assinar(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

function lerMostrar(): boolean {
  try {
    if (!abertoPeloApp()) return false;
    const versao = Number(localStorage.getItem(CHAVE_APK_VERSAO) ?? "0");
    if (versao >= APK_VERSION_CODE) return false;
    return Number(localStorage.getItem(CHAVE_APK_AVISO_DISPENSADO) ?? "0") < APK_VERSION_CODE;
  } catch {
    return false;
  }
}

function dispensar() {
  try {
    localStorage.setItem(CHAVE_APK_AVISO_DISPENSADO, String(APK_VERSION_CODE));
  } catch {
    /* ignora */
  }
  ouvintes.forEach((f) => f());
}

export function AvisoAtualizacaoApp() {
  const mostrar = useSyncExternalStore(assinar, lerMostrar, () => false);
  if (!mostrar) return null;
  return (
    <div
      role="status"
      className="mx-5 mt-4 flex rounded-2xl border border-na-green/30 bg-na-green-light px-4 py-3 text-na-green-dark dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <RefreshCw size={16} className="shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 text-[13px] font-bold">Nova versão do app ({APK_VERSAO})</p>
          <button type="button" onClick={dispensar} aria-label="Fechar aviso" className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full opacity-70 hover:opacity-100">
            <X size={18} />
          </button>
        </div>
        <p className="text-[12px] opacity-90">Correções e melhorias. Instale por cima da atual: nada se perde.</p>
        <a
          href={APK_CAMINHO}
          download
          onClick={dispensar}
          className="flex min-h-11 w-full items-center justify-center rounded-xl bg-na-green px-3 text-[13px] font-bold text-white sm:w-auto sm:self-start"
        >
          Baixar a versão {APK_VERSAO}
        </a>
      </div>
    </div>
  );
}
