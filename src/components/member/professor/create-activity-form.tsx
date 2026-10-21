"use client";

import { createActivity } from "@/lib/actions/activity-actions";
import {
  catalogoDaMateria,
  PROVAS_CONJUNTAS,
  provaConjuntaDa,
  type CatalogoMateria,
} from "@/lib/temas-curriculo";
import type { ActivityType } from "@prisma/client";
import { CheckCircle2, ChevronDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

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

export type MateriaDaTurma = {
  sigla: string;
  nome: string;
  catalogo: CatalogoMateria | null;
};

/**
 * Na prova, as matérias de uma prova conjunta (N1: Ética, Sociedade e
 * Filosofia da História) viram uma opção só — pedido do usuário 2026-10-21.
 */
function opcoesDeMateria(
  materias: MateriaDaTurma[],
  tipo: ActivityType,
): MateriaDaTurma[] {
  if (tipo !== "prova") return materias;
  const lista: MateriaDaTurma[] = [];
  for (const m of materias) {
    const chave = provaConjuntaDa(m.sigla);
    if (!chave) lista.push(m);
    else if (!lista.some((x) => x.sigla === chave))
      lista.push({
        sigla: chave,
        nome: PROVAS_CONJUNTAS[chave].rotuloCurto,
        catalogo: catalogoDaMateria(chave),
      });
  }
  return lista;
}

// Tipos ligados a conteúdo: escolhem matéria e temas numa lista (pedido do usuário 2026-10-21).
const TIPOS_COM_CONTEUDO: ActivityType[] = ["prova", "trabalho", "leitura"];
const NOME_TIPO: Partial<Record<ActivityType, string>> = {
  prova: "Prova",
  trabalho: "Trabalho",
  leitura: "Leitura",
};

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
  const comConteudo =
    !ehGrupo && TIPOS_COM_CONTEUDO.includes(tipo) && materias.length > 0;
  const opcoes = opcoesDeMateria(materias, tipo);
  const materia = comConteudo
    ? opcoes.find((m) => m.sigla === sigla)
    : undefined;

  // Título sugerido ("Prova de Psicologia", "Prova de conclusão do N1") até o instrutor escrever o dele.
  function sugerirTitulo(novoTipo: ActivityType, novaSigla: string) {
    if (tituloEditado) return;
    const conjunta = PROVAS_CONJUNTAS[novaSigla];
    const m = opcoesDeMateria(materias, novoTipo).find(
      (x) => x.sigla === novaSigla,
    );
    setTitulo(
      conjunta && novoTipo === "prova"
        ? conjunta.tituloSugerido
        : m && NOME_TIPO[novoTipo]
          ? `${NOME_TIPO[novoTipo]} de ${m.nome}`
          : "",
    );
  }
  const [done, setDone] = useState<{
    slack: "enviado" | "falhou" | null;
    whatsapp: { sent: number; total: number; failed: number };
    push: { pessoas: number; total: number };
  } | null>(null);
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
    <form
      action={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
            Tipo
          </label>
          <select
            name="type"
            required
            value={tipo}
            onChange={(e) => {
              const novo = e.target.value as ActivityType;
              setTipo(novo);
              // A matéria escolhida pode não existir no novo tipo (a conclusão do N1 só existe na prova).
              const continua = opcoesDeMateria(materias, novo).some(
                (m) => m.sigla === sigla,
              );
              if (!continua) {
                setSigla("");
                setTemas([]);
              }
              sugerirTitulo(novo, continua ? sigla : "");
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
          <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
            {ehGrupo ? "Data (fica na agenda até ela)" : "Data"}
          </label>
          <input
            type="date"
            name="dueDate"
            required
            className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700"
          />
        </div>
      </div>

      {comConteudo && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
            Matéria
          </label>
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
            <option value="">
              {tipo === "prova"
                ? "Escolha a matéria"
                : "Escolha a matéria (opcional)"}
            </option>
            {opcoes.map((m) => (
              <option key={m.sigla} value={m.sigla}>
                {m.nome}
              </option>
            ))}
          </select>
          {PROVAS_CONJUNTAS[sigla] && tipo === "prova" && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {PROVAS_CONJUNTAS[sigla].cobre}
            </p>
          )}
        </div>
      )}

      {materia?.catalogo && (
        <SeletorTemas
          rotulo={`Temas ${tipo === "prova" ? "da prova" : "abordados"}`}
          bloco={materia.catalogo.bloco}
          opcoes={materia.catalogo.temas}
          marcados={temas}
          onChange={setTemas}
        />
      )}
      {materia && !materia.catalogo && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Os temas de {materia.nome} ainda não estão cadastrados no Portal.
          Descreva o conteúdo abaixo.
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
          Título
        </label>
        <input
          name="title"
          required
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            setTituloEditado(true);
          }}
          placeholder={
            ehGrupo
              ? "Ex: Escala de sábado confirmada"
              : "Ex: Prova sobre A República, de Platão"
          }
          className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700"
        />
      </div>

      {!ehGrupo && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
            {materia?.catalogo ? "Complemento (opcional)" : "Itens a estudar"}
          </label>
          <textarea
            name="studyItems"
            rows={2}
            placeholder={
              materia?.catalogo
                ? "Ex: estudar também a apostila do tema"
                : "Ex: Capítulos 1 a 5, o mito da caverna"
            }
            className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700"
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
          {ehGrupo ? "Mensagem" : "Observações (opcional)"}
        </label>
        <textarea
          name="description"
          rows={ehGrupo ? 4 : 2}
          className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700"
        />
      </div>

      {temSlack && (
        <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            name="publicarNoSlack"
            defaultChecked
            className="h-4 w-4 accent-na-green"
          />
          Publicar também no canal do Slack
        </label>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
      >
        {isPending
          ? "Publicando..."
          : ehGrupo
            ? "Publicar para o grupo"
            : "Publicar atividade para a turma"}
      </button>

      {erro && (
        <p className="text-[11px] font-semibold text-na-danger-dark dark:text-red-300">
          {erro}
        </p>
      )}

      {done && (
        <div className="flex items-center gap-2 rounded-lg bg-na-success-light p-2.5 text-xs text-na-success-dark dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 size={14} /> Publicado na Agenda do Portal
          {done.slack === "enviado" ? " e no Slack" : ""}.{" "}
          {done.push.pessoas
            ? `Notificação no celular para ${done.push.pessoas} de ${done.push.total} pessoa(s).`
            : "Ninguém do grupo ativou as notificações no celular ainda."}
          {done.whatsapp.sent
            ? ` WhatsApp: ${done.whatsapp.sent} de ${done.whatsapp.total}.`
            : ""}
        </div>
      )}
      {done?.slack === "falhou" && (
        <p className="text-[11px] text-na-danger-dark dark:text-red-300">
          Não foi possível postar no Slack. A publicação na Agenda foi mantida.
        </p>
      )}
    </form>
  );
}

/**
 * Lista suspensa de temas com várias escolhas (pedido do usuário 2026-10-21:
 * "dropdown" em vez da lista aberta). Os escolhidos ficam como etiquetas
 * abaixo do campo, removíveis com um toque.
 */
export function SeletorTemas({
  rotulo,
  bloco,
  opcoes,
  marcados,
  onChange,
}: {
  rotulo: string;
  bloco?: string;
  opcoes: {
    titulo: string;
    topicos?: string[];
    rotulo?: string;
    grupo?: string;
  }[];
  marcados: string[];
  onChange: (temas: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  // Fecha ao tocar fora ou com Esc.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node))
        setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const ordem = (lista: string[]) =>
    opcoes.map((o) => o.titulo).filter((t) => lista.includes(t));
  const alternar = (titulo: string) =>
    onChange(
      ordem(
        marcados.includes(titulo)
          ? marcados.filter((t) => t !== titulo)
          : [...marcados, titulo],
      ),
    );
  const resumo =
    marcados.length === 0
      ? "Escolha os temas"
      : marcados.length === 1
        ? marcados[0]
        : `${marcados.length} temas escolhidos`;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
        {rotulo}
        {bloco ? (
          <span className="font-normal text-gray-500 dark:text-gray-400">
            {" "}
            · {bloco}
          </span>
        ) : null}
      </span>
      <div ref={caixa} className="relative">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={aberto}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 p-2 text-left text-sm dark:border-gray-700"
        >
          <span
            className={`truncate ${marcados.length ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}
          >
            {resumo}
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-gray-500 transition ${aberto ? "rotate-180" : ""}`}
          />
        </button>

        {aberto && (
          <div
            role="listbox"
            aria-multiselectable="true"
            className="absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            {opcoes.map((t, i) => {
              const marcado = marcados.includes(t.titulo);
              // Prova conjunta: cabeçalho a cada bloco (Ética, Sociedade, Filosofia da História).
              const novoGrupo = t.grupo && t.grupo !== opcoes[i - 1]?.grupo;
              return (
                <div key={t.titulo}>
                  {novoGrupo && (
                    <p className="px-2 pt-2 pb-1 text-[10px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                      {t.grupo}
                    </p>
                  )}
                  <label
                    className={`flex cursor-pointer items-start gap-2 rounded-lg p-2 text-[13px] hover:bg-gray-50 dark:hover:bg-gray-800 ${marcado ? "bg-na-green-light dark:bg-emerald-950/30" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternar(t.titulo)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-na-green"
                    />
                    <span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {t.rotulo ?? t.titulo}
                      </span>
                      {t.topicos && (
                        <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                          {t.topicos.join(" · ")}
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              );
            })}
            <div className="sticky bottom-0 flex justify-end border-t border-gray-100 bg-white p-1.5 dark:border-gray-800 dark:bg-gray-900">
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-lg bg-na-green px-3 py-1.5 text-[12px] font-semibold text-white"
              >
                Concluir
              </button>
            </div>
          </div>
        )}
      </div>

      {marcados.length > 1 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {marcados.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 rounded-full bg-na-green-light px-2.5 py-1 text-[11px] font-semibold text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              {t}
              <button
                type="button"
                onClick={() => alternar(t)}
                aria-label={`Remover ${t}`}
                className="rounded-full p-0.5 hover:bg-black/10"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
