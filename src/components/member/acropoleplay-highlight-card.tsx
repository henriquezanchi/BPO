"use client";

import { gerarAutoLoginAcropolePlay } from "@/lib/actions/acropoleplay-actions";
import { getAcropolePlayHighlight } from "@/lib/actions/acropoleplay-highlight-actions";
import { abrirJanelaAcropolePlay, autoSubmeterLoginAcropolePlay } from "@/lib/acropoleplay-auto-login";
import { Clapperboard, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

/**
 * Card de divulgação da Acrópole Play (lançamento/série em destaque) —
 * pedido do usuário 2026-10-08: "sem poluir demais" — por isso fixo, 1 só,
 * sempre no mesmo lugar (não é pop-up). Some sozinho se não houver nenhum
 * destaque cadastrado (ver scripts/set-acropoleplay-highlight.ts).
 */
export function AcropolePlayHighlightCard({ memberId }: { memberId: string }) {
  const [highlight, setHighlight] = useState<Awaited<ReturnType<typeof getAcropolePlayHighlight>> | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getAcropolePlayHighlight().then(setHighlight);
  }, []);

  function handleAssistir() {
    const janela = abrirJanelaAcropolePlay();
    startTransition(async () => {
      const res = await gerarAutoLoginAcropolePlay(memberId);
      if (res.ok) {
        autoSubmeterLoginAcropolePlay(res.email, res.senha, janela);
      } else if (janela) {
        janela.location.href = "https://membros.acropoleplay.com/auth/login";
      }
    });
  }

  if (!highlight) return null;

  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-na-gold/40 bg-na-gold/10 p-3">
      {highlight.imagemUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- imagem vem de URL externa arbitrária (quem cadastra o destaque), sem domínio fixo pra configurar no next/image
        <img src={highlight.imagemUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[10px] font-bold text-na-gold-dark">
          <Clapperboard size={11} /> ACRÓPOLE PLAY
        </p>
        <p className="truncate text-[13px] font-bold text-gray-900 dark:text-gray-100">{highlight.titulo}</p>
        <p className="truncate text-[11px] text-gray-600 dark:text-gray-400">{highlight.descricao}</p>
      </div>
      <button
        onClick={handleAssistir}
        disabled={isPending}
        className="shrink-0 rounded-lg bg-na-green-dark px-3 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : "Assistir"}
      </button>
    </div>
  );
}
