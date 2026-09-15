"use client";

import { createActivity } from "@/lib/actions/activity-actions";
import type { ActivityType } from "@prisma/client";
import { CheckCircle2 } from "lucide-react";
import { useState, useTransition } from "react";

const TYPES: { value: ActivityType; label: string }[] = [
  { value: "prova", label: "Prova" },
  { value: "trabalho", label: "Trabalho" },
  { value: "leitura", label: "Leitura" },
  { value: "atividade_turma", label: "Atividade de turma" },
];

export function CreateActivityForm({ classGroupId }: { classGroupId: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await createActivity({
        classGroupId,
        type: formData.get("type") as ActivityType,
        title: String(formData.get("title") ?? ""),
        studyItems: String(formData.get("studyItems") ?? "") || undefined,
        description: String(formData.get("description") ?? "") || undefined,
        dueDate: new Date(String(formData.get("dueDate"))),
      });
      setDone(true);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-700">Tipo</label>
          <select name="type" required className="rounded-lg border border-gray-300 p-2 text-sm">
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-700">Data</label>
          <input type="date" name="dueDate" required className="rounded-lg border border-gray-300 p-2 text-sm" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-gray-700">Título</label>
        <input
          name="title"
          required
          placeholder="Ex: Prova sobre A República, de Platão"
          className="rounded-lg border border-gray-300 p-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-gray-700">Itens a estudar</label>
        <textarea
          name="studyItems"
          rows={2}
          placeholder="Ex: Capítulos 1 a 5, o mito da caverna"
          className="rounded-lg border border-gray-300 p-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-gray-700">Observações (opcional)</label>
        <textarea name="description" rows={2} className="rounded-lg border border-gray-300 p-2 text-sm" />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
      >
        {isPending ? "Publicando..." : "Publicar atividade para a turma"}
      </button>

      {done && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-2.5 text-xs text-green-800">
          <CheckCircle2 size={14} /> Atividade publicada e alunos notificados no WhatsApp.
        </div>
      )}
    </form>
  );
}
