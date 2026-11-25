"use client";
import { declararComparecimento } from "@/lib/actions/event-actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * "Você conseguiu participar?" nos eventos passados. Quem já respondeu vê só a resposta e um "Alterar" discreto
 * (revisão de design 25/11/2026: a pergunta aparecia de novo embaixo da própria resposta).
 */
export function EventAttendanceReply({ memberId, registrationId, atual }: { memberId: string; registrationId: string; atual?: "sim" | "nao" | null }) {
  const [message, setMessage] = useState("");
  const [editando, setEditando] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (atual && !editando)
    return (
      <button type="button" onClick={() => setEditando(true)} className="-my-1 min-h-9 w-fit text-[12px] font-semibold text-na-green-dark underline-offset-2 hover:underline dark:text-emerald-400">
        Alterar resposta
      </button>
    );
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-gray-800 dark:text-gray-200">Você conseguiu participar?</p>
      <div className="flex gap-2">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            type="button"
            disabled={pending}
            className="min-h-11 flex-1 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-800 transition hover:border-na-green hover:text-na-green-dark disabled:opacity-50 dark:border-gray-700 dark:text-gray-100"
            onClick={() =>
              start(async () => {
                try {
                  await declararComparecimento(memberId, registrationId, value);
                  setMessage("Resposta registrada. A recepção faz a conferência de presença.");
                  setEditando(false);
                  router.refresh();
                } catch {
                  setMessage("Não foi possível registrar a resposta. Tente novamente.");
                }
              })
            }
          >
            {value ? "Sim, participei" : "Não participei"}
          </button>
        ))}
      </div>
      {message && <p role="status" className="text-xs text-gray-600 dark:text-gray-400">{message}</p>}
    </div>
  );
}
