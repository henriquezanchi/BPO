"use client";

import { meusPedidosDeDeclaracao, pedirMinhaDeclaracao, type MeuPedido } from "@/lib/actions/declaracao-actions";
import { FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

/**
 * Declaração de matrícula pedida pelo próprio aluno (pedido do usuário 06/11/2026). A Escolástica prepara com os
 * dados do Mercúrio e entrega pelo Portal (o aluno imprime ou salva em PDF) ou assinada, para retirar na secretaria.
 */
export function MinhasDeclaracoes() {
  const [pedidos, setPedidos] = useState<MeuPedido[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [finalidade, setFinalidade] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, iniciar] = useTransition();

  useEffect(() => {
    meusPedidosDeDeclaracao().then(setPedidos).catch(() => setPedidos([]));
  }, []);

  const emPreparo = pedidos?.some((p) => p.situacao === "preparando");

  function pedir() {
    setMsg(null);
    iniciar(async () => {
      const r = await pedirMinhaDeclaracao(finalidade);
      if (!r.ok) return setMsg({ ok: false, texto: r.error });
      setMsg({ ok: true, texto: "Pedido enviado à secretaria. Avisamos aqui e no celular quando ficar pronta." });
      setAberto(false);
      setFinalidade("");
      setPedidos(await meusPedidosDeDeclaracao());
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
          <FileText size={17} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Declaração de matrícula</h3>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">Para o trabalho, a faculdade ou o que precisar. A secretaria prepara com os dados da escola.</p>
        </div>
      </div>

      {pedidos === null ? (
        <Loader2 size={16} className="animate-spin text-gray-400" />
      ) : (
        pedidos.length > 0 && (
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {pedidos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
                <span className="min-w-0 text-gray-700 dark:text-gray-300">
                  Pedida em {dia(p.pedidoEm)}
                  {p.finalidade && <span className="text-gray-500"> · {p.finalidade}</span>}
                </span>
                {p.situacao === "preparando" && <span className="text-[12px] font-semibold text-amber-700 dark:text-amber-400">Em preparo</span>}
                {p.situacao === "retirar" && <span className="text-[12px] font-semibold text-na-green-dark dark:text-emerald-400">Pronta para retirar na secretaria</span>}
                {p.situacao === "no_portal" && (
                  <Link href={`/portal/declaracao/${p.id}`} className="text-[12px] font-semibold text-na-green-dark underline dark:text-emerald-400">
                    Abrir e imprimir
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      {msg && <p className={`rounded-lg px-3 py-2 text-[13px] ${msg.ok ? "bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"}`}>{msg.texto}</p>}

      {!emPreparo &&
        (aberto ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">Para que é a declaração? (opcional)</span>
              <input
                value={finalidade}
                onChange={(e) => setFinalidade(e.target.value)}
                maxLength={200}
                placeholder="Ex.: comprovação junto ao empregador"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={pedir} disabled={enviando} className="flex items-center gap-2 rounded-lg bg-na-green px-3 py-2 text-sm font-semibold text-white hover:bg-na-green-dark disabled:opacity-50">
                {enviando && <Loader2 size={14} className="animate-spin" />} Enviar pedido
              </button>
              <button type="button" onClick={() => setAberto(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAberto(true)} className="self-start rounded-lg border border-na-green px-3 py-2 text-sm font-semibold text-na-green-dark dark:text-emerald-400">
            Pedir declaração
          </button>
        ))}
    </section>
  );
}
