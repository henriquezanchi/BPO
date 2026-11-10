"use client";

import { enviarSugestao } from "@/lib/actions/sugestoes-actions";
import type { MinhaSugestao, OpcoesDeContexto } from "@/lib/sugestoes";
import {
  CATEGORIAS,
  ROTULO_STATUS_AUTOR,
  TEXTO_MAX,
  TEXTO_MIN,
  TITULO_MAX,
  categoria as acharCategoria,
  destinoDa,
  rotuloCompleto,
  subcategoria as acharSub,
  subcategoriasDe,
  textoDoProblema,
  type Categoria,
} from "@/lib/sugestoes-comum";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const COR_STATUS: Record<MinhaSugestao["status"], string> = {
  nova: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  em_analise: "bg-na-warning-light text-na-warning-dark dark:bg-amber-950/40 dark:text-amber-300",
  respondida: "bg-na-success-light text-na-success-dark dark:bg-green-950/40 dark:text-green-300",
  arquivada: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};
const CAMPO =
  "w-full rounded-lg border border-gray-200 bg-white p-2.5 text-[13px] text-gray-900 outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";
const ROTULO = "text-sm font-bold text-gray-900 dark:text-gray-100";
const PASSO = "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-na-green text-[11px] font-bold text-white";

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

/**
 * Caixa de sugestões do aluno (lib/sugestoes-comum.ts). Em etapas, para a sugestão chegar entendível: categoria,
 * subcategoria, turma ou evento quando for o caso, um assunto curto e o texto guiado pela pergunta da subcategoria.
 */
export function CaixaSugestoes({ inicial, minhas, opcoes }: { inicial: Categoria | null; minhas: MinhaSugestao[]; opcoes: OpcoesDeContexto }) {
  const router = useRouter();
  const [cat, setCat] = useState<Categoria | null>(inicial);
  const [sub, setSub] = useState<string | null>(null);
  const [turmaId, setTurmaId] = useState<string>(opcoes.turmas.length === 1 ? opcoes.turmas[0].id : "");
  const [eventoId, setEventoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [tentou, setTentou] = useState("");
  const [aconteceu, setAconteceu] = useState("");
  const [anonima, setAnonima] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dados = cat ? acharCategoria(cat) : undefined;
  const subs = cat ? subcategoriasDe(cat) : [];
  const subAtual = cat ? acharSub(cat, sub) : undefined;
  const doPortal = cat ? destinoDa(cat) === "portal" : false;
  const problema = cat === "portal_problema";
  const pronto = !!cat && (subs.length === 0 || !!subAtual);
  const pedeTurma = subAtual?.contexto === "turma" && opcoes.turmas.length > 0;
  const pedeEvento = subAtual?.contexto === "evento";
  let n = subs.length ? 2 : 1;
  const passo = () => ++n;

  function escolherCategoria(c: Categoria) {
    setCat(c);
    setSub(null);
    setErro(null);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!cat) return setErro("Escolha uma categoria.");
    if (subs.length && !sub) return setErro(`Responda: ${dados?.pergunta}`);
    const corpo = problema ? textoDoProblema(tentou, aconteceu) : texto;
    if (problema && (tentou.trim().length < 3 || aconteceu.trim().length < 3)) return setErro("Conte o que você tentou fazer e o que aconteceu.");
    startTransition(async () => {
      const app = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;
      const r = await enviarSugestao({
        categoria: cat,
        subcategoria: sub,
        titulo,
        turmaId: pedeTurma ? turmaId : null,
        eventoId: pedeEvento ? eventoId : null,
        texto: corpo,
        anonima,
        largura: window.innerWidth,
        app,
      });
      if (!r.ok) return setErro(r.error);
      setEnviada(true);
      setTitulo("");
      setTexto("");
      setTentou("");
      setAconteceu("");
      setAnonima(false);
      setSub(null);
      router.refresh();
    });
  }

  return (
    <>
      {enviada ? (
        <section role="status" className="flex flex-col items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-na-green" />
            <span>Sugestão enviada, obrigado. Quando houver resposta, ela aparece aqui embaixo e, se você ativou os avisos, no seu celular.</span>
          </p>
          <button type="button" onClick={() => setEnviada(false)} className="text-xs font-semibold text-na-green-dark hover:underline dark:text-emerald-400">
            Enviar outra
          </button>
        </section>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <fieldset className="flex flex-col gap-2">
            <legend className={`mb-2 flex items-center gap-2 ${ROTULO}`}>
              <span className={PASSO}>1</span> Sobre o que é?
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CATEGORIAS.map((c) => {
                const marcada = cat === c.id;
                return (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-na-green ${
                      marcada ? "border-na-green bg-na-green-light/60 dark:border-emerald-500 dark:bg-emerald-950/40" : "border-gray-200 hover:border-na-gold dark:border-gray-700"
                    }`}
                  >
                    <input type="radio" name="categoria" value={c.id} checked={marcada} onChange={() => escolherCategoria(c.id)} className="sr-only" />
                    <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{c.rotulo}</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">{c.ajuda}</span>
                  </label>
                );
              })}
            </div>
            {cat && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Vai para: <strong className="text-gray-700 dark:text-gray-200">{doPortal ? "equipe que cuida do Portal" : "direção da sua filial"}</strong>
              </p>
            )}
          </fieldset>

          {cat && subs.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className={`mb-2 flex items-center gap-2 ${ROTULO}`}>
                <span className={PASSO}>2</span> {dados?.pergunta}
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {subs.map((s) => (
                  <label
                    key={s.id}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-na-green ${
                      sub === s.id ? "border-na-green bg-na-green text-white" : "border-gray-300 text-gray-700 hover:border-na-gold dark:border-gray-600 dark:text-gray-300"
                    }`}
                  >
                    <input type="radio" name="subcategoria" value={s.id} checked={sub === s.id} onChange={() => setSub(s.id)} className="sr-only" />
                    {s.rotulo}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {pronto && (
            <>
              {pedeTurma && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="sug-turma" className={`flex items-center gap-2 ${ROTULO}`}>
                    <span className={PASSO}>{passo()}</span> Qual turma?
                  </label>
                  <select id="sug-turma" value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className={CAMPO}>
                    <option value="">Escolha a turma</option>
                    {opcoes.turmas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {pedeEvento && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="sug-evento" className={`flex items-center gap-2 ${ROTULO}`}>
                    <span className={PASSO}>{passo()}</span> Qual evento?
                  </label>
                  {opcoes.eventos.length ? (
                    <select id="sug-evento" value={eventoId} onChange={(e) => setEventoId(e.target.value)} className={CAMPO}>
                      <option value="">Escolha o evento</option>
                      {opcoes.eventos.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.data} · {ev.titulo}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[12px] text-gray-500 dark:text-gray-400">Não há eventos recentes da sua filial no Portal. Escolha outra opção acima e cite o evento no texto.</p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label htmlFor="sug-titulo" className={`flex items-center gap-2 ${ROTULO}`}>
                  <span className={PASSO}>{passo()}</span> Assunto, em poucas palavras
                </label>
                <input
                  id="sug-titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  maxLength={TITULO_MAX}
                  placeholder={problema ? 'Ex.: "Não consigo mudar o endereço no computador"' : 'Ex.: "Som da sala 2 está baixo"'}
                  className={CAMPO}
                />
              </div>

              {problema ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="sug-tentou" className={`flex items-center gap-2 ${ROTULO}`}>
                      <span className={PASSO}>{passo()}</span> O que você tentou fazer?
                    </label>
                    <textarea id="sug-tentou" value={tentou} onChange={(e) => setTentou(e.target.value)} rows={3} maxLength={900} placeholder="Ex.: abri Editar Dados e cliquei no campo do endereço para corrigir o número." className={`${CAMPO} resize-y`} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="sug-aconteceu" className={`flex items-center gap-2 ${ROTULO}`}>
                      <span className={PASSO}>{passo()}</span> O que aconteceu?
                    </label>
                    <textarea id="sug-aconteceu" value={aconteceu} onChange={(e) => setAconteceu(e.target.value)} rows={3} maxLength={900} placeholder="Ex.: o campo não deixa digitar; no celular funciona." className={`${CAMPO} resize-y`} />
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">O tipo de aparelho e o navegador vão junto, para a equipe conseguir repetir o problema.</p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1">
                  <label htmlFor="sug-texto" className={`flex items-center gap-2 ${ROTULO}`}>
                    <span className={PASSO}>{passo()}</span> Conte para a gente
                  </label>
                  {subAtual?.guia && <p className="text-[12px] text-gray-600 dark:text-gray-300">{subAtual.guia}</p>}
                  <textarea id="sug-texto" value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} maxLength={TEXTO_MAX} placeholder="Escreva aqui" className={`${CAMPO} resize-y`} />
                  <span className="self-end text-[11px] text-gray-400">{texto.trim().length < TEXTO_MIN ? `mínimo de ${TEXTO_MIN} caracteres` : `${texto.length}/${TEXTO_MAX}`}</span>
                </div>
              )}

              <label className="flex items-start gap-2 text-[12px] text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={anonima} onChange={(e) => setAnonima(e.target.checked)} className="mt-0.5 h-4 w-4 accent-na-green" />
                <span>
                  Enviar sem mostrar meu nome
                  <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                    Quem lê não vê seu nome nem sua matrícula. Você continua acompanhando a resposta aqui.
                    {doPortal && " Num problema do Portal, com o nome fica mais fácil a equipe falar com você."}
                  </span>
                </span>
              </label>

              {erro && (
                <p role="alert" className="text-[12px] text-na-danger-dark dark:text-red-300">
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {isPending ? "Enviando..." : "Enviar sugestão"}
              </button>
            </>
          )}
          {!pronto && erro && (
            <p role="alert" className="text-[12px] text-na-danger-dark dark:text-red-300">
              {erro}
            </p>
          )}
        </form>
      )}

      {minhas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Minhas sugestões</h2>
          {minhas.map((s) => (
            <article key={s.id} className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  {rotuloCompleto(s.categoria, s.subcategoria)} · {dataCurta(s.criadaEm)}
                  {s.anonima ? " · sem nome" : ""}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${COR_STATUS[s.status]}`}>{ROTULO_STATUS_AUTOR[s.status]}</span>
              </div>
              {s.titulo && <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{s.titulo}</p>}
              {s.contexto && <p className="text-[11px] text-gray-500 dark:text-gray-400">{s.contexto}</p>}
              <p className="text-[13px] whitespace-pre-line text-gray-800 dark:text-gray-200">{s.texto}</p>
              {s.resposta && (
                <div className="rounded-lg bg-na-green-light/60 p-2.5 text-[12px] text-gray-800 dark:bg-emerald-950/40 dark:text-gray-200">
                  <span className="mb-0.5 block text-[11px] font-bold tracking-wide text-na-green-dark uppercase dark:text-emerald-400">
                    Resposta{s.respondidaEm ? ` · ${dataCurta(s.respondidaEm)}` : ""}
                  </span>
                  <span className="whitespace-pre-line">{s.resposta}</span>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </>
  );
}
