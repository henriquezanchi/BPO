"use client";

import { CollapsibleSection } from "@/components/ui/collapsible-section";
import {
  abrirArquivoPlano,
  editarApresentacao,
  gravarEscala,
  registrarTemasAnteriores,
  linkEnvioPlano,
  marcarApresentacaoAvulsa,
  cancelarMinhaApresentacao,
  corrigirApresentacao,
  marcarApresentacao,
  preverEscala,
  registrarArquivoPlano,
  removerApresentacao,
  revisarPlano,
  salvarPlano,
} from "@/lib/actions/escala-actions";
import { chaveTema, programaDaDisciplina, type Programa, type TemaDoPrograma, sequenciaDosPedagogos } from "@/lib/pedagogos-programa";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, Loader2, Paperclip, Pencil, Sparkles, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type PlanoView = {
  status: string;
  sintese: string | null;
  praticaFilosofica: string | null;
  ponteParaVida: string | null;
  consequencias: string | null;
  arquivoNome: string | null;
  entregueEm: string | null;
  comentarioInstrutor: string | null;
};
export type ApresentacaoView = {
  id: string;
  data: string;
  ordem: number;
  pedagogoId: string;
  pedagogo: string;
  materiaSigla: string | null;
  tema: string;
  topicos: string[];
  status: string;
  prazo: string;
  situacao: "aprovado" | "entregue" | "devolvido" | "atrasado" | "no_prazo";
  plano: PlanoView | null;
};
type Disciplina = { sigla: string; nome: string; temas: { titulo: string; topicos: string[] }[] };
export type ProgressoView = {
  sigla: string;
  programa: string;
  total: number;
  pessoas: { id: string; nome: string; apresentados: number; marcados: number; proximo: string | null; anteriores: string[]; pelaEscala: string[] }[];
};
type Linha = { pedagogoId: string; pedagogo: string; data: string; ordem: number; materiaSigla: string; tema: string; topicos: string[] };

const CARTAO = "rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900";
const TITULO = "text-[11px] font-bold tracking-wide text-gray-600 uppercase dark:text-gray-300";
const CAMPO = "min-h-10 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-[13px] text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100";
const ROTULO = "flex flex-col gap-1 text-[12px] font-semibold text-gray-700 dark:text-gray-300";
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const PONTOS = [
  ["sintese", "Síntese", "A ideia central da aula, em poucas linhas."],
  ["praticaFilosofica", "Prática Filosófica", "Como os alunos vão vivenciar a ideia na aula."],
  ["ponteParaVida", "Ponte para a Vida", "Como a ideia se aplica no dia a dia."],
  ["consequencias", "Consequências quando essa ideia não é vivida", "O que acontece quando ela falta."],
] as const;

/** "Ética · 1. Filosofia natural": a disciplina na frente quando o programa tem mais de uma (os números se repetem). */
const temaComDisciplina = (a: { materiaSigla: string | null; tema: string }) => {
  const p = programaDaDisciplina(a.materiaSigla);
  const d = p && p.disciplinas > 1 ? p.temas.find((t) => t.sigla === a.materiaSigla)?.disciplina : null;
  return d ? `${d} · ${a.tema}` : a.tema;
};
const dataBR = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
};
const SITUACAO: Record<ApresentacaoView["situacao"], [string, string]> = {
  aprovado: ["Plano aprovado", "bg-na-success-light text-na-success-dark dark:bg-emerald-950/50 dark:text-emerald-300"],
  entregue: ["Plano entregue, a revisar", "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300"],
  devolvido: ["Plano devolvido para ajustes", "bg-na-warning-light text-na-warning-dark dark:bg-amber-950/50 dark:text-amber-300"],
  atrasado: ["Plano atrasado", "bg-na-danger-light text-na-danger-dark dark:bg-red-950/50 dark:text-red-300"],
  no_prazo: ["Plano até", "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"],
};
function Etiqueta({ a }: { a: ApresentacaoView }) {
  const [rotulo, cor] = SITUACAO[a.situacao];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cor}`}>{a.situacao === "no_prazo" ? `${rotulo} ${a.prazo.slice(8, 10)}/${a.prazo.slice(5, 7)}` : rotulo}</span>;
}

export function EscalaPedagogos({
  grupoId,
  hoje,
  euId,
  podeGerir,
  podeAjustar,
  proximos = {},
  trilhas = {},
  pedagogos,
  disciplinas,
  programas,
  progresso,
  apresentacoes,
}: {
  grupoId: string;
  hoje: string;
  euId: string;
  podeGerir: boolean;
  /** Pedagogo da turma ou quem gere: ajusta disciplina, tema e data das apresentações (23/11/2026). */
  podeAjustar?: boolean;
  /** Próximo tema de cada pedagogo na sequência da formação (chave), 23/11/2026. */
  proximos?: Record<string, string | null>;
  /** Temas já marcados ou feitos de cada pedagogo (chaves), para sugerir o próximo. */
  trilhas?: Record<string, string[]>;
  pedagogos: { id: string; nome: string }[];
  disciplinas: Disciplina[];
  programas: Programa[];
  progresso: ProgressoView[];
  apresentacoes: ApresentacaoView[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
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

  const abertas = apresentacoes.filter((a) => a.status === "agendada" && a.data >= hoje);
  const passadas = apresentacoes.filter((a) => !(a.status === "agendada" && a.data >= hoje));
  // Correção do que aconteceu (24/11/2026): tema diferente, continuação, apresentou/não apresentou.
  const [corrigindo, setCorrigindo] = useState<string | null>(null);
  const minhas = abertas.filter((a) => a.pedagogoId === euId);
  const atrasados = abertas.filter((a) => a.situacao === "atrasado");
  const aRevisar = abertas.filter((a) => a.situacao === "entregue");
  const porData = new Map<string, ApresentacaoView[]>();
  for (const a of abertas) porData.set(a.data, [...(porData.get(a.data) ?? []), a]);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Cada pedagogo apresenta sua aula em 15 minutos ao instrutor dos pedagogos. O plano de aula é entregue até 7 dias antes da apresentação.
      </p>
      {erro && <p role="alert" className="rounded-xl bg-na-danger-light px-3 py-2 text-[13px] text-na-danger-dark dark:bg-red-950/30 dark:text-red-300">{erro}</p>}

      {minhas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className={TITULO}>Minhas apresentações</h2>
          {minhas.map((a) => (
            <MeuPlano key={a.id} a={a} pendente={pendente} rodar={rodar} />
          ))}
        </section>
      )}

      {podeGerir && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Próximas", abertas.length, "apresentações marcadas"],
            ["A revisar", aRevisar.length, "planos entregues"],
            ["Atrasados", atrasados.length, "plano não entregue no prazo"],
            ["Pedagogos", pedagogos.length, "na turma"],
          ].map(([r, v, d]) => (
            <div key={String(r)} className={`${CARTAO} !p-3 ${r === "Atrasados" && Number(v) > 0 ? "border-na-danger/40 dark:border-red-900" : ""}`}>
              <p className="text-2xl font-black text-gray-900 tabular-nums dark:text-gray-100">{v}</p>
              <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">{r}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{d}</p>
            </div>
          ))}
        </div>
      )}

      {podeGerir && atrasados.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-na-danger/30 bg-na-danger-light px-3 py-2 text-[13px] text-na-danger-dark dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>Planos atrasados: {atrasados.map((a) => `${a.pedagogo.split(" ")[0]} (${dataBR(a.data)})`).join(", ")}.</span>
        </p>
      )}

      {podeGerir && <GerarRodada grupoId={grupoId} hoje={hoje} pedagogos={pedagogos} pendente={pendente} rodar={rodar} />}
      {(podeGerir || podeAjustar) && pedagogos.length > 0 && <MarcarUma grupoId={grupoId} hoje={hoje} proximos={proximos} trilhas={trilhas} pedagogos={pedagogos} pendente={pendente} rodar={rodar} />}

      {progresso.some((p) => p.pessoas.length > 0) && <ProgressoPrograma grupoId={grupoId} progresso={progresso} programas={programas} podeGerir={podeGerir} pendente={pendente} rodar={rodar} />}

      <section className="flex flex-col gap-2">
        <h2 className={TITULO}>Escala</h2>
        {porData.size === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 p-4 text-center text-[13px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
            {podeGerir ? "Nenhuma apresentação marcada. Gere a próxima rodada acima." : "O instrutor dos pedagogos ainda não montou a escala."}
          </p>
        ) : (
          [...porData.entries()].map(([data, lista]) => (
            <div key={data} className={`${CARTAO} flex flex-col gap-2 !p-3`}>
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-gray-900 capitalize dark:text-gray-100">
                <CalendarClock size={14} className="text-na-green" /> {dataBR(data)}
              </p>
              {lista.map((a) => (
                <LinhaEscala key={a.id} a={a} hoje={hoje} minha={a.pedagogoId === euId} podeGerir={podeGerir} podeAjustar={podeGerir || !!podeAjustar} pedagogos={pedagogos} disciplinas={disciplinas} pendente={pendente} rodar={rodar} />
              ))}
            </div>
          ))
        )}
      </section>

      {passadas.length > 0 && (
        <section className={CARTAO}>
          <CollapsibleSection defaultOpen={false} title={<h2 className={TITULO}>Já aconteceram ({passadas.length})</h2>}>
            <ul className="mt-2 flex flex-col divide-y divide-gray-100 text-[12px] dark:divide-gray-800">
              {[...passadas].reverse().map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 text-gray-800 dark:text-gray-200">
                    <b>{a.pedagogo}</b> · {temaComDisciplina(a)} <span className="text-gray-500">· {dataBR(a.data)}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-500 dark:text-gray-400">
                      {a.status === "apresentada" ? "Apresentou" : a.status === "faltou" ? "Não apresentou" : a.status === "cancelada" ? "Cancelada" : "Sem registro"}
                    </span>
                    {podeGerir && a.status === "agendada" && (
                      <>
                        <button disabled={pendente} onClick={() => rodar(() => marcarApresentacao(a.id, "apresentada"))} className="rounded-lg bg-na-green px-2 py-1 font-semibold text-white">Apresentou</button>
                        <button disabled={pendente} onClick={() => rodar(() => marcarApresentacao(a.id, "faltou"))} className="rounded-lg border border-gray-300 px-2 py-1 font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">Não apresentou</button>
                      </>
                    )}
                    {podeGerir && a.status !== "cancelada" && (
                      <button disabled={pendente} onClick={() => setCorrigindo(corrigindo === a.id ? null : a.id)} className="flex items-center gap-1 font-semibold text-na-green-dark hover:underline dark:text-emerald-400">
                        <Pencil size={12} /> {corrigindo === a.id ? "Fechar" : "O que foi apresentado"}
                      </button>
                    )}
                  </span>
                  {corrigindo === a.id && <CorrigirPassada a={a} disciplinas={disciplinas} pendente={pendente} rodar={rodar} fechar={() => setCorrigindo(null)} />}
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        </section>
      )}
    </div>
  );
}

type Rodar = (acao: () => Promise<{ ok: boolean; error?: string }>, depois?: () => void) => void;

/**
 * O que foi apresentado de fato (24/11/2026): a pessoa pode ter apresentado outro tema, ou a continuação do tema
 * anterior (ex.: Bhagavad Gita em duas semanas), e isso precisa ficar certo para a sequência da formação.
 */
function CorrigirPassada({ a, disciplinas, pendente, rodar, fechar }: { a: ApresentacaoView; disciplinas: Disciplina[]; pendente: boolean; rodar: Rodar; fechar: () => void }) {
  const [status, setStatus] = useState<"apresentada" | "faltou">(a.status === "faltou" ? "faltou" : "apresentada");
  const [modoTema, setModoTema] = useState<"mesmo" | "outro" | "continuacao">("mesmo");
  const [ed, setEd] = useState({ materiaSigla: a.materiaSigla, tema: a.tema });
  const temas = disciplinas.find((d) => d.sigla === ed.materiaSigla)?.temas ?? [];
  return (
    <div className="basis-full rounded-xl bg-gray-50 p-3 text-[12px] dark:bg-gray-950/40">
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-1.5 font-semibold"><input type="radio" name={`st-${a.id}`} checked={status === "apresentada"} onChange={() => setStatus("apresentada")} /> Apresentou</label>
        <label className="flex items-center gap-1.5 font-semibold"><input type="radio" name={`st-${a.id}`} checked={status === "faltou"} onChange={() => setStatus("faltou")} /> Não apresentou</label>
      </div>
      {status === "apresentada" && (
        <div className="mt-2 flex flex-wrap gap-3">
          <label className="flex items-center gap-1.5"><input type="radio" name={`tm-${a.id}`} checked={modoTema === "mesmo"} onChange={() => setModoTema("mesmo")} /> O tema marcado ({a.tema})</label>
          <label className="flex items-center gap-1.5"><input type="radio" name={`tm-${a.id}`} checked={modoTema === "continuacao"} onChange={() => setModoTema("continuacao")} /> Continuação do tema anterior (2ª parte)</label>
          <label className="flex items-center gap-1.5"><input type="radio" name={`tm-${a.id}`} checked={modoTema === "outro"} onChange={() => setModoTema("outro")} /> Outro tema</label>
        </div>
      )}
      {status === "apresentada" && modoTema === "outro" && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select aria-label="Disciplina" value={ed.materiaSigla ?? ""} onChange={(e) => { const sigla = e.target.value || null; setEd({ materiaSigla: sigla, tema: disciplinas.find((d) => d.sigla === sigla)?.temas[0]?.titulo ?? ed.tema }); }} className={CAMPO}>
            {disciplinas.map((d) => <option key={d.sigla} value={d.sigla}>{d.nome}</option>)}
          </select>
          {temas.length ? (
            <select aria-label="Tema" value={ed.tema} onChange={(e) => setEd({ ...ed, tema: e.target.value })} className={CAMPO}>
              {temas.map((t) => <option key={t.titulo} value={t.titulo}>{t.titulo}</option>)}
            </select>
          ) : (
            <input aria-label="Tema" value={ed.tema} onChange={(e) => setEd({ ...ed, tema: e.target.value })} className={CAMPO} />
          )}
        </div>
      )}
      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">A sequência da formação segue a partir do que foi apresentado de fato. A continuação conta como o mesmo tema; a próxima rodada vai para o seguinte.</p>
      <div className="mt-2 flex gap-2">
        <button
          disabled={pendente}
          onClick={() => rodar(() => corrigirApresentacao(a.id, status === "faltou" ? { status } : modoTema === "continuacao" ? { status, continuacao: true } : modoTema === "outro" ? { status, materiaSigla: ed.materiaSigla, tema: ed.tema } : { status }), fechar)}
          className="rounded-lg bg-na-green px-3 py-1.5 font-semibold text-white"
        >
          Salvar
        </button>
        <button onClick={fechar} className="px-2 font-semibold text-gray-500">Cancelar</button>
      </div>
    </div>
  );
}

/** Temas da formação agrupados por disciplina, na ordem da sequência (Ética, Sociedade, Filosofia da História, Psicologia, ISO). */
function OpcoesDeTema({ feitos }: { feitos: Set<string> }) {
  const seq = sequenciaDosPedagogos();
  const disciplinas = [...new Set(seq.map((t) => t.disciplina))];
  return (
    <>
      {disciplinas.map((d) => (
        <optgroup key={d} label={d}>
          {seq
            .filter((t) => t.disciplina === d)
            .map((t) => {
              const k = chaveTema(t.sigla, t.titulo);
              return <option key={k} value={k}>{feitos.has(k) ? "✓ " : ""}{t.titulo}</option>;
            })}
        </optgroup>
      ))}
    </>
  );
}
const temaPelaChave = (k: string | null | undefined) => (k ? (sequenciaDosPedagogos().find((t) => chaveTema(t.sigla, t.titulo) === k) ?? null) : null);

/** Marcar uma apresentação só, fora da rodada (23/11/2026): pessoa, data e tema (já vem o próximo da sequência dela). */
function MarcarUma({ grupoId, hoje, proximos, trilhas, pedagogos, pendente, rodar }: { grupoId: string; hoje: string; proximos: Record<string, string | null>; trilhas: Record<string, string[]>; pedagogos: { id: string; nome: string }[]; pendente: boolean; rodar: Rodar }) {
  const [aberto, setAberto] = useState(false);
  const inicial = (id: string) => proximos[id] ?? chaveTema(sequenciaDosPedagogos()[0]?.sigla ?? null, sequenciaDosPedagogos()[0]?.titulo ?? "");
  const [pessoa, setPessoa] = useState(pedagogos[0]?.id ?? "");
  const [chave, setChave] = useState(() => inicial(pedagogos[0]?.id ?? ""));
  const [data, setData] = useState("");
  if (!aberto)
    return (
      <button onClick={() => setAberto(true)} className="flex w-fit items-center gap-1.5 rounded-xl border border-na-green px-4 py-2 text-[13px] font-bold text-na-green-dark dark:text-emerald-400">
        <CalendarClock size={15} /> Marcar uma apresentação
      </button>
    );
  return (
    <section className={`${CARTAO} flex flex-col gap-3`}>
      <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100">Marcar uma apresentação</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
        <label className={ROTULO}>
          Pedagogo
          <select value={pessoa} onChange={(e) => { setPessoa(e.target.value); setChave(inicial(e.target.value)); }} className={CAMPO}>
            {pedagogos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        <label className={ROTULO}>
          Data
          <input type="date" value={data} min={hoje} onChange={(e) => setData(e.target.value)} className={CAMPO} />
        </label>
        <label className={`${ROTULO} sm:col-span-2`}>
          Tema
          <select value={chave} onChange={(e) => setChave(e.target.value)} className={CAMPO}>
            <OpcoesDeTema feitos={new Set(trilhas[pessoa] ?? [])} />
          </select>
        </label>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">Já vem o tema seguinte ao da última apresentação da pessoa. ✓ = tema que ela já apresentou ou tem marcado.</p>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pendente || !data || !temaPelaChave(chave)}
          onClick={() => {
            const t = temaPelaChave(chave);
            if (t) rodar(() => marcarApresentacaoAvulsa(grupoId, { pedagogoId: pessoa, data, materiaSigla: t.sigla, tema: t.titulo }), () => { setAberto(false); setData(""); });
          }}
          className="flex items-center gap-1.5 rounded-xl bg-na-green px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
        >
          {pendente && <Loader2 size={14} className="animate-spin" />} Marcar e avisar a pessoa
        </button>
        <button onClick={() => setAberto(false)} className="px-2 text-[13px] font-semibold text-gray-500">Cancelar</button>
      </div>
    </section>
  );
}

function GerarRodada({ grupoId, hoje, pedagogos, pendente, rodar }: { grupoId: string; hoje: string; pedagogos: { id: string; nome: string }[]; pendente: boolean; rodar: Rodar }) {
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState(() => new Date(Date.parse(`${hoje}T12:00:00Z`) + 8 * 864e5).toISOString().slice(0, 10));
  const [porEncontro, setPorEncontro] = useState(2);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [trilhas, setTrilhas] = useState<Record<string, string[]>>({});
  const [proximos, setProximos] = useState<Record<string, string | null>>({});
  const [concluiram, setConcluiram] = useState<string[]>([]);
  /** Pedagogos deixados fora desta rodada (24/11/2026). */
  const [fora, setFora] = useState<Set<string>>(new Set());

  if (!aberto)
    return (
      <button onClick={() => setAberto(true)} className="flex w-fit items-center gap-1.5 rounded-xl bg-na-green px-4 py-2 text-[13px] font-bold text-white hover:bg-na-green-dark">
        <Sparkles size={15} /> Gerar a próxima rodada
      </button>
    );
  return (
    <section className={`${CARTAO} flex flex-col gap-3 border-na-green/40`}>
      <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100">Próxima rodada: cada pedagogo apresenta o tema seguinte ao da última apresentação dele</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ROTULO}>
          A partir de
          <input type="date" value={inicio} min={hoje} onChange={(e) => { setInicio(e.target.value); setLinhas(null); }} className={CAMPO} />
        </label>
        <label className={ROTULO}>
          Apresentações por encontro
          <select value={porEncontro} onChange={(e) => { setPorEncontro(Number(e.target.value)); setLinhas(null); }} className={CAMPO}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} ({n * 15} min)</option>)}
          </select>
        </label>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">Quem entra nesta rodada ({pedagogos.length - fora.size} de {pedagogos.length})</legend>
        <div className="flex flex-wrap gap-1.5">
          {pedagogos.map((p) => {
            const entra = !fora.has(p.id);
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${entra ? "border-na-green/60 bg-na-success-light text-na-success-dark dark:bg-emerald-950/30 dark:text-emerald-300" : "border-gray-300 text-gray-500 line-through dark:border-gray-700"}`}
              >
                <input
                  type="checkbox"
                  checked={entra}
                  onChange={() => {
                    setFora((atual) => {
                      const novo = new Set(atual);
                      if (novo.has(p.id)) novo.delete(p.id);
                      else novo.add(p.id);
                      return novo;
                    });
                    setLinhas(null);
                  }}
                  className="accent-na-green"
                />
                {p.nome.split(" ").slice(0, 2).join(" ")}
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Desmarque quem não deve apresentar nesta rodada; as datas se reorganizam sem a pessoa, e na próxima ela continua de onde parou.
        A formação segue esta ordem: Ética, Sociedade, Filosofia da História, Psicologia e ISO. Cada pedagogo continua de onde parou, sem ligação com os colegas; quem não apresentou repete o tema; quem mudou de tema à mão continua dali. As datas seguem os encontros da aba Encontros (ou semanais, no dia da data de início). Quem apresentou há mais tempo vem primeiro.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pendente}
          onClick={() =>
            rodar(async () => {
              const r = await preverEscala(grupoId, { inicio, porEncontro, excluir: [...fora] });
              if (r.ok) {
                setLinhas(r.linhas);
                setTrilhas(r.trilhas);
                setProximos(r.proximos);
                setConcluiram(r.concluiram);
              }
              return r;
            })
          }
          className="flex items-center gap-1.5 rounded-lg border border-na-green px-3 py-1.5 text-[13px] font-semibold text-na-green-dark dark:text-emerald-400"
        >
          {pendente && <Loader2 size={14} className="animate-spin" />} Montar prévia
        </button>
        <button onClick={() => { setAberto(false); setLinhas(null); }} className="px-2 text-[13px] font-semibold text-gray-500">Cancelar</button>
      </div>
      {linhas && (
        <div className="flex flex-col gap-2">
          {concluiram.length > 0 && (
            <p className="rounded-lg bg-na-success-light px-3 py-2 text-[12px] text-na-success-dark dark:bg-emerald-950/30 dark:text-emerald-300">
              Já chegaram ao fim da formação (ficam fora): {concluiram.map((n) => n.split(" ").slice(0, 2).join(" ")).join(", ")}.
            </p>
          )}
          <p className="text-[12px] text-gray-600 dark:text-gray-300">Ajuste o que quiser antes de gravar. ✓ = tema que a pessoa já apresentou ou tem marcado.</p>
          {linhas.map((l, i) => {
            const mudar = (parte: Partial<Linha>) => setLinhas((atual) => atual!.map((x, k) => (k === i ? { ...x, ...parte } : x)));
            const temaDe = (t: TemaDoPrograma) => ({ materiaSigla: t.sigla, tema: t.titulo, topicos: t.topicos });
            return (
              <div key={i} className="grid gap-2 rounded-xl border border-gray-200 p-2 sm:grid-cols-[1fr_9rem_1.4fr_auto] dark:border-gray-800">
                <select
                  aria-label="Pedagogo"
                  value={l.pedagogoId}
                  onChange={(e) => {
                    const t = temaPelaChave(proximos[e.target.value]);
                    mudar({ pedagogoId: e.target.value, pedagogo: pedagogos.find((p) => p.id === e.target.value)?.nome ?? "", ...(t ? temaDe(t) : {}) });
                  }}
                  className={CAMPO}
                >
                  {pedagogos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <input aria-label="Data" type="date" value={l.data} onChange={(e) => mudar({ data: e.target.value })} className={CAMPO} />
                <select
                  aria-label="Tema"
                  value={chaveTema(l.materiaSigla, l.tema)}
                  onChange={(e) => {
                    const t = temaPelaChave(e.target.value);
                    if (t) mudar(temaDe(t));
                  }}
                  className={CAMPO}
                >
                  <OpcoesDeTema feitos={new Set(trilhas[l.pedagogoId] ?? [])} />
                </select>
                <button
                  type="button"
                  aria-label={`Tirar ${l.pedagogo} desta rodada`}
                  title="Tirar desta rodada"
                  onClick={() => setLinhas((atual) => atual!.filter((_, k) => k !== i))}
                  className="flex items-center gap-1 justify-self-end self-center rounded-lg p-1.5 text-[12px] text-gray-400 hover:bg-gray-100 hover:text-na-danger-dark dark:hover:bg-gray-800"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
          <button
            disabled={pendente || linhas.length === 0}
            onClick={() => rodar(() => gravarEscala(grupoId, linhas), () => { setLinhas(null); setAberto(false); setFora(new Set()); })}
            className="flex w-fit items-center gap-1.5 rounded-xl bg-na-green px-4 py-2 text-[13px] font-bold text-white hover:bg-na-green-dark"
          >
            {pendente && <Loader2 size={14} className="animate-spin" />} Gravar a escala e avisar os pedagogos
          </button>
        </div>
      )}
    </section>
  );
}

/** Progresso de cada pedagogo no programa (pedido do usuário 2026-10-29): conclui quem apresentou todos os temas. */
function ProgressoPrograma({
  grupoId,
  progresso,
  programas,
  podeGerir,
  pendente,
  rodar,
}: {
  grupoId: string;
  progresso: ProgressoView[];
  programas: Programa[];
  podeGerir: boolean;
  pendente: boolean;
  rodar: Rodar;
}) {
  const [registrando, setRegistrando] = useState<string | null>(null);
  return (
    <section className={CARTAO}>
      <CollapsibleSection defaultOpen={false} title={<h2 className={TITULO}>Progresso na formação</h2>}>
        <div className="mt-2 flex flex-col gap-4">
          {podeGerir && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Para quem já apresentava antes do Portal, use “Temas já apresentados” e marque o que a pessoa já fez. Esses temas contam na trilha e não aparecem na escala.
            </p>
          )}
          {progresso.map((p) => {
            const programa = programas.find((x) => x.sigla === p.sigla);
            return (
              <div key={p.sigla} className="flex flex-col gap-2">
                <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">
                  {p.programa} · {p.total} temas
                </p>
                <ul className="flex flex-col gap-3">
                  {p.pessoas.map((x) => {
                    const concluiu = x.apresentados >= p.total;
                    const soMarcados = x.marcados - x.apresentados;
                    const chave = `${p.sigla}:${x.id}`;
                    return (
                      <li key={x.id} className="flex flex-col gap-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-[12px]">
                          <b className="text-gray-900 dark:text-gray-100">{x.nome}</b>
                          <span className={concluiu ? "font-semibold text-na-success-dark dark:text-emerald-300" : "text-gray-500 dark:text-gray-400"}>
                            {concluiu ? "Concluiu" : `${x.apresentados} de ${p.total} apresentados${soMarcados > 0 ? ` · ${soMarcados} marcado${soMarcados > 1 ? "s" : ""}` : ""}`}
                          </span>
                        </span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <span className="block h-full rounded-full bg-na-green" style={{ width: `${Math.round((x.apresentados / p.total) * 100)}%` }} />
                        </span>
                        <span className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                          <span>{!concluiu && x.proximo ? `Próximo: ${x.proximo}` : ""}</span>
                          {podeGerir && programa && registrando !== chave && (
                            <button onClick={() => setRegistrando(chave)} className="font-semibold text-na-green-dark hover:underline dark:text-emerald-400">
                              Temas já apresentados{x.anteriores.length ? ` (${x.anteriores.length})` : ""}
                            </button>
                          )}
                        </span>
                        {podeGerir && programa && registrando === chave && (
                          <TemasAnteriores
                            programa={programa}
                            pessoa={x}
                            pendente={pendente}
                            salvar={(chaves) => rodar(() => registrarTemasAnteriores(grupoId, x.id, p.sigla, chaves), () => setRegistrando(null))}
                            cancelar={() => setRegistrando(null)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>
    </section>
  );
}

/** Lista dos temas do programa para marcar o que a pessoa já apresentou antes do Portal. */
function TemasAnteriores({
  programa,
  pessoa,
  pendente,
  salvar,
  cancelar,
}: {
  programa: Programa;
  pessoa: ProgressoView["pessoas"][number];
  pendente: boolean;
  salvar: (chaves: string[]) => void;
  cancelar: () => void;
}) {
  const [marcados, setMarcados] = useState(() => new Set(pessoa.anteriores));
  const pelaEscala = new Set(pessoa.pelaEscala);
  const disciplinas = [...new Set(programa.temas.map((t) => t.disciplina))];
  const alternar = (k: string) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(k)) novo.delete(k);
      else novo.add(k);
      return novo;
    });
  return (
    <div className="mt-1 flex flex-col gap-3 rounded-xl border border-na-green/40 p-3">
      <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">O que {pessoa.nome.split(" ")[0]} já apresentou antes do Portal</p>
      {disciplinas.map((d) => {
        // Tocar no nome da disciplina marca todos os temas dela (ou desmarca, se já estavam todos marcados).
        const livres = programa.temas.filter((t) => t.disciplina === d).map((t) => chaveTema(t.sigla, t.titulo)).filter((k) => !pelaEscala.has(k));
        const todos = livres.length > 0 && livres.every((k) => marcados.has(k));
        const alternarDisciplina = () =>
          setMarcados((atual) => {
            const novo = new Set(atual);
            for (const k of livres) {
              if (todos) novo.delete(k);
              else novo.add(k);
            }
            return novo;
          });
        return (
        <fieldset key={d} className="flex flex-col gap-1">
          <legend className="mb-1">
            <button
              type="button"
              onClick={alternarDisciplina}
              className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gray-500 uppercase hover:text-na-green-dark dark:text-gray-400 dark:hover:text-emerald-400"
            >
              {d}
              <span className="font-semibold tracking-normal normal-case">· {todos ? "desmarcar todos" : "marcar todos"}</span>
            </button>
          </legend>
          {programa.temas
            .filter((t) => t.disciplina === d)
            .map((t) => {
              const k = chaveTema(t.sigla, t.titulo);
              const naEscala = pelaEscala.has(k);
              return (
                <label key={k} className={`flex items-center gap-2 text-[12px] ${naEscala ? "text-gray-400" : "text-gray-800 dark:text-gray-200"}`}>
                  <input type="checkbox" disabled={naEscala} checked={naEscala || marcados.has(k)} onChange={() => alternar(k)} className="h-4 w-4 accent-na-green" />
                  {t.titulo}
                  {naEscala && <span className="text-[11px]">(já na escala do Portal)</span>}
                </label>
              );
            })}
        </fieldset>
        );
      })}
      <div className="flex gap-2">
        <button
          disabled={pendente}
          onClick={() => salvar([...marcados])}
          className="flex items-center gap-1.5 rounded-lg bg-na-green px-3 py-1.5 text-[12px] font-bold text-white hover:bg-na-green-dark"
        >
          {pendente && <Loader2 size={13} className="animate-spin" />} Salvar
        </button>
        <button onClick={cancelar} className="px-2 text-[12px] font-semibold text-gray-500">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function LinhaEscala({ a, hoje, minha, podeGerir, podeAjustar, pedagogos, disciplinas, pendente, rodar }: { a: ApresentacaoView; hoje: string; minha: boolean; podeGerir: boolean; podeAjustar: boolean; pedagogos: { id: string; nome: string }[]; disciplinas: Disciplina[]; pendente: boolean; rodar: Rodar }) {
  const [modo, setModo] = useState<"nada" | "plano" | "editar">("nada");
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);
  const [comentario, setComentario] = useState(a.plano?.comentarioInstrutor ?? "");
  const [ed, setEd] = useState({ pedagogoId: a.pedagogoId, data: a.data, tema: a.tema, materiaSigla: a.materiaSigla });
  const temas = disciplinas.find((d) => d.sigla === ed.materiaSigla)?.temas ?? [];
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-100 p-2.5 dark:border-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{a.pedagogo}</p>
          <p className="text-[12px] text-gray-600 dark:text-gray-300">{temaComDisciplina(a)}</p>
          {a.topicos.length > 0 && <p className="text-[11px] text-gray-500 dark:text-gray-400">{a.topicos.join(" · ")}</p>}
        </div>
        <Etiqueta a={a} />
      </div>
      {podeAjustar && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold [&>button]:min-h-10 [&>button]:items-center">
          {podeGerir && a.plano && a.plano.status !== "rascunho" && (
            <button onClick={() => setModo(modo === "plano" ? "nada" : "plano")} className="flex items-center gap-1 text-na-green-dark hover:underline dark:text-emerald-400">
              <FileText size={13} /> {modo === "plano" ? "Fechar plano" : "Ver plano"}
            </button>
          )}
          <button onClick={() => setModo(modo === "editar" ? "nada" : "editar")} className="flex items-center gap-1 text-gray-600 hover:underline dark:text-gray-300">
            <Pencil size={13} /> Ajustar
          </button>
          {podeGerir && (
            <button disabled={pendente} onClick={() => rodar(() => removerApresentacao(a.id))} className="flex items-center gap-1 text-gray-500 hover:text-na-danger-dark">
              <Trash2 size={13} /> Remover
            </button>
          )}
          {/* Pedagogo cancela a própria apresentação até 4 dias antes (24/11/2026); avisa o instrutor e o encontro seguinte. */}
          {minha && !podeGerir && a.status === "agendada" && !confirmarCancelamento && (Date.parse(`${a.data}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 864e5 >= 4 && (
            <button disabled={pendente} onClick={() => setConfirmarCancelamento(true)} className="flex items-center gap-1 text-gray-500 hover:text-na-danger-dark">
              <Trash2 size={13} /> Não vou poder apresentar
            </button>
          )}
        </div>
      )}
      {/* Confirmação em destaque (24/11/2026): caixa vermelha com o efeito e dois botões diferentes, para a pessoa ler. */}
      {confirmarCancelamento && (
        <div role="alertdialog" aria-label="Confirmar cancelamento" className="rounded-xl border-2 border-na-danger bg-na-danger-light p-3 text-[13px] text-na-danger-dark dark:bg-red-950/40 dark:text-red-200">
          <p className="font-bold">Cancelar sua apresentação de {a.data.slice(8, 10)}/{a.data.slice(5, 7)}?</p>
          <p className="mt-1">O instrutor é avisado, e quem apresenta no encontro seguinte recebe a pergunta se pode antecipar. O tema “{a.tema}” volta na próxima rodada. Não dá para desfazer por aqui.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button disabled={pendente} onClick={() => rodar(() => cancelarMinhaApresentacao(a.id), () => setConfirmarCancelamento(false))} className="flex items-center gap-1.5 rounded-lg bg-na-danger px-3 py-2 text-[13px] font-bold text-white">
              {pendente && <Loader2 size={13} className="animate-spin" />} Sim, cancelar e avisar
            </button>
            <button disabled={pendente} onClick={() => setConfirmarCancelamento(false)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] font-semibold text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">
              Não, manter
            </button>
          </div>
        </div>
      )}
      {modo === "plano" && a.plano && (
        <div className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3 dark:bg-gray-950/40">
          <VerPlano apresentacaoId={a.id} plano={a.plano} />
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} placeholder="Comentários e correções para o pedagogo" className={`${CAMPO} py-2`} />
          <div className="flex flex-wrap gap-2 text-[12px] font-semibold">
            <button disabled={pendente} onClick={() => rodar(() => revisarPlano(a.id, "aprovado", comentario), () => setModo("nada"))} className="flex items-center gap-1 rounded-lg bg-na-green px-3 py-1.5 text-white">
              <CheckCircle2 size={13} /> Aprovar
            </button>
            <button disabled={pendente} onClick={() => rodar(() => revisarPlano(a.id, "devolvido", comentario), () => setModo("nada"))} className="flex items-center gap-1 rounded-lg border border-na-warning/60 px-3 py-1.5 text-na-warning-dark dark:text-amber-300">
              <Undo2 size={13} /> Devolver com correções
            </button>
          </div>
        </div>
      )}
      {modo === "editar" && (
        <div className="grid gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-2 dark:bg-gray-950/40">
          {podeGerir ? (
            <select aria-label="Pedagogo" value={ed.pedagogoId} onChange={(e) => setEd({ ...ed, pedagogoId: e.target.value })} className={CAMPO}>
              {pedagogos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          ) : (
            <p className="self-center text-[13px] font-semibold text-gray-700 dark:text-gray-200">{a.pedagogo}</p>
          )}
          {/* Disciplina (23/11/2026): trocar a disciplina põe o primeiro tema dela; o tema se escolhe ao lado. */}
          <select
            aria-label="Disciplina"
            value={ed.materiaSigla ?? ""}
            onChange={(e) => {
              const sigla = e.target.value || null;
              setEd({ ...ed, materiaSigla: sigla, tema: disciplinas.find((d) => d.sigla === sigla)?.temas[0]?.titulo ?? ed.tema });
            }}
            className={CAMPO}
          >
            {!disciplinas.some((d) => d.sigla === ed.materiaSigla) && <option value={ed.materiaSigla ?? ""}>{ed.materiaSigla ?? "Sem disciplina"}</option>}
            {disciplinas.map((d) => <option key={d.sigla} value={d.sigla}>{d.nome}</option>)}
          </select>
          <input aria-label="Data" type="date" value={ed.data} onChange={(e) => setEd({ ...ed, data: e.target.value })} className={CAMPO} />
          {temas.length ? (
            <select aria-label="Tema" value={ed.tema} onChange={(e) => setEd({ ...ed, tema: e.target.value })} className={CAMPO}>
              {temas.map((t) => <option key={t.titulo} value={t.titulo}>{t.titulo}</option>)}
            </select>
          ) : (
            <input aria-label="Tema" value={ed.tema} onChange={(e) => setEd({ ...ed, tema: e.target.value })} className={CAMPO} />
          )}
          <button
            disabled={pendente}
            onClick={() => rodar(() => editarApresentacao(a.id, { ...ed, pedagogoId: podeGerir ? ed.pedagogoId : undefined }), () => setModo("nada"))}
            className="rounded-lg bg-na-green px-3 text-[12px] font-semibold text-white"
          >
            Salvar
          </button>
          {ed.pedagogoId !== a.pedagogoId && a.plano && <p className="text-[11px] text-na-warning-dark sm:col-span-2 dark:text-amber-300">Trocar a pessoa apaga o plano já feito para esta apresentação.</p>}
        </div>
      )}
    </div>
  );
}

function VerPlano({ apresentacaoId, plano }: { apresentacaoId: string; plano: PlanoView }) {
  const [abrindo, setAbrindo] = useState(false);
  return (
    <div className="flex flex-col gap-2 text-[13px] text-gray-800 dark:text-gray-200">
      {plano.entregueEm && <p className="text-[11px] text-gray-500 dark:text-gray-400">Entregue em {new Date(plano.entregueEm).toLocaleDateString("pt-BR")}</p>}
      {plano.arquivoNome && (
        <button
          onClick={async () => {
            setAbrindo(true);
            const r = await abrirArquivoPlano(apresentacaoId);
            setAbrindo(false);
            if (r.ok) window.open(r.url, "_blank", "noopener");
          }}
          className="flex w-fit items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1 text-[12px] font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
        >
          {abrindo ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />} {plano.arquivoNome}
        </button>
      )}
      {PONTOS.map(([k, rotulo]) =>
        plano[k] ? (
          <div key={k}>
            <p className="text-[11px] font-bold text-gray-500 uppercase dark:text-gray-400">{rotulo}</p>
            <p className="whitespace-pre-line">{plano[k]}</p>
          </div>
        ) : null,
      )}
    </div>
  );
}

function MeuPlano({ a, pendente, rodar }: { a: ApresentacaoView; pendente: boolean; rodar: Rodar }) {
  const [pontos, setPontos] = useState<Record<string, string>>(() => Object.fromEntries(PONTOS.map(([k]) => [k, a.plano?.[k] ?? ""])));
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const router = useRouter();

  async function enviarArquivo(arquivo: File) {
    setAviso(null);
    setEnviando(true);
    try {
      const r = await linkEnvioPlano(a.id, arquivo.name, arquivo.size);
      if (!r.ok) return setAviso(r.error);
      const { error } = await createSupabaseBrowserClient().storage.from("planos-aula").uploadToSignedUrl(r.path, r.token, arquivo, { contentType: arquivo.type || "application/octet-stream" });
      if (error) return setAviso("Não foi possível enviar o arquivo. Tente de novo.");
      const g = await registrarArquivoPlano(a.id, r.path, arquivo.name, arquivo.type);
      if (!g.ok) return setAviso(g.error);
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article className={`${CARTAO} flex flex-col gap-3 border-na-green/40`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-bold text-gray-900 capitalize dark:text-gray-100">{dataBR(a.data)}</p>
          <p className="text-[13px] text-gray-700 dark:text-gray-200">{temaComDisciplina(a)}</p>
          {a.topicos.length > 0 && <p className="text-[11px] text-gray-500 dark:text-gray-400">{a.topicos.join(" · ")}</p>}
        </div>
        <Etiqueta a={a} />
      </div>
      {a.plano?.status === "devolvido" && a.plano.comentarioInstrutor && (
        <p className="rounded-xl bg-na-warning-light px-3 py-2 text-[13px] whitespace-pre-line text-na-warning-dark dark:bg-amber-950/30 dark:text-amber-200">
          <b>Correções do instrutor:</b> {a.plano.comentarioInstrutor}
        </p>
      )}
      {a.plano?.status === "aprovado" && a.plano.comentarioInstrutor && (
        <p className="rounded-xl bg-na-success-light px-3 py-2 text-[13px] whitespace-pre-line text-na-success-dark dark:bg-emerald-950/30 dark:text-emerald-200">
          <b>Comentário do instrutor:</b> {a.plano.comentarioInstrutor}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:border-na-green dark:border-gray-700 dark:text-gray-200">
          {enviando ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
          {a.plano?.arquivoNome ? "Trocar arquivo" : "Enviar arquivo do plano"}
          <input type="file" accept=".pdf,.doc,.docx,.odt,.ppt,.pptx,.odp,.txt,.rtf" className="hidden" disabled={enviando} onChange={(e) => e.target.files?.[0] && enviarArquivo(e.target.files[0])} />
        </label>
        {a.plano?.arquivoNome && <span className="text-[12px] text-gray-600 dark:text-gray-300">{a.plano.arquivoNome}</span>}
        <span className="text-[11px] text-gray-500 dark:text-gray-400">PDF, Word, PowerPoint ou texto, até 20 MB</span>
      </div>
      {aviso && <p className="text-[12px] text-na-danger-dark dark:text-red-300">{aviso}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {PONTOS.map(([k, rotulo, ajuda]) => (
          <label key={k} className={ROTULO}>
            {rotulo}
            <textarea value={pontos[k]} onChange={(e) => setPontos({ ...pontos, [k]: e.target.value })} rows={3} placeholder={ajuda} className={`${CAMPO} py-2 font-normal`} />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap justify-end gap-2 text-[13px] font-semibold">
        <button disabled={pendente} onClick={() => rodar(() => salvarPlano(a.id, pontos, false))} className="rounded-xl border border-gray-300 px-4 py-2 text-gray-700 dark:border-gray-700 dark:text-gray-200">
          Salvar rascunho
        </button>
        <button disabled={pendente} onClick={() => rodar(() => salvarPlano(a.id, pontos, true))} className="flex items-center gap-1.5 rounded-xl bg-na-green px-4 py-2 font-bold text-white hover:bg-na-green-dark">
          {pendente && <Loader2 size={14} className="animate-spin" />} {a.plano && a.plano.status !== "rascunho" ? "Entregar de novo" : "Entregar plano"}
        </button>
      </div>
    </article>
  );
}
