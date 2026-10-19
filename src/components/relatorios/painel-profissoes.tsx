"use client";

import type { AreaDaUnidade, Par, ResumoProfissoes } from "@/lib/mercurio-db/resumo-profissoes";
import { AREAS, type Area } from "@/lib/profissoes";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { useMemo, useState } from "react";

const REGIOES: Record<string, string> = { RCO: "Centro-Oeste", RNN: "Norte e Nordeste" };
// Áreas sem informação útil ficam no fim da lista, em cinza.
const SEM_AREA: Area[] = ["Serviço público (área não identificada)", "Outras", "Não informada"];
// Validado com o validador de paleta (claro e escuro) — mesma cor do Relatório da Filial.
const COR_BARRA = "bg-[#009485] dark:bg-[#16a090]";
const COR_NEUTRA = "bg-gray-400 dark:bg-gray-500";

type Agregado = { total: number; profissoes: Map<string, number>; orgaos: Map<string, number>; peloOrgao: number };

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(n / d < 0.1 ? 1 : 0).replace(".", ",")}%` : "0%");

function somarEm(mapa: Map<string, number>, origem: Record<string, Par> | undefined, i: 0 | 1) {
  for (const [k, v] of Object.entries(origem ?? {})) if (v[i]) mapa.set(k, (mapa.get(k) ?? 0) + v[i]);
}

function agregar(dados: ResumoProfissoes, unidades: string[], i: 0 | 1) {
  const porArea = new Map<Area, Agregado>();
  for (const u of unidades) {
    for (const [area, d] of Object.entries(dados.porUnidade[u] ?? {}) as [Area, AreaDaUnidade][]) {
      if (!d.total[i]) continue;
      const a = porArea.get(area) ?? { total: 0, profissoes: new Map(), orgaos: new Map(), peloOrgao: 0 };
      a.total += d.total[i];
      a.peloOrgao += d.peloOrgao?.[i] ?? 0;
      somarEm(a.profissoes, d.profissoes, i);
      somarEm(a.orgaos, d.orgaos, i);
      porArea.set(area, a);
    }
  }
  return porArea;
}

const maiores = (m: Map<string, number>, n: number) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);

function Segmento<T extends string>({ valor, opcoes, onChange, rotulo }: { valor: T; opcoes: [T, string][]; onChange: (v: T) => void; rotulo: string }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
      {opcoes.map(([v, r]) => (
        <button
          key={v}
          role="radio"
          aria-checked={valor === v}
          onClick={() => onChange(v)}
          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${valor === v ? "bg-na-green text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"}`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

const SELECT = "rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200";

/**
 * Profissões por área de atuação (pedido do usuário 2026-10-19). Mesmo
 * componente no Relatório da Filial (uma unidade) e no painel nacional
 * (todas, com filtro por região, estado e filial).
 */
export function PainelProfissoes({ dados, nacional }: { dados: ResumoProfissoes; nacional?: boolean }) {
  const [publico, setPublico] = useState<"ativos" | "membros">("ativos");
  const [regiao, setRegiao] = useState("");
  const [uf, setUf] = useState("");
  const [unidade, setUnidade] = useState("");
  const [aberta, setAberta] = useState<Area | null>(null);
  const i = publico === "ativos" ? 0 : 1;

  const ufs = useMemo(() => [...new Set(dados.unidades.filter((u) => !regiao || u.regiao === regiao).map((u) => u.uf))].filter(Boolean).sort(), [dados, regiao]);
  const unidadesFiltradas = useMemo(
    () => dados.unidades.filter((u) => (!regiao || u.regiao === regiao) && (!uf || u.uf === uf) && (!unidade || u.id === unidade)),
    [dados, regiao, uf, unidade],
  );
  const porArea = useMemo(() => agregar(dados, unidadesFiltradas.map((u) => u.id), i), [dados, unidadesFiltradas, i]);

  const total = [...porArea.values()].reduce((s, a) => s + a.total, 0);
  const naoInformada = porArea.get("Não informada")?.total ?? 0;
  const ordenadas = [...AREAS].filter((a) => !SEM_AREA.includes(a) && porArea.get(a)).sort((a, b) => porArea.get(b)!.total - porArea.get(a)!.total);
  const linhas = [...ordenadas, ...SEM_AREA.filter((a) => porArea.get(a))];
  const maior = Math.max(1, ...linhas.map((a) => porArea.get(a)!.total));
  const identificadas = ordenadas.reduce((s, a) => s + porArea.get(a)!.total, 0);

  const tabelaFiliais = useMemo(
    () =>
      unidadesFiltradas
        .map((u) => {
          const areas = agregar(dados, [u.id], i);
          const t = [...areas.values()].reduce((s, a) => s + a.total, 0);
          const top = [...areas].filter(([a]) => !SEM_AREA.includes(a)).sort((a, b) => b[1].total - a[1].total).slice(0, 3);
          return { u, t, top, semInfo: areas.get("Não informada")?.total ?? 0 };
        })
        .filter((l) => l.t > 0)
        .sort((a, b) => b.t - a.t),
    [dados, unidadesFiltradas, i],
  );

  function baixarCsv() {
    const cab = ["Filial", "UF", "Região", ...AREAS, "Total"];
    const corpo = unidadesFiltradas.map((u) => {
      const areas = agregar(dados, [u.id], i);
      const vals = AREAS.map((a) => areas.get(a)?.total ?? 0);
      return [u.nome, u.uf, REGIOES[u.regiao] ?? u.regiao, ...vals, vals.reduce((s, v) => s + v, 0)];
    });
    const csv = [cab, ...corpo].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    a.download = `profissoes-${publico}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmento
          rotulo="Público"
          valor={publico}
          onChange={setPublico}
          opcoes={[
            ["ativos", "Todos os ativos"],
            ["membros", "Membros (2º nível+)"],
          ]}
        />
        {nacional && (
          <>
            <select aria-label="Região" className={SELECT} value={regiao} onChange={(e) => (setRegiao(e.target.value), setUf(""), setUnidade(""))}>
              <option value="">Todas as regiões</option>
              {Object.entries(REGIOES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select aria-label="Estado" className={SELECT} value={uf} onChange={(e) => (setUf(e.target.value), setUnidade(""))}>
              <option value="">Todos os estados</option>
              {ufs.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select aria-label="Filial" className={SELECT} value={unidade} onChange={(e) => setUnidade(e.target.value)}>
              <option value="">Todas as filiais</option>
              {dados.unidades
                .filter((u) => (!regiao || u.regiao === regiao) && (!uf || u.uf === uf))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                    {u.uf ? ` (${u.uf})` : ""}
                  </option>
                ))}
            </select>
          </>
        )}
        <button onClick={baixarCsv} className="ml-auto flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          <Download size={12} /> Baixar planilha
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          [publico === "ativos" ? "Ativos" : "Membros", total.toLocaleString("pt-BR"), nacional ? `${tabelaFiliais.length} filiais` : null],
          ["Com área identificada", pct(identificadas, total), `${identificadas.toLocaleString("pt-BR")} pessoas`],
          ["Sem profissão no Mercúrio", pct(naoInformada, total), `${naoInformada.toLocaleString("pt-BR")} pessoas`],
        ].map(([r, v, d]) => (
          <div key={r} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">{r}</p>
            <p className="text-xl font-black text-gray-900 tabular-nums dark:text-gray-100">{v}</p>
            {d && <p className="text-[10px] text-gray-500 dark:text-gray-400">{d}</p>}
          </div>
        ))}
      </div>

      {total === 0 ? (
        <p className="text-[12px] text-gray-500 dark:text-gray-400">Ninguém neste recorte.</p>
      ) : (
        <ul className="flex flex-col">
          {linhas.map((area) => {
            const a = porArea.get(area)!;
            const neutra = SEM_AREA.includes(area);
            const expandida = aberta === area;
            return (
              <li key={area} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                <button
                  onClick={() => setAberta(expandida ? null : area)}
                  aria-expanded={expandida}
                  title={`${area}: ${a.total} (${pct(a.total, total)})`}
                  className="grid w-full grid-cols-[14px_1fr_auto] items-center gap-x-2 gap-y-1 py-1.5 text-left sm:grid-cols-[14px_minmax(0,17rem)_1fr_auto] text-[12px] text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50"
                >
                  {expandida ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                  <span className={`truncate ${neutra ? "text-gray-500 dark:text-gray-400" : ""}`}>{area}</span>
                  <span className="order-last col-span-2 col-start-2 flex h-3 items-center sm:order-none sm:col-span-1 sm:col-start-auto">
                    <span className={`h-2.5 rounded-r ${neutra ? COR_NEUTRA : COR_BARRA}`} style={{ width: `${(a.total / maior) * 100}%`, minWidth: 3 }} />
                  </span>
                  <span className="w-20 text-right tabular-nums">
                    {a.total.toLocaleString("pt-BR")} <span className="text-gray-400">· {pct(a.total, total)}</span>
                  </span>
                </button>
                {expandida && (
                  <div className="mb-2 ml-5 flex flex-col gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/40">
                    <div className="flex flex-wrap gap-1.5">
                      {maiores(a.profissoes, 24).map(([p, n]) => (
                        <span key={p} className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                          {p} <strong className="tabular-nums">{n}</strong>
                        </span>
                      ))}
                      {a.profissoes.size > 24 && <span className="text-[11px] text-gray-500">e mais {a.profissoes.size - 24} profissões</span>}
                    </div>
                    {a.orgaos.size > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400">Órgãos e locais de trabalho mais citados</p>
                        <p className="text-[11px] text-gray-600 dark:text-gray-300">{maiores(a.orgaos, 12).map(([o, n]) => `${o} (${n})`).join(" · ")}</p>
                      </div>
                    )}
                    {a.peloOrgao > 0 && <p className="text-[10px] text-gray-500 dark:text-gray-400">{a.peloOrgao} servidor(es) classificados nesta área pelo local de trabalho.</p>}
                    {area === "Serviço público (área não identificada)" && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Servidores sem profissão específica nem órgão informado no Mercúrio.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {nacional && tabelaFiliais.length > 1 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <caption className="mb-2 text-left text-[12px] font-bold text-gray-900 dark:text-gray-100">Por filial</caption>
            <thead className="text-gray-500 dark:text-gray-400">
              <tr>
                <th className="py-1 pr-3 font-semibold">Filial</th>
                <th className="py-1 pr-3 text-right font-semibold">Pessoas</th>
                <th className="py-1 pr-3 font-semibold">Áreas mais comuns</th>
                <th className="py-1 text-right font-semibold">Sem profissão</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300">
              {tabelaFiliais.map(({ u, t, top, semInfo }) => (
                <tr key={u.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-1.5 pr-3">
                    <button onClick={() => setUnidade(u.id)} className="font-semibold text-na-green-dark hover:underline dark:text-emerald-400">
                      {u.nome}
                    </button>
                    <span className="text-gray-400"> {u.uf}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{t}</td>
                  <td className="py-1.5 pr-3">{top.map(([a, d]) => `${a} ${pct(d.total, t)}`).join(" · ")}</td>
                  <td className="py-1.5 text-right tabular-nums">{pct(semInfo, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-gray-500 dark:text-gray-400">
        Profissão como está no cadastro do Mercúrio, agrupada por área de atuação. Atualizado na sincronização diária ({new Date(dados.geradoEm).toLocaleDateString("pt-BR")}).
      </p>
    </div>
  );
}
