"use client";

import { Clapperboard, ChevronRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Acesso rápido no topo do Portal (pedido do usuário 2026-10-29). Conta quantas vezes a pessoa abre cada quadro, no
 * próprio aparelho (localStorage; nada vai ao servidor), e destaca o mais usado. Contribuição perto do vencimento
 * tem prioridade (decidido em member-portal-client). Sem nada para destacar: a frase do dia, alternando com o Acrópole
 * Play, e os próximos eventos.
 */
const CHAVE = (memberId: string) => `na-uso:${memberId}`;
const JANELA_MS = 30 * 864e5;
const MINIMO = 4;

/** Quadros que contam juntos: contribuição, situação e recarga do Fortuna são "Economia"; editar dados não conta. */
export function funcionalidadeDoModal(modal: string): string | null {
  if (["contribuicao", "situacao", "fortuna_recarga", "economia"].includes(modal)) return "economia";
  if (modal === "cadastro") return null;
  return modal;
}

export function registrarUso(memberId: string, modal: string) {
  const f = funcionalidadeDoModal(modal);
  if (!f) return;
  try {
    const usos = JSON.parse(localStorage.getItem(CHAVE(memberId)) ?? "{}") as Record<string, number[]>;
    const agora = Date.now();
    usos[f] = [...(usos[f] ?? []).filter((t) => agora - t < JANELA_MS), agora].slice(-50);
    localStorage.setItem(CHAVE(memberId), JSON.stringify(usos));
  } catch {
    /* sem localStorage (modo privado): sem acesso rápido por uso */
  }
}

/** O quadro mais aberto nos últimos 30 dias, se foi aberto pelo menos 4 vezes. */
export function funcionalidadeFavorita(memberId: string, disponiveis: string[]): string | null {
  try {
    const usos = JSON.parse(localStorage.getItem(CHAVE(memberId)) ?? "{}") as Record<string, number[]>;
    const agora = Date.now();
    const ranking = Object.entries(usos)
      .filter(([f]) => disponiveis.includes(f))
      .map(([f, ts]) => [f, ts.filter((t) => agora - t < JANELA_MS).length] as const)
      .filter(([, n]) => n >= MINIMO)
      .sort((a, b) => b[1] - a[1]);
    return ranking[0]?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Lido depois de montar (o servidor não conhece o localStorage). */
export function useFavorita(memberId: string, disponiveis: string[]) {
  const [favorita, setFavorita] = useState<string | null>(null);
  const chave = disponiveis.join(",");
  useEffect(() => {
    const t = setTimeout(() => setFavorita(funcionalidadeFavorita(memberId, chave.split(","))), 0);
    return () => clearTimeout(t);
  }, [memberId, chave]);
  return favorita;
}

type Evento = { id: string; titulo: string; data: Date };

/** Sem nada a destacar: frase do dia alternando com o Acrópole Play, e os próximos eventos. */
export function DestaqueDoDia({ frase, acropolePlay, eventos, abrirAgenda }: { frase: { texto: string; autor: string; obra: string | null }; acropolePlay: boolean; eventos: Evento[]; abrirAgenda: () => void }) {
  const [vez, setVez] = useState(0);
  useEffect(() => {
    if (!acropolePlay) return;
    const t = setInterval(() => setVez((v) => v + 1), 9000);
    return () => clearInterval(t);
  }, [acropolePlay]);
  const mostrarPlay = acropolePlay && vez % 2 === 1;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative min-h-[112px] overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <figure className={`absolute inset-0 flex flex-col justify-center px-5 py-4 text-center transition-opacity duration-700 ${mostrarPlay ? "pointer-events-none opacity-0" : "opacity-100"}`}>
          <blockquote className="text-[13px] leading-relaxed text-gray-700 italic dark:text-gray-300">“{frase.texto}”</blockquote>
          <figcaption className="mt-1 text-[11px] font-semibold text-gray-500">
            — {frase.autor}
            {frase.obra ? `, ${frase.obra}` : ""}
          </figcaption>
        </figure>
        {acropolePlay && (
          <a
            href="/api/portal/acropole-play/entrar"
            target="_blank"
            rel="noreferrer"
            tabIndex={mostrarPlay ? 0 : -1}
            className={`absolute inset-0 flex items-center gap-3 bg-gradient-to-br from-na-green-dark to-na-green px-5 text-white transition-opacity duration-700 ${mostrarPlay ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Clapperboard size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold tracking-wide text-na-gold uppercase">Acrópole Play</span>
              <span className="block text-[14px] leading-snug font-bold">Filosofia em vídeos e séries, quando quiser.</span>
              <span className="mt-0.5 block text-[11px] text-white/80">Assistir agora →</span>
            </span>
          </a>
        )}
      </div>
      {eventos.length > 0 && (
        <button onClick={abrirAgenda} className="flex flex-col gap-1.5 rounded-2xl border border-gray-200 bg-white p-3.5 text-left transition hover:border-na-gold dark:border-gray-800 dark:bg-gray-900">
          <span className="flex items-center justify-between text-[10px] font-bold tracking-wide text-na-green-dark uppercase dark:text-emerald-400">
            Próximos eventos <ChevronRight size={14} className="text-gray-400" />
          </span>
          {eventos.map((e) => (
            <span key={e.id} className="flex items-baseline gap-2 text-[12px]">
              <span className="w-11 shrink-0 font-bold text-gray-500 tabular-nums">{e.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
              <span className="truncate text-gray-800 dark:text-gray-200">{e.titulo}</span>
            </span>
          ))}
        </button>
      )}
    </div>
  );
}

/** Quadro mais usado, em tamanho grande. */
export function AtalhoFavorito({ icone, titulo, subtitulo, onClick }: { icone: ReactNode; titulo: string; subtitulo: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-na-green/30 bg-na-green-light/40 p-4 text-left transition hover:border-na-green dark:border-emerald-900 dark:bg-emerald-950/20">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-na-green text-white">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold tracking-wide text-na-green-dark uppercase dark:text-emerald-400">Acesso rápido</span>
        <span className="block text-[14px] font-bold text-gray-900 dark:text-gray-100">{titulo}</span>
        <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">{subtitulo}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-gray-400" />
    </button>
  );
}
