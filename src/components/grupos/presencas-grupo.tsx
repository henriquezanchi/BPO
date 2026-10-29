"use client";

import { marcarPresencasDoEncontro, relatorioPresencas } from "@/lib/actions/grupos-actions";
import { Download, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

type Pessoa = { id: string; name: string };
type Encontro = { id: string; startsAt: string; status: string; presencas: { memberId: string; participou: boolean; motivo: string | null }[] };
type Relatorio = Extract<Awaited<ReturnType<typeof relatorioPresencas>>, { ok: true }>;

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

function periodos() {
  const hoje = new Date();
  const a = hoje.getFullYear();
  const m = hoje.getMonth();
  const inicioMes = (ano: number, mes: number) => dia(new Date(ano, mes, 1, 12));
  const fimMes = (ano: number, mes: number) => dia(new Date(ano, mes + 1, 0, 12));
  return [
    { rotulo: "Este mês", de: inicioMes(a, m), ate: dia(hoje) },
    { rotulo: "Mês passado", de: inicioMes(a, m - 1), ate: fimMes(a, m - 1) },
    { rotulo: "Últimos 3 meses", de: inicioMes(a, m - 2), ate: dia(hoje) },
    { rotulo: "Últimos 6 meses", de: inicioMes(a, m - 5), ate: dia(hoje) },
    { rotulo: "Este ano", de: `${a}-01-01`, ate: dia(hoje) },
  ];
}

/** Presença no GAF (pedido do usuário 2026-10-29): a coordenação marca quem veio e tira o relatório por período. */
export function PresencasGrupo({ grupoId, pessoas, passados, recarregar }: { grupoId: string; pessoas: Pessoa[]; passados: Encontro[]; recarregar: () => void }) {
  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-gray-100 pt-4 dark:border-gray-800">
      <div>
        <h3 className="mb-2 text-[12px] font-bold text-gray-500 uppercase dark:text-gray-400">Marcar presença</h3>
        {passados.filter((e) => e.status !== "cancelada").length ? (
          <ul className="flex flex-col gap-2">
            {passados
              .filter((e) => e.status !== "cancelada")
              .map((e) => (
                <MarcarEncontro key={e.id} encontro={e} pessoas={pessoas} recarregar={recarregar} />
              ))}
          </ul>
        ) : (
          <p className="text-[12px] text-gray-500 dark:text-gray-400">Nenhum encontro realizado ainda.</p>
        )}
      </div>
      <RelatorioPresencas grupoId={grupoId} />
    </div>
  );
}

function MarcarEncontro({ encontro, pessoas, recarregar }: { encontro: Encontro; pessoas: Pessoa[]; recarregar: () => void }) {
  const [marcados, setMarcados] = useState(() => new Set(encontro.presencas.filter((p) => p.participou).map((p) => p.memberId)));
  const [aviso, setAviso] = useState("");
  const [pendente, iniciar] = useTransition();
  const presentes = encontro.presencas.filter((p) => p.participou).length;
  return (
    <li className="rounded-xl border border-gray-200 dark:border-gray-700">
      <details>
        <summary className="cursor-pointer p-3 text-[13px]">
          <span className="font-semibold capitalize">{quando(encontro.startsAt)}</span>
          <span className="text-gray-500 dark:text-gray-400"> · {presentes} de {pessoas.length} presentes</span>
        </summary>
        <div className="flex flex-col gap-1 border-t border-gray-100 p-3 dark:border-gray-800">
          {pessoas.map((p) => {
            const justificou = encontro.presencas.find((x) => x.memberId === p.id && !x.participou && x.motivo);
            return (
              <label key={p.id} className="flex items-start gap-2 rounded-lg px-1 py-1 text-[13px] hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <input
                  type="checkbox"
                  checked={marcados.has(p.id)}
                  onChange={(e) =>
                    setMarcados((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(p.id);
                      else n.delete(p.id);
                      return n;
                    })
                  }
                  className="mt-0.5 size-4 accent-na-green"
                />
                <span>
                  {p.name}
                  {justificou && <span className="block text-[11px] text-gray-500 dark:text-gray-400">Justificou: {justificou.motivo}</span>}
                </span>
              </label>
            );
          })}
          <button
            disabled={pendente}
            onClick={() =>
              iniciar(async () => {
                const r = await marcarPresencasDoEncontro(encontro.id, pessoas.map((p) => ({ memberId: p.id, participou: marcados.has(p.id) })));
                setAviso(r.ok ? "Presença salva." : r.error);
                if (r.ok) recarregar();
              })
            }
            className="mt-2 flex items-center justify-center gap-2 self-start rounded-lg bg-na-green px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {pendente && <Loader2 size={13} className="animate-spin" />} Salvar presença
          </button>
          {aviso && <p className="text-[12px] text-gray-600 dark:text-gray-300">{aviso}</p>}
        </div>
      </details>
    </li>
  );
}

function RelatorioPresencas({ grupoId }: { grupoId: string }) {
  const opcoes = periodos();
  const [de, setDe] = useState(opcoes[0].de);
  const [ate, setAte] = useState(opcoes[0].ate);
  const [rel, setRel] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const gerar = (d = de, a = ate) =>
    iniciar(async () => {
      const r = await relatorioPresencas(grupoId, d, a);
      if (!r.ok) return setErro(r.error);
      setErro(null);
      setRel(r);
    });
  const baixar = () => {
    if (!rel) return;
    const linhas = [["Nome", "Presenças", "Encontros", "%", "Faltas justificadas", "Faltas", "Sem registro"], ...rel.pessoas.map((p) => [p.nome, p.presentes, rel.encontros.length, p.percentual ?? "", p.justificadas, p.faltas, p.semRegistro])];
    const csv = "﻿" + linhas.map((l) => l.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `presencas-${de}-a-${ate}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[12px] font-bold text-gray-500 uppercase dark:text-gray-400">Relatório de presenças</h3>
      <div className="flex flex-wrap gap-1.5">
        {opcoes.map((o) => (
          <button
            key={o.rotulo}
            onClick={() => {
              setDe(o.de);
              setAte(o.ate);
              gerar(o.de, o.ate);
            }}
            className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${de === o.de && ate === o.ate ? "border-na-green bg-na-green text-white" : "border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300"}`}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2 text-[12px]">
        <label className="flex flex-col gap-0.5">
          De
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-800" />
        </label>
        <label className="flex flex-col gap-0.5">
          Até
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-800" />
        </label>
        <button disabled={pendente} onClick={() => gerar()} className="flex items-center gap-1.5 rounded-lg bg-na-green px-3 py-1.5 font-semibold text-white disabled:opacity-50">
          {pendente && <Loader2 size={12} className="animate-spin" />} Gerar
        </button>
        {rel && (
          <button onClick={baixar} className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300">
            <Download size={12} /> Planilha (CSV)
          </button>
        )}
      </div>
      {erro && <p className="text-[12px] text-na-danger-dark dark:text-red-300">{erro}</p>}
      {rel && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="bg-gray-50 px-3 py-2 text-[12px] text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
            {rel.encontros.length} {rel.encontros.length === 1 ? "encontro realizado" : "encontros realizados"} no período
          </p>
          <table className="w-full text-left text-[12px]">
            <thead className="text-[11px] text-gray-500 uppercase dark:text-gray-400">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-2 py-2 text-right">Presença</th>
                <th className="px-2 py-2 text-right">Justif.</th>
                <th className="px-2 py-2 text-right">Faltas</th>
                <th className="px-2 py-2 text-right">Sem reg.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rel.pessoas.map((p) => (
                <tr key={p.memberId}>
                  <td className="px-3 py-2">
                    {p.nome}
                    {p.coordenacao && <span className="text-[10px] text-gray-500"> · coordenação</span>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {p.presentes}/{rel.encontros.length}
                    {p.percentual !== null && <span className="text-gray-500"> ({p.percentual}%)</span>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{p.justificadas}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{p.faltas}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{p.semRegistro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
