"use client";

import { estadoDoDiarioHoje } from "@/lib/actions/diario-actions";
import { Flame, Moon, Sunrise } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Fechadura desenhada (o diário é um lugar fechado, que só a própria pessoa abre). */
function Fechadura({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 32" aria-hidden className={className}>
      <circle cx="12" cy="10" r="6.5" fill="currentColor" />
      <path d="M8.2 13.5h7.6L18 29H6z" fill="currentColor" />
    </svg>
  );
}

type Estado = Awaited<ReturnType<typeof estadoDoDiarioHoje>>;

/**
 * Cartão "Meu diário" no quadro do GAF (pedido do usuário 2026-10-29): noite e ouro em vez do laranja, com a situação
 * de hoje (Prólogo, Epílogo, Fogo Interno) antes de abrir. Ao tocar, duas portas se abrem sobre uma fechadura acesa,
 * como a entrada de um lugar secreto, e só então o diário abre. Quem prefere menos movimento entra direto.
 */
export function EntradaDiario() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado | undefined>(undefined);
  const [abrindo, setAbrindo] = useState(false);

  useEffect(() => {
    router.prefetch("/diario");
    estadoDoDiarioHoje().then(setEstado, () => setEstado(null));
  }, [router]);

  function entrar() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return router.push("/diario");
    setAbrindo(true);
    setTimeout(() => router.push("/diario"), 1700);
  }

  const marca = (feito: boolean | undefined, Icone: typeof Sunrise, rotulo: string) => (
    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${feito ? "border-na-gold/60 text-na-gold" : "border-white/15 text-white/45"}`}>
      <Icone size={11} /> {rotulo} {feito ? "feito" : "a fazer"}
    </span>
  );

  return (
    <>
      <button
        type="button"
        onClick={entrar}
        className="group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border border-na-gold/30 bg-[radial-gradient(120%_140%_at_0%_0%,#0d4a41_0%,#06231f_45%,#020d0b_100%)] p-3.5 text-left shadow-[inset_0_0_0_1px_rgb(255_202_0/0.06)] transition hover:border-na-gold/60"
      >
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-na-gold/50 bg-black/30">
          <Fechadura className="h-5 w-5 text-na-gold transition group-hover:[filter:drop-shadow(0_0_8px_rgb(255_202_0/0.8))]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold tracking-wide text-white">Meu diário</span>
          <span className="block text-[11px] text-white/60">Um lugar onde só a sua consciência entra.</span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {estado === undefined ? (
              <span className="text-[10px] text-white/40">…</span>
            ) : (
              <>
                {marca(estado?.prologo, Sunrise, "Prólogo")}
                {marca(estado?.epilogo, Moon, "Epílogo")}
                {!!estado?.sequencia && (
                  <span className="flex items-center gap-1 rounded-full border border-na-gold/40 px-2 py-0.5 text-[10px] font-semibold text-na-gold">
                    <Flame size={11} /> {estado.sequencia} {estado.sequencia === 1 ? "dia" : "dias"}
                  </span>
                )}
              </>
            )}
          </span>
        </span>
      </button>

      {abrindo &&
        createPortal(
          <div role="status" aria-label="Abrindo o seu diário" className="diario-animado fixed inset-0 z-[200] overflow-hidden bg-[#020d0b] [animation:diario-fundo_250ms_ease-out] [perspective:1200px]">
            {/* Luz que aparece quando as portas se abrem. */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgb(255_202_0/0.55)_0%,rgb(255_202_0/0.12)_30%,transparent_60%)] opacity-0 [animation:diario-luz_900ms_ease-out_650ms_forwards]" />
            {/* As duas portas, com friso dourado e a fechadura no encontro delas. */}
            <div className="absolute inset-y-0 left-0 w-1/2 origin-left border-r border-na-gold/50 bg-[linear-gradient(90deg,#03140f,#0a3a33)] [animation:diario-porta-esquerda_1000ms_cubic-bezier(.6,0,.2,1)_600ms_forwards] [backface-visibility:hidden]" />
            <div className="absolute inset-y-0 right-0 w-1/2 origin-right border-l border-na-gold/50 bg-[linear-gradient(270deg,#03140f,#0a3a33)] [animation:diario-porta-direita_1000ms_cubic-bezier(.6,0,.2,1)_600ms_forwards] [backface-visibility:hidden]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
              <Fechadura className="h-14 w-10 text-na-gold [animation:diario-fechadura_900ms_ease-in-out_infinite]" />
              <p className="px-6 text-center text-[13px] font-semibold text-na-gold uppercase opacity-0 [animation:diario-palavras_900ms_ease-out_500ms_forwards]">
                Só a sua consciência entra aqui
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
