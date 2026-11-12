"use client";

import { escolherRepasseCartao } from "@/lib/actions/cobranca-online-actions";
import { TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";

/** Escolha da taxa do cartão (Economia → Cobrança on-line). O exemplo usa a taxa real da conta Asaas da filial. */
export function RepasseCartao(p: { schoolId: string; repassa: boolean; exemplo: { base: number; comTaxa: number; taxa: number } | null }) {
  const [repassa, setRepassa] = useState(p.repassa);
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const escolher = (v: boolean) => {
    if (v === repassa) return;
    const antes = repassa;
    setRepassa(v);
    iniciar(async () => {
      const r = await escolherRepasseCartao(p.schoolId, v);
      if (!r.ok) {
        setRepassa(antes);
        setErro(r.error);
      } else setErro("");
    });
  };

  const opcao = (v: boolean, titulo: string, texto: string) => (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${repassa === v ? "border-na-green bg-na-green-light/60 dark:border-emerald-600 dark:bg-emerald-950/40" : "border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"}`}
    >
      <input type="radio" name={`cartao-${p.schoolId}`} checked={repassa === v} onChange={() => escolher(v)} disabled={pendente} className="mt-1 accent-na-green" />
      <span className="grid gap-0.5">
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{titulo}</span>
        <span className="text-[13px] text-gray-600 dark:text-gray-400">{texto}</span>
      </span>
    </label>
  );

  return (
    <div className="grid gap-2" aria-busy={pendente}>
      {opcao(
        false,
        "A escola absorve a taxa",
        p.exemplo
          ? `O aluno paga no cartão o mesmo que no Pix (${brl(p.exemplo.base)}); a taxa de cerca de ${brl(p.exemplo.taxa)} sai da parte da escola.`
          : "O aluno paga no cartão o mesmo que no Pix; a taxa sai da parte da escola.",
      )}
      {opcao(
        true,
        "Repassar a taxa ao aluno",
        p.exemplo
          ? `O aluno paga ${brl(p.exemplo.comTaxa)} no cartão em vez de ${brl(p.exemplo.base)}; a escola recebe o valor cheio.`
          : "O valor no cartão fica maior que no Pix; a escola recebe o valor cheio.",
      )}
      {repassa && (
        <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Repassar a taxa deixa o cartão mais caro para o aluno e aumenta a chance de atraso e inadimplência.
        </p>
      )}
      {erro && <p role="alert" className="text-[13px] text-red-700 dark:text-red-400">{erro}</p>}
    </div>
  );
}
