"use client";

import { IconeWhatsApp } from "@/components/member/compartilhar-evento";
import { compartilharAnotacao, excluirAnotacao, resumirAnotacao, salvarAnotacao } from "@/lib/actions/anotacoes-actions";
import type { DadosAnotacoes } from "@/lib/anotacoes";
import { FileDown, Loader2, Share2, Sparkles, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const CAMPO = "w-full rounded-xl border border-gray-300 bg-white p-2.5 text-[13px] text-gray-900 outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";
const BOTAO_LEVE = "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12px] font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";
const CARTAO = "flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900";

/** Envia o texto para outro app: WhatsApp, Google Drive, e-mail... (menu de compartilhar do celular). */
async function compartilharTexto(titulo: string, texto: string) {
  const nome = `${titulo.replace(/[^\p{L}\p{N} ._-]+/gu, "").slice(0, 60) || "anotacao"}.txt`;
  const arquivo = new File([texto], nome, { type: "text/plain" });
  if (navigator.canShare?.({ files: [arquivo] })) return navigator.share({ title: titulo, files: [arquivo] });
  if (navigator.share) return navigator.share({ title: titulo, text: texto });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(arquivo);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const zap = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`;

function Partilhar({ titulo, texto, pdf }: { titulo: string; texto: string; pdf: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a href={zap(`*${titulo}*\n\n${texto}`)} target="_blank" rel="noreferrer" className={BOTAO_LEVE}>
        <IconeWhatsApp tamanho={13} /> WhatsApp
      </a>
      <button type="button" onClick={() => compartilharTexto(titulo, texto).catch(() => {})} className={BOTAO_LEVE} title="Google Drive, e-mail ou outro app">
        <Share2 size={13} /> Salvar na nuvem / outro app
      </button>
      <a href={pdf} target="_blank" rel="noreferrer" className={BOTAO_LEVE}>
        <FileDown size={13} /> PDF
      </a>
    </div>
  );
}

/** Anotações das aulas (2026-10-29): escolher matéria e tema, anotar, compartilhar, resumir com IA. */
export function AnotacoesCliente({ d }: { d: DadosAnotacoes }) {
  const router = useRouter();
  const [sigla, setSigla] = useState(d.escolha?.sigla ?? "");
  const materia = d.materias.find((m) => m.sigla === sigla);
  const [tema, setTema] = useState(d.escolha?.tema ?? "");
  const [texto, setTexto] = useState(d.atual?.texto ?? "");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const salvo = (d.atual?.texto ?? "") === texto;
  const titulo = d.escolha ? `${d.escolha.materiaNome} · ${d.escolha.tema}` : "";

  const abrir = (s: string, t: string) => {
    if (s && t) router.push(`/estudos/anotacoes?materia=${encodeURIComponent(s)}&tema=${encodeURIComponent(t)}`);
  };
  const rodar = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) => {
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) return setAviso({ ok: false, texto: r.error ?? "Não foi possível agora." });
      if (ok) setAviso({ ok: true, texto: ok });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <section className={CARTAO}>
        {d.materias.length ? (
          <>
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-gray-700 dark:text-gray-300">
              Matéria
              <select
                value={sigla}
                onChange={(e) => {
                  setSigla(e.target.value);
                  setTema("");
                }}
                className={CAMPO}
              >
                <option value="">Escolha a matéria...</option>
                {d.materias.map((m) => (
                  <option key={m.sigla} value={m.sigla}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </label>
            {materia && (
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-gray-700 dark:text-gray-300">
                Tema da aula
                {materia.temas.length ? (
                  <select
                    value={tema}
                    onChange={(e) => {
                      setTema(e.target.value);
                      abrir(sigla, e.target.value);
                    }}
                    className={CAMPO}
                  >
                    <option value="">Escolha o tema...</option>
                    {materia.temas.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="flex gap-2">
                    <input value={tema} onChange={(e) => setTema(e.target.value)} maxLength={160} placeholder="Escreva o tema da aula" className={CAMPO} />
                    <button type="button" disabled={!tema.trim()} onClick={() => abrir(sigla, tema.trim())} className="rounded-xl bg-na-green px-3 text-[12px] font-semibold text-white disabled:opacity-50">
                      Abrir
                    </button>
                  </span>
                )}
              </label>
            )}
          </>
        ) : (
          <p className="text-[13px] text-gray-500 dark:text-gray-400">Sua turma ainda não tem matérias cadastradas no Mercúrio. Fale com a Escolástica.</p>
        )}
      </section>

      {d.escolha && (
        <>
          <section className={CARTAO}>
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">{titulo}</h2>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={12} maxLength={20000} placeholder="Suas anotações da aula..." className={CAMPO} />
            <div className="flex flex-wrap items-center gap-2">
              <button disabled={pendente || salvo} onClick={() => rodar(() => salvarAnotacao({ sigla: d.escolha!.sigla, tema: d.escolha!.tema, texto }), "Anotação salva.")} className="inline-flex items-center gap-2 rounded-xl bg-na-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {pendente && <Loader2 size={14} className="animate-spin" />} {salvo && d.atual ? "Salvo" : "Salvar"}
              </button>
              {d.atual && (
                <button disabled={pendente} onClick={() => confirm("Excluir esta anotação?") && rodar(() => excluirAnotacao(d.atual!.id))} className="inline-flex items-center gap-1 text-[12px] font-semibold text-na-danger-dark dark:text-red-300">
                  <Trash2 size={13} /> Excluir
                </button>
              )}
            </div>
            {d.atual && salvo && (
              <>
                <label className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-[12px] text-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
                  <input type="checkbox" checked={d.atual.compartilhada} disabled={pendente} onChange={(e) => rodar(() => compartilharAnotacao(d.atual!.id, e.target.checked))} className="mt-0.5 size-4 accent-na-green" />
                  <span>
                    <strong>Compartilhar com os colegas pelo Portal.</strong> O professor da matéria confere antes de a anotação aparecer para quem estuda este tema.
                  </span>
                </label>
                <Partilhar titulo={titulo} texto={d.atual.texto} pdf={`/estudos/anotacoes/${d.atual.id}/pdf`} />
              </>
            )}
          </section>

          {d.atual && salvo && (
            <section className={CARTAO}>
              <h3 className="flex items-center gap-2 text-[14px] font-bold text-gray-900 dark:text-gray-100">
                <Sparkles size={15} className="text-na-gold-dark dark:text-amber-300" /> Resumo para estudar
              </h3>
              {d.atual.resumo ? (
                <>
                  <p className="text-[13px] whitespace-pre-line text-gray-700 dark:text-gray-300">{d.atual.resumo}</p>
                  <Partilhar titulo={`Resumo · ${titulo}`} texto={d.atual.resumo} pdf={`/estudos/anotacoes/${d.atual.id}/pdf?so=resumo`} />
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">O resumo também aparece na prova deste tema, na sua Agenda.</p>
                </>
              ) : (
                <p className="text-[12px] text-gray-500 dark:text-gray-400">A IA organiza as suas anotações em tópicos para revisar antes da prova. Usa só o que você escreveu.</p>
              )}
              <button disabled={pendente} onClick={() => rodar(() => resumirAnotacao(d.atual!.id), "Resumo pronto.")} className={`${BOTAO_LEVE} self-start`}>
                {pendente ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {d.atual.resumo ? "Refazer o resumo" : "Resumir com IA"}
              </button>
            </section>
          )}

          {d.colegas.length > 0 && (
            <section className={CARTAO}>
              <h3 className="flex items-center gap-2 text-[14px] font-bold text-gray-900 dark:text-gray-100">
                <Users size={15} /> Dos colegas
              </h3>
              <p className="-mt-2 text-[11px] text-gray-500 dark:text-gray-400">Anotações deste tema conferidas pelo professor.</p>
              <ul className="flex flex-col gap-2">
                {d.colegas.map((c) => (
                  <li key={c.id} className="rounded-xl bg-gray-50 p-3 text-[12px] text-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
                    <p className="line-clamp-[12] whitespace-pre-line">{c.texto}</p>
                    <p className="mt-1 text-[11px] font-semibold text-gray-500">— {c.autor}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {aviso && <p role="status" className={`text-[12px] ${aviso.ok ? "text-na-green-dark dark:text-emerald-400" : "text-na-danger-dark dark:text-red-300"}`}>{aviso.texto}</p>}

      {d.minhas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">Minhas anotações</h3>
          <ul className="flex flex-col gap-1.5">
            {d.minhas.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/estudos/anotacoes?materia=${encodeURIComponent(a.materiaSigla)}&tema=${encodeURIComponent(a.tema)}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[12px] dark:border-gray-800 dark:bg-gray-900"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-gray-900 dark:text-gray-100">{a.tema}</span>
                    <span className="block text-gray-500 dark:text-gray-400">
                      {a.materiaNome ?? a.materiaSigla}
                      {a.compartilhada ? " · compartilhada" : ""}
                      {a.resumo ? " · com resumo" : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
