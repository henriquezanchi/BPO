"use client";

import { alternarDia, alternarHorario, cancelarAtendimento, excluirJanela, registrarResultado, salvarJanela } from "@/lib/actions/atendimento-actions";
import { CalendarClock, Loader2, MapPin, Plus, Trash2, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { agruparPorDia, DIAS_LONGOS, horaDe, MODALIDADE_ROTULO, rotuloHora, rotuloDia } from "./comum";

type Janela = { id: string; diaSemana: number | null; data: string | null; inicioMinuto: number; fimMinuto: number; duracaoMinutos: number; modalidade: string; local: string | null; linkOnline: string | null };
type Horario = { inicio: string; fim: string; janelaId: string; situacao: "livre" | "marcado" | "fechado" | "dia_fechado"; reservaId: string | null; aluno: string | null };
type Conversa = { id: string; inicio: string; fim: string; aluno: string; turma: string; assunto: string | null; modalidade: string; status: string; canceladoPor: string | null };

const CAMPO = "w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-na-green focus:ring-2 focus:ring-na-green/15 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";
const ROTULO = "flex flex-col gap-1 text-[12px] font-semibold text-gray-700 dark:text-gray-300";
const CARTAO = "rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900";
const TITULO = "text-[11px] font-bold tracking-wide text-gray-600 uppercase dark:text-gray-300";

export function PainelInstrutor({ fuso, janelas, horarios, conversas }: { fuso: string; janelas: Janela[]; horarios: Horario[]; conversas: Conversa[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(janelas.length === 0);
  const [agora] = useState(() => Date.now());

  function rodar(acao: () => Promise<{ ok: boolean; error?: string }>, depois?: () => void) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) setErro(r.error ?? "Não foi possível agora.");
      else {
        depois?.();
        router.refresh();
      }
    });
  }

  const proximas = conversas.filter((c) => c.status === "marcada" && new Date(c.fim).getTime() > agora);
  const aRegistrar = conversas.filter((c) => c.status === "marcada" && new Date(c.inicio).getTime() <= agora);
  const recentes = conversas.filter((c) => c.status !== "marcada").reverse().slice(0, 10);
  const porDia = agruparPorDia(horarios, fuso);
  const livres = horarios.filter((h) => h.situacao === "livre").length;
  const marcados = horarios.filter((h) => h.situacao === "marcado").length;

  return (
    <div className="flex flex-col gap-6">
      {erro && <p role="alert" className="rounded-xl bg-na-danger-light px-3 py-2 text-[13px] text-na-danger-dark dark:bg-red-950/30 dark:text-red-300">{erro}</p>}

      <div className="grid grid-cols-3 gap-2">
        {[
          ["Livres", livres, "próximas 4 semanas"],
          ["Marcadas", marcados, "próximas 4 semanas"],
          ["A registrar", aRegistrar.length, "conversas que já passaram"],
        ].map(([r, v, d]) => (
          <div key={String(r)} className={CARTAO + " !p-3"}>
            <p className="text-2xl font-black text-gray-900 tabular-nums dark:text-gray-100">{v}</p>
            <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">{r}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{d}</p>
          </div>
        ))}
      </div>

      {aRegistrar.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className={TITULO}>Como foi?</h2>
          {aRegistrar.map((c) => (
            <article key={c.id} className={`${CARTAO} flex flex-wrap items-center justify-between gap-3`}>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{c.aluno}</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">{rotuloDia(c.inicio, fuso)} · {horaDe(c.inicio, fuso)}</p>
              </div>
              <div className="flex gap-1.5 text-[12px] font-semibold">
                <button disabled={pendente} onClick={() => rodar(() => registrarResultado(c.id, "realizada"))} className="rounded-lg bg-na-green px-3 py-1.5 text-white hover:bg-na-green-dark">Conversamos</button>
                <button disabled={pendente} onClick={() => rodar(() => registrarResultado(c.id, "faltou"))} className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 dark:border-gray-700 dark:text-gray-200">Não veio</button>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className={TITULO}>Próximas conversas</h2>
        {proximas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 p-4 text-center text-[13px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Nenhuma conversa marcada. {livres ? "Seus horários livres já aparecem para os alunos." : "Abra horários abaixo para os alunos marcarem."}
          </p>
        ) : (
          proximas.map((c) => <CartaoConversa key={c.id} c={c} fuso={fuso} pendente={pendente} cancelar={(motivo) => rodar(() => cancelarAtendimento(c.id, motivo))} />)
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className={TITULO}>Minhas faixas de horário</h2>
          {!novaAberta && (
            <button onClick={() => setNovaAberta(true)} className="flex items-center gap-1 text-[12px] font-semibold text-na-green-dark hover:underline dark:text-emerald-400">
              <Plus size={14} /> Abrir horários
            </button>
          )}
        </div>
        {janelas.map((j) => (
          <div key={j.id} className={`${CARTAO} flex items-center justify-between gap-3 !py-3`}>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100">
                {j.data ? rotuloDia(`${j.data}T12:00:00Z`, "UTC") : DIAS_LONGOS[j.diaSemana ?? 0]}, {rotuloHora(j.inicioMinuto)}–{rotuloHora(j.fimMinuto)}
              </p>
              <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-gray-500 dark:text-gray-400">
                <span>Conversas de {j.duracaoMinutos} min</span>
                <span className="flex items-center gap-1">{j.modalidade === "online" ? <Video size={12} /> : <MapPin size={12} />}{MODALIDADE_ROTULO[j.modalidade]}{j.local ? ` · ${j.local}` : ""}</span>
              </p>
            </div>
            <button disabled={pendente} onClick={() => rodar(() => excluirJanela(j.id))} aria-label="Remover faixa" title="Remover faixa (conversas já marcadas continuam)" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {novaAberta && <NovaFaixa pendente={pendente} cancelar={janelas.length ? () => setNovaAberta(false) : undefined} salvar={(f) => rodar(() => salvarJanela(f), () => setNovaAberta(false))} />}
      </section>

      {porDia.size > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className={TITULO}>Próximas 4 semanas</h2>
          <p className="-mt-1 text-[12px] text-gray-500 dark:text-gray-400">Toque num horário livre para fechá-lo, ou num fechado para reabrir.</p>
          {[...porDia.entries()].map(([dia, lista]) => {
            const diaFechado = lista.every((h) => h.situacao === "dia_fechado");
            const janelasDoDia = [...new Set(lista.map((h) => h.janelaId))];
            return (
              <div key={dia} className={`${CARTAO} !p-3`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className={`text-[13px] font-bold ${diaFechado ? "text-gray-400 line-through" : "text-gray-900 dark:text-gray-100"}`}>{rotuloDia(lista[0].inicio, fuso)}</p>
                  <button
                    disabled={pendente}
                    onClick={() => rodar(async () => {
                      for (const id of janelasDoDia) {
                        const r = await alternarDia(id, dia);
                        if (!r.ok) return r;
                      }
                      return { ok: true };
                    })}
                    className="text-[11px] font-semibold text-gray-500 hover:underline dark:text-gray-400"
                  >
                    {diaFechado ? "Reabrir o dia" : "Fechar o dia"}
                  </button>
                </div>
                {!diaFechado && (
                  <div className="flex flex-wrap gap-1.5">
                    {lista.map((h) =>
                      h.situacao === "marcado" ? (
                        <span key={h.inicio} title={h.aluno ?? ""} className="rounded-lg bg-na-green px-2.5 py-1 text-[12px] font-semibold text-white">
                          {horaDe(h.inicio, fuso)} · {(h.aluno ?? "").split(" ")[0]}
                        </span>
                      ) : (
                        <button
                          key={h.inicio}
                          disabled={pendente}
                          onClick={() => rodar(() => alternarHorario(h.inicio))}
                          className={`rounded-lg border px-2.5 py-1 text-[12px] font-semibold tabular-nums ${h.situacao === "livre" ? "border-na-green/50 text-na-green-dark hover:bg-na-green-light/40 dark:text-emerald-400" : "border-gray-200 text-gray-400 line-through dark:border-gray-700"}`}
                        >
                          {horaDe(h.inicio, fuso)}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {recentes.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h2 className={TITULO}>Últimos 30 dias</h2>
          <ul className="flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white text-[12px] dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
            {recentes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate text-gray-800 dark:text-gray-200">{c.aluno} · {rotuloDia(c.inicio, fuso)}</span>
                <span className="shrink-0 font-semibold text-gray-500 dark:text-gray-400">
                  {c.status === "realizada" ? "Conversaram" : c.status === "faltou" ? "Não veio" : c.canceladoPor === "aluno" ? "Aluno cancelou" : "Você cancelou"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CartaoConversa({ c, fuso, pendente, cancelar }: { c: Conversa; fuso: string; pendente: boolean; cancelar: (motivo: string) => void }) {
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  return (
    <article className={`${CARTAO} flex flex-col gap-2 !border-na-green/40`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{c.aluno}</p>
          {c.turma && <p className="text-[11px] text-gray-500 dark:text-gray-400">{c.turma}</p>}
        </div>
        <p className="flex shrink-0 items-center gap-1 text-right text-[12px] font-semibold text-na-green-dark dark:text-emerald-400">
          <CalendarClock size={13} /> {rotuloDia(c.inicio, fuso)} · {horaDe(c.inicio, fuso)}
        </p>
      </div>
      <p className="text-[12px] text-gray-600 dark:text-gray-300">{MODALIDADE_ROTULO[c.modalidade]}{c.assunto ? ` · “${c.assunto}”` : ""}</p>
      {cancelando ? (
        <div className="flex flex-col gap-2">
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (o aluno recebe)" maxLength={300} className={CAMPO} />
          <div className="flex justify-end gap-2 text-[12px] font-semibold">
            <button onClick={() => setCancelando(false)} className="px-2 py-1 text-gray-600 dark:text-gray-300">Voltar</button>
            <button disabled={pendente} onClick={() => cancelar(motivo)} className="rounded-lg bg-red-600 px-3 py-1.5 text-white">Cancelar conversa</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCancelando(true)} className="w-fit text-[12px] font-semibold text-gray-500 hover:underline dark:text-gray-400">Cancelar</button>
      )}
    </article>
  );
}

function NovaFaixa({ pendente, salvar, cancelar }: { pendente: boolean; salvar: (f: FormData) => void; cancelar?: () => void }) {
  const [tipo, setTipo] = useState("semanal");
  const [modalidade, setModalidade] = useState("presencial");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        salvar(new FormData(e.currentTarget));
      }}
      className={`${CARTAO} grid gap-3 border-na-green/40 sm:grid-cols-2`}
    >
      <p className="text-[13px] font-bold text-gray-900 sm:col-span-2 dark:text-gray-100">Abrir horários</p>
      <label className={ROTULO}>
        Repetição
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={CAMPO}>
          <option value="semanal">Toda semana</option>
          <option value="data">Só numa data</option>
        </select>
      </label>
      {tipo === "semanal" ? (
        <label className={ROTULO}>
          Dia da semana
          <select name="diaSemana" defaultValue="2" className={CAMPO}>
            {DIAS_LONGOS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </label>
      ) : (
        <label className={ROTULO}>
          Data
          <input type="date" name="data" required className={CAMPO} />
        </label>
      )}
      <label className={ROTULO}>
        Das
        <input type="time" name="inicio" required defaultValue="18:00" step={300} className={CAMPO} />
      </label>
      <label className={ROTULO}>
        Até
        <input type="time" name="fim" required defaultValue="19:30" step={300} className={CAMPO} />
      </label>
      <label className={ROTULO}>
        Cada conversa
        <select name="duracao" defaultValue="30" className={CAMPO}>
          {[20, 30, 45, 60].map((d) => <option key={d} value={d}>{d} minutos</option>)}
        </select>
      </label>
      <label className={ROTULO}>
        Onde
        <select name="modalidade" value={modalidade} onChange={(e) => setModalidade(e.target.value)} className={CAMPO}>
          <option value="presencial">Presencial</option>
          <option value="online">Online</option>
          <option value="ambos">O aluno escolhe</option>
        </select>
      </label>
      {modalidade !== "online" && (
        <label className={`${ROTULO} sm:col-span-2`}>
          Local na escola (opcional)
          <input name="local" maxLength={120} placeholder="Ex.: sala Platão" className={CAMPO} />
        </label>
      )}
      {modalidade !== "presencial" && (
        <label className={`${ROTULO} sm:col-span-2`}>
          Link da chamada (opcional)
          <input name="linkOnline" type="url" maxLength={300} placeholder="https://meet.google.com/…" className={CAMPO} />
        </label>
      )}
      <div className="flex justify-end gap-2 sm:col-span-2">
        {cancelar && <button type="button" onClick={cancelar} className="px-3 py-2 text-[13px] font-semibold text-gray-600 dark:text-gray-300">Cancelar</button>}
        <button disabled={pendente} className="flex items-center gap-1.5 rounded-xl bg-na-green px-4 py-2 text-[13px] font-bold text-white hover:bg-na-green-dark disabled:opacity-60">
          {pendente && <Loader2 size={14} className="animate-spin" />} Abrir horários
        </button>
      </div>
    </form>
  );
}
