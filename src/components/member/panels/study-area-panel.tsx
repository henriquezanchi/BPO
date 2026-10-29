"use client";

import { BookOpen, BookOpenText, Castle, Clapperboard, Library, NotebookPen, PlaySquare } from "lucide-react";
import Link from "next/link";

/** Acrópole Play e Apostilas só aparecem se a filial liberou (ver recursos-filial.ts). */
export function StudyAreaPanel({
  mostrarAcropolePlay = false,
  mostrarBastioes = false,
}: {
  mostrarAcropolePlay?: boolean;
  /** Apostilas: aceito e ignorado até haver conteúdo (o botão foi escondido em 26/10/2026). */
  mostrarApostilas?: boolean;
  /** Bastiões: só membros (2º nível em diante, FV, HD, dirigentes, provacionistas); N1 e programa complementar não veem. */
  mostrarBastioes?: boolean;
}) {

  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <BookOpen size={32} className="text-na-gold-dark" />
      <div>
        <div className="mb-1 text-[15px] font-semibold text-gray-900 dark:text-gray-100">Área de Estudos</div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Bons estudos!</p>
      </div>

      <div className="flex w-full flex-col gap-2.5">
        {/* Ferramentas de estudo do próprio aluno (2026-10-29): anotações das aulas e livros. O diário fica no GAF. */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: "/estudos/anotacoes", icone: <NotebookPen size={18} />, rotulo: "Anotações das aulas" },
            { href: "/estudos/livros", icone: <Library size={18} />, rotulo: "Meus livros" },
          ].map((f) => (
            <Link key={f.href} href={f.href} className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 px-2 py-3 text-[11px] font-semibold text-gray-800 transition hover:border-na-green hover:bg-na-green-light/40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-emerald-950/30">
              <span className="text-na-green dark:text-emerald-400">{f.icone}</span>
              {f.rotulo}
            </Link>
          ))}
        </div>
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
        {/* Biblioteca da Nova Acrópole Brasil, para todos (29/10/2026; antes o botão levava ao Bastiões, só para membros). */}
        <a
          href="https://biblioteca.acropolebrasil.com.br/"
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <BookOpenText size={16} /> Acessar Biblioteca
        </a>
        {mostrarBastioes && (
          <a
            href="https://bastiao.oinabn.com.br/"
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Castle size={16} /> Bastiões (Membros)
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
