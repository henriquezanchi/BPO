"use client";

import { createPoll } from "@/lib/actions/poll-actions";
import { CheckCircle2, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";

export function CreatePollForm({ classGroupId }: { classGroupId: string }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await createPoll({ classGroupId, question, options });
      setQuestion("");
      setOptions(["", ""]);
      setDone(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-gray-700">Pergunta</label>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
          placeholder="Ex: Qual dia funciona melhor pro mutirão?"
          className="rounded-lg border border-gray-300 p-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold text-gray-700">Opções</label>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={opt}
              onChange={(e) => setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
              required
              placeholder={`Opção ${i + 1}`}
              className="flex-1 rounded-lg border border-gray-300 p-2 text-sm"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setOptions((prev) => [...prev, ""])}
          className="flex items-center gap-1 self-start text-xs font-semibold text-na-green hover:text-na-green-dark"
        >
          <Plus size={14} /> Adicionar opção
        </button>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
      >
        {isPending ? "Publicando..." : "Publicar enquete para a turma"}
      </button>

      {done && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-2.5 text-xs text-green-800">
          <CheckCircle2 size={14} /> Enquete publicada — os alunos já podem votar pela Agenda.
        </div>
      )}
    </form>
  );
}
