"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "na-theme";
const listeners = new Set<() => void>();

// Fonte externa = a classe "dark" na <html> (setada pelo script inline de
// layout.tsx antes da hidratação, ou por setDark() abaixo). useSyncExternalStore
// lida sozinho com o caso "servidor não sabe o tema real" — usa
// getServerSnapshot no HTML inicial e troca pro valor real do cliente logo
// após montar, sem precisar de setState dentro de useEffect (o padrão mais
// óbvio aqui causaria "cascading renders", pego pelo eslint).
function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

function setDark(next: boolean) {
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  } catch {
    /* localStorage indisponível (modo privado etc.) — tema simplesmente não persiste */
  }
  listeners.forEach((l) => l());
}

export function ThemeToggle({ className }: { className?: string }) {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <button
      type="button"
      onClick={() => setDark(!isDark)}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo noturno"}
      title={isDark ? "Modo claro" : "Modo noturno"}
      className={
        className ??
        "flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      }
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
