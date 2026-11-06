import type { AlertaCadastro } from "@/lib/mercurio-db/resumo-filial";
import { AlertTriangle } from "lucide-react";

const O_QUE_FAZER: Record<AlertaCadastro["tipo"], string> = {
  turma_conclusao_vencida: "Atualize no Mercúrio a previsão de conclusão (ou encerre a turma, se já concluiu).",
  ativo_sem_turma: "Inclua o aluno na turma certa no Mercúrio.",
  sem_canal_entrada: "Pergunte como a pessoa conheceu a escola e registre no Mercúrio: é o que mostra à direção onde vale investir.",
};

/**
 * Cadastro a corrigir no Mercúrio (pedido do usuário 06/11/2026), do resumo diário da filial (resumo-filial.ts). Some
 * sozinho no dia seguinte à correção, quando o resumo é refeito.
 */
export function AlertasCadastro({ alertas, geradoEm }: { alertas: AlertaCadastro[]; geradoEm: Date }) {
  if (!alertas.length) return null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
      <h2 className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
        <AlertTriangle size={16} /> Cadastro a corrigir no Mercúrio
      </h2>
      {alertas.map((a) => (
        <details key={a.tipo} className="rounded-xl bg-white p-3 text-[13px] dark:bg-gray-900">
          <summary className="cursor-pointer font-semibold text-gray-900 dark:text-gray-100">
            {a.titulo} <span className="ml-1 rounded-full bg-amber-100 px-2 text-[12px] text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">{a.itens.length}</span>
          </summary>
          <p className="mt-2 text-[12px] text-gray-600 dark:text-gray-400">{O_QUE_FAZER[a.tipo]}</p>
          <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-auto">
            {a.itens.map((i) => (
              <li key={`${i.matricula ?? ""}-${i.nome}`} className="flex flex-wrap justify-between gap-2 border-t border-gray-100 pt-1 dark:border-gray-800">
                <span className="text-gray-800 dark:text-gray-200">
                  {i.nome}
                  {i.matricula && <span className="text-gray-500"> · {i.matricula}</span>}
                </span>
                {i.detalhe && <span className="text-[12px] text-gray-500 dark:text-gray-400">{i.detalhe}</span>}
              </li>
            ))}
          </ul>
        </details>
      ))}
      <p className="text-[11px] text-amber-800/80 dark:text-amber-300/70">
        Conferido no Mercúrio em {geradoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}. Depois de corrigir, some no resumo do dia seguinte.
      </p>
    </section>
  );
}
