"use client";

import { ativarQuiosque, desligarQuiosque } from "@/lib/actions/cafe-actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Área do Café → quiosque da lanchonete (23/11/2026; lib/quiosque.ts): ativar este aparelho e desligar os antigos. */
export function AtivarQuiosque(p: { aparelhos: { id: string; nome: string; ativadoPor: string; em: string }[] }) {
  const [caixa, setCaixa] = useState("");
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900" aria-labelledby="quiosque-h">
      <h2 id="quiosque-h" className="text-base font-black text-gray-900 dark:text-gray-100">Quiosque da lanchonete</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Deixe um computador ou tablet no balcão: cada aluno procura o nome, confirma com os 4 primeiros números do CPF, marca o que pegou e paga com o
        saldo. Para ativar, abra o Portal <b>no aparelho do quiosque</b>, informe o número do caixa no Fortuna e toque no botão.
      </p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          iniciar(async () => {
            const r = await ativarQuiosque(Number(caixa));
            if (r.ok) router.push("/quiosque");
            else setErro(r.error);
          });
        }}
      >
        <input value={caixa} onChange={(e) => setCaixa(e.target.value.replace(/\D/g, ""))} inputMode="numeric" required placeholder="Número do caixa no Fortuna" aria-label="Número do caixa no Fortuna" className="min-h-10 flex-1 rounded-lg border border-gray-300 px-3 dark:border-gray-700 dark:bg-gray-950" />
        <button type="submit" disabled={pendente} className="min-h-10 rounded-lg bg-na-green px-4 font-bold text-white disabled:opacity-60">
          Usar este aparelho como quiosque
        </button>
      </form>
      {erro && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{erro}</p>}
      <p className="text-xs text-gray-500">Sem aparelho? O QR do caixa (abaixo) abre o mesmo autoatendimento no celular do aluno. Para ver como fica, abra <a href="/quiosque?demo=1" className="underline">a demonstração do quiosque</a>.</p>
      {p.aparelhos.length > 0 && (
        <ul className="grid gap-1 text-sm">
          {p.aparelhos.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-1 dark:border-gray-800">
              <span>
                {a.nome} · ativado por {a.ativadoPor.replace(/\s*\(.*\)$/, "")} em {new Date(a.em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </span>
              <button type="button" disabled={pendente} onClick={() => iniciar(async () => { await desligarQuiosque(a.id); router.refresh(); })} className="text-xs font-semibold text-red-700 underline dark:text-red-400">
                Desligar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
