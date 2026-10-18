"use client";

import { criarCanalSlack, desvincularCanalSlack, sincronizarIntegrantesSlack, vincularCanalSlack } from "@/lib/actions/slack-actions";
import { AlertTriangle, CheckCircle2, ExternalLink, Hash, Loader2, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";

type Resultado = { ok: true; convidados: number; semConta: number } | { ok: false; error: string };

/**
 * Canal do Slack da filial vinculado à turma/grupo — só aparece pro
 * responsável e só quando a filial tem o Slack conectado. O canal criado é
 * privado: o link "Abrir no Slack" sozinho não dá acesso a ninguém de fora.
 */
export function SlackChannelPanel({ classGroupId, linkCanal }: { classGroupId: string; linkCanal: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [link, setLink] = useState("");

  function executar(acao: () => Promise<Resultado | { ok: true }>) {
    setResultado(null);
    startTransition(async () => {
      const r = await acao();
      setResultado("convidados" in r || !r.ok ? (r as Resultado) : null);
      if (r.ok) setVinculando(false);
    });
  }

  const botao = "flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
      {linkCanal ? (
        <>
          <p className="text-xs text-gray-600 dark:text-gray-400">Este grupo tem um canal privado no Slack da filial.</p>
          <div className="flex flex-wrap gap-2">
            <a href={linkCanal} target="_blank" rel="noreferrer" className={botao}>
              <ExternalLink size={13} /> Abrir no Slack
            </a>
            <button disabled={isPending} onClick={() => executar(() => sincronizarIntegrantesSlack(classGroupId))} className={botao}>
              <UserPlus size={13} /> Convidar integrantes novos
            </button>
            <button
              disabled={isPending}
              onClick={() => confirm("Desvincular o canal deste grupo? O canal continua existindo no Slack.") && executar(() => desvincularCanalSlack(classGroupId))}
              className="px-2 text-[11px] font-semibold text-gray-400 underline hover:text-gray-600 dark:hover:text-gray-300"
            >
              Desvincular
            </button>
          </div>
        </>
      ) : vinculando ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executar(() => vincularCanalSlack(classGroupId, link));
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Link do canal (no Slack: botão direito no canal → Copiar link)</label>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://….slack.com/archives/C0123456"
            className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700"
          />
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Se o canal for privado, adicione antes o app do Portal a ele.</p>
          <div className="flex gap-2">
            <button type="submit" disabled={isPending || !link.trim()} className={botao}>
              Vincular
            </button>
            <button type="button" onClick={() => setVinculando(false)} className="px-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Crie um canal privado no Slack da filial pra este grupo. Quem do grupo tiver conta no Slack (mesmo e-mail do cadastro) é convidado na hora.
          </p>
          <div className="flex flex-wrap gap-2">
            <button disabled={isPending} onClick={() => executar(() => criarCanalSlack(classGroupId))} className={botao}>
              <Hash size={13} /> Criar canal
            </button>
            <button disabled={isPending} onClick={() => setVinculando(true)} className={botao}>
              Vincular canal existente
            </button>
          </div>
        </>
      )}

      {isPending && (
        <p className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          <Loader2 size={12} className="animate-spin" /> Falando com o Slack…
        </p>
      )}
      {resultado?.ok && (
        <p className="flex items-start gap-1.5 text-[11px] text-na-success-dark dark:text-emerald-300">
          <CheckCircle2 size={13} className="mt-px shrink-0" />
          {resultado.convidados} {resultado.convidados === 1 ? "pessoa convidada" : "pessoas convidadas"} pro canal.
          {resultado.semConta > 0 && ` ${resultado.semConta} sem conta no Slack da filial (ou sem e-mail no cadastro) — essas recebem os avisos pelo Portal e WhatsApp.`}
        </p>
      )}
      {resultado && !resultado.ok && (
        <p className="flex items-start gap-1.5 text-[11px] text-na-danger-dark dark:text-red-300">
          <AlertTriangle size={13} className="mt-px shrink-0" /> {resultado.error}
        </p>
      )}
    </div>
  );
}
