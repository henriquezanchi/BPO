"use client";

import { getCalendarioMes } from "@/lib/actions/calendario-actions";
import { ROTULO_CAMADA } from "@/lib/calendario-comum";
import type { Camada, ItemCalendario } from "@/lib/calendario-filial";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ZONA = "America/Sao_Paulo";
const diaBR = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONA });
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" });

// Uma cor por camada (identidade), sempre acompanhada do nome na legenda e na lista do dia.
// Paleta validada (claro e escuro) com o validador de cores dos gráficos.
const COR: Record<Camada, string> = {
  aula: "bg-[#009485] dark:bg-[#16a090]",
  reuniao_grupo: "bg-[#9a6b00] dark:bg-[#b8862a]",
  evento_filial: "bg-[#2a78d6] dark:bg-[#3987e5]",
  evento_externo: "bg-[#d55181] dark:bg-[#d55181]",
  feriado: "bg-gray-400 dark:bg-gray-500",
};

/** Calendário inteligente do chefe: programação e detalhes do dia (pedido do usuário 2026-10-19). */
export function CalendarioTab({ schoolId }: { schoolId: string }) {
  const hojeISO = useMemo(() => new Date().toLocaleDateString("en-CA", { timeZone: ZONA }), []);
  const [ano, setAno] = useState(Number(hojeISO.slice(0, 4)));
  const [mes, setMes] = useState(Number(hojeISO.slice(5, 7)));
  const [itens, setItens] = useState<ItemCalendario[] | null>(null);
  const [camadas, setCamadas] = useState<Set<Camada>>(new Set(Object.keys(ROTULO_CAMADA) as Camada[]));
  const [diaSel, setDiaSel] = useState(hojeISO);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    getCalendarioMes(schoolId, ano, mes).then((r) => { if (vivo) { setItens(r); setErro(false); } }).catch(() => { if (vivo) setErro(true); });
    return () => {
      vivo = false;
    };
  }, [schoolId, ano, mes]);

  const porDia = useMemo(() => {
    const m = new Map<string, ItemCalendario[]>();
    for (const i of itens ?? []) if (camadas.has(i.camada)) m.set(diaBR(i.inicio), [...(m.get(diaBR(i.inicio)) ?? []), i]);
    return m;
  }, [itens, camadas]);

  const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const celulas = [...Array(primeiro).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => `${ano}-${String(mes).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`)];
  const mudar = (d: number) => {
    const n = new Date(Date.UTC(ano, mes - 1 + d, 1));
    setItens(null);
    setErro(false);
    setDiaSel(`${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-01`);
    setAno(n.getUTCFullYear());
    setMes(n.getUTCMonth() + 1);
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <button onClick={() => mudar(-1)} aria-label="Mês anterior" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {MESES[mes - 1]} {ano}
          </span>
          <button onClick={() => mudar(1)} aria-label="Próximo mês" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(ROTULO_CAMADA) as Camada[]).map((c) => (
            <button
              key={c}
              aria-pressed={camadas.has(c)}
              onClick={() =>
                setCamadas((s) => {
                  const n = new Set(s);
                  if (n.has(c)) n.delete(c);
                  else n.add(c);
                  return n;
                })
              }
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                camadas.has(c) ? "border-gray-300 text-gray-800 dark:border-gray-600 dark:text-gray-200" : "border-dashed border-gray-300 text-gray-400 dark:border-gray-700 dark:text-gray-500"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${camadas.has(c) ? COR[c] : "bg-transparent"}`} /> {ROTULO_CAMADA[c]}
            </button>
          ))}
        </div>

        {erro ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">Não foi possível carregar o calendário. Tente trocar o mês ou recarregar a página.</p> : !itens ? (
          <p className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
            <Loader2 size={13} className="animate-spin" /> Montando o calendário…
          </p>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400">
              {SEMANA.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {celulas.map((dia, i) => {
                if (!dia) return <div key={`v-${i}`} />;
                const lista = porDia.get(dia) ?? [];
                const sel = dia === diaSel;
                return (
                  <button
                    key={dia}
                    type="button"
                    aria-pressed={sel}
                    aria-current={dia === hojeISO ? "date" : undefined}
                    aria-label={`${Number(dia.slice(8))} de ${MESES[mes - 1]}, ${lista.length} evento${lista.length === 1 ? "" : "s"}`}
                    onClick={() => setDiaSel(dia)}
                    className={`flex min-h-20 min-w-0 flex-col items-stretch gap-1 rounded-lg border border-transparent p-1 text-left text-[12px] transition focus-visible:outline-2 focus-visible:outline-na-green sm:min-h-24 sm:p-2 ${
                      sel ? "bg-na-green/15 ring-1 ring-na-green" : dia === hojeISO ? "ring-1 ring-gray-300 dark:ring-gray-600" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className="text-center font-semibold text-gray-800 dark:text-gray-200">{Number(dia.slice(8))}</span>
                    <span className="flex min-w-0 flex-col gap-1">
                      {lista.slice(0, 3).map((item) => (
                        <span key={item.id} title={item.titulo} className="flex min-w-0 items-center gap-1 text-[9px] leading-4 text-gray-600 sm:text-[11px] dark:text-gray-300">
                          <span aria-hidden="true" className={`h-1 w-1 shrink-0 rounded-full ${COR[item.camada]}`} />
                          <span className="truncate">{item.titulo}</span>
                        </span>
                      ))}
                      {lista.length > 3 && <span aria-label={`Mais ${lista.length - 3} eventos`} className="px-1 text-[11px] text-gray-500 dark:text-gray-400">...</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div aria-live="polite" className="border-t border-gray-100 pt-3 dark:border-gray-800">
              <p className="mb-2 text-[12px] font-semibold text-gray-800 dark:text-gray-200">
                {new Date(`${diaSel}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </p>
              {(porDia.get(diaSel) ?? []).length === 0 ? (
                <p className="text-[12px] text-gray-500 dark:text-gray-400">Nada neste dia.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {(porDia.get(diaSel) ?? []).map((x) => (
                    <li key={x.id} className="flex items-start gap-2 text-[12px] text-gray-700 dark:text-gray-300">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${COR[x.camada]}`} />
                      <span>
                        <strong>{x.diaInteiro ? "Dia todo" : `${hora(x.inicio)}${x.fim ? `–${hora(x.fim)}` : ""}`}</strong> · {x.titulo}
                        {x.detalhe ? <span className="text-gray-500 dark:text-gray-400"> · {x.detalhe}</span> : null}
                        <span className="text-gray-400 dark:text-gray-500"> · {ROTULO_CAMADA[x.camada]}</span>
                        {x.adminHref && <a href={x.adminHref} className="mt-1 block w-fit text-[11px] font-semibold text-na-green-dark underline underline-offset-2 dark:text-emerald-400">Administrar evento →</a>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Aulas: dia e horário de cada turma no Mercúrio (duração estimada de 2 h). Eventos nacionais e regionais ainda não dizem a quem se destinam; por isso contam como conflito para todos.
        </p>
      </section>

      <a href="/voluntario/eventos?aba=eventos" className="w-fit text-xs font-semibold text-na-green-dark hover:underline dark:text-emerald-400">Criar evento e encontrar uma data →</a>
    </div>
  );
}
