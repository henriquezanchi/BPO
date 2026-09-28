"use client";

import { getMinhasSolicitacoes, oferecerApoioVoluntario, solicitarAdesaoGaf } from "@/lib/actions/misc-request-actions";
import { formatDateBR, whatsappHref } from "@/lib/format";
import { HandHeart, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

const SECRETARIAS = ["Economia", "Difusão", "Abertura de Turma", "Café Sophia", "Artes", "Manutenção", "Escolástica"];

/**
 * Antes só mudava um estado local do React — nada era salvo, ninguém na
 * escola via o pedido (bug real encontrado 2026-09-22). Agora persiste de
 * verdade (ver misc-request-actions.ts) e aparece no detalhe do membro no
 * Painel do Diretor.
 */
export function GafPanel({ memberId }: { memberId: string }) {
  const [solicitadoEm, setSolicitadoEm] = useState<Date | null | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getMinhasSolicitacoes(memberId).then((r) => setSolicitadoEm(r.gafSolicitadoEm));
  }, [memberId]);

  function handleSolicitar() {
    startTransition(async () => {
      await solicitarAdesaoGaf(memberId);
      setSolicitadoEm(new Date());
    });
  }

  return (
    <div className="text-left">
      <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
        O <strong>Grupo de Acompanhamento Filosófico (GAF)</strong> é um espaço criado para apoiar o aluno em sua
        jornada de vivência prática da filosofia, com encontros periódicos e acompanhamento próximo por instrutores.
      </p>
      {solicitadoEm && (
        <p className="mb-2 text-[11px] text-gray-400 dark:text-gray-500">Última solicitação: {formatDateBR(solicitadoEm)}</p>
      )}
      <button
        disabled={isPending || solicitadoEm === undefined}
        onClick={handleSolicitar}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <HandHeart size={16} />}
        {solicitadoEm ? "Solicitar de novo" : "Solicitar adesão ao GAF"}
      </button>
    </div>
  );
}

export function VolunteerPanel({ memberId }: { memberId: string }) {
  const [active, setActive] = useState<string[]>([]);
  const [oferecidoEm, setOferecidoEm] = useState<Date | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getMinhasSolicitacoes(memberId).then((r) => setOferecidoEm(r.voluntariadoOferecidoEm));
  }, [memberId]);

  function toggle(tag: string) {
    setActive((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function handleOferecer() {
    if (active.length === 0) {
      setErro("Selecione pelo menos uma secretaria.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      await oferecerApoioVoluntario(memberId, active);
      setOferecidoEm(new Date());
      setActive([]);
    });
  }

  return (
    <div className="text-left">
      <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">Ofereça-se para ajudar no funcionamento da escola:</p>
      {oferecidoEm && (
        <p className="mb-2 text-[11px] text-gray-400 dark:text-gray-500">Última oferta: {formatDateBR(oferecidoEm)}</p>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        {SECRETARIAS.map((s) => (
          <button
            key={s}
            onClick={() => toggle(s)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
              active.includes(s)
                ? "border-na-green bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-400"
                : "border-gray-200 bg-gray-50 text-gray-700 hover:border-na-green dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {erro && <p className="mb-2 text-[11px] text-red-700 dark:text-red-400">{erro}</p>}
      <button
        disabled={isPending || oferecidoEm === undefined}
        onClick={handleOferecer}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <HandHeart size={16} />} Me oferecer para apoiar
      </button>
    </div>
  );
}

export function HelpPanel({ whatsapp }: { whatsapp: string }) {
  return (
    <div className="py-2 text-center">
      <p className="mb-4 text-xs text-gray-600 dark:text-gray-400">
        Precisa de ajuda com sua composição, recibos ou tem alguma dúvida? Nossa equipe está pronta para te
        atender via WhatsApp.
      </p>
      <a
        href={whatsappHref(whatsapp, "Olá, preciso de ajuda com o Portal do Membro")}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-na-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark"
      >
        Chamar no WhatsApp
      </a>
    </div>
  );
}
