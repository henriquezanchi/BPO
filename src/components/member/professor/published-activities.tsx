"use client";

import { manageActivity } from "@/lib/actions/activity-actions";
import { SeletorTemas } from "@/components/member/professor/create-activity-form";
import { formatDateBR } from "@/lib/format";
import { catalogoDaMateria } from "@/lib/temas-curriculo";
import type { Activity } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const labels = { aviso: "Aviso", atividade_turma: "Atividade", prova: "Prova", trabalho: "Trabalho", leitura: "Leitura" };
const field = "w-full min-w-0 rounded-lg border border-gray-300 bg-transparent p-2 text-sm dark:border-gray-700";

export function PublishedActivities({ activities, ehGrupo }: { activities: Activity[]; ehGrupo: boolean }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const sorted = [...activities].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  return <ul className="flex flex-col gap-2">{sorted.map(activity => <PublishedActivity key={activity.id} activity={activity} ehGrupo={ehGrupo} past={new Date(activity.dueDate).toISOString().slice(0, 10) < today} />)}</ul>;
}

function PublishedActivity({ activity, ehGrupo, past }: { activity: Activity; ehGrupo: boolean; past: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  // Temas do catálogo da matéria (2026-10-21): aparecem no cartão e podem ser trocados ao editar.
  const catalogo = catalogoDaMateria(activity.materiaSigla);
  const [temas, setTemas] = useState<string[]>(activity.temas ?? []);
  if (removed) return null;

  function save(data: FormData) {
    startTransition(async () => {
      try {
        const result = await manageActivity(activity.id, {
          title: String(data.get("title") ?? ""),
          type: String(data.get("type")) as Activity["type"],
          dueDate: new Date(String(data.get("dueDate")) + "T00:00:00Z"),
          description: String(data.get("description") ?? ""),
          studyItems: String(data.get("studyItems") ?? ""),
          temas: catalogo ? temas : undefined,
        });
        if (!result.ok) { setMessage(result.error ?? "Não foi possível salvar."); return; }
        setEditing(false); setMessage("Alterações salvas na Agenda. Mensagens externas já enviadas não são alteradas."); router.refresh();
      } catch { setMessage("Não foi possível salvar. Tente novamente."); }
    });
  }
  function remove() {
    startTransition(async () => {
      try {
        const result = await manageActivity(activity.id, null);
        if (!result.ok) { setMessage(result.error ?? "Não foi possível excluir."); return; }
        setRemoved(true); router.refresh();
      } catch { setMessage("Não foi possível excluir. Tente novamente."); }
    });
  }
  return <li className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 text-xs dark:border-gray-700 dark:bg-gray-800">
    <details>
      <summary className="cursor-pointer rounded-xl p-3 focus-visible:outline-2 focus-visible:outline-na-green">
        <span className="ml-1 inline-flex max-w-[90%] flex-wrap items-center gap-x-4 gap-y-1 align-top">
          <span className="break-words font-semibold">{activity.title}</span>
          <span className="text-gray-500 dark:text-gray-400">{formatDateBR(activity.dueDate)}</span>
          {past && <span className="rounded-full bg-gray-200 px-2 py-1 font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">Já aconteceu</span>}
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-gray-200 p-3 dark:border-gray-700">
        {editing ? <form action={save} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">Título<input name="title" required maxLength={160} defaultValue={activity.title} className={field} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex min-w-0 flex-col gap-1">Tipo<select name="type" defaultValue={activity.type} className={field}>{Object.entries(labels).filter(([key]) => !ehGrupo || ["aviso", "atividade_turma"].includes(key)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="flex min-w-0 flex-col gap-1">Data<input type="date" name="dueDate" required defaultValue={new Date(activity.dueDate).toISOString().slice(0, 10)} className={field} /></label>
          </div>
          {catalogo && <SeletorTemas rotulo={`Temas${activity.materiaNome ? ` · ${activity.materiaNome}` : ""}`} bloco={catalogo.bloco} opcoes={catalogo.temas} marcados={temas} onChange={setTemas} />}
          {!ehGrupo && <label className="flex flex-col gap-1">{catalogo ? "Complemento" : "Itens a estudar"}<textarea name="studyItems" maxLength={5000} defaultValue={activity.studyItems ?? ""} className={field} /></label>}
          <label className="flex flex-col gap-1">Mensagem<textarea name="description" rows={4} maxLength={5000} defaultValue={activity.description ?? ""} className={field} /></label>
          <div className="flex flex-wrap gap-2"><button disabled={pending} className="rounded-lg bg-na-green px-4 py-2.5 font-semibold text-white disabled:opacity-50">{pending ? "Salvando…" : "Salvar alterações"}</button><button type="button" disabled={pending} onClick={() => setEditing(false)} className="rounded-lg px-4 py-2.5">Cancelar</button></div>
        </form> : <>
          <p className="text-gray-500 dark:text-gray-400">{labels[activity.type]}{activity.materiaNome ? ` · ${activity.materiaNome}` : ""}</p>
          {!!activity.temas?.length && <div><strong>Temas:</strong><ul className="mt-1 flex flex-col gap-0.5">{activity.temas.map((t) => <li key={t}>{t}</li>)}</ul></div>}
          {activity.studyItems && <p className="whitespace-pre-wrap break-words"><strong>{catalogo ? "Complemento: " : "Itens a estudar: "}</strong>{activity.studyItems}</p>}
          <p className="whitespace-pre-wrap break-words">{activity.description || "Sem mensagem adicional."}</p>
          {!deleting && <div className="flex gap-2"><button disabled={pending} onClick={() => { setEditing(true); setMessage(""); }} className="rounded-lg border border-gray-300 px-4 py-2.5 font-semibold dark:border-gray-600">Editar</button><button disabled={pending} onClick={() => { setDeleting(true); setMessage(""); }} className="rounded-lg px-4 py-2.5 text-red-700 dark:text-red-300">Excluir</button></div>}
        </>}
        {deleting && <div className="rounded-lg border border-red-300 p-3"><p>Excluir esta publicação da Agenda? Essa ação não pode ser desfeita. Mensagens externas já enviadas não serão apagadas.</p><div className="mt-2 flex flex-wrap gap-2"><button disabled={pending} onClick={remove} className="rounded-lg bg-red-700 px-4 py-2.5 text-white disabled:opacity-50">{pending ? "Excluindo…" : "Confirmar exclusão"}</button><button disabled={pending} onClick={() => setDeleting(false)} className="rounded-lg px-4 py-2.5">Manter publicação</button></div></div>}
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  </li>;
}
