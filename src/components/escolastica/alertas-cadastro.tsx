import type { AlertaCadastro } from "@/lib/mercurio-db/resumo-filial";
import { AlertTriangle } from "lucide-react";
import { AcoesDoAlerta } from "@/components/escolastica/botao-ja-corrigi";
import { chaveDoItem } from "@/lib/alertas/corrigidos";

/** Passo a passo de cada correção (06/11/2026). Os nomes exatos dos botões do Mercúrio podem variar. */
const PASSOS: Record<AlertaCadastro["tipo"], string[]> = {
  turma_conclusao_vencida: [
    "Confirme com o instrutor se a turma continua ou já concluiu.",
    "No Mercúrio, abra o cadastro das turmas da filial e a turma da lista.",
    "Se continua: atualize a previsão de conclusão. Se concluiu: passe os alunos para a turma seguinte e encerre a turma.",
    "Volte aqui e toque em “Já corrigi”.",
  ],
  ativo_sem_turma: [
    "Copie a matrícula e, no Mercúrio, abra a lista de Ativos da filial e a ficha do aluno.",
    "Confira o nível e informe a turma em que ele assiste às aulas. Se a turma não existir no Mercúrio, peça à direção para criá-la antes.",
    "Salve a ficha, volte aqui e toque em “Já corrigi”.",
  ],
  sem_canal_entrada: [
    "Pergunte à pessoa como conheceu a escola (contato pessoal, redes sociais, internet, propaganda, palestra...).",
    "Copie a matrícula e, no Mercúrio, abra a ficha da pessoa na lista de Ativos.",
    "Preencha o campo de como conheceu a escola (mídia de ingresso), salve, volte aqui e toque em “Já corrigi”.",
  ],
};

const O_QUE_FAZER: Record<AlertaCadastro["tipo"], string> = {
  turma_conclusao_vencida: "Atualize no Mercúrio a previsão de conclusão (ou encerre a turma, se já concluiu).",
  ativo_sem_turma: "Inclua o aluno na turma certa no Mercúrio.",
  sem_canal_entrada: "Pergunte como a pessoa conheceu a escola e registre no Mercúrio: é o que mostra à direção onde vale investir.",
};

/**
 * Cadastro a corrigir no Mercúrio (pedido do usuário 06/11/2026), do resumo diário da filial (resumo-filial.ts). Some
 * sozinho no dia seguinte à correção, quando o resumo é refeito. "Já corrigi" esconde o item até o próximo resumo
 * (lib/alertas/corrigidos.ts): se a correção não pegou, ele volta.
 */
export function AlertasCadastro({
  alertas: todos,
  geradoEm,
  schoolId,
  escondidos,
}: {
  alertas: AlertaCadastro[];
  geradoEm: Date;
  schoolId: string;
  escondidos: Set<string>;
}) {
  const alertas = todos.map((a) => ({ ...a, itens: a.itens.filter((i) => !escondidos.has(chaveDoItem(a.tipo, i))) })).filter((a) => a.itens.length);
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
          <details className="mt-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
            <summary className="cursor-pointer text-[12px] font-semibold text-na-green-dark dark:text-emerald-400">Como corrigir no Mercúrio</summary>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[12px] text-gray-700 dark:text-gray-300">
              {PASSOS[a.tipo].map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </details>
          <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-auto">
            {a.itens.map((i) => (
              <li key={`${i.matricula ?? ""}-${i.nome}`} className="flex flex-wrap justify-between gap-2 border-t border-gray-100 pt-1 dark:border-gray-800">
                <span className="text-gray-800 dark:text-gray-200">
                  {i.nome}
                  {i.matricula && <span className="text-gray-500"> · {i.matricula}</span>}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {i.detalhe && <span className="text-[12px] text-gray-500 dark:text-gray-400">{i.detalhe}</span>}
                  <AcoesDoAlerta schoolId={schoolId} chave={chaveDoItem(a.tipo, i)} matricula={i.matricula || undefined} />
                </span>
              </li>
            ))}
          </ul>
        </details>
      ))}
      <p className="text-[11px] text-amber-800/80 dark:text-amber-300/70">
        Conferido no Mercúrio em {geradoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}. O que você marcar como corrigido some agora; se a correção não aparecer no Mercúrio até o resumo seguinte, o item volta.
      </p>
    </section>
  );
}
