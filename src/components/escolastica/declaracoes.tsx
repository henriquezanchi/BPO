"use client";

import { gerarDeclaracao } from "@/lib/actions/declaracao-actions";
import { SECOES, type Declaracao, type Secao } from "@/lib/declaracoes/texto";
import { FileText, Loader2, Printer, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

type Pessoa = { id: string; nome: string; matricula: string };

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Gerador de declarações da Escolástica: escolhe a pessoa e o que declarar; o texto vem do Mercúrio, pode ser
 * ajustado na própria folha (clique no parágrafo) e sai pela impressão do navegador, que também salva em PDF.
 */
export function GeradorDeclaracoes({ schoolId, pessoas }: { schoolId: string; pessoas: Pessoa[] }) {
  const [busca, setBusca] = useState("");
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [secoes, setSecoes] = useState<Secao[]>(["matricula"]);
  const [finalidade, setFinalidade] = useState("");
  const [declaracao, setDeclaracao] = useState<Declaracao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, iniciar] = useTransition();

  const achados = useMemo(() => {
    const q = normalizar(busca.trim());
    if (q.length < 2) return [];
    return pessoas.filter((p) => normalizar(p.nome).includes(q) || p.matricula.startsWith(q)).slice(0, 8);
  }, [busca, pessoas]);

  function alternar(s: Secao) {
    setSecoes((atual) => (atual.includes(s) ? atual.filter((x) => x !== s) : [...atual, s]));
  }

  function gerar() {
    if (!pessoa) return;
    setErro(null);
    iniciar(async () => {
      const r = await gerarDeclaracao(schoolId, pessoa.id, secoes, finalidade);
      if (r.ok) setDeclaracao(r.declaracao);
      else {
        setDeclaracao(null);
        setErro(r.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <style>{`@media print {
        @page { size: A4; margin: 22mm 20mm; }
        body * { visibility: hidden !important; }
        #folha-declaracao, #folha-declaracao * { visibility: visible !important; }
        #folha-declaracao { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0 !important; box-shadow: none !important; padding: 0 !important; background: #fff !important; color: #000 !important; }
      }`}</style>

      <section className="flex w-full max-w-sm shrink-0 flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 print:hidden dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
            <FileText size={18} />
          </span>
          <div>
            <h2 className="text-[14px] font-bold text-gray-900 dark:text-gray-100">Nova declaração</h2>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Dados lidos agora do Mercúrio.</p>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">Pessoa</span>
          {pessoa ? (
            <span className="flex items-center justify-between gap-2 rounded-lg border border-na-green/40 bg-na-green-light/50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-gray-900 dark:text-gray-100">{pessoa.nome}</span>
                <span className="text-[11px] text-gray-500">Matrícula {pessoa.matricula}</span>
              </span>
              <button type="button" onClick={() => { setPessoa(null); setDeclaracao(null); }} className="text-[12px] font-semibold text-na-green-dark dark:text-emerald-400">
                Trocar
              </button>
            </span>
          ) : (
            <span className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome ou matrícula"
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              {achados.length > 0 && (
                <span className="absolute inset-x-0 top-full z-10 mt-1 flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {achados.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setPessoa(p); setBusca(""); setDeclaracao(null); }} className="px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                      <span className="block font-medium text-gray-900 dark:text-gray-100">{p.nome}</span>
                      <span className="text-[11px] text-gray-500">Matrícula {p.matricula}</span>
                    </button>
                  ))}
                </span>
              )}
            </span>
          )}
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[12px] font-semibold text-gray-700 dark:text-gray-300">O que declarar</legend>
          {SECOES.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 hover:bg-gray-50 dark:hover:bg-gray-800">
              <input type="checkbox" checked={secoes.includes(s.id)} onChange={() => alternar(s.id)} className="mt-0.5 h-4 w-4 accent-[#086357]" />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{s.rotulo}</span>
                <span className="block text-[12px] text-gray-500 dark:text-gray-400">{s.descricao}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">Finalidade (opcional)</span>
          <input
            value={finalidade}
            onChange={(e) => setFinalidade(e.target.value)}
            maxLength={200}
            placeholder="Ex.: comprovação junto ao empregador"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>

        <button
          type="button"
          onClick={gerar}
          disabled={!pessoa || gerando}
          className="flex items-center justify-center gap-2 rounded-lg bg-na-green px-4 py-2.5 text-sm font-bold text-white transition hover:bg-na-green-dark disabled:opacity-50"
        >
          {gerando && <Loader2 size={16} className="animate-spin" />}
          {gerando ? "Lendo o Mercúrio…" : "Gerar declaração"}
        </button>
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}
      </section>

      {declaracao ? (
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Confira o texto. Para ajustar, clique no parágrafo e edite antes de imprimir.</p>
            <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
              <Printer size={16} /> Imprimir ou salvar em PDF
            </button>
          </div>
          <article id="folha-declaracao" className="mx-auto w-full max-w-[210mm] rounded-sm border border-gray-200 bg-white px-[14mm] py-[16mm] font-serif text-[15px] leading-[1.75] text-gray-900 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/na-logo.png" alt="Nova Acrópole" className="mx-auto mb-10 h-16 w-auto" />
            <h2 className="mb-10 text-center font-sans text-[18px] font-bold uppercase tracking-[0.2em]">{declaracao.titulo}</h2>
            <div className="flex flex-col gap-5 text-justify">
              {declaracao.paragrafos.map((p, i) => (
                <p key={`${pessoa?.id}-${i}`} contentEditable suppressContentEditableWarning className="indent-10 outline-none focus:bg-amber-50">
                  {p}
                </p>
              ))}
            </div>
            <p contentEditable suppressContentEditableWarning className="mt-10 text-right outline-none focus:bg-amber-50">
              {declaracao.localData}
            </p>
            {declaracao.assinatura && (
              <div className="mt-20 flex flex-col items-center">
                <span className="w-72 border-t border-gray-800" />
                <span contentEditable suppressContentEditableWarning className="mt-2 font-sans text-[14px] font-semibold outline-none focus:bg-amber-50">
                  {declaracao.assinatura.nome}
                </span>
                <span contentEditable suppressContentEditableWarning className="font-sans text-[13px] text-gray-600 outline-none focus:bg-amber-50">
                  {declaracao.assinatura.cargo}
                </span>
              </div>
            )}
          </article>
        </div>
      ) : (
        <div className="hidden flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 lg:flex dark:border-gray-700 dark:text-gray-400 print:hidden">
          Escolha a pessoa e o que declarar. A declaração aparece aqui, pronta para imprimir.
        </div>
      )}
    </div>
  );
}
