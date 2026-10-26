"use client";

import { CollapsibleSection } from "@/components/ui/collapsible-section";
import {
  abrirArquivoPlano,
  editarApresentacao,
  gravarEscala,
  linkEnvioPlano,
  marcarApresentacao,
  preverEscala,
  registrarArquivoPlano,
  removerApresentacao,
  revisarPlano,
  salvarPlano,
} from "@/lib/actions/escala-actions";
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

const dataBR = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
};
const SITUACAO: Record<ApresentacaoView["situacao"], [string, string]> = {
  aprovado: ["Plano aprovado", "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"],
  entregue: ["Plano entregue, a revisar", "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300"],
  devolvido: ["Plano devolvido para ajustes", "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"],
  atrasado: ["Plano atrasado", "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"],
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
  pedagogos,
  disciplinas,
  apresentacoes,
}: {
  grupoId: string;
  hoje: string;
  euId: string;
  podeGerir: boolean;
  pedagogos: { id: string; nome: string }[];
  disciplinas: Disciplina[];
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
            <div key={String(r)} className={`${CARTAO} !p-3 ${r === "Atrasados" && Number(v) > 0 ? "border-red-300 dark:border-red-900" : ""}`}>
              <p className="text-2xl font-black text-gray-900 tabular-nums dark:text-gray-100">{v}</p>
              <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">{r}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{d}</p>
            </div>
          ))}
        </div>
      )}

      {podeGerir && atrasados.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>Planos atrasados: {atrasados.map((a) => `${a.pedagogo.split(" ")[0]} (${dataBR(a.data)})`).join(", ")}.</span>
        </p>
      )}

      {podeGerir && <GerarRodada grupoId={grupoId} hoje={hoje} disciplinas={disciplinas} pedagogos={pedagogos} pendente={pendente} rodar={rodar} />}

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
                <LinhaEscala key={a.id} a={a} podeGerir={podeGerir} pedagogos={pedagogos} disciplinas={disciplinas} pendente={pendente} rodar={rodar} />
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
                    <b>{a.pedagogo}</b> · {a.tema} <span className="text-gray-500">· {dataBR(a.data)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-gray-500 dark:text-gray-400">
                      {a.status === "apresentada" ? "Apresentou" : a.status === "faltou" ? "Não apresentou" : a.status === "cancelada" ? "Cancelada" : "Sem registro"}
                    </span>
                    {podeGerir && a.status === "agendada" && (
                      <>
                        <button disabled={pendente} onClick={() => rodar(() => marcarApresentacao(a.id, "apresentada"))} className="rounded-lg bg-na-green px-2 py-1 font-semibold text-white">Apresentou</button>
                        <button disabled={pendente} onClick={() => rodar(() => marcarApresentacao(a.id, "faltou"))} className="rounded-lg border border-gray-300 px-2 py-1 font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">Não apresentou</button>
                      </>
                    )}
                  </span>
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

function GerarRodada({ grupoId, hoje, disciplinas, pedagogos, pendente, rodar }: { grupoId: string; hoje: string; disciplinas: Disciplina[]; pedagogos: { id: string; nome: string }[]; pendente: boolean; rodar: Rodar }) {
  const [aberto, setAberto] = useState(false);
  const [sigla, setSigla] = useState(disciplinas[0]?.sigla ?? "");
  const [inicio, setInicio] = useState(() => new Date(Date.parse(`${hoje}T12:00:00Z`) + 8 * 864e5).toISOString().slice(0, 10));
  const [porEncontro, setPorEncontro] = useState(2);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const temas = disciplinas.find((d) => d.sigla === sigla)?.temas ?? [];

  if (!aberto)
    return (
      <button onClick={() => setAberto(true)} className="flex w-fit items-center gap-1.5 rounded-xl bg-na-green px-4 py-2 text-[13px] font-bold text-white hover:bg-na-green-dark">
        <Sparkles size={15} /> Gerar a próxima rodada
      </button>
    );
  return (
    <section className={`${CARTAO} flex flex-col gap-3 border-na-green/40`}>
      <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100">Próxima rodada: todos os pedagogos apresentam uma vez</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={ROTULO}>
          Disciplina
          <select value={sigla} onChange={(e) => { setSigla(e.target.value); setLinhas(null); }} className={CAMPO}>
            {disciplinas.map((d) => <option key={d.sigla} value={d.sigla}>{d.nome}</option>)}
          </select>
        </label>
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
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        As datas seguem os encontros marcados na aba Encontros (ou semanais, no dia da data de início). Os temas continuam a sequência da disciplina de onde a última apresentação parou. Quem apresentou há mais tempo vem primeiro.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pendente}
          onClick={() =>
            rodar(async () => {
              const r = await preverEscala(grupoId, { sigla, inicio, porEncontro });
              if (r.ok) setLinhas(r.linhas);
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
          <p className="text-[12px] text-gray-600 dark:text-gray-300">Ajuste o que quiser antes de gravar:</p>
          {linhas.map((l, i) => {
            const mudar = (parte: Partial<Linha>) => setLinhas((atual) => atual!.map((x, k) => (k === i ? { ...x, ...parte } : x)));
            return (
              <div key={i} className="grid gap-2 rounded-xl border border-gray-200 p-2 sm:grid-cols-[1fr_9rem_1.4fr] dark:border-gray-800">
                <select aria-label="Pedagogo" value={l.pedagogoId} onChange={(e) => mudar({ pedagogoId: e.target.value, pedagogo: pedagogos.find((p) => p.id === e.target.value)?.nome ?? "" })} className={CAMPO}>
                  {pedagogos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <input aria-label="Data" type="date" value={l.data} onChange={(e) => mudar({ data: e.target.value })} className={CAMPO} />
                <select aria-label="Tema" value={l.tema} onChange={(e) => mudar({ tema: e.target.value, topicos: temas.find((t) => t.titulo === e.target.value)?.topicos ?? [] })} className={CAMPO}>
                  {temas.map((t) => <option key={t.titulo} value={t.titulo}>{t.titulo}</option>)}
                </select>
              </div>
            );
          })}
          <button
            disabled={pendente}
            onClick={() => rodar(() => gravarEscala(grupoId, linhas), () => { setLinhas(null); setAberto(false); })}
            className="flex w-fit items-center gap-1.5 rounded-xl bg-na-green px-4 py-2 text-[13px] font-bold text-white hover:bg-na-green-dark"
          >
            {pendente && <Loader2 size={14} className="animate-spin" />} Gravar a escala e avisar os pedagogos
          </button>
        </div>
      )}
    </section>
  );
}

function LinhaEscala({ a, podeGerir, pedagogos, disciplinas, pendente, rodar }: { a: ApresentacaoView; podeGerir: boolean; pedagogos: { id: string; nome: string }[]; disciplinas: Disciplina[]; pendente: boolean; rodar: Rodar }) {
  const [modo, setModo] = useState<"nada" | "plano" | "editar">("nada");
  const [comentario, setComentario] = useState(a.plano?.comentarioInstrutor ?? "");
  const [ed, setEd] = useState({ pedagogoId: a.pedagogoId, data: a.data, tema: a.tema });
  const temas = disciplinas.find((d) => d.sigla === a.materiaSigla)?.temas ?? [];
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-100 p-2.5 dark:border-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{a.pedagogo}</p>
          <p className="text-[12px] text-gray-600 dark:text-gray-300">{a.tema}</p>
          {a.topicos.length > 0 && <p className="text-[11px] text-gray-500 dark:text-gray-400">{a.topicos.join(" · ")}</p>}
        </div>
        <Etiqueta a={a} />
      </div>
      {podeGerir && (
        <div className="flex flex-wrap gap-3 text-[12px] font-semibold">
          {a.plano && a.plano.status !== "rascunho" && (
            <button onClick={() => setModo(modo === "plano" ? "nada" : "plano")} className="flex items-center gap-1 text-na-green-dark hover:underline dark:text-emerald-400">
              <FileText size={13} /> {modo === "plano" ? "Fechar plano" : "Ver plano"}
            </button>
          )}
          <button onClick={() => setModo(modo === "editar" ? "nada" : "editar")} className="flex items-center gap-1 text-gray-600 hover:underline dark:text-gray-300">
            <Pencil size={13} /> Ajustar
          </button>
          <button disabled={pendente} onClick={() => rodar(() => removerApresentacao(a.id))} className="flex items-center gap-1 text-gray-500 hover:text-red-600">
            <Trash2 size={13} /> Remover
          </button>
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
            <button disabled={pendente} onClick={() => rodar(() => revisarPlano(a.id, "devolvido", comentario), () => setModo("nada"))} className="flex items-center gap-1 rounded-lg border border-amber-400 px-3 py-1.5 text-amber-800 dark:text-amber-300">
              <Undo2 size={13} /> Devolver com correções
            </button>
          </div>
        </div>
      )}
      {modo === "editar" && (
        <div className="grid gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-[1fr_9rem_1.4fr_auto] dark:bg-gray-950/40">
          <select aria-label="Pedagogo" value={ed.pedagogoId} onChange={(e) => setEd({ ...ed, pedagogoId: e.target.value })} className={CAMPO}>
            {pedagogos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
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
            onClick={() => rodar(() => editarApresentacao(a.id, { ...ed, materiaSigla: a.materiaSigla }), () => setModo("nada"))}
            className="rounded-lg bg-na-green px-3 text-[12px] font-semibold text-white"
          >
            Salvar
          </button>
          {ed.pedagogoId !== a.pedagogoId && a.plano && <p className="text-[11px] text-amber-700 sm:col-span-4 dark:text-amber-300">Trocar a pessoa apaga o plano já feito para esta apresentação.</p>}
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
          <p className="text-[13px] text-gray-700 dark:text-gray-200">{a.tema}</p>
          {a.topicos.length > 0 && <p className="text-[11px] text-gray-500 dark:text-gray-400">{a.topicos.join(" · ")}</p>}
        </div>
        <Etiqueta a={a} />
      </div>
      {a.plano?.status === "devolvido" && a.plano.comentarioInstrutor && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] whitespace-pre-line text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <b>Correções do instrutor:</b> {a.plano.comentarioInstrutor}
        </p>
      )}
      {a.plano?.status === "aprovado" && a.plano.comentarioInstrutor && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] whitespace-pre-line text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
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
      {aviso && <p className="text-[12px] text-red-700 dark:text-red-300">{aviso}</p>}
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
