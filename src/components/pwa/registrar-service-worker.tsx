"use client";

import { useEffect } from "react";

const CHAVE_RECARGA = "na-recarga-chunk";

function pareceChunkPerdido(texto: string) {
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(texto);
}

/** Manda o erro para o servidor (aparece no registro da Vercel). Nada de dados pessoais: só mensagem, URL e navegador. */
function reportar(tipo: string, mensagem: string, pilha?: string) {
  try {
    const corpo = JSON.stringify({ tipo, mensagem: mensagem.slice(0, 500), pilha: pilha?.slice(0, 1500), url: location.pathname, ua: navigator.userAgent.slice(0, 200) });
    if (!navigator.sendBeacon?.("/api/erro-cliente", new Blob([corpo], { type: "application/json" }))) {
      fetch("/api/erro-cliente", { method: "POST", body: corpo, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {
    /* sem rede: paciência */
  }
}

/**
 * Registra o service worker do PWA (public/sw.js) em todas as páginas e, desde 25/11/2026 (relato "vários botões não
 * acionam nada, sem erro"), ouve os erros de JavaScript da página: manda ao servidor e, se for pedaço do site que
 * sumiu depois de uma publicação (ChunkLoadError), recarrega a página uma vez.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((e) => console.error("Service worker não registrado:", e));
    }
    function recarregarSePossivel() {
      try {
        const ultima = Number(sessionStorage.getItem(CHAVE_RECARGA) ?? "0");
        if (Date.now() - ultima < 60_000) return;
        sessionStorage.setItem(CHAVE_RECARGA, String(Date.now()));
      } catch {
        /* sem sessionStorage: recarrega mesmo assim */
      }
      location.reload();
    }
    const aoErro = (e: ErrorEvent) => {
      const msg = e.message || String(e.error ?? "");
      reportar("error", msg, e.error?.stack);
      if (pareceChunkPerdido(msg + " " + (e.error?.stack ?? ""))) recarregarSePossivel();
    };
    const aoRejeicao = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      const msg = r instanceof Error ? r.message : String(r);
      reportar("rejeicao", msg, r instanceof Error ? r.stack : undefined);
      if (pareceChunkPerdido(msg + " " + (r instanceof Error ? r.stack ?? "" : ""))) recarregarSePossivel();
    };
    window.addEventListener("error", aoErro);
    window.addEventListener("unhandledrejection", aoRejeicao);
    return () => {
      window.removeEventListener("error", aoErro);
      window.removeEventListener("unhandledrejection", aoRejeicao);
    };
  }, []);
  return null;
}
