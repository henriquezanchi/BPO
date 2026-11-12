"use client";

import { excluirAcao, mudarSituacao, registrar, salvarAcao } from "@/lib/actions/cronograma-actions";
import { type AcaoCronograma, type Alerta, SITUACOES, type Situacao, alertaDe } from "@/lib/cronograma-spread-comum";
import { CircleAlert, CircleCheck, Clock, Pencil, Plus, TriangleAlert } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";

/** Tela do cronograma do spread (/admin/cronograma). Regras do alerta em lib/cronograma-spread-comum.ts. */

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function fmt(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  if (!y) return "—";
  return `${SEM[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${String(d).padStart(2, "0")} ${MES[m - 1]}`;
}

const COR_ALERTA: Record<Alerta["tipo"], string> = {
  ok: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  atrasada: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
  bloqueada: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
  curto: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  comece: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  normal: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
const ICONE_ALERTA: Record<Alerta["tipo"], typeof Clock> = { ok: CircleCheck, atrasada: TriangleAlert, bloqueada: TriangleAlert, curto: CircleAlert, comece: CircleAlert, normal: Clock };
const COR_SITUACAO: Record<Situacao, string> = {
  afazer: "border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
  andamento: "border-transparent bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  bloqueado: "border-transparent bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
  feito: "border-transparent bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

type Filtro = "todas" | "pendentes" | "alerta" | "feito";
const VAZIA = (hoje: string): AcaoCronograma => ({ id: "", fase: "", inicio: hoje, fim: hoje, status: "afazer", acao: "", pessoas: "", materiais: "", duracao: "", dias: null, obs: "", registros: [] });

export function CronogramaSpread({ acoes, hoje }: { acoes: AcaoCronograma[]; hoje: string }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<AcaoCronograma | null>(null);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();

  const comAlerta = useMemo(() => acoes.map((a) => ({ a, al: alertaDe(a, hoje) })), [acoes, hoje]);
  const feitas = acoes.filter((a) => a.status === "feito").length;
  const atrasadas = comAlerta.filter((x) => x.al.tipo === "atrasada" || x.al.tipo === "bloqueada").length;
  const curtas = comAlerta.filter((x) => x.al.tipo === "curto" || x.al.tipo === "comece").length;
  const proxima = acoes.filter((a) => a.status !== "feito" && a.fim >= hoje).sort((x, y) => x.fim.localeCompare(y.fim))[0];

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const vis = comAlerta.filter(({ a, al }) => {
      if (filtro === "pendentes" && a.status === "feito") return false;
      if (filtro === "feito" && a.status !== "feito") return false;
      if (filtro === "alerta" && !["atrasada", "bloqueada", "curto", "comece"].includes(al.tipo)) return false;
      return !q || [a.acao, a.pessoas, a.materiais, a.obs, a.fase].join(" ").toLowerCase().includes(q);
    });
    const m = new Map<string, typeof vis>();
    for (const x of vis) m.set(x.a.fase || "Sem fase", [...(m.get(x.a.fase || "Sem fase") ?? []), x]);
    return [...m.entries()]
      .map(([fase, l]) => [fase, l.sort((x, y) => x.a.inicio.localeCompare(y.a.inicio))] as const)
      .sort((x, y) => x[1][0].a.inicio.localeCompare(y[1][0].a.inicio));
  }, [comAlerta, filtro, busca]);

  const rodar = (fn: () => Promise<{ ok: boolean; error?: string }>, depois?: () => void) =>
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.error ?? "Não deu para salvar.");
      else {
        setErro("");
        depois?.();
      }
    });

  return (
    <div className="grid gap-4" aria-busy={pendente}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Resumo rotulo="Concluídas" valor={`${feitas}/${acoes.length}`} cor="text-emerald-700 dark:text-emerald-400" barra={acoes.length ? feitas / acoes.length : 0} />
        <Resumo rotulo="Atrasadas ou bloqueadas" valor={String(atrasadas)} cor="text-red-700 dark:text-red-400" />
        <Resumo rotulo="Prazo curto" valor={String(curtas)} cor="text-amber-700 dark:text-amber-400" />
        <Resumo rotulo="Próximo prazo" valor={proxima ? fmt(proxima.fim) : "—"} detalhe={proxima?.acao} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar ação, pessoa ou material"
          aria-label="Buscar"
          className="min-h-10 min-w-0 flex-1 basis-60 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        {(["todas", "pendentes", "alerta", "feito"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            aria-pressed={filtro === f}
            className={`min-h-9 rounded-full border px-3 text-[13px] font-semibold ${filtro === f ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900" : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"}`}
          >
            {{ todas: "Todas", pendentes: "Pendentes", alerta: "Com alerta", feito: "Feitas" }[f]}
          </button>
        ))}
        <button type="button" onClick={() => setEditando(VAZIA(hoje))} className="flex min-h-10 items-center gap-1.5 rounded-lg bg-na-green px-4 text-sm font-bold text-white hover:bg-na-green-dark">
          <Plus className="size-4" aria-hidden /> Nova ação
        </button>
      </div>

      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{erro}</p>}

      {grupos.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">Nenhuma ação com esse filtro.</p>}

      {grupos.map(([fase, lista]) => (
        <section key={fase} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-800/50">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">{fase}</h2>
            <span className="font-mono text-xs text-gray-500">
              {fmt(lista.reduce((m, x) => (x.a.inicio < m ? x.a.inicio : m), lista[0].a.inicio))} → {fmt(lista.reduce((m, x) => (x.a.fim > m ? x.a.fim : m), lista[0].a.fim))}
            </span>
            <span className="ml-auto text-xs text-gray-500">
              {lista.filter((x) => x.a.status === "feito").length} de {lista.length} feitas
            </span>
          </header>
          <div className="hidden grid-cols-[104px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.3fr)_170px_132px_36px] gap-3 border-b border-gray-200 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 lg:grid dark:border-gray-800">
            <span>Datas</span>
            <span>Ação</span>
            <span>Pessoas necessárias</span>
            <span>Tarefas e materiais</span>
            <span>Tempo médio</span>
            <span>Situação</span>
            <span />
          </div>
          {lista.map(({ a, al }) => (
            <Linha
              key={a.id}
              a={a}
              al={al}
              aberto={abertos.has(a.id)}
              alternar={() => setAbertos((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })}
              editar={() => setEditando(a)}
              situacao={(s) => rodar(() => mudarSituacao(a.id, s))}
              registrar={(t, limpar) => rodar(() => registrar(a.id, t), limpar)}
            />
          ))}
        </section>
      ))}

      {editando && (
        <Formulario
          inicial={editando}
          fases={[...new Set(acoes.map((a) => a.fase))]}
          fechar={() => setEditando(null)}
          salvar={(d) => rodar(() => salvarAcao(d), () => setEditando(null))}
          excluir={(id) => rodar(() => excluirAcao(id), () => setEditando(null))}
          pendente={pendente}
        />
      )}
    </div>
  );
}

function Resumo({ rotulo, valor, cor = "text-gray-900 dark:text-gray-100", barra, detalhe }: { rotulo: string; valor: string; cor?: string; barra?: number; detalhe?: string }) {
  return (
    <div className="grid content-start gap-0.5 rounded-xl border border-gray-200 bg-white px-3.5 py-3 dark:border-gray-800 dark:bg-gray-900">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{rotulo}</span>
      <b className={`text-2xl font-black tabular-nums ${cor}`}>{valor}</b>
      {barra !== undefined && (
        <span className="mt-1 h-1.5 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
          <span className="block h-full bg-na-green" style={{ width: `${Math.round(barra * 100)}%` }} />
        </span>
      )}
      {detalhe && <span className="line-clamp-2 text-xs text-gray-500">{detalhe}</span>}
    </div>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500 lg:hidden">{children}</span>;
}

function Linha(p: { a: AcaoCronograma; al: Alerta; aberto: boolean; alternar: () => void; editar: () => void; situacao: (s: Situacao) => void; registrar: (t: string, limpar: () => void) => void }) {
  const { a, al } = p;
  const pessoas = a.pessoas.split(",").map((x) => x.trim()).filter(Boolean);
  const materiais = a.materiais.split("\n").map((x) => x.trim()).filter(Boolean);
  const Icone = ICONE_ALERTA[al.tipo];
  const campo = useRef<HTMLInputElement>(null);
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-b border-gray-200 px-4 py-3 last:border-b-0 lg:grid-cols-[104px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.3fr)_170px_132px_36px] dark:border-gray-800">
      <div className="font-mono text-[12.5px] tabular-nums text-gray-800 dark:text-gray-200">
        <Rotulo>Datas</Rotulo>
        {fmt(a.inicio)}
        {a.fim !== a.inicio && (
          <>
            <span className="block font-sans text-[11px] text-gray-500">até</span>
            {fmt(a.fim)}
          </>
        )}
      </div>
      <div className="order-first col-span-2 min-w-0 lg:order-none lg:col-span-1">
        <Rotulo>Ação</Rotulo>
        <p className={`font-semibold ${a.status === "feito" ? "text-gray-500 line-through" : "text-gray-900 dark:text-gray-100"}`}>{a.acao}</p>
        {a.obs && <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-gray-500">{a.obs}</p>}
        <button type="button" onClick={p.alternar} aria-expanded={p.aberto} className="mt-1 text-[12.5px] font-semibold text-na-green dark:text-emerald-400">
          {p.aberto ? "Fechar registro" : `Registro${a.registros.length ? ` (${a.registros.length})` : ""}`}
        </button>
      </div>
      <div className="col-span-2 min-w-0 lg:col-span-1">
        <Rotulo>Pessoas necessárias</Rotulo>
        <div className="flex flex-wrap gap-1">
          {pessoas.length ? pessoas.map((x) => <span key={x} className="rounded-md bg-na-green-light px-1.5 py-0.5 text-[12.5px] text-na-green-dark dark:bg-emerald-950 dark:text-emerald-300">{x}</span>) : <span className="text-gray-400">—</span>}
        </div>
      </div>
      <div className="col-span-2 min-w-0 text-[13px] text-gray-700 lg:col-span-1 dark:text-gray-300">
        <Rotulo>Tarefas e materiais</Rotulo>
        {materiais.length ? <ul className="list-disc space-y-0.5 pl-4">{materiais.map((x, i) => <li key={i}>{x}</li>)}</ul> : <span className="text-gray-400">—</span>}
      </div>
      <div className="min-w-0 text-[12.5px]">
        <Rotulo>Tempo médio</Rotulo>
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${COR_ALERTA[al.tipo]}`}>
          <Icone className="size-3.5 shrink-0" aria-hidden />
          {al.titulo}
        </span>
        {al.detalhe && <p className="mt-1 text-gray-500">{al.detalhe}</p>}
      </div>
      <div>
        <Rotulo>Situação</Rotulo>
        <select
          value={a.status}
          onChange={(e) => p.situacao(e.target.value as Situacao)}
          aria-label={`Situação de ${a.acao}`}
          className={`min-h-8 w-full rounded-full border px-2.5 text-[12.5px] font-semibold ${COR_SITUACAO[a.status]}`}
        >
          {Object.entries(SITUACOES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="order-first col-start-2 row-start-1 justify-self-end lg:order-none lg:col-start-auto lg:row-start-auto">
        <button type="button" onClick={p.editar} aria-label={`Editar ${a.acao}`} title="Editar" className="grid size-9 place-items-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100">
          <Pencil className="size-4" aria-hidden />
        </button>
      </div>
      {p.aberto && (
        <div className="col-span-2 grid gap-2 rounded-lg bg-gray-50 p-3 lg:col-span-6 lg:col-start-2 dark:bg-gray-800/60">
          {a.registros.length ? (
            <ol className="grid gap-1">
              {a.registros.map((r, i) => (
                <li key={i} className="flex gap-3 text-[13px]">
                  <time className="shrink-0 pt-px font-mono text-[11.5px] text-gray-500">{fmt(r.em)}</time>
                  <span>{r.texto}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-gray-500">Nada registrado ainda.</p>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = campo.current?.value.trim();
              if (t) p.registrar(t, () => { if (campo.current) campo.current.value = ""; });
            }}
          >
            <input ref={campo} maxLength={500} placeholder="O que aconteceu? Ex.: tesoureiro enviou a ata" aria-label="Novo registro" className="min-h-9 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2.5 text-sm dark:border-gray-700 dark:bg-gray-900" />
            <button type="submit" className="rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800">
              Registrar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Formulario(p: { inicial: AcaoCronograma; fases: string[]; fechar: () => void; salvar: (d: Omit<AcaoCronograma, "registros" | "id"> & { id?: string }) => void; excluir: (id: string) => void; pendente: boolean }) {
  const [d, setD] = useState(p.inicial);
  const [confirmar, setConfirmar] = useState(false);
  const muda = <K extends keyof AcaoCronograma>(k: K, v: AcaoCronograma[K]) => setD((x) => ({ ...x, [k]: v }));
  const cls = "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950";
  const lbl = "grid gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="cron-dlg" onClick={(e) => e.target === e.currentTarget && p.fechar()}>
      <form
        className="grid max-h-[calc(100dvh-2rem)] w-full max-w-2xl gap-3 overflow-y-auto rounded-2xl bg-white p-5 dark:bg-gray-900"
        onSubmit={(e) => {
          e.preventDefault();
          const { registros: _r, ...resto } = d;
          void _r;
          p.salvar({ ...resto, id: d.id || undefined });
        }}
      >
        <h2 id="cron-dlg" className="text-lg font-black text-gray-900 dark:text-gray-100">{p.inicial.id ? "Editar ação" : "Nova ação"}</h2>
        <label className={lbl}>Ação<input required autoFocus maxLength={300} value={d.acao} onChange={(e) => muda("acao", e.target.value)} className={cls} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={lbl}>
            Fase
            <input required list="cron-fases" value={d.fase} onChange={(e) => muda("fase", e.target.value)} placeholder="Ex.: Semana 1 — contato e contas" className={cls} />
            <datalist id="cron-fases">{p.fases.map((f) => <option key={f} value={f} />)}</datalist>
          </label>
          <label className={lbl}>
            Situação
            <select value={d.status} onChange={(e) => muda("status", e.target.value as Situacao)} className={cls}>
              {Object.entries(SITUACOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className={lbl}>Início<input type="date" required value={d.inicio} onChange={(e) => muda("inicio", e.target.value)} className={cls} /></label>
          <label className={lbl}>Prazo final<input type="date" required min={d.inicio} value={d.fim} onChange={(e) => muda("fim", e.target.value)} className={cls} /></label>
        </div>
        <label className={lbl}>Pessoas necessárias<input value={d.pessoas} onChange={(e) => muda("pessoas", e.target.value)} placeholder="Separe por vírgula: Henrique, Tesoureiro GYN" className={cls} /></label>
        <label className={lbl}>Tarefas e materiais necessários<textarea rows={4} value={d.materiais} onChange={(e) => muda("materiais", e.target.value)} placeholder="Um por linha" className={cls} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={lbl}>Tempo médio (texto)<input value={d.duracao} onChange={(e) => muda("duracao", e.target.value)} placeholder="Ex.: 1 a 3 dias úteis" className={cls} /></label>
          <label className={lbl}>
            Tempo médio em dias úteis
            <input type="number" min={0} step={0.5} value={d.dias ?? ""} onChange={(e) => muda("dias", e.target.value === "" ? null : Number(e.target.value))} className={cls} />
            <span className="font-normal text-gray-500">Usado no alerta de prazo curto.</span>
          </label>
        </div>
        <label className={lbl}>Observações<textarea rows={2} value={d.obs} onChange={(e) => muda("obs", e.target.value)} className={cls} /></label>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {p.inicial.id ? (
            <button
              type="button"
              onClick={() => (confirmar ? p.excluir(p.inicial.id) : setConfirmar(true))}
              className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${confirmar ? "border-red-700 bg-red-700 text-white" : "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400"}`}
            >
              {confirmar ? "Confirmar exclusão" : "Excluir"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={p.fechar} className="min-h-10 rounded-lg border border-gray-300 px-4 text-sm font-semibold dark:border-gray-700">Cancelar</button>
            <button type="submit" disabled={p.pendente} className="min-h-10 rounded-lg bg-na-green px-4 text-sm font-bold text-white hover:bg-na-green-dark disabled:opacity-60">
              {p.pendente ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
