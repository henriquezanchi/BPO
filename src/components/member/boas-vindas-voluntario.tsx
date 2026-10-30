"use client";

import type { BoasVindasVoluntario as Dados } from "@/lib/boas-vindas-voluntario";
import { ChevronRight, FileSignature, HandHeart, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Boas-vindas do novo voluntário (pedido do usuário 2026-10-29): no próximo acesso depois da liberação, agradece,
 * mostra as áreas em que a pessoa foi indicada, o que ela pode fazer no Portal do Voluntário e orienta a assinar o termo com a filial.
 * Some de vez quando a pessoa chega ao fim (por liberação, neste aparelho); "Ver depois" fecha só nesta sessão.
 * Os dados vêm de lib/boas-vindas-voluntario.ts.
 */
const CHAVE = (memberId: string, liberacao: string) => `na-boas-vindas-vol:${memberId}:${liberacao}`;

export function BoasVindasVoluntario({ memberId, nome, dados }: { memberId: string; nome: string; dados: Dados }) {
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState(0);
  const primeiro = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const k = CHAVE(memberId, dados.chave);
        setAberto(!localStorage.getItem(k) && !sessionStorage.getItem(k));
      } catch {
        setAberto(true);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [memberId, dados.chave]);

  useEffect(() => {
    if (!aberto) return;
    primeiro.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, passo]);

  function fechar(definitivo: boolean) {
    try {
      (definitivo ? localStorage : sessionStorage).setItem(CHAVE(memberId, dados.chave), new Date().toISOString());
    } catch {
      /* sem armazenamento: aparece de novo no próximo acesso */
    }
    setAberto(false);
  }

  if (!aberto) return null;
  const ultimo = passo === 2;
  const botao = "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => fechar(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="boas-vindas-titulo"
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92dvh] w-full max-w-[440px] flex-col overflow-y-auto rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px] dark:bg-gray-900"
      >
        <button onClick={() => fechar(false)} aria-label="Fechar" className="absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10">
          <X size={18} />
        </button>
        <header className="bg-gradient-to-br from-na-green-dark to-na-green px-6 pt-8 pb-6 text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-na-gold">
            {passo === 2 ? <FileSignature size={24} /> : <HandHeart size={24} />}
          </span>
          <p className="mt-4 text-[10px] font-bold tracking-wide text-na-gold uppercase">Portal do Voluntário · {passo + 1} de 3</p>
          <h2 id="boas-vindas-titulo" className="mt-1 text-[22px] leading-tight font-black text-balance">
            {passo === 0 ? `Obrigado, ${nome}!` : passo === 1 ? "O que você pode fazer aqui" : "Antes de começar"}
          </h2>
        </header>

        <div className="flex flex-col gap-4 px-6 py-5 text-[13px] leading-relaxed text-gray-700 dark:text-gray-300">
          {passo === 0 && (
            <>
              <p>
                Você agora faz parte do voluntariado da sua escola{dados.liberadoPor ? `, a convite de ${dados.liberadoPor}` : ""}. “Voluntário” é aquele que faz por força da Vontade, e é essa
                vontade que mantém a escola de pé.
              </p>
              <div>
                <p className="text-[11px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">Onde você foi indicado</p>
                {dados.areas.length ? (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {dados.areas.map((a) => (
                      <li key={a} className="rounded-full bg-na-green-light px-3 py-1 text-[12px] font-semibold text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
                        {a}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1">A Direção da filial vai combinar com você as áreas em que vai atuar.</p>
                )}
              </div>
            </>
          )}

          {passo === 1 && (
            <>
              <p>
                No topo do Portal, toque em <strong>Área do Voluntário</strong>. Lá ficam os seus grupos, secretarias e encontros{dados.oQueFazer.length ? ", e também:" : "."}
              </p>
              {dados.oQueFazer.length > 0 && (
                <ul className="flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
                  {dados.oQueFazer.map((d) => (
                    <li key={d.rotulo} className="px-3.5 py-2.5">
                      <span className="block font-semibold text-gray-900 dark:text-gray-100">{d.rotulo}</span>
                      <span className="block text-[12px] text-gray-500 dark:text-gray-400">{d.descricao}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[12px] text-gray-500 dark:text-gray-400">Avisos, escalas e encontros dos seus grupos também aparecem aqui no Portal e nas notificações.</p>
            </>
          )}

          {passo === 2 && (
            <>
              <p>
                O serviço voluntário começa pelo <strong>Termo de Adesão ao Serviço Voluntário</strong>. Procure a secretaria ou a Direção da sua filial para assinar: em papel, com duas
                testemunhas, ou pelo gov.br.
              </p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400">Se você já assinou na filial, está tudo pronto. O texto do termo fica na Área do Voluntário, em Termo de voluntariado.</p>
            </>
          )}
        </div>

        <footer className="flex flex-col gap-2 px-6 pb-6">
          {!ultimo ? (
            <button ref={primeiro} onClick={() => setPasso(passo + 1)} className={`${botao} bg-na-green text-white hover:bg-na-green-dark`}>
              Continuar <ChevronRight size={16} />
            </button>
          ) : (
            <Link href="/voluntario" onClick={() => fechar(true)} className={`${botao} bg-na-green text-white hover:bg-na-green-dark`}>
              Ir para a Área do Voluntário <ChevronRight size={16} />
            </Link>
          )}
          <button onClick={passo === 0 ? () => fechar(false) : () => setPasso(passo - 1)} className={`${botao} text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800`}>
            {passo === 0 ? "Ver depois" : "Voltar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
