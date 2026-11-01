"use client";

import { PraticaTratak } from "@/components/diario/tratak";
import { PraticaGuiada, type PraticaGuiadaChave } from "@/components/fv/pratica-guiada";
import {
  dadosDaCartaFv,
  excluirTarefa,
  historicoFv,
  marcarPraticaFv,
  marcarPresencaGdve,
  marcarTarefa,
  salvarBalanco,
  salvarDegrau,
  salvarFicha,
  salvarTarefa,
  salvarTemplo,
} from "@/lib/actions/diario-fv-actions";
import {
  bastiaoDaTarefa,
  CONDICOES,
  constanciaDasPraticas,
  DIAS_CURTOS,
  DIAS_SEMANA,
  estatisticasDoCiclo,
  ETAPAS_TEMPLO,
  faixaDeFrequencia,
  formatarHoras,
  hhmm,
  ITENS_CARTA,
  nivelDaTarefa,
  OPCOES_RELATORIO,
  PERGUNTAS_PRESENCA,
  perguntasDoDia,
  PRATICAS_FORJA,
  proximaCartaSugerida,
  ROTULO_PRATICA,
  SUBITENS_2,
  textoDoItem,
  textoDoRelatorioMensal,
  UNIDADES,
  type Calendario,
  type ChavePresenca,
  type FormRelatorio,
  type TarefaGdve,
} from "@/lib/fv/comum";
import type { DiarioFvDaPessoa, HistoricoFv } from "@/lib/fv/dados";
import { historicoDaCarta } from "@/lib/fv/historico-carta";
import { mensagemErroAmigavel } from "@/lib/friendly-error";
import { Check, ChevronLeft, ChevronRight, ClipboardCopy, Download, Flame, Hammer, History, Landmark, Mountain, Pencil, Plus, Scroll, Sparkles, Star, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

/**
 * Meu diário de FV, aba do GDVE (pedido do usuário 2026-10-31): o diário de FV antigo (Forja, Degrau, Balanço, Módulo
 * GDVE, Mestre e Carta, Relatório Mensal) dentro do Portal, sem os recursos de IA. Só a própria pessoa vê.
 */
type Rodar = (fn: () => Promise<{ ok: boolean; error?: string }>, depois?: () => void) => void;
type Status = "vazio" | "andamento" | "completo" | "atrasado";

const CAMPO = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-na-green dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";
const ROTULO = "flex flex-col gap-1 text-[12px] font-semibold text-gray-700 dark:text-gray-300";
const BOTAO = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-na-green px-4 text-[13px] font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60";
const BOTAO_LEVE = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 text-[13px] font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800";

const dataBR = (d: string | null | undefined) => (d ? d.split("-").reverse().join("/") : "--/--/--");
const rotuloDia = (d: string, hoje: string) => {
  const diff = Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${d}T12:00:00Z`)) / 864e5);
  return diff === 0 ? "Hoje" : diff === 1 ? "Ontem" : `${DIAS_CURTOS[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${d.slice(8)}/${d.slice(5, 7)}`;
};

export function DiarioFv({ d }: { d: DiarioFvDaPessoa }) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const rodar: Rodar = (fn, depois) => {
    setErro(null);
    setAviso(null);
    startTransition(async () => {
      try {
        const r = await fn();
        if (!r.ok) return setErro(r.error ?? "Não foi possível salvar.");
        depois?.();
        router.refresh();
      } catch (e) {
        setErro(mensagemErroAmigavel(e));
      }
    });
  };

  function irParaDia(dia: string) {
    const url = new URL(window.location.href);
    if (url.pathname.startsWith("/grupos/")) url.searchParams.set("aba", "diariofv");
    if (dia === d.hoje) url.searchParams.delete("dia");
    else url.searchParams.set("dia", dia);
    router.push(url.pathname + url.search, { scroll: false });
  }

  const stats = estatisticasDoCiclo(d.ciclo);
  const constancia = constanciaDasPraticas(stats.diasPraticas);
  const cartaAtrasada = !!d.ficha.proximaCarta && d.ficha.proximaCarta < d.hoje;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 rounded-2xl border border-na-gold/40 bg-gradient-to-br from-[#0b1f1c] to-na-green-dark p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-wide text-na-gold uppercase">Planejamento do Discipulado</p>
            <h2 className="text-[18px] font-black">Meu diário de FV</h2>
            <p className="text-[12px] text-white/80">Só você vê este diário.</p>
          </div>
          <div className="flex shrink-0 flex-col items-end text-right" title="Constância de práticas nos últimos 30 dias">
            <span className="flex items-center gap-1 text-[13px] font-bold text-na-gold">
              <Flame size={14} /> {constancia.atual}
            </span>
            <span className="text-[11px] text-white/80">{stats.diasPraticas} dias com práticas</span>
            {constancia.proximo && <span className="text-[11px] text-white/80">Rumo a {constancia.proximo}: faltam {constancia.faltam}</span>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-3">
          <Info rotulo="Minha unidade" valor={d.ficha.unidade ?? "Não definida"} />
          <Info rotulo="Minha condição" valor={d.ficha.condicao ?? "Não definida"} />
          <Info rotulo="Mestre / Instrutor" valor={d.ficha.mestre ?? "Não definido"} />
          <Info rotulo="Próxima entrega" valor={dataBR(d.ficha.proximaCarta)} destaque={cartaAtrasada} />
          <Info rotulo="Próxima reunião" valor={d.proximaReuniao ? new Date(d.proximaReuniao).toLocaleString("pt-BR", { timeZone: d.fuso, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Sem data"} />
        </dl>
      </header>

      <nav aria-label="Dia do diário" className="flex flex-wrap gap-1.5">
        {d.datas.map((dia) => (
          <button
            key={dia}
            onClick={() => irParaDia(dia)}
            aria-current={dia === d.data ? "date" : undefined}
            className={`min-h-10 rounded-full border px-3.5 text-[12px] font-semibold transition ${dia === d.data ? "border-na-green bg-na-green text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"}`}
          >
            {rotuloDia(dia, d.hoje)}
          </button>
        ))}
      </nav>

      {erro && (
        <p role="alert" className="rounded-xl bg-na-danger-light px-3 py-2 text-[12px] font-semibold text-na-danger-dark dark:bg-red-950/30 dark:text-red-300">
          {erro}
        </p>
      )}
      {aviso && (
        <p role="status" className="rounded-xl bg-na-success-light px-3 py-2 text-[12px] font-semibold text-na-success-dark dark:bg-emerald-950/30 dark:text-emerald-300">
          {aviso}
        </p>
      )}

      <Forja key={`forja-${d.data}`} d={d} rodar={rodar} pendente={pendente} />
      <Degrau key={`degrau-${d.data}`} d={d} rodar={rodar} pendente={pendente} avisar={setAviso} />
      <Balanco key={`balanco-${d.data}`} d={d} rodar={rodar} pendente={pendente} avisar={setAviso} />
      <ModuloGdve key={`gdve-${d.data}`} d={d} rodar={rodar} pendente={pendente} />
      <MestreECarta d={d} rodar={rodar} pendente={pendente} avisar={setAviso} atrasada={cartaAtrasada} />
      <RelatorioMensal d={d} stats={stats} />
      <HistoricoDeFv />
    </div>
  );
}

function Info({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold tracking-wide text-white/70 uppercase">{rotulo}</dt>
      <dd className={`truncate font-semibold ${destaque ? "text-na-laranja" : ""}`}>{valor}</dd>
    </div>
  );
}

/** Gaveta: aberta enquanto está em andamento; fecha sozinha quando completa (como no diário antigo). */
function Gaveta({ titulo, icone, status, children }: { titulo: string; icone: ReactNode; status: Status; children: ReactNode }) {
  const selo = { vazio: null, andamento: "Em andamento", completo: "Completo", atrasado: "Atrasada!" }[status];
  return (
    <details
      open={status !== "completo"}
      className={`group rounded-2xl border bg-white p-4 dark:bg-gray-900 ${status === "atrasado" ? "border-na-danger/50" : status === "andamento" ? "border-dashed border-na-gold/70" : "border-gray-200 dark:border-gray-800"}`}
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-[15px] font-bold text-gray-900 dark:text-gray-100">
        <span className={status === "completo" ? "text-gray-400" : "text-na-gold-dark dark:text-na-gold"}>{icone}</span>
        <span className={status === "completo" ? "text-gray-500 line-through decoration-gray-300" : ""}>{titulo}</span>
        {selo && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${status === "atrasado" ? "bg-na-danger-light text-na-danger-dark" : status === "completo" ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" : "bg-na-warning-light text-na-warning-dark"}`}>{selo}</span>}
        <ChevronRight size={16} className={`shrink-0 text-gray-400 transition group-open:rotate-90 ${selo ? "" : "ml-auto"}`} />
      </summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}

// ---------- Forja do Caráter ----------
function Forja({ d, rodar, pendente }: { d: DiarioFvDaPessoa; rodar: Rodar; pendente: boolean }) {
  const [escolhida, setEscolhida] = useState<{ chave: string; rotulo: string } | null>(null);
  const [guiada, setGuiada] = useState<PraticaGuiadaChave | "tratak" | null>(null);
  const feitas = d.dia.praticas;
  const total = PRATICAS_FORJA.length + ETAPAS_TEMPLO.length;
  const n = [...PRATICAS_FORJA, ...ETAPAS_TEMPLO].filter((p) => feitas[p.chave]).length;
  const status: Status = n === 0 ? "vazio" : n >= total ? "completo" : "andamento";
  const etapasFeitas = ETAPAS_TEMPLO.filter((e) => feitas[e.chave]).map((e) => e.chave);

  const item = (p: { chave: string; rotulo: string }) => (
    <button
      key={p.chave}
      onClick={() => setEscolhida(p)}
      className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-[13px] transition ${feitas[p.chave] ? "border-na-success/40 bg-na-success-light text-na-success-dark dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-gray-200 text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"}`}
    >
      {feitas[p.chave] ? <Check size={15} className="shrink-0" /> : <span className="size-[15px] shrink-0 rounded-full border-2 border-gray-300 dark:border-gray-600" />}
      <span className="min-w-0 flex-1">{p.rotulo}</span>
    </button>
  );

  return (
    <Gaveta titulo="Práticas (A Forja do Caráter)" icone={<Hammer size={17} />} status={status}>
      <div className="grid gap-2 sm:grid-cols-2">{PRATICAS_FORJA.map(item)}</div>
      <p className="mt-1 flex items-center gap-1.5 text-[12px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
        <Landmark size={13} /> Templo Interior
      </p>
      <div className="grid gap-2 sm:grid-cols-2">{ETAPAS_TEMPLO.map(item)}</div>

      {escolhida && (
        <div role="dialog" aria-modal="true" aria-label={escolhida.rotulo} className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setEscolhida(null)}>
          <div className="flex w-full max-w-sm flex-col gap-2 rounded-2xl bg-white p-5 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-100">{escolhida.rotulo}</h3>
            <button
              className={BOTAO}
              onClick={() => {
                const c = escolhida.chave;
                setEscolhida(null);
                setGuiada(c === "tratak" ? "tratak" : ETAPAS_TEMPLO.some((e) => e.chave === c) ? "templo" : (c as PraticaGuiadaChave));
              }}
            >
              Realizar no Portal
            </button>
            {!feitas[escolhida.chave] ? (
              <button className={BOTAO_LEVE} disabled={pendente} onClick={() => rodar(() => marcarPraticaFv(d.data, escolhida.chave, true), () => setEscolhida(null))}>
                Já realizado
              </button>
            ) : (
              <button className={BOTAO_LEVE} disabled={pendente} onClick={() => rodar(() => marcarPraticaFv(d.data, escolhida.chave, false), () => setEscolhida(null))}>
                Desmarcar prática
              </button>
            )}
            <button className="min-h-10 text-[13px] text-gray-500 underline" onClick={() => setEscolhida(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {guiada === "tratak" && <PraticaTratak aoFechar={() => setGuiada(null)} aoRegistrar={() => rodar(async () => ({ ok: true }))} registrar={() => marcarPraticaFv(d.data, "tratak", true)} />}
      {guiada && guiada !== "tratak" && (
        <PraticaGuiada
          chave={guiada}
          etapasFeitas={etapasFeitas}
          aoFechar={() => setGuiada(null)}
          aoConcluir={async (etapas) => {
            const r = guiada === "templo" ? await salvarTemplo(d.data, etapas ?? []) : await marcarPraticaFv(d.data, guiada, true);
            if (!r.ok) return r.error;
            rodar(async () => ({ ok: true }));
            return null;
          }}
        />
      )}
    </Gaveta>
  );
}

// ---------- Degrau (A Escalada) ----------
function Degrau({ d, rodar, pendente, avisar }: { d: DiarioFvDaPessoa; rodar: Rodar; pendente: boolean; avisar: (m: string) => void }) {
  const [itens, setItens] = useState<Record<string, string>>(d.dia.itens);
  const preenchidos = ITENS_CARTA.filter((i) => textoDoItem(d.dia.itens, i.id)).length;
  const status: Status = preenchidos === 0 ? "vazio" : preenchidos === ITENS_CARTA.length ? "completo" : "andamento";
  const mudar = (k: string, v: string) => setItens((a) => ({ ...a, [k]: v }));

  return (
    <Gaveta titulo="Degrau (A Escalada)" icone={<Mountain size={17} />} status={status}>
      <p className="text-[12px] text-gray-500 dark:text-gray-400">Ao salvar, os itens preenchidos ficam recolhidos, para descansar sua mente.</p>
      {ITENS_CARTA.map((item) => {
        const salvo = !!textoDoItem(d.dia.itens, item.id);
        return (
          <details key={item.id} open={!salvo} className={`rounded-xl border p-3 ${salvo ? "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/40" : "border-gray-200 dark:border-gray-700"}`}>
            <summary className="cursor-pointer list-none">
              <span className={`block text-[13px] font-bold ${salvo ? "text-gray-500 line-through decoration-gray-300" : "text-gray-900 dark:text-gray-100"}`}>
                {salvo && <Check size={13} className="mr-1 inline text-na-success" />}
                {item.rotulo}
              </span>
              <span className="mt-0.5 block text-[12px] text-gray-500 dark:text-gray-400">{item.descricao}</span>
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              {item.id === "item2" ? (
                SUBITENS_2.map(([k, r]) => (
                  <label key={k} className={ROTULO}>
                    {r}
                    <textarea rows={2} value={itens[`item2_${k}`] ?? ""} onChange={(e) => mudar(`item2_${k}`, e.target.value)} placeholder="Análise..." className={CAMPO} />
                  </label>
                ))
              ) : (
                <textarea rows={3} aria-label={item.rotulo} value={itens[item.id] ?? ""} onChange={(e) => mudar(item.id, e.target.value)} placeholder="Registro..." className={CAMPO} />
              )}
              {item.id === "item2" && itens.item2 && <p className="text-[12px] text-gray-500 dark:text-gray-400">Do diário antigo: {itens.item2}</p>}
            </div>
          </details>
        );
      })}
      <button className={BOTAO} disabled={pendente} onClick={() => rodar(() => salvarDegrau(d.data, itens), () => avisar("Reflexões da Carta de Degrau salvas."))}>
        Salvar relatos da Escalada
      </button>
    </Gaveta>
  );
}

// ---------- Balanço de Serviço e Atividades ----------
function Balanco({ d, rodar, pendente, avisar }: { d: DiarioFvDaPessoa; rodar: Rodar; pendente: boolean; avisar: (m: string) => void }) {
  const perguntas = perguntasDoDia(d.ficha.calendario, d.data);
  const [presencas, setPresencas] = useState<Partial<Record<ChavePresenca, string>>>(d.dia.presencas);
  const [vol, setVol] = useState(hhmm(d.dia.minutosVoluntariado));
  const respondidas = perguntas.filter((k) => d.dia.presencas[k]).length;
  const status: Status = respondidas === 0 && !d.dia.minutosVoluntariado ? "vazio" : respondidas === perguntas.length ? "completo" : "andamento";
  const temAula = perguntas.includes("aulaRegular") || perguntas.includes("aulaMinistrada");
  const semCalendario = !d.ficha.calendario.aulaRegularDia && !d.ficha.calendario.reuniaoRaioDia && !(d.ficha.calendario.aulaMinistradaDias ?? []).length && !d.ficha.calendario.dataCrm && !d.ficha.calendario.dataAulaEd;

  return (
    <Gaveta titulo="Balanço de Serviço e Atividades" icone={<Star size={17} />} status={status}>
      {semCalendario && <p className="text-[12px] text-gray-500 dark:text-gray-400">Preencha o Calendário Fixo em “Mestre e Carta” para as perguntas de aula, Raio, CRM e ED aparecerem nos dias certos.</p>}
      {PERGUNTAS_PRESENCA.filter((p) => perguntas.includes(p.chave)).map((p) => (
        <label key={p.chave} className={ROTULO}>
          {p.pergunta}
          <select value={presencas[p.chave] ?? ""} onChange={(e) => setPresencas((a) => ({ ...a, [p.chave]: e.target.value }))} className={CAMPO}>
            <option value="">Selecione...</option>
            <option value="Sim">{p.sim}</option>
            <option value="Não">{p.nao}</option>
          </select>
        </label>
      ))}
      <label className={ROTULO}>
        Serviço / Voluntariado extra hoje?
        <input type="time" value={vol} onChange={(e) => setVol(e.target.value)} className={`${CAMPO} max-w-40`} aria-describedby="ajuda-voluntariado" />
        <span id="ajuda-voluntariado" className="font-normal text-gray-500 dark:text-gray-400">
          {temAula ? "As horas das aulas acima são calculadas pelo seu calendário. Informe aqui apenas horários avulsos (limpezas, manutenções, etc)." : "Informe aqui o tempo dedicado a serviços avulsos pela Escola hoje (limpeza, manutenções, secretaria, etc)."}
        </span>
      </label>
      <button className={BOTAO} disabled={pendente} onClick={() => rodar(() => salvarBalanco(d.data, presencas, vol), () => avisar("Balanço do dia salvo."))}>
        Salvar balanço
      </button>
    </Gaveta>
  );
}

// ---------- Módulo GDVE ----------
const COR_NIVEL = {
  zero: "bg-na-danger-light text-na-danger-dark",
  pouco: "bg-na-warning-light text-na-warning-dark",
  metade: "bg-[#fff6d6] text-na-gold-dark",
  quase: "bg-na-success-light/70 text-na-success-dark",
  feito: "bg-na-success-light text-na-success-dark",
};

function ModuloGdve({ d, rodar, pendente }: { d: DiarioFvDaPessoa; rodar: Rodar; pendente: boolean }) {
  const [editando, setEditando] = useState<TarefaGdve | "nova" | null>(null);
  const [perguntaPresenca, setPerguntaPresenca] = useState(false);
  const tarefas = d.ficha.tarefas;
  const feita = (t: TarefaGdve) => (t.ciclo ? !!d.ficha.ciclo[t.id] : (d.dia.gdveTarefas[t.id] ?? 0) >= t.meta);
  const completas = tarefas.filter(feita).length;
  const status: Status = !tarefas.length && !d.dia.gdvePresenca ? "vazio" : tarefas.length && completas === tarefas.length ? "completo" : "andamento";

  return (
    <Gaveta titulo="Módulo GDVE" icone={<Users size={17} />} status={status}>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
        <div className="text-[13px]">
          <p className="font-bold text-gray-900 dark:text-gray-100">Reunião do GDVE</p>
          <p className="text-gray-600 dark:text-gray-300">
            {d.proximaReuniao ? `Próxima: ${new Date(d.proximaReuniao).toLocaleString("pt-BR", { timeZone: d.fuso, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "Sem reunião marcada no Portal."}
          </p>
        </div>
        {d.dia.gdvePresenca ? (
          <button className={BOTAO_LEVE} disabled={pendente} onClick={() => rodar(() => marcarPresencaGdve(d.data, false, false))}>
            <Check size={15} /> Presença confirmada
          </button>
        ) : (
          <button className={BOTAO} disabled={pendente} onClick={() => setPerguntaPresenca(true)}>
            Marcar presença
          </button>
        )}
      </div>
      {perguntaPresenca && (
        <div className="flex flex-col gap-2 rounded-xl border border-na-gold/40 bg-na-gold/5 p-3 text-[13px]">
          <p className="text-gray-800 dark:text-gray-200">Começa um novo ciclo? Zerar as missões do ciclo também zera a leitura do Bastião marcada como feita.</p>
          <div className="flex flex-wrap gap-2">
            <button className={BOTAO} disabled={pendente} onClick={() => rodar(() => marcarPresencaGdve(d.data, true, true), () => setPerguntaPresenca(false))}>
              Marcar e zerar missões do ciclo
            </button>
            <button className={BOTAO_LEVE} disabled={pendente} onClick={() => rodar(() => marcarPresencaGdve(d.data, true, false), () => setPerguntaPresenca(false))}>
              Só marcar presença
            </button>
          </div>
        </div>
      )}

      <p className="text-[12px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">Práticas específicas do ciclo</p>
      {tarefas.length === 0 && <p className="text-[12px] text-gray-500 dark:text-gray-400">Nenhuma prática do ciclo ainda. Ex.: “Ler Bastião 12” ou “Eu sou Discípulo”, 3 vezes por dia.</p>}
      <ul className="flex flex-col gap-2">
        {tarefas.map((t) => {
          const n = d.dia.gdveTarefas[t.id] ?? 0;
          const b = bastiaoDaTarefa(t.nome);
          return (
            <li key={t.id} className="flex flex-col gap-1.5 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => rodar(() => marcarTarefa(d.data, t.id))}
                  disabled={pendente}
                  aria-label={t.ciclo ? `${t.nome}: ${feita(t) ? "feita, tocar para desmarcar" : "pendente, tocar para marcar"}` : `${t.nome}: ${n} de ${t.meta}, tocar para somar`}
                  className={`flex min-h-10 min-w-14 items-center justify-center rounded-lg px-2 text-[13px] font-bold ${t.ciclo ? (feita(t) ? COR_NIVEL.feito : COR_NIVEL.zero) : COR_NIVEL[nivelDaTarefa(n, t.meta)]}`}
                >
                  {t.ciclo ? (feita(t) ? <Check size={16} /> : "⏳") : `${n}/${t.meta}`}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-gray-900 dark:text-gray-100">{t.nome}</span>
                  <span className="block text-[11px] text-gray-500 dark:text-gray-400">{t.ciclo ? `Missão do ciclo · ${feita(t) ? "Feito" : "Pendente"}` : t.meta > 1 ? "Meta diária" : "Prática diária"}</span>
                </span>
                <button aria-label={`Editar ${t.nome}`} onClick={() => setEditando(t)} className="flex size-10 items-center justify-center text-gray-400 hover:text-gray-700">
                  <Pencil size={15} />
                </button>
                <button
                  aria-label={`Excluir ${t.nome}`}
                  disabled={pendente}
                  onClick={() => confirm("Deseja excluir esta prática?") && rodar(() => excluirTarefa(t.id))}
                  className="flex size-10 items-center justify-center text-gray-400 hover:text-na-danger-dark"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {b && "unico" in b && (
                <a href={b.unico.link} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-na-green-dark underline dark:text-emerald-400">
                  Abrir na Biblioteca: {b.unico.nomeCompleto}
                </a>
              )}
              {b && "varios" in b && (
                <select
                  className={CAMPO}
                  defaultValue=""
                  aria-label="Escolher o Bastião"
                  onChange={(e) => {
                    const escolhido = b.varios[Number(e.target.value)];
                    if (!escolhido) return;
                    window.open(escolhido.link, "_blank", "noopener");
                    rodar(() => salvarTarefa({ ...t, nome: escolhido.nomeCompleto }));
                  }}
                >
                  <option value="">{b.varios.length} encontrados! Escolha...</option>
                  {b.varios.map((x, i) => (
                    <option key={`${x.numero}-${x.ano}-${i}`} value={i}>
                      {x.nomeCompleto}
                    </option>
                  ))}
                </select>
              )}
            </li>
          );
        })}
      </ul>
      {editando ? (
        <FormTarefa tarefa={editando === "nova" ? null : editando} pendente={pendente} rodar={rodar} aoFechar={() => setEditando(null)} />
      ) : (
        <button className={BOTAO_LEVE} onClick={() => setEditando("nova")}>
          <Plus size={15} /> Adicionar prática do ciclo
        </button>
      )}
    </Gaveta>
  );
}

function FormTarefa({ tarefa, pendente, rodar, aoFechar }: { tarefa: TarefaGdve | null; pendente: boolean; rodar: Rodar; aoFechar: () => void }) {
  const [nome, setNome] = useState(tarefa?.nome ?? "");
  const [ciclo, setCiclo] = useState(tarefa?.ciclo ?? false);
  const [meta, setMeta] = useState(tarefa?.meta ?? 1);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
      <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100">{tarefa ? "Editar prática" : "Adicionar nova prática"}</p>
      <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={160} placeholder="Ex: Ler Bastião / Eu sou Discípulo..." className={CAMPO} aria-label="Nome da prática" />
      <label className="flex items-center gap-2 text-[13px] text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={ciclo} onChange={(e) => setCiclo(e.target.checked)} className="size-5 accent-na-green" /> Missão única do ciclo (não zera diariamente)
      </label>
      {!ciclo && (
        <label className="flex items-center gap-2 text-[13px] text-gray-700 dark:text-gray-300">
          Vezes por dia:
          <input type="number" min={1} max={10} value={meta} onChange={(e) => setMeta(Number(e.target.value))} className={`${CAMPO} max-w-20`} />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <button className={BOTAO} disabled={pendente || !nome.trim()} onClick={() => rodar(() => salvarTarefa({ id: tarefa?.id, nome, meta, ciclo }), aoFechar)}>
          {tarefa ? "Salvar alteração" : "Adicionar"}
        </button>
        <button className={BOTAO_LEVE} onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ---------- Mestre e Carta + Calendário Fixo ----------
function MestreECarta({ d, rodar, pendente, avisar, atrasada }: { d: DiarioFvDaPessoa; rodar: Rodar; pendente: boolean; avisar: (m: string) => void; atrasada: boolean }) {
  const f = d.ficha;
  const [ficha, setFicha] = useState({ unidade: f.unidade ?? "", condicao: f.condicao ?? "", mestre: f.mestre ?? "", ultimoEncontro: f.ultimoEncontro ?? "", ultimaCarta: f.ultimaCarta ?? "", proximaCarta: f.proximaCarta ?? "" });
  const [cal, setCal] = useState<Calendario>(f.calendario);
  const [baixando, setBaixando] = useState(false);
  const [semRegistro, setSemRegistro] = useState(false);
  const completo = !!(f.mestre && f.ultimoEncontro && f.ultimaCarta && f.proximaCarta);
  const status: Status = atrasada ? "atrasado" : !f.mestre ? "vazio" : completo ? "completo" : "andamento";
  const campo = (k: keyof typeof ficha) => ({ value: ficha[k], onChange: (e: { target: { value: string } }) => setFicha((a) => ({ ...a, [k]: e.target.value })) });

  async function baixarHistorico() {
    setBaixando(true);
    setSemRegistro(false);
    try {
      const dados = await dadosDaCartaFv();
      const r = historicoDaCarta(dados);
      if (!r) return setSemRegistro(true);
      const blob = new Blob(["﻿" + r.texto], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Historico_Carta_de_Degrau_${r.inicio}_a_${r.fim}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setBaixando(false);
    }
  }

  const diaSel = (k: "aulaRegularDia" | "reuniaoRaioDia") => (
    <select value={cal[k] ?? ""} onChange={(e) => setCal((c) => ({ ...c, [k]: e.target.value || undefined }))} className={CAMPO}>
      <option value="">Selecione o dia...</option>
      {DIAS_SEMANA.map((n, i) => (
        <option key={n} value={String(i)}>
          {n}
        </option>
      ))}
    </select>
  );
  const hora = (valor: string | undefined, mudar: (v: string) => void, rotulo: string) => <input type="time" aria-label={rotulo} value={valor ?? ""} onChange={(e) => mudar(e.target.value)} className={`${CAMPO} max-w-32`} />;

  return (
    <Gaveta titulo={`Mestre e Carta${status === "andamento" ? " (incompleto)" : ""}`} icone={<Scroll size={17} />} status={status}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ROTULO}>
          Unidade
          <select {...campo("unidade")} className={CAMPO}>
            <option value="">Selecione...</option>
            {UNIDADES.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className={ROTULO}>
          Condição
          <select {...campo("condicao")} className={CAMPO}>
            <option value="">Selecione...</option>
            {CONDICOES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className={`${ROTULO} sm:col-span-2`}>
          Mestre / Instrutor (CD)
          <input {...campo("mestre")} maxLength={160} placeholder="Com quem você se reporta..." className={CAMPO} />
        </label>
        <label className={ROTULO}>
          Último encontro / entrevista
          <input type="date" {...campo("ultimoEncontro")} className={CAMPO} />
        </label>
        <label className={ROTULO}>
          Última entrega de Carta
          <input
            type="date"
            value={ficha.ultimaCarta}
            onChange={(e) => {
              const v = e.target.value;
              // A próxima entrega é sugerida 3 meses depois (pode ser ajustada); sem a última, a próxima também sai.
              setFicha((a) => ({ ...a, ultimaCarta: v, proximaCarta: v ? proximaCartaSugerida(v) : "" }));
            }}
            className={CAMPO}
          />
        </label>
        <label className={ROTULO}>
          Próxima entrega (previsão)
          <input type="date" {...campo("proximaCarta")} className={CAMPO} />
        </label>
      </div>

      <p className="mt-1 text-[12px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">Calendário fixo de atividades</p>
      <div className="flex flex-col gap-3">
        <div className={ROTULO}>
          Aula Regular (Curso)
          <div className="flex flex-wrap items-center gap-2">
            {diaSel("aulaRegularDia")}
            {hora(cal.aulaRegularHora, (v) => setCal((c) => ({ ...c, aulaRegularHora: v })), "Início da aula regular")}
            <span className="font-normal">até</span>
            {hora(cal.aulaRegularFim, (v) => setCal((c) => ({ ...c, aulaRegularFim: v })), "Fim da aula regular")}
          </div>
        </div>
        <div className={ROTULO}>
          Reunião de Raio
          <div className="flex flex-wrap items-center gap-2">
            {diaSel("reuniaoRaioDia")}
            {hora(cal.reuniaoRaioHora, (v) => setCal((c) => ({ ...c, reuniaoRaioHora: v })), "Início da reunião de Raio")}
            <span className="font-normal">até</span>
            {hora(cal.reuniaoRaioFim, (v) => setCal((c) => ({ ...c, reuniaoRaioFim: v })), "Fim da reunião de Raio")}
          </div>
        </div>
        <div className={ROTULO}>
          Dias em que ministro aula
          <div className="flex flex-wrap gap-1.5">
            {DIAS_CURTOS.map((n, i) => {
              const k = String(i);
              const marcado = (cal.aulaMinistradaDias ?? []).includes(k);
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={marcado}
                  onClick={() =>
                    setCal((c) => {
                      const dias = marcado ? (c.aulaMinistradaDias ?? []).filter((x) => x !== k) : [...(c.aulaMinistradaDias ?? []), k];
                      const tempos = { ...(c.aulaMinistradaTempos ?? {}) };
                      if (marcado) delete tempos[k];
                      else tempos[k] = tempos[k] ?? {};
                      return { ...c, aulaMinistradaDias: dias, aulaMinistradaTempos: tempos };
                    })
                  }
                  className={`min-h-10 min-w-11 rounded-lg border px-2 text-[12px] font-semibold ${marcado ? "border-na-green bg-na-green text-white" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          {[...(cal.aulaMinistradaDias ?? [])].sort().map((k) => (
            <div key={k} className="flex flex-wrap items-center gap-2 font-normal">
              <span className="w-28">{DIAS_SEMANA[Number(k)]}:</span>
              {hora(cal.aulaMinistradaTempos?.[k]?.inicio, (v) => setCal((c) => ({ ...c, aulaMinistradaTempos: { ...c.aulaMinistradaTempos, [k]: { ...c.aulaMinistradaTempos?.[k], inicio: v } } })), `Início da aula de ${DIAS_SEMANA[Number(k)]}`)}
              <span>até</span>
              {hora(cal.aulaMinistradaTempos?.[k]?.fim, (v) => setCal((c) => ({ ...c, aulaMinistradaTempos: { ...c.aulaMinistradaTempos, [k]: { ...c.aulaMinistradaTempos?.[k], fim: v } } })), `Fim da aula de ${DIAS_SEMANA[Number(k)]}`)}
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={ROTULO}>
            Data da próxima CRM
            <input type="date" value={cal.dataCrm ?? ""} onChange={(e) => setCal((c) => ({ ...c, dataCrm: e.target.value || undefined }))} className={CAMPO} />
          </label>
          <label className={ROTULO}>
            Data da próxima ED
            <input type="date" value={cal.dataAulaEd ?? ""} onChange={(e) => setCal((c) => ({ ...c, dataAulaEd: e.target.value || undefined }))} className={CAMPO} />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={BOTAO} disabled={pendente} onClick={() => rodar(() => salvarFicha({ ...ficha, calendario: cal }), () => avisar("Acompanhamento discipular salvo."))}>
          Salvar ficha completa
        </button>
        <button className={BOTAO_LEVE} disabled={baixando} onClick={baixarHistorico}>
          <Download size={15} /> {baixando ? "Montando..." : "Histórico da Carta (texto)"}
        </button>
      </div>
      <p className="text-[12px] text-gray-500 dark:text-gray-400">O histórico reúne suas respostas da Escalada desde a última entrega ({ficha.ultimaCarta ? dataBR(ficha.ultimaCarta) : "ou dos últimos 30 dias"}), item por item, para você reler antes de escrever a Carta.</p>
      {semRegistro && <p className="text-[12px] font-semibold text-na-warning-dark">Ainda não há respostas da Carta de Degrau neste ciclo para exportar.</p>}
    </Gaveta>
  );
}

// ---------- Relatório Mensal do Ciclo ----------
const FORM_VAZIO: FormRelatorio = { outrasCrm: "", bastioesLidos: "", propaganda: [], contribuicao: "", doacao: "", secretariaAtuacao: "", secretariaReuniao: "", secretariaMembros: "", pontosPositivos: "", desafioCrescimento: "" };

function RelatorioMensal({ d, stats }: { d: DiarioFvDaPessoa; stats: ReturnType<typeof estatisticasDoCiclo> }) {
  const [form, setForm] = useState<FormRelatorio>(FORM_VAZIO);
  const [texto, setTexto] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const campo = (k: Exclude<keyof FormRelatorio, "propaganda">) => ({ value: form[k], onChange: (e: { target: { value: string } }) => setForm((a) => ({ ...a, [k]: e.target.value })) });
  const selo = (rotulo: string, valor: string) => (
    <div className="rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-700">
      <p className="text-[10px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">{rotulo}</p>
      <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{valor}</p>
    </div>
  );

  function gerar() {
    const mesAno = new Date(`${d.hoje}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
    const t = textoDoRelatorioMensal({ mesAno, primeiroNome: d.primeiroNome, ficha: d.ficha, e: stats, form, livroAtual: d.livroAtual });
    setTexto(t);
    navigator.clipboard.writeText(t).then(
      () => setCopiado(true),
      () => setCopiado(false),
    );
  }

  return (
    <Gaveta titulo="Relatório Mensal do Ciclo" icone={<ClipboardCopy size={17} />} status="andamento">
      <p className="text-[12px] text-gray-500 dark:text-gray-400">Últimos 30 dias, calculados pelo seu diário.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {selo("Voluntariado", formatarHoras(stats.minutosVoluntariado))}
        {selo("Aulas assistidas", formatarHoras(stats.minutosAulaAssistida))}
        {selo("Aulas ministradas", formatarHoras(stats.minutosAulaMinistrada))}
        {selo("Freq. de práticas", faixaDeFrequencia(stats.diasPraticas).rotulo)}
        {selo("Aulas de curso", `${stats.aulaRegular} presenças`)}
        {selo("Aulas de ED", `${stats.ed} presenças`)}
        {selo("CRM mensal", stats.crm > 0 ? "Participou" : "Não registrada")}
        {selo("Reuniões de Raio", `${stats.raio} encontros`)}
        {selo("Escalas de limpeza", `${stats.limpeza} check-ins`)}
        {selo("Guarda Noturna (GN)", `${stats.gn} turnos`)}
      </div>
      <p className="text-[12px] text-gray-500 dark:text-gray-400">Limpeza, GN, estudos e Bastião são contados pelas práticas pessoais do seu diário com esses nomes.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ROTULO}>
          Participou das outras CRM (extras/especiais)?
          <select {...campo("outrasCrm")} className={CAMPO}>
            <option value="">Selecione...</option>
            {OPCOES_RELATORIO.outrasCrm.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className={ROTULO}>
          Quantos bastiões leu esse mês?
          <select {...campo("bastioesLidos")} className={CAMPO}>
            <option value="">Automático pelo Portal (ou selecione)</option>
            {OPCOES_RELATORIO.bastioesLidos.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <fieldset className={`${ROTULO} sm:col-span-2`}>
          <legend className="mb-1">Envolvimento com a propaganda (múltipla escolha)</legend>
          <div className="flex flex-wrap gap-1.5">
            {OPCOES_RELATORIO.propaganda.map((o) => {
              const marcado = form.propaganda.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={marcado}
                  onClick={() => setForm((a) => ({ ...a, propaganda: marcado ? a.propaganda.filter((x) => x !== o) : [...a.propaganda, o] }))}
                  className={`min-h-10 rounded-full border px-3 text-[12px] font-semibold ${marcado ? "border-na-green bg-na-green text-white" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"}`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className={ROTULO}>
          Pagou contribuição mensal?
          <select {...campo("contribuicao")} className={CAMPO}>
            <option value="">Selecione...</option>
            {OPCOES_RELATORIO.contribuicao.map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className={ROTULO}>
          Fez alguma doação extra?
          <select {...campo("doacao")} className={CAMPO}>
            <option value="">Selecione...</option>
            {OPCOES_RELATORIO.doacao.map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className={ROTULO}>
          Secretaria de atuação
          <select {...campo("secretariaAtuacao")} className={CAMPO}>
            <option value="">Selecione...</option>
            {OPCOES_RELATORIO.secretarias.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className={ROTULO}>
          Trabalhou/reuniu com os membros da sec.?
          <input {...campo("secretariaReuniao")} className={CAMPO} />
        </label>
        <label className={`${ROTULO} sm:col-span-2`}>
          Quantos membros? Algum destaque?
          <input {...campo("secretariaMembros")} className={CAMPO} />
        </label>
        <label className={`${ROTULO} sm:col-span-2`}>
          Indique 1 ou 2 pontos positivos/crescimento deste mês
          <span className="font-normal text-gray-500 dark:text-gray-400">Momento de síntese pessoal: extraia suas vitórias com suas próprias palavras.</span>
          <textarea rows={3} {...campo("pontosPositivos")} className={CAMPO} />
        </label>
        <label className={`${ROTULO} sm:col-span-2`}>
          Indique um desafio que você está percebendo para crescer
          <span className="font-normal text-gray-500 dark:text-gray-400">Olhe para si mesmo e defina com clareza o seu principal obstáculo (Kurava) atual.</span>
          <textarea rows={3} {...campo("desafioCrescimento")} className={CAMPO} />
        </label>
      </div>
      <button className={BOTAO} onClick={gerar}>
        <ClipboardCopy size={15} /> Gerar relatório e copiar
      </button>
      {texto && (
        <>
          <p role="status" className="text-[12px] font-semibold text-na-success-dark">
            {copiado ? "Relatório copiado. É só colar onde for entregar." : "Não deu para copiar sozinho: selecione o texto abaixo e copie."}
          </p>
          <textarea readOnly rows={12} value={texto} className={`${CAMPO} font-mono text-[12px]`} aria-label="Texto do relatório" />
        </>
      )}
      <p className="text-[12px] text-gray-500 dark:text-gray-400">Os campos acima não ficam gravados; servem para montar o texto deste mês.</p>
    </Gaveta>
  );
}

// ---------- Histórico de FV ----------
function HistoricoDeFv() {
  const [h, setH] = useState<HistoricoFv | null>(null);
  const [carregando, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const carregar = (mes?: string) =>
    startTransition(async () => {
      setErro(null);
      try {
        setH(await historicoFv(mes));
      } catch (e) {
        setErro(mensagemErroAmigavel(e));
      }
    });
  const i = h ? h.meses.indexOf(h.mes) : -1;
  const nomeMes = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="flex items-center gap-2 text-[15px] font-bold text-gray-900 dark:text-gray-100">
        <History size={17} className="text-na-gold-dark dark:text-na-gold" /> Histórico de FV
      </h3>
      {!h ? (
        <button className={BOTAO_LEVE} disabled={carregando} onClick={() => carregar()}>
          {carregando ? "Carregando..." : "Ver os registros passados"}
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <button aria-label="Mês anterior" disabled={carregando || i < 0 || i >= h.meses.length - 1} onClick={() => carregar(h.meses[i + 1])} className="flex size-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800">
              <ChevronLeft size={18} />
            </button>
            <p className="text-[14px] font-bold text-gray-900 capitalize dark:text-gray-100">{nomeMes(h.mes)}</p>
            <button aria-label="Mês seguinte" disabled={carregando || i <= 0} onClick={() => carregar(h.meses[i - 1])} className="flex size-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800">
              <ChevronRight size={18} />
            </button>
          </div>
          {h.dias.length === 0 && <p className="text-[12px] text-gray-500 dark:text-gray-400">Nenhum registro de FV neste mês.</p>}
          {h.dias.map((dia) => (
            <details key={dia.data} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 text-[13px] font-bold text-gray-900 dark:text-gray-100">
                {dataBR(dia.data)}
                <span className="font-normal text-gray-500 dark:text-gray-400">{DIAS_SEMANA[new Date(`${dia.data}T12:00:00Z`).getUTCDay()]}</span>
                {dia.gdvePresenca && <span className="rounded-full bg-na-gold/15 px-2 py-0.5 text-[10px] font-bold text-na-gold-dark">GDVE</span>}
                {dia.praticas.length > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-[11px] font-normal text-gray-500">
                    <Sparkles size={12} /> {dia.praticas.length}
                  </span>
                )}
              </summary>
              <div className="mt-2 flex flex-col gap-2 text-[13px] text-gray-700 dark:text-gray-300">
                {dia.praticas.length > 0 && <p>Práticas: {dia.praticas.map((p) => ROTULO_PRATICA[p] ?? p).join(", ")}</p>}
                {PERGUNTAS_PRESENCA.filter((p) => dia.presencas[p.chave]).map((p) => (
                  <p key={p.chave}>
                    {p.pergunta} {dia.presencas[p.chave]}
                  </p>
                ))}
                {!!dia.minutosVoluntariado && <p>Serviço / voluntariado: {formatarHoras(dia.minutosVoluntariado)}</p>}
                {ITENS_CARTA.map((item) => {
                  const t = textoDoItem(dia.itens, item.id);
                  return t ? (
                    <div key={item.id}>
                      <p className="text-[12px] font-bold text-gray-900 dark:text-gray-100">{item.rotulo}</p>
                      <p className="whitespace-pre-line">{t}</p>
                    </div>
                  ) : null;
                })}
              </div>
            </details>
          ))}
        </>
      )}
      {erro && <p role="alert" className="text-[12px] text-na-danger-dark">{erro}</p>}
    </section>
  );
}
