"use client";

import { useState } from "react";
import { HandHeart } from "lucide-react";
import { whatsappHref } from "@/lib/format";

const SECRETARIAS = ["Economia", "Difusão", "Abertura de Turma", "Café Sophia", "Artes", "Manutenção", "Escolástica"];

export function GafPanel() {
  const [sent, setSent] = useState(false);
  return (
    <div className="text-left">
      <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
        O <strong>Grupo de Acompanhamento Filosófico (GAF)</strong> é um espaço criado para apoiar o aluno em sua
        jornada de vivência prática da filosofia, com encontros periódicos e acompanhamento próximo por instrutores.
      </p>
      <button
        disabled={sent}
        onClick={() => setSent(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
      >
        <HandHeart size={16} /> {sent ? "Intenção registrada!" : "Solicitar adesão ao GAF"}
      </button>
    </div>
  );
}

export function VolunteerPanel() {
  const [active, setActive] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  function toggle(tag: string) {
    setActive((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  return (
    <div className="text-left">
      <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">Ofereça-se para ajudar no funcionamento da escola:</p>
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
      <button
        disabled={sent}
        onClick={() => setSent(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
      >
        <HandHeart size={16} /> {sent ? "Obrigado pelo apoio!" : "Me oferecer para apoiar"}
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
