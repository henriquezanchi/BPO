"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CHAVE_DISPENSADO = "na-install-prompt-dispensado";
const listeners = new Set<() => void>();

// Mesmo padrão de theme-toggle.tsx (useSyncExternalStore em vez de
// setState dentro de useEffect pra ler estado do navegador — o padrão
// óbvio de useEffect+setState é pego pelo eslint como "cascading renders").
function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshotDispensado(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || localStorage.getItem(CHAVE_DISPENSADO) === "1";
}
function getServerSnapshotDispensado(): boolean {
  return true; // esconde até o cliente confirmar — evita flash e mismatch de hidratação
}

function getSnapshotIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}
function getServerSnapshotIOS(): boolean {
  return false;
}

function marcarDispensado() {
  try {
    localStorage.setItem(CHAVE_DISPENSADO, "1");
  } catch {
    /* localStorage indisponível (modo privado etc.) — só não persiste, sem quebrar a UI */
  }
  listeners.forEach((l) => l());
}

/**
 * Banner de instalação do PWA — decisão do usuário 2026-09-28 (só a parte
 * de instalabilidade, sem notificação push). Android/Chrome dá o evento
 * `beforeinstallprompt` pra gente controlar o botão; iOS Safari não tem
 * esse evento (Apple não implementa), então mostra instrução manual
 * (compartilhar > adicionar à tela de início) só nesse caso.
 */
export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const dispensado = useSyncExternalStore(subscribe, getSnapshotDispensado, getServerSnapshotDispensado);
  const isIOS = useSyncExternalStore(subscribe, getSnapshotIOS, getServerSnapshotIOS);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstalar() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setPromptEvent(null);
  }

  if (dispensado || (!promptEvent && !isIOS)) return null;

  return (
    <div className="mx-4 mb-3 flex items-start gap-2.5 rounded-xl border border-na-green/30 bg-na-green-light p-3 text-left dark:border-emerald-900 dark:bg-emerald-950/30">
      <Download size={16} className="mt-0.5 shrink-0 text-na-green-dark dark:text-emerald-400" />
      <div className="flex-1">
        <p className="text-[12px] font-semibold text-na-green-dark dark:text-emerald-400">Instale o Portal no seu celular</p>
        {isIOS ? (
          <p className="text-[11px] text-gray-600 dark:text-gray-400">
            Toque em compartilhar <span aria-hidden>⎋</span> e depois em &quot;Adicionar à Tela de Início&quot;.
          </p>
        ) : (
          <button onClick={handleInstalar} className="mt-1 text-[11px] font-semibold text-na-green underline dark:text-emerald-400">
            Instalar agora
          </button>
        )}
      </div>
      <button onClick={marcarDispensado} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
        <X size={14} />
      </button>
    </div>
  );
}
