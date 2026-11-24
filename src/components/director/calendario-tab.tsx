"use client";

import { cancelarReunioesEmLote, getCalendarioMes, reunioesDoPeriodo } from "@/lib/actions/calendario-actions";
import { ROTULO_CAMADA } from "@/lib/calendario-comum";
import type { Camada, ItemCalendario } from "@/lib/calendario-filial";
import { CalendarOff, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

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
      <Recesso schoolId={schoolId} aoConcluir={() => { setItens(null); getCalendarioMes(schoolId, ano, mes).then(setItens).catch(() => setErro(true)); }} />
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

        {erro ? <p role="alert" className="text-sm text-na-danger-dark dark:text-red-300">Não foi possível carregar o calendário. Tente trocar o mês ou recarregar a página.</p> : !itens ? (
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

/**
 * Período sem reuniões (recesso; pedido do usuário 24/11/2026): a direção informa o período e o motivo, vê todas as
 * reuniões dos grupos da filial nesse intervalo (todas marcadas) e desmarca as que seguem acontecendo. As marcadas
 * são canceladas com o motivo, que aparece na arte da programação ("Sem reunião · RECESSO").
 */
function Recesso({ schoolId, aoConcluir }: { schoolId: string; aoConcluir: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [motivo, setMotivo] = useState("Recesso");
  const [lista, setLista] = useState<Awaited<ReturnType<typeof reunioesDoPeriodo>> | null>(null);
  const [fora, setFora] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const campo = "min-h-10 rounded-lg border border-gray-300 bg-white px-2.5 text-[13px] dark:border-gray-600 dark:bg-gray-950";
  const buscar = () =>
    iniciar(async () => {
      setMsg(null); setConfirmar(false);
      try { setLista(await reunioesDoPeriodo(schoolId, de, ate)); setFora(new Set()); } catch (e) { setMsg((e as Error).message); }
    });
  const marcadas = (lista ?? []).filter((r) => !fora.has(r.id));
  const cancelar = () =>
    iniciar(async () => {
      try {
        const r = await cancelarReunioesEmLote(schoolId, marcadas.map((m) => m.id), motivo);
        setMsg(`${r.canceladas} ${r.canceladas === 1 ? "reunião cancelada" : "reuniões canceladas"} com o motivo "${motivo.trim() || "Recesso"}".`);
        setLista(null); setConfirmar(false); aoConcluir();
      } catch (e) { setMsg((e as Error).message); }
    });
  if (!aberto)
    return (
      <button onClick={() => setAberto(true)} className="flex w-fit items-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
        <CalendarOff size={15} /> Período sem reuniões (recesso)
      </button>
    );
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Período sem reuniões</h3>
      <p className="text-[12px] text-gray-500 dark:text-gray-400">Todas as reuniões dos grupos da filial no período vêm marcadas para cancelar. Desmarque as que seguem acontecendo. O motivo aparece na arte da programação de cada grupo.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[12px] font-semibold">De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={campo} /></label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold">Até<input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} className={campo} /></label>
        <label className="flex min-w-40 flex-col gap-1 text-[12px] font-semibold">Motivo<input value={motivo} maxLength={60} onChange={(e) => setMotivo(e.target.value)} className={campo} /></label>
        <button disabled={pendente || !de || !ate} onClick={buscar} className="min-h-10 rounded-lg bg-na-green px-3 text-[13px] font-semibold text-white disabled:opacity-50">{pendente && !lista ? <Loader2 size={14} className="animate-spin" /> : "Ver reuniões"}</button>
        <button onClick={() => { setAberto(false); setLista(null); setMsg(null); }} className="min-h-10 px-2 text-[13px] font-semibold text-gray-500">Fechar</button>
      </div>
      {lista && (
        <div className="flex flex-col gap-2">
          {lista.length === 0 ? (
            <p className="text-[13px] text-gray-500">Nenhuma reunião futura agendada nesse período.</p>
          ) : (
            <ul className="grid gap-1 text-[13px]">
              {lista.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <input id={`rec-${r.id}`} type="checkbox" checked={!fora.has(r.id)} onChange={() => setFora((f) => { const n = new Set(f); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} className="h-4 w-4 accent-na-green" />
                  <label htmlFor={`rec-${r.id}`} className={fora.has(r.id) ? "text-gray-500" : ""}>
                    {new Date(r.inicio).toLocaleString("pt-BR", { timeZone: ZONA, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · <b>{r.grupo}</b> · {r.titulo}{fora.has(r.id) ? " · continua" : ""}
                  </label>
                </li>
              ))}
            </ul>
          )}
          {marcadas.length > 0 && !confirmar && (
            <button disabled={pendente} onClick={() => setConfirmar(true)} className="w-fit rounded-lg border border-na-danger px-3 py-2 text-[13px] font-semibold text-na-danger-dark">Cancelar {marcadas.length} {marcadas.length === 1 ? "reunião" : "reuniões"}…</button>
          )}
          {confirmar && (
            <div role="alertdialog" className="rounded-xl border-2 border-na-danger bg-na-danger-light p-3 text-[13px] text-na-danger-dark dark:bg-red-950/40 dark:text-red-200">
              <p className="font-bold">Cancelar {marcadas.length} {marcadas.length === 1 ? "reunião" : "reuniões"} com o motivo “{motivo.trim() || "Recesso"}”?</p>
              <p className="mt-1">Os grupos veem o cancelamento na Agenda e na arte da programação. Para reativar uma reunião depois, é preciso criá-la de novo no grupo.</p>
              <div className="mt-2 flex gap-2">
                <button disabled={pendente} onClick={cancelar} className="rounded-lg bg-na-danger px-3 py-2 font-bold text-white">{pendente ? <Loader2 size={14} className="animate-spin" /> : "Sim, cancelar"}</button>
                <button disabled={pendente} onClick={() => setConfirmar(false)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-semibold text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">Não, manter</button>
              </div>
            </div>
          )}
        </div>
      )}
      {msg && <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">{msg}</p>}
    </section>
  );
}
