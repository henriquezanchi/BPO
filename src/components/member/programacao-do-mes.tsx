"use client";

import { IconeWhatsApp } from "@/components/member/compartilhar-evento";
import { gerarArteProgramacao } from "@/lib/arte-programacao";
import { eventoCompartilhavel } from "@/lib/compartilhar-evento";
import type { AgendaItem } from "@/lib/member-data";
import { MESES, itensDoMes, textoWhatsappProgramacao, turmaDoMes } from "@/lib/programacao-mes";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, Download, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * "Programação do mês" na Agenda (17/11/2026): arte 1080×1350 no guia da marca com os compromissos do mês que está
 * aberto no calendário, mais o texto para o WhatsApp — mesmo jeito de compartilhar dos eventos individuais.
 */
const BOTAO =
  "flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-left text-[13px] font-semibold text-gray-800 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800";

/** `somenteAbertos`: membro sem atribuições ou aluno (17/11/2026) gera só com os eventos abertos ao público. */
export function ProgramacaoDoMes(p: { items: AgendaItem[]; ano: number; mes: number; fuso: string; publico: string; escola: string; somenteAbertos?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [arte, setArte] = useState<{ arquivo: File; url: string } | null>(null);
  const [erro, setErro] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const escolaCurta = p.escola.replace(/^Nova Acr[oó]pole\s*-\s*/i, "");
  const base = useMemo(() => (p.somenteAbertos ? p.items.filter((i) => i.kind === "evento" && eventoCompartilhavel(i)) : p.items), [p.items, p.somenteAbertos]);
  const itens = useMemo(() => itensDoMes(base, p.ano, p.mes, p.fuso), [base, p.ano, p.mes, p.fuso]);
  const turma = useMemo(() => (p.somenteAbertos ? escolaCurta : turmaDoMes(base)), [base, p.somenteAbertos, escolaCurta]);
  const publico = p.somenteAbertos ? "Eventos abertos" : p.publico;
  const texto = useMemo(
    () => textoWhatsappProgramacao({ turma, publico, ano: p.ano, mes: p.mes, itens, abertos: p.somenteAbertos, escola: escolaCurta }),
    [turma, publico, p.ano, p.mes, itens, p.somenteAbertos, escolaCurta],
  );
  const nomeArquivo = `programacao-${MESES[p.mes - 1]}-${p.ano}.png`;

  useEffect(() => {
    if (!aberto || !itens.length) return;
    let cancelado = false;
    let url: string | undefined;
    gerarArteProgramacao({ turma, publico, ano: p.ano, mes: p.mes, itens, rodapeDireita: `Nova Acrópole ${escolaCurta}` })
      .then((blob) => {
        if (cancelado) return;
        const arquivo = new File([blob], nomeArquivo, { type: "image/png" });
        url = URL.createObjectURL(arquivo);
        setArte({ arquivo, url });
      })
      .catch(() => !cancelado && setErro(true));
    return () => {
      cancelado = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [aberto, itens, turma, publico, p.ano, p.mes, escolaCurta, nomeArquivo]);

  function copiar() {
    if (!navigator.clipboard?.writeText) return setAviso("Selecione e copie o texto abaixo.");
    void navigator.clipboard.writeText(texto).then(
      () => setCopiado(true),
      () => setAviso("Não foi possível copiar automaticamente. Selecione e copie o texto abaixo."),
    );
  }

  function baixar() {
    if (!arte) return;
    const a = document.createElement("a");
    a.href = arte.url;
    a.download = arte.arquivo.name;
    a.click();
  }

  function compartilhar() {
    if (!arte) return;
    copiar();
    if (navigator.share && navigator.canShare?.({ files: [arte.arquivo] })) {
      void navigator.share({ files: [arte.arquivo], text: texto }).catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setAviso("Não foi possível compartilhar. Baixe a arte e anexe no WhatsApp; o texto já está copiado.");
      });
    } else {
      baixar();
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
      setAviso("Arte baixada. No WhatsApp, anexe a imagem à mensagem que já está pronta.");
    }
  }

  return (
    <Dialog.Root
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) {
          setArte(null);
          setErro(false);
          setAviso(null);
          setCopiado(false);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className={`${BOTAO} w-full justify-center`}>
          <IconeWhatsApp /> {p.somenteAbertos ? "Eventos abertos" : "Programação"} de {MESES[p.mes - 1]} para compartilhar
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-[101] max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-4 text-gray-900 shadow-xl dark:bg-gray-900 dark:text-gray-100"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <Dialog.Title className="text-base font-bold text-na-green-dark dark:text-emerald-400">Programação de {MESES[p.mes - 1]}</Dialog.Title>
            <Dialog.Close aria-label="Fechar" className="rounded-lg p-2">
              <X size={20} />
            </Dialog.Close>
          </div>
          {!itens.length ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">{p.somenteAbertos ? `Não há eventos abertos ao público em ${MESES[p.mes - 1]}.` : `Não há aulas nem eventos na sua agenda em ${MESES[p.mes - 1]}.`}</p>
          ) : (
            <>
              {arte ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- PNG gerado no próprio navegador */}
                  <img src={arte.url} alt={`Programação de ${MESES[p.mes - 1]}`} className="mx-auto max-h-[45dvh] rounded-lg object-contain" />
                  <button type="button" onClick={compartilhar} className={`${BOTAO} mt-3 w-full justify-center`}>
                    <IconeWhatsApp /> Compartilhar arte e texto
                  </button>
                  <button type="button" onClick={baixar} className={`${BOTAO} mt-2 w-full justify-center`}>
                    <Download size={16} /> Baixar arte
                  </button>
                </>
              ) : erro ? (
                <p role="alert" className="text-sm">Não foi possível gerar a arte. Você ainda pode enviar o texto abaixo.</p>
              ) : (
                <p role="status" className="flex items-center gap-2 py-6 text-sm">
                  <Loader2 className="animate-spin" size={18} /> Preparando a arte…
                </p>
              )}
              <label className="mt-3 block text-sm font-semibold">
                Texto para o WhatsApp
                <textarea readOnly value={texto} rows={8} className="mt-1 w-full resize-y rounded-lg border border-gray-300 bg-gray-50 p-3 text-xs font-normal dark:border-gray-700 dark:bg-gray-800" />
              </label>
              <button type="button" onClick={copiar} className={`${BOTAO} mt-2 w-full justify-center`}>
                {copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? "Texto copiado" : "Copiar texto"}
              </button>
              {aviso && <p role="status" className="mt-2 text-sm text-gray-600 dark:text-gray-400">{aviso}</p>}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
