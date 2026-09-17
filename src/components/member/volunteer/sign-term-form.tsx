"use client";

import { signVolunteerTerm } from "@/lib/actions/volunteer-term-actions";
import { CheckCircle2, PenLine } from "lucide-react";
import { useState, useTransition } from "react";

export function SignTermForm({ memberId }: { memberId: string }) {
  const [agreed, setAgreed] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await signVolunteerTerm(memberId, signedName);
        setDone(true);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-800 dark:bg-emerald-950/30 dark:text-emerald-300">
        <CheckCircle2 size={16} /> Termo assinado com sucesso!
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        Li e concordo com os termos acima.
      </label>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
          Digite seu nome completo pra assinar digitalmente
        </label>
        <input
          value={signedName}
          onChange={(e) => setSignedName(e.target.value)}
          required
          placeholder="Nome completo"
          className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        />
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={!agreed || !signedName.trim() || isPending}
        className="flex items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-50"
      >
        <PenLine size={16} /> {isPending ? "Assinando..." : "Assinar Digitalmente"}
      </button>
    </form>
  );
}
