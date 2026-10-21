"use client";

import { createActivity } from "@/lib/actions/activity-actions";
import type { ActivityType } from "@prisma/client";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const TYPES: { value: ActivityType; label: string }[] = [
  { value: "prova", label: "Prova" },
  { value: "trabalho", label: "Trabalho" },
  { value: "leitura", label: "Leitura" },
  { value: "atividade_turma", label: "Atividade de turma" },
  { value: "aviso", label: "Aviso" },
];

// Grupos de voluntários (Brigada, Corpo de Segurança) não têm prova/leitura.
const TYPES_GRUPO: { value: ActivityType; label: string }[] = [
  { value: "aviso", label: "Aviso" },
  { value: "atividade_turma", label: "Atividade do grupo" },
];

export function CreateActivityForm({ classGroupId, ehGrupo = false, temSlack = false }: { classGroupId: string; ehGrupo?: boolean; temSlack?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<{ slack: "enviado" | "falhou" | null; whatsapp: { sent: number; total: number; failed: number }; push: { pessoas: number; total: number } } | null>(null);
  const tipos = ehGrupo ? TYPES_GRUPO : TYPES;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await createActivity({
        classGroupId,
        type: formData.get("type") as ActivityType,
        title: String(formData.get("title") ?? ""),
        studyItems: String(formData.get("studyItems") ?? "") || undefined,
        description: String(formData.get("description") ?? "") || undefined,
        dueDate: new Date(String(formData.get("dueDate"))),
        publicarNoSlack: formData.get("publicarNoSlack") === "on",
      });
      setDone({ slack: res.slack, whatsapp: res.whatsapp, push: res.push });
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Tipo</label>
          <select name="type" required className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700">
            {tipos.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{ehGrupo ? "Data (fica na agenda até ela)" : "Data"}</label>
          <input type="date" name="dueDate" required className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Título</label>
        <input
          name="title"
          required
          placeholder={ehGrupo ? "Ex: Escala de sábado confirmada" : "Ex: Prova sobre A República, de Platão"}
          className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700"
        />
      </div>

      {!ehGrupo && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Itens a estudar</label>
          <textarea
            name="studyItems"
            rows={2}
            placeholder="Ex: Capítulos 1 a 5, o mito da caverna"
            className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700"
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{ehGrupo ? "Mensagem" : "Observações (opcional)"}</label>
        <textarea name="description" rows={ehGrupo ? 4 : 2} className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700" />
      </div>

      {temSlack && (
        <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <input type="checkbox" name="publicarNoSlack" defaultChecked className="h-4 w-4 accent-na-green" />
          Publicar também no canal do Slack
        </label>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
      >
        {isPending ? "Publicando..." : ehGrupo ? "Publicar para o grupo" : "Publicar atividade para a turma"}
      </button>

      {done && (
        <div className="flex items-center gap-2 rounded-lg bg-na-success-light p-2.5 text-xs text-na-success-dark dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 size={14} /> Publicado na Agenda do Portal{done.slack === "enviado" ? " e no Slack" : ""}.{" "}
          {done.push.pessoas ? `Notificação no celular para ${done.push.pessoas} de ${done.push.total} pessoa(s).` : "Ninguém do grupo ativou as notificações no celular ainda."}
          {done.whatsapp.sent ? ` WhatsApp: ${done.whatsapp.sent} de ${done.whatsapp.total}.` : ""}
        </div>
      )}
      {done?.slack === "falhou" && (
        <p className="text-[11px] text-na-danger-dark dark:text-red-300">Não foi possível postar no Slack. A publicação na Agenda foi mantida.</p>
      )}
    </form>
  );
}
