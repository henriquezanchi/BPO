"use client";

import { marcarTourConcluido } from "@/lib/actions/misc-request-actions";
import { Calendar, Coffee, Compass, Wallet, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

const PASSOS = [
  {
    icon: Compass,
    titulo: "Bem-vindo ao Portal!",
    texto: "Em poucos passos, mostramos onde encontrar o que você mais vai usar por aqui.",
    alvo: "welcome",
  },
  {
    icon: Wallet,
    titulo: "Nunca mais esqueça de pagar",
    texto: 'Toque em "Ver Situação" e ative o "Débito Automático" — depois de autorizar uma vez, sua mensalidade é cobrada sozinha todo mês.',
    alvo: "contribuicao-status",
  },
  {
    icon: Coffee,
    titulo: "Carteira Fortuna",
    texto: "Recarregue sua carteira da lanchonete direto por aqui e evite fila na hora do lanche.",
    alvo: "fortuna",
  },
  {
    icon: Calendar,
    titulo: "Fique por dentro",
    texto: "Veja a agenda da sua turma, eventos da escola e vote nas enquetes — tudo atualizado em tempo real.",
    alvo: "agenda",
  },
] as const;

interface RetanguloAlvo {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
/** Aproximação generosa da altura do cartão de texto — só usada pra decidir se ele cabe embaixo do alvo sem estourar a tela. */
const ALTURA_ESTIMADA_TOOLTIP = 260;

/**
 * Tour guiado do 1º login — decisão do usuário 2026-09-28, aprimorado
 * 2026-09-30 pra apontar (spotlight) pro elemento real da tela que cada
 * passo descreve, em vez de só texto solto — os alvos são elementos com
 * `data-tour-id` marcados em member-portal-client.tsx (welcome,
 * contribuicao-status, fortuna, agenda). Sem lib nova: o "furo" no overlay
 * escuro é só um `box-shadow` gigante em volta de um retângulo do tamanho
 * do elemento (técnica de spotlight sem SVG/mask), e o texto é
 * posicionado com `position: fixed` + `transform` acima/abaixo do alvo,
 * sem precisar saber a altura real do cartão de antemão.
 */
export function OnboardingTour({ memberId, onFechar }: { memberId: string; onFechar: () => void }) {
  const [passo, setPasso] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [alvo, setAlvo] = useState<RetanguloAlvo | null>(null);
  const ultimo = passo === PASSOS.length - 1;
  const { icon: Icon, titulo, texto, alvo: alvoId } = PASSOS[passo];

  useEffect(() => {
    // setAlvo só é chamado de dentro de medir() (via setTimeout/listener),
    // nunca síncrono no corpo do efeito — exigência do lint
    // react-hooks/set-state-in-effect (mesmo padrão já usado em
    // transparencia-panel.tsx/install-prompt.tsx nesta sessão).
    const medir = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour-id="${alvoId}"]`);
      if (!el) {
        setAlvo(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setAlvo({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    document.querySelector<HTMLElement>(`[data-tour-id="${alvoId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });

    // Espera o scroll suave assentar antes de medir a posição final.
    const timer = setTimeout(medir, 350);
    window.addEventListener("resize", medir);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", medir);
    };
  }, [alvoId]);

  function concluir() {
    startTransition(async () => {
      await marcarTourConcluido(memberId);
      onFechar();
    });
  }

  const abaixoDoAlvo = alvo ? alvo.top + alvo.height + ALTURA_ESTIMADA_TOOLTIP < window.innerHeight : true;

  return (
    <div className="fixed inset-0 z-50">
      {alvo ? (
        <div
          className="fixed rounded-2xl transition-all duration-300"
          style={{
            top: alvo.top - PADDING,
            left: alvo.left - PADDING,
            width: alvo.width + PADDING * 2,
            height: alvo.height + PADDING * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.68)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/68" />
      )}

      <div
        className="fixed w-[calc(100%-2.5rem)] max-w-[340px] rounded-3xl bg-white p-5 text-center shadow-2xl dark:bg-gray-900"
        style={
          alvo
            ? {
                left: "50%",
                top: abaixoDoAlvo ? alvo.top + alvo.height + PADDING + 14 : alvo.top - PADDING - 14,
                transform: abaixoDoAlvo ? "translateX(-50%)" : "translateX(-50%) translateY(-100%)",
              }
            : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
        }
      >
        <button onClick={concluir} disabled={isPending} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
          <X size={18} />
        </button>

        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-na-green-light dark:bg-emerald-950/40">
          <Icon size={22} className="text-na-green-dark dark:text-emerald-400" />
        </div>

        <h2 className="mb-2 text-[15px] font-black text-na-green-dark dark:text-emerald-400">{titulo}</h2>
        <p className="mb-5 text-[13px] text-gray-600 dark:text-gray-400">{texto}</p>

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
