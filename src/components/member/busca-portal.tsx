"use client";

import { buscarFuncoesComIA } from "@/lib/actions/busca-actions";
import { buscarLocal, FUNCOES_PORTAL, normalizar, type FuncaoPortal } from "@/lib/busca-portal";
import { ChevronRight, Loader2, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/**
 * Campo de busca do Portal do Aluno (pedido do usuário 2026-10-29). Busca local instantânea; se ela não acha bem,
 * pede à IA, que escolhe só entre as funções que a pessoa tem (lib/busca-portal.ts, actions/busca-actions.ts).
 */
export type DestinoBusca = { abrir: () => void } | { href: string; externo?: boolean };

const ESPERA_IA_MS = 700;

export function BuscaPortal({ destinos }: { destinos: Record<string, DestinoBusca> }) {
  const [consulta, setConsulta] = useState("");
  const [ia, setIa] = useState<{ consulta: string; ids: string[] } | null>(null);
  const disponiveis = useMemo(() => FUNCOES_PORTAL.filter((f) => destinos[f.id]), [destinos]);
  const locais = useMemo(() => buscarLocal(consulta, disponiveis).slice(0, 5), [consulta, disponiveis]);
  const chave = normalizar(consulta);
  // Achou pelo título (ou por uma frase-chave): não precisa da IA.
  const precisaIa = chave.length >= 4 && !(locais[0]?.pontos >= 3);
  const iaDaConsulta = ia?.consulta === chave ? ia.ids : null;
  const procurando = precisaIa && iaDaConsulta === null;

  const ids = disponiveis.map((f) => f.id).join(",");
  useEffect(() => {
    if (!precisaIa) return;
    const t = setTimeout(() => {
      buscarFuncoesComIA(consulta, ids.split(","))
        .then((r) => setIa({ consulta: chave, ids: r }))
        .catch(() => setIa({ consulta: chave, ids: [] }));
    }, ESPERA_IA_MS);
    return () => clearTimeout(t);
  }, [precisaIa, chave, consulta, ids]);

  const sugeridos = (iaDaConsulta ?? []).map((id) => disponiveis.find((f) => f.id === id)).filter((f): f is FuncaoPortal => !!f && !locais.some((l) => l.funcao.id === f.id));
  const limpar = () => {
    setConsulta("");
    setIa(null);
  };

  return (
    <section role="search" className="flex flex-col gap-2">
      <label className="relative flex items-center">
        <Search size={16} className="pointer-events-none absolute left-3.5 text-gray-400" />
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && limpar()}
          maxLength={120}
          aria-label="Buscar no Portal"
          placeholder="O que você procura? Ex.: pagar a mensalidade"
          className="h-11 w-full rounded-2xl border border-gray-200 bg-white pr-10 pl-10 text-[13px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-na-green focus:ring-2 focus:ring-na-green-light dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
        />
        {consulta && (
          <button type="button" onClick={limpar} aria-label="Limpar a busca" className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={15} />
          </button>
        )}
      </label>

      {chave && (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" aria-live="polite">
          {locais.map(({ funcao }) => (
            <Resultado key={funcao.id} funcao={funcao} destino={destinos[funcao.id]} aoEscolher={limpar} />
          ))}
          {sugeridos.length > 0 && (
            <>
              <p className="flex items-center gap-1.5 border-t border-gray-100 px-3.5 pt-2.5 pb-1 text-[10px] font-bold tracking-wide text-na-gold-dark uppercase first:border-t-0 dark:border-gray-800 dark:text-amber-300">
                <Sparkles size={11} /> Talvez seja isto
              </p>
              {sugeridos.map((f) => (
                <Resultado key={f.id} funcao={f} destino={destinos[f.id]} aoEscolher={limpar} />
              ))}
            </>
          )}
          {procurando && (
            <p className="flex items-center gap-2 border-t border-gray-100 px-3.5 py-2.5 text-[12px] text-gray-500 first:border-t-0 dark:border-gray-800 dark:text-gray-400">
              <Loader2 size={13} className="animate-spin" /> Entendendo o que você procura…
            </p>
          )}
          {!procurando && !locais.length && !sugeridos.length && (
            <p className="px-3.5 py-3 text-[12px] text-gray-500 dark:text-gray-400">
              Não achei nada parecido. Tente outras palavras{destinos.whatsapp ? " ou fale com a secretaria pelo WhatsApp" : ""}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Resultado({ funcao, destino, aoEscolher }: { funcao: FuncaoPortal; destino: DestinoBusca; aoEscolher: () => void }) {
  const conteudo = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-gray-900 dark:text-gray-100">{funcao.titulo}</span>
        <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">{funcao.descricao}</span>
      </span>
      <ChevronRight size={15} className="shrink-0 text-gray-400" />
    </>
  );
  const classe = "flex w-full items-center gap-3 border-t border-gray-100 px-3.5 py-2.5 text-left first:border-t-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60";
  if ("abrir" in destino)
    return (
      <button
        type="button"
        onClick={() => {
          aoEscolher();
          destino.abrir();
        }}
        className={classe}
      >
        {conteudo}
      </button>
    );
  if (destino.externo)
    return (
      <a href={destino.href} target="_blank" rel="noreferrer" onClick={aoEscolher} className={classe}>
        {conteudo}
      </a>
    );
  return (
    <Link href={destino.href} onClick={aoEscolher} className={classe}>
      {conteudo}
    </Link>
  );
}
