import type { Achado, Analise } from "@/lib/avaliacao-analise";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";

const ESTILO: Record<Achado["tom"], { icone: typeof Info; classe: string }> = {
  atencao: { icone: TriangleAlert, classe: "border-amber-200 bg-na-warning-light/60 text-na-warning-dark dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300" },
  neutro: { icone: Info, classe: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300" },
  positivo: { icone: CircleCheck, classe: "border-green-200 bg-na-success-light/60 text-na-success-dark dark:border-green-900 dark:bg-green-950/30 dark:text-green-300" },
};

/** Achados do cruzamento dos dados (avaliacao-analise.ts), do que pede ação ao que vai bem. */
export function ListaDeAchados({ achados, vazio }: { achados: Achado[]; vazio: string }) {
  if (!achados.length) return <p className="text-[12px] text-gray-500 dark:text-gray-400">{vazio}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {achados.map((a, i) => {
        const { icone: Icone, classe } = ESTILO[a.tom];
        return (
          <li key={i} className={`flex items-start gap-2 rounded-xl border p-3 ${classe}`}>
            <Icone size={15} className="mt-0.5 shrink-0" />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-gray-900 dark:text-gray-100">{a.titulo}</span>
              <span className="block text-[12px] text-gray-700 dark:text-gray-300">{a.texto}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const f1 = (x: number) => x.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Números de cabeça e o cruzamento da recomendação com as perguntas de escolha. */
export function NumerosECruzamentos({ analise }: { analise: Analise }) {
  const { nota, recomendacao, cruzamentos } = analise;
  const blocos = [
    nota && nota.escola !== null && { rotulo: "Nota média dos instrutores", valor: f1(nota.escola), detalhe: `escala ${nota.pergunta.min}–${nota.pergunta.max} · ${nota.total} avaliações` },
    recomendacao && recomendacao.escola !== null && { rotulo: "Recomendação da escola", valor: f1(recomendacao.escola), detalhe: `escala ${recomendacao.pergunta.min}–${recomendacao.pergunta.max} · ${recomendacao.total} respostas` },
    recomendacao && recomendacao.nps !== null && { rotulo: "NPS", valor: String(recomendacao.nps), detalhe: "de −100 a 100: quem indica menos quem critica" },
  ].filter(Boolean) as { rotulo: string; valor: string; detalhe: string }[];
  return (
    <div className="flex flex-col gap-3">
      {blocos.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {blocos.map((b) => (
            <div key={b.rotulo} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{b.rotulo}</p>
              <p className="text-2xl font-black text-na-green-dark tabular-nums dark:text-emerald-400">{b.valor}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{b.detalhe}</p>
            </div>
          ))}
        </div>
      )}
      {cruzamentos.length > 0 && recomendacao && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">Recomendação da escola conforme a resposta</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {cruzamentos.map((c) => {
              const max = recomendacao.pergunta.max ?? 10;
              return (
                <div key={c.pergunta.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                  <p className="mb-2 text-[12px] font-medium text-gray-800 dark:text-gray-200">{c.pergunta.texto}</p>
                  <ul className="flex flex-col gap-1">
                    {c.linhas.map((l) => (
                      <li key={l.opcao} className="flex items-center gap-2 text-[11px] text-gray-700 dark:text-gray-300">
                        <span className="w-28 shrink-0 truncate" title={l.opcao}>
                          {l.opcao}
                        </span>
                        <span className="h-2 flex-1 rounded bg-gray-100 dark:bg-gray-800">
                          {l.media !== null && <span className="block h-2 rounded bg-na-green/70 dark:bg-emerald-500/70" style={{ width: `${(l.media / max) * 100}%` }} />}
                        </span>
                        <span className="w-16 shrink-0 text-right text-gray-500 tabular-nums dark:text-gray-400">{l.media !== null ? `${f1(l.media)} · ${l.total}` : `— · ${l.total}`}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">Média da recomendação entre quem deu cada resposta · número de respostas. Grupos com menos de 3 ficam sem média.</p>
        </div>
      )}
    </div>
  );
}
