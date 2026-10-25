"use client";
import { CartaoSecao } from "@/components/ui/cartao-secao";

import { alterarAcessoSubchefe } from "@/lib/actions/admin-filial-actions";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";

const AREAS: [string, string][] = [
  ["direcao", "Visão da filial"],
  ["escolastica", "Escolástica"],
  ["economia", "Economia"],
  ["eventos", "Eventos"],
  ["cafe", "Café"],
  ["admin", "Administração"],
];

/**
 * Sub-chefe tem por padrão tudo o que o chefe tem (pedido do usuário
 * 2026-10-19). Aqui o chefe retira, ou devolve, áreas específicas.
 */
export function AcessosSubchefe({ schoolId, subchefes }: { schoolId: string; subchefes: { id: string; nome: string; retiradas: string[] }[] }) {
  const [estado, setEstado] = useState(() => Object.fromEntries(subchefes.map((s) => [s.id, new Set(s.retiradas)])));
  const [emAndamento, setEmAndamento] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  function alternar(memberId: string, area: string) {
    const retirada = estado[memberId].has(area);
    const chave = `${memberId}:${area}`;
    setEmAndamento(chave);
    setErro(null);
    iniciar(async () => {
      const r = await alterarAcessoSubchefe(schoolId, memberId, area, retirada);
      setEmAndamento(null);
      if (!r.ok) return setErro(r.error);
      setEstado((e) => {
        const s = new Set(e[memberId]);
        if (retirada) s.delete(area);
        else s.add(area);
        return { ...e, [memberId]: s };
      });
    });
  }

  return (
    <CartaoSecao icone={ShieldCheck} titulo="Acessos do sub-chefe" descricao="O sub-chefe tem os mesmos acessos do chefe. Desmarque o que quiser retirar.">
      {subchefes.length === 0 ? (
        <p className="text-[12px] text-gray-500">Nenhum sub-chefe registrado no Mercúrio para esta filial.</p>
      ) : (
        subchefes.map((s) => (
          <div key={s.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
            <p className="mb-2 text-[13px] font-semibold text-gray-900 dark:text-gray-100">{s.nome}</p>
            <div className="flex flex-wrap gap-1.5">
              {AREAS.map(([area, rotulo]) => {
                const tem = !estado[s.id].has(area);
                return (
                  <button
                    key={area}
                    aria-pressed={tem}
                    disabled={emAndamento === `${s.id}:${area}`}
                    onClick={() => alternar(s.id, area)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold disabled:opacity-60 ${
                      tem ? "border-na-green bg-na-green text-white" : "border-gray-300 text-gray-500 line-through dark:border-gray-600"
                    }`}
                  >
                    {emAndamento === `${s.id}:${area}` && <Loader2 size={11} className="animate-spin" />} {rotulo}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
      {erro && <p className="text-[12px] text-na-danger-dark dark:text-red-400">{erro}</p>}
    </CartaoSecao>
  );
}
