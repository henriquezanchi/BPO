"use client";

import { createActivity } from "@/lib/actions/activity-actions";
import type { CatalogoMateria } from "@/lib/temas-curriculo";
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

export type MateriaDaTurma = { sigla: string; nome: string; catalogo: CatalogoMateria | null };

// Tipos ligados a conteúdo: escolhem matéria e temas numa lista (pedido do usuário 2026-10-21).
const TIPOS_COM_CONTEUDO: ActivityType[] = ["prova", "trabalho", "leitura"];
const NOME_TIPO: Partial<Record<ActivityType, string>> = { prova: "Prova", trabalho: "Trabalho", leitura: "Leitura" };

export function CreateActivityForm({
  classGroupId,
  ehGrupo = false,
  temSlack = false,
  materias = [],
}: {
  classGroupId: string;
  ehGrupo?: boolean;
  temSlack?: boolean;
  materias?: MateriaDaTurma[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<ActivityType>(ehGrupo ? "aviso" : "prova");
  const [sigla, setSigla] = useState("");
  const [temas, setTemas] = useState<string[]>([]);
  const [titulo, setTitulo] = useState("");
  const [tituloEditado, setTituloEditado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const comConteudo = !ehGrupo && TIPOS_COM_CONTEUDO.includes(tipo) && materias.length > 0;
  const materia = comConteudo ? materias.find((m) => m.sigla === sigla) : undefined;

  // Título sugerido ("Prova de Psicologia") até o instrutor escrever o dele.
  function sugerirTitulo(novoTipo: ActivityType, novaSigla: string) {
    if (tituloEditado) return;
    const m = materias.find((x) => x.sigla === novaSigla);
    setTitulo(m && NOME_TIPO[novoTipo] ? `${NOME_TIPO[novoTipo]} de ${m.nome}` : "");
  }
  const [done, setDone] = useState<{ slack: "enviado" | "falhou" | null; whatsapp: { sent: number; total: number; failed: number }; push: { pessoas: number; total: number } } | null>(null);
  const tipos = ehGrupo ? TYPES_GRUPO : TYPES;

  function handleSubmit(formData: FormData) {
    setErro(null);
    if (materia?.catalogo && tipo === "prova" && temas.length === 0) {
      setErro("Marque pelo menos um tema da prova.");
      return;
    }
    startTransition(async () => {
      const res = await createActivity({
        classGroupId,
        type: formData.get("type") as ActivityType,
        title: String(formData.get("title") ?? ""),
        materiaSigla: materia?.sigla,
        temas: materia?.catalogo ? temas : undefined,
        studyItems: String(formData.get("studyItems") ?? "") || undefined,
        description: String(formData.get("description") ?? "") || undefined,
        dueDate: new Date(String(formData.get("dueDate"))),
        publicarNoSlack: formData.get("publicarNoSlack") === "on",
      });
      setDone({ slack: res.slack, whatsapp: res.whatsapp, push: res.push });
      setTemas([]);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Tipo</label>
          <select
            name="type"
            required
            value={tipo}
            onChange={(e) => {
              const novo = e.target.value as ActivityType;
              setTipo(novo);
              sugerirTitulo(novo, sigla);
            }}
            className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700"
          >
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

      {comConteudo && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Matéria</label>
          <select
            value={sigla}
            required={tipo === "prova"}
            onChange={(e) => {
              setSigla(e.target.value);
              setTemas([]);
              sugerirTitulo(tipo, e.target.value);
            }}
            className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700"
          >
            <option value="">{tipo === "prova" ? "Escolha a matéria" : "Escolha a matéria (opcional)"}</option>
            {materias.map((m) => (
              <option key={m.sigla} value={m.sigla}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {materia?.catalogo && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
            Temas {tipo === "prova" ? "da prova" : "abordados"}
            {materia.catalogo.bloco ? <span className="font-normal text-gray-500 dark:text-gray-400"> · {materia.catalogo.bloco}</span> : null}
          </legend>
          <div className="flex flex-col gap-1 rounded-xl border border-gray-200 p-2 dark:border-gray-700">
            {materia.catalogo.temas.map((t) => {
              const marcado = temas.includes(t.titulo);
              return (
                <label key={t.titulo} className={`flex cursor-pointer items-start gap-2 rounded-lg p-2 text-[13px] ${marcado ? "bg-na-green-light dark:bg-emerald-950/30" : ""}`}>
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={(e) => setTemas(e.target.checked ? [...temas, t.titulo] : temas.filter((x) => x !== t.titulo))}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-na-green"
                  />
                  <span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{t.titulo}</span>
                    {t.topicos && <span className="block text-[11px] text-gray-500 dark:text-gray-400">{t.topicos.join(" · ")}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      {materia && !materia.catalogo && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">Os temas de {materia.nome} ainda não estão cadastrados no Portal. Descreva o conteúdo abaixo.</p>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Título</label>
        <input
          name="title"
          required
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            setTituloEditado(true);
          }}
          placeholder={ehGrupo ? "Ex: Escala de sábado confirmada" : "Ex: Prova sobre A República, de Platão"}
          className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700"
        />
      </div>

      {!ehGrupo && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{materia?.catalogo ? "Complemento (opcional)" : "Itens a estudar"}</label>
          <textarea
            name="studyItems"
            rows={2}
            placeholder={materia?.catalogo ? "Ex: estudar também a apostila do tema" : "Ex: Capítulos 1 a 5, o mito da caverna"}
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

      {erro && <p className="text-[11px] font-semibold text-na-danger-dark dark:text-red-300">{erro}</p>}

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
