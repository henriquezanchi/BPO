import type { CanalEntrada, Permanencia } from "@/lib/mercurio-db/resumo-filial";

const pct = (p: Permanencia) => (p.base ? Math.round((p.ficaram / p.base) * 100) : null);

/** Barra + número: quanto dos que entraram por esse canal ficaram N meses. Sem base suficiente, só um traço. */
function Ficou({ p }: { p: Permanencia }) {
  const v = pct(p);
  if (v === null) return <span className="text-gray-400 dark:text-gray-500">—</span>;
  return (
    <span className="flex items-center justify-end gap-2" title={`${p.ficaram} de ${p.base}`}>
      <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-gray-100 sm:block dark:bg-gray-800">
        <span className="block h-full rounded-full bg-[#009485] dark:bg-[#16a090]" style={{ width: `${v}%` }} />
      </span>
      <span className="w-9 text-right tabular-nums">{v}%</span>
    </span>
  );
}

/**
 * De onde vêm os alunos (pedido do usuário 06/11/2026): entradas dos últimos 36 meses pelo canal registrado no
 * Mercúrio ("como conheceu a escola") e quantos ficaram 6 e 12 meses. Ajuda a decidir onde investir nas aberturas.
 */
export function CanaisDeEntrada({ canais }: { canais: CanalEntrada[] }) {
  const total = canais.reduce((s, c) => s + c.entraram, 0);
  if (!total) return <p className="text-[12px] text-gray-500 dark:text-gray-400">Nenhuma entrada nos últimos 3 anos.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="text-[10px] text-gray-500 uppercase dark:text-gray-400">
            <tr>
              <th className="py-1 pr-2 font-semibold">Como conheceu</th>
              <th className="py-1 pr-2 text-right font-semibold">Entraram</th>
              <th className="py-1 pr-2 text-right font-semibold">Ativos</th>
              <th className="py-1 pr-2 text-right font-semibold">Ficaram 6 m</th>
              <th className="py-1 text-right font-semibold">Ficaram 12 m</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 dark:text-gray-300">
            {canais.map((c) => (
              <tr key={c.canal} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1.5 pr-2">{c.canal}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {c.entraram} <span className="text-gray-400 dark:text-gray-500">({Math.round((c.entraram / total) * 100)}%)</span>
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{c.ativos}</td>
                <td className="py-1.5 pr-2">
                  <Ficou p={c.m6} />
                </td>
                <td className="py-1.5">
                  <Ficou p={c.m12} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Entradas dos últimos 3 anos, pelo que foi registrado no Mercúrio. &quot;Ficaram 6 m&quot; só conta quem entrou há mais de 6 meses (o mesmo para 12). Passe o
        mouse no percentual para ver os números.
      </p>
    </div>
  );
}
