"use client";

import { marcarTourConcluido } from "@/lib/actions/misc-request-actions";
import { Calendar, Coffee, Compass, Wallet, X } from "lucide-react";
import { useState, useTransition } from "react";

const PASSOS = [
  {
    icon: Compass,
    titulo: "Bem-vindo ao Portal!",
    texto: "Em poucos passos, mostramos onde encontrar o que você mais vai usar por aqui.",
  },
  {
    icon: Wallet,
    titulo: "Nunca mais esqueça de pagar",
    texto: 'Ative o "Débito Automático" na tela de contribuição — depois de autorizar uma vez, sua mensalidade é cobrada sozinha todo mês.',
  },
  {
    icon: Coffee,
    titulo: "Carteira Fortuna",
    texto: "Recarregue sua carteira da lanchonete direto pelo Portal e evite fila na hora do lanche.",
  },
  {
    icon: Calendar,
    titulo: "Fique por dentro",
    texto: "Veja a agenda da sua turma, eventos da escola e vote nas enquetes — tudo atualizado em tempo real.",
  },
];

/**
 * Tour guiado do 1º login — decisão do usuário 2026-09-28. Mostrado só
 * quando Member.tourCompletedAt é null (ver member-portal-client.tsx).
 * Overlay próprio (não BottomSheet) de propósito: não queremos fechar sem
 * querer clicando fora/Escape no meio do tour.
 */
export function OnboardingTour({ memberId, onFechar }: { memberId: string; onFechar: () => void }) {
  const [passo, setPasso] = useState(0);
  const [isPending, startTransition] = useTransition();
  const ultimo = passo === PASSOS.length - 1;
  const { icon: Icon, titulo, texto } = PASSOS[passo];

  function concluir() {
    startTransition(async () => {
      await marcarTourConcluido(memberId);
      onFechar();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5 backdrop-blur-[2px]">
      <div className="relative w-full max-w-[360px] rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-gray-900">
        <button onClick={concluir} disabled={isPending} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
          <X size={18} />
        </button>

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-na-green-light dark:bg-emerald-950/40">
          <Icon size={26} className="text-na-green-dark dark:text-emerald-400" />
        </div>

        <h2 className="mb-2 text-base font-bold text-na-green-dark dark:text-emerald-400">{titulo}</h2>
        <p className="mb-6 text-[13px] text-gray-600 dark:text-gray-400">{texto}</p>

        <div className="mb-4 flex items-center justify-center gap-1.5">
          {PASSOS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === passo ? "w-5 bg-na-green" : "w-1.5 bg-gray-200 dark:bg-gray-700"}`} />
          ))}
        </div>

        <div className="flex gap-2">
          {!ultimo && (
            <button onClick={concluir} disabled={isPending} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-[13px] font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
              Pular
            </button>
          )}
          <button
            onClick={() => (ultimo ? concluir() : setPasso((p) => p + 1))}
            disabled={isPending}
            className="flex-1 rounded-xl bg-na-green px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
          >
            {ultimo ? "Começar" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
