"use client";
import { IconeWhatsApp } from "@/components/member/compartilhar-evento";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

import { abrirCampanha, alterarEncerramentoCampanha, alterarStatusCampanha } from "@/lib/actions/avaliacao-actions";
import { linkWhatsappDaAvaliacao } from "@/lib/avaliacao-comum";
import { BarChart3, CalendarClock, Loader2, Play, Square } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

interface Turma {
  id: string;
  nome: string;
  alunos: number;
  instrutores: number;
}

interface Campanha {
  id: string;
  titulo: string;
  status: string;
  abertaEm: Date;
  encerradaEm: Date | null;
  /** Último dia para responder (AAAA-MM-DD) ou null. */
  encerraEm: string | null;
  turmas: number;
  respostas: number;
  participantes: number;
}

const data = (d: Date) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
/** "2026-11-30" → "30/11/2026" (sem fuso: é um dia, não um instante). */
const dia = (iso: string) => iso.split("-").reverse().join("/");
const hojeIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export function CampanhasPanel({ schoolId, tituloPadrao, turmas, campanhas }: { schoolId: string; tituloPadrao: string; turmas: Turma[]; campanhas: Campanha[] }) {
  const [abrindo, setAbrindo] = useState(false);
  const [titulo, setTitulo] = useState(tituloPadrao);
  const [todas, setTodas] = useState(true);
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());
  const [fim, setFim] = useState("");
  const [editandoData, setEditandoData] = useState<{ id: string; valor: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [emAndamento, setEmAndamento] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const semVinculo = turmas.filter((t) => t.instrutores === 0);

  function abrir(e: React.FormEvent) {
    e.preventDefault();
    if (!todas && escolhidas.size === 0) return setErro("Escolha pelo menos uma turma.");
    setErro(null);
    setEmAndamento("abrir");
    startTransition(async () => {
      const r = await abrirCampanha(schoolId, { titulo, turmas: todas ? [] : [...escolhidas], encerraEm: fim });
      setEmAndamento(null);
      if (r.ok) setAbrindo(false);
      else setErro(r.error);
    });
  }

  function alterar(id: string, status: "aberta" | "encerrada") {
    setEmAndamento(id);
    startTransition(async () => {
      const r = await alterarStatusCampanha(id, status);
      setEmAndamento(null);
      if (!r.ok) setErro(r.error);
    });
  }

  function salvarData(id: string, valor: string) {
    setEmAndamento(`data-${id}`);
    setErro(null);
    startTransition(async () => {
      const r = await alterarEncerramentoCampanha(id, valor);
      setEmAndamento(null);
      if (r.ok) setEditandoData(null);
      else setErro(r.error);
    });
  }

  const abertas = campanhas.filter((c) => c.status === "aberta");
  const encerradas = campanhas.filter((c) => c.status !== "aberta");
  const linha = (c: (typeof campanhas)[number]) => (
            <li key={c.id} className="flex flex-col gap-2 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.titulo}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {c.status === "aberta" ? `Aberta desde ${data(c.abertaEm)}${c.encerraEm ? ` · encerra no fim de ${dia(c.encerraEm)}` : " · sem data para encerrar"}` : `Encerrada em ${data(c.encerradaEm ?? c.abertaEm)}`} · {c.turmas ? `${c.turmas} turma(s)` : "todas as turmas"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    c.status === "aberta" ? "bg-na-success-light text-na-success-dark dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {c.status === "aberta" ? "Aberta" : "Encerrada"}
                </span>
              </div>
              <p className="text-[12px] text-gray-700 dark:text-gray-300">
                {c.participantes} {c.participantes === 1 ? "aluno respondeu" : "alunos responderam"} · {c.respostas} {c.respostas === 1 ? "resposta" : "respostas"}
              </p>
              {editandoData?.id === c.id && (
                <div className="flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-2.5 dark:bg-gray-800">
                  <label className="flex flex-col gap-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                    Último dia para responder
                    <input
                      type="date"
                      min={hojeIso()}
                      value={editandoData.valor}
                      onChange={(e) => setEditandoData({ id: c.id, valor: e.target.value })}
                      className="rounded-lg border border-gray-300 bg-white p-1.5 text-[13px] text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </label>
                  <button type="button" disabled={emAndamento === `data-${c.id}`} onClick={() => salvarData(c.id, editandoData.valor)} className="flex items-center gap-1 rounded-lg bg-na-green px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">
                    {emAndamento === `data-${c.id}` && <Loader2 size={11} className="animate-spin" />} Salvar data
                  </button>
                  {c.encerraEm && (
                    <button type="button" disabled={emAndamento === `data-${c.id}`} onClick={() => salvarData(c.id, "")} className="px-2 py-1.5 text-[11px] font-semibold text-gray-600 underline dark:text-gray-300">
                      Tirar a data
                    </button>
                  )}
                  <button type="button" onClick={() => setEditandoData(null)} className="px-2 py-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    Cancelar
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/escolastica/avaliacao/${c.id}`}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <BarChart3 size={12} /> Relatórios
                </Link>
                {c.status === "aberta" && (
                  <a
                    href={linkWhatsappDaAvaliacao(c.titulo, c.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Mandar o convite com o link da avaliação nos grupos das turmas"
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <IconeWhatsApp tamanho={12} /> Compartilhar no WhatsApp
                  </a>
                )}
                {c.status === "aberta" && editandoData?.id !== c.id && (
                  <button
                    type="button"
                    onClick={() => setEditandoData({ id: c.id, valor: c.encerraEm ?? "" })}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <CalendarClock size={12} /> {c.encerraEm ? "Mudar data de encerramento" : "Definir data de encerramento"}
                  </button>
                )}
                <button
                  onClick={() => alterar(c.id, c.status === "aberta" ? "encerrada" : "aberta")}
                  disabled={emAndamento === c.id}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {c.status === "aberta" ? <Square size={11} /> : <Play size={11} />} {c.status === "aberta" ? "Encerrar" : "Reabrir"}
                </button>
              </div>
            </li>
  );

  return (
    <section className="flex flex-col gap-3">
      <CollapsibleSection title={<h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Rodadas</h2>}>

      {abrindo ? (
        <form onSubmit={abrir} className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Título que o aluno vê</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Avaliação geral — novembro/2026" className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Para quem</span>
            <label className="flex items-center gap-2 text-[13px] text-gray-800 dark:text-gray-200">
              <input type="radio" checked={todas} onChange={() => setTodas(true)} className="accent-na-green" /> Todas as turmas
            </label>
            <label className="flex items-center gap-2 text-[13px] text-gray-800 dark:text-gray-200">
              <input type="radio" checked={!todas} onChange={() => setTodas(false)} className="accent-na-green" /> Só algumas turmas (por ondas)
            </label>
            {!todas && (
              <ul className="mt-1 flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
                {turmas.map((t) => (
                  <li key={t.id}>
                    <label className="flex items-center justify-between gap-2 text-[12px] text-gray-800 dark:text-gray-200">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={escolhidas.has(t.id)}
                          onChange={(e) =>
                            setEscolhidas((a) => {
                              const n = new Set(a);
                              if (e.target.checked) n.add(t.id);
                              else n.delete(t.id);
                              return n;
                            })
                          }
                          className="h-4 w-4 accent-na-green"
                        />
                        {t.nome}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {t.alunos} {t.alunos === 1 ? "aluno" : "alunos"} · {t.instrutores} {t.instrutores === 1 ? "instrutor" : "instrutores"}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
            Último dia para responder (opcional)
            <input type="date" min={hojeIso()} value={fim} onChange={(e) => setFim(e.target.value)} className="w-fit rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            <span className="font-normal text-gray-500 dark:text-gray-400">A rodada se encerra sozinha no fim desse dia. Dá para mudar depois de aberta.</span>
          </label>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            As perguntas atuais do questionário (abaixo) são copiadas para esta rodada. Ao abrir, o quadrinho aparece no Portal de cada aluno com algo a responder.
          </p>
          {erro && <p className="text-[11px] text-na-danger-dark dark:text-red-300">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={emAndamento === "abrir"} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {emAndamento === "abrir" && <Loader2 size={14} className="animate-spin" />} Liberar para os alunos
            </button>
            <button type="button" onClick={() => setAbrindo(false)} className="px-3 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAbrindo(true)}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-[13px] font-semibold text-gray-700 transition hover:border-na-green hover:text-na-green-dark dark:border-gray-700 dark:text-gray-300"
        >
          <Play size={14} /> Abrir nova rodada
        </button>
      )}

      {erro && !abrindo && (
        <p role="alert" className="text-[11px] text-na-danger-dark dark:text-red-300">
          {erro}
        </p>
      )}

      {semVinculo.length > 0 && (
        <p className="text-[11px] text-na-warning-dark dark:text-amber-300">
          {semVinculo.length === 1 ? "A turma" : "As turmas"} {semVinculo.map((t) => t.nome).join(", ")} não {semVinculo.length === 1 ? "tem" : "têm"} instrutor vinculado no Mercúrio — esses alunos só respondem a parte geral.
        </p>
      )}

      {campanhas.length === 0 ? (
        <p className="text-[12px] text-gray-500 dark:text-gray-400">Nenhuma rodada ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {abertas.length > 0 && <ul className="flex flex-col gap-2">{abertas.map(linha)}</ul>}
          {encerradas.length > 0 && (
            <CollapsibleSection defaultOpen={false} title={<h3 className="text-[12px] font-semibold text-gray-600 dark:text-gray-300">Encerradas ({encerradas.length})</h3>}>
              <ul className="flex flex-col gap-2">{encerradas.map(linha)}</ul>
            </CollapsibleSection>
          )}
        </div>
      )}
    </CollapsibleSection></section>
  );
}
