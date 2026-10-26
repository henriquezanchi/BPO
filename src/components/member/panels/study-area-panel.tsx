"use client";

import { BookOpen, BookOpenText, Clapperboard, PlaySquare } from "lucide-react";

/** Acrópole Play e Apostilas só aparecem se a filial liberou (ver recursos-filial.ts). */
export function StudyAreaPanel({
  mostrarAcropolePlay = false,
  mostrarBiblioteca = false,
}: {
  mostrarAcropolePlay?: boolean;
  /** Apostilas: aceito e ignorado até haver conteúdo (o botão foi escondido em 26/10/2026). */
  mostrarApostilas?: boolean;
  /** Só membros (2º nível em diante); N1 e programa complementar não veem. */
  mostrarBiblioteca?: boolean;
}) {

  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <BookOpen size={32} className="text-na-gold-dark" />
      <div>
        <div className="mb-1 text-[15px] font-semibold text-gray-900 dark:text-gray-100">Área de Estudos</div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Bons estudos!</p>
      </div>

      <div className="flex w-full flex-col gap-2.5">
        {mostrarAcropolePlay && (
        <a
          href="/api/portal/acropole-play/entrar"
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green-dark px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <Clapperboard size={16} /> Acrópole Play — vídeos e séries
        </a>
        )}
        {mostrarBiblioteca && (
          <a
            href="https://bastiao.oinabn.com.br/"
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <BookOpenText size={16} /> Acessar Biblioteca
          </a>
        )}
        {/* Apostilas: botão escondido até haver conteúdo (26/10/2026; antes só dizia "em breve"). `mostrarApostilas` fica para quando houver. */}
        <a
          href="https://www.youtube.com/novaacropole"
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <PlaySquare size={16} /> Canal da Nova Acrópole no YouTube
        </a>
      </div>
    </div>
  );
}
