"use client";

import { enviarSugestao } from "@/lib/actions/sugestoes-actions";
import type { MinhaSugestao } from "@/lib/sugestoes";
import { CATEGORIAS, ROTULO_STATUS_AUTOR, TEXTO_MAX, TEXTO_MIN, categoria as acharCategoria, destinoDa, type Categoria } from "@/lib/sugestoes-comum";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const COR_STATUS: Record<MinhaSugestao["status"], string> = {
  nova: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  em_analise: "bg-na-warning-light text-na-warning-dark dark:bg-amber-950/40 dark:text-amber-300",
  respondida: "bg-na-success-light text-na-success-dark dark:bg-green-950/40 dark:text-green-300",
  arquivada: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export function CaixaSugestoes({ inicial, minhas }: { inicial: Categoria | null; minhas: MinhaSugestao[] }) {
  const router = useRouter();
  const [cat, setCat] = useState<Categoria | null>(inicial);
  const [texto, setTexto] = useState("");
  const [anonima, setAnonima] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);
  const [isPending, startTransition] = useTransition();
  const doPortal = cat ? destinoDa(cat) === "portal" : false;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!cat) return setErro("Escolha uma categoria.");
    startTransition(async () => {
      const app = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;
      const r = await enviarSugestao({ categoria: cat, texto, anonima, largura: window.innerWidth, app });
      if (!r.ok) return setErro(r.error);
      setEnviada(true);
      setTexto("");
      setAnonima(false);
      router.refresh();
    });
  }

  return (
    <>
      {enviada ? (
        <section role="status" className="flex flex-col items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-na-green" />
            <span>
              Sugestão enviada, obrigado. Quando houver resposta, ela aparece aqui embaixo e, se você ativou os avisos, no seu celular.
            </span>
          </p>
          <button type="button" onClick={() => setEnviada(false)} className="text-xs font-semibold text-na-green-dark hover:underline dark:text-emerald-400">
            Enviar outra
          </button>
        </section>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">Sobre o que é?</legend>
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
                    <input type="radio" name="categoria" value={c.id} checked={marcada} onChange={() => setCat(c.id)} className="sr-only" />
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

          <div className="flex flex-col gap-1">
            <label htmlFor="sugestao-texto" className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Conte para a gente
            </label>
            {cat === "portal_problema" && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Diga em que tela estava, o que tentou fazer e o que aconteceu. O tipo de aparelho e o navegador vão junto, para conseguirmos repetir o problema.
              </p>
            )}
            <textarea
              id="sugestao-texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={6}
              maxLength={TEXTO_MAX}
              placeholder={cat === "portal_problema" ? "Ex.: no computador, em Editar Dados, clico no campo do endereço e não consigo digitar." : "Escreva aqui"}
              className="w-full resize-y rounded-lg border border-gray-200 bg-white p-2.5 text-[13px] text-gray-900 outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <span className="self-end text-[10px] text-gray-400">
              {texto.trim().length < TEXTO_MIN ? `mínimo de ${TEXTO_MIN} caracteres` : `${texto.length}/${TEXTO_MAX}`}
            </span>
          </div>

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
        </form>
      )}

      {minhas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Minhas sugestões</h2>
          {minhas.map((s) => (
            <article key={s.id} className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  {acharCategoria(s.categoria)?.rotulo ?? "Sugestão"} · {dataCurta(s.criadaEm)}
                  {s.anonima ? " · sem nome" : ""}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${COR_STATUS[s.status]}`}>{ROTULO_STATUS_AUTOR[s.status]}</span>
              </div>
              <p className="text-[13px] whitespace-pre-line text-gray-800 dark:text-gray-200">{s.texto}</p>
              {s.resposta && (
                <div className="rounded-lg bg-na-green-light/60 p-2.5 text-[12px] text-gray-800 dark:bg-emerald-950/40 dark:text-gray-200">
                  <span className="mb-0.5 block text-[10px] font-bold tracking-wide text-na-green-dark uppercase dark:text-emerald-400">
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
