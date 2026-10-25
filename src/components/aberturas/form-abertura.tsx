"use client";

import { salvarAbertura } from "@/lib/actions/aberturas-actions";
import { CalendarPlus, X } from "lucide-react";
import { useState } from "react";
import { CAMPO_CLASS, Campo, Feedback, SubmitButton, hiddenAberturaFields, useFormAction } from "./form-action";
import type { Abertura, Pessoa } from "./types";
import { hora } from "./utils";
import { CampoOrcamento } from "./campo-orcamento";

const DIAS = ["domingos", "segundas-feiras", "terças-feiras", "quartas-feiras", "quintas-feiras", "sextas-feiras", "sábados"];

const STATUS = [
  ["rascunho", "Rascunho"],
  ["planejada", "Planejada"],
  ["em_curso", "Em curso"],
  ["concluida", "Concluída"],
  ["cancelada", "Cancelada"],
];

function dataSaoPaulo(value: unknown) {
  if (typeof value !== "string" && !(value instanceof Date)) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const parte = (type: Intl.DateTimeFormatPartTypes) => partes.find((item) => item.type === type)?.value ?? "";
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

export function FormAbertura({ schoolId, professores, abertura, onFechar }: { schoolId: string; professores: Pessoa[]; abertura?: Abertura | null; onFechar: (id?: string) => void }) {
  const [professorIds, setProfessorIds] = useState<string[]>(abertura?.professorIds ?? []);
  const [primeiraAula, setPrimeiraAula] = useState(dataSaoPaulo(abertura?.primeiraAula));
  const diaSemana = primeiraAula ? new Date(`${primeiraAula}T12:00:00Z`).getUTCDay() : null;
  // Palestra de abertura já registrada (a mais cedo do Ciclo cultural) e o orçamento detalhado mais recente.
  const palestraExistente = dataSaoPaulo(
    (abertura?.registros ?? [])
      .filter((r) => r.tipo === "palestra")
      .map((r) => String((r.dados as { inicio?: unknown } | null)?.inicio ?? ""))
      .filter(Boolean)
      .sort()[0] ?? "",
  );
  const ultimoOrcamento = (abertura?.registros ?? []).filter((r) => r.tipo === "orcamento").at(-1);
  const orcamentoItens = ((ultimoOrcamento?.dados as { itens?: Record<string, number> } | null)?.itens ?? {}) as Record<string, number>;
  const [palestraTocada, setPalestraTocada] = useState(false);
  const [palestraManual, setPalestra] = useState("");
  const semanaAntes = primeiraAula && !abertura ? new Date(new Date(`${primeiraAula}T12:00:00Z`).getTime() - 7 * 864e5).toISOString().slice(0, 10) : "";
  const palestra = palestraTocada ? palestraManual : semanaAntes;
  const action = useFormAction(salvarAbertura);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    action.submit(event, (result) => onFechar(("id" in result ? result.id : undefined) ?? abertura?.id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onFechar()}>
      <section role="dialog" aria-modal="true" aria-labelledby="form-abertura-titulo" className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7 dark:bg-gray-900">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-na-green-dark uppercase dark:text-emerald-400"><CalendarPlus size={14} /> Planejamento pedagógico</p>
            <h2 id="form-abertura-titulo" className="mt-1 text-xl font-black text-gray-950 dark:text-white">{abertura ? "Editar abertura" : "Nova abertura"}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Registre o calendário e os parâmetros que orientam o planejamento.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={() => onFechar()} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </header>
        <form onSubmit={submit} className="space-y-5">
          {hiddenAberturaFields(schoolId, abertura?.id, abertura?.revisao)}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Primeira aula">
              <input required type="date" name="primeiraAula" value={primeiraAula} onChange={(event) => setPrimeiraAula(event.target.value)} className={CAMPO_CLASS} />
            </Campo>
            <Campo label="Inscrições até" hint="Opcional, para inscrições tardias. Em branco: até 30 dias após a primeira aula.">
              <input type="date" name="inscricoesAte" min={primeiraAula || undefined} defaultValue={dataSaoPaulo(abertura?.inscricoesAte)} className={CAMPO_CLASS} />
            </Campo>
            {/* Dia da semana sai da data da primeira aula (pedido do usuário 2026-10-25). */}
            <Campo label="Horário de início" hint={diaSemana === null ? "Escolha a data da primeira aula." : `Aulas às ${DIAS[diaSemana]}.`}>
              <input required type="time" name="inicio" defaultValue={hora(abertura?.inicioMinuto ?? 19 * 60)} className={CAMPO_CLASS} />
            </Campo>
            <input type="hidden" name="diaSemana" value={diaSemana ?? ""} />
            <Campo label="Palestra cultural de abertura" hint={palestraExistente ? "Já registrada; altere no Ciclo cultural." : "Normalmente uma semana antes da primeira aula. Entra no Ciclo cultural."}>
              {palestraExistente ? (
                <input type="date" value={palestraExistente} disabled className={CAMPO_CLASS} />
              ) : (
                <input type="date" name="palestraCultural" value={palestra} max={primeiraAula || undefined} onChange={(event) => { setPalestra(event.target.value); setPalestraTocada(true); }} className={CAMPO_CLASS} />
              )}
            </Campo>
            <Campo label="Sala">
              <input required name="sala" maxLength={80} defaultValue={abertura?.sala ?? ""} placeholder="Sala ou espaço" className={CAMPO_CLASS} />
            </Campo>
            <Campo label="Capacidade">
              <input required type="number" name="capacidade" min="1" max="1000" defaultValue={abertura?.capacidade ?? 20} className={CAMPO_CLASS} />
            </Campo>
            <Campo label="Meta de matrículas">
              <input required type="number" name="metaMatriculas" min="1" max="1000" defaultValue={abertura?.metaMatriculas ?? 12} className={CAMPO_CLASS} />
            </Campo>

            <Campo label="Situação">
              <select name="status" defaultValue={abertura?.status ?? "rascunho"} className={CAMPO_CLASS}>
                {STATUS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Campo>
            <CampoOrcamento totalCentavos={abertura?.orcamentoCentavos ?? 0} itensIniciais={orcamentoItens} />
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">Professores envolvidos</p>
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Para confirmar uma abertura planejada, em curso ou concluída, selecione pelo menos dois professores.</p>
              {professores.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Nenhum professor foi disponibilizado para esta escola.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {professores.map((professor) => (
                    <label key={professor.id} className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
                      <input type="checkbox" name="professorIds" value={professor.id} checked={professorIds.includes(professor.id)} onChange={(event) => setProfessorIds((current) => event.target.checked ? [...current, professor.id] : current.filter((id) => id !== professor.id))} className="accent-na-green" />
                      <span className="truncate">{professor.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Feedback error={action.error} success={action.success} aviso={action.aviso} />
          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-gray-800">
            <button type="button" onClick={() => onFechar()} className="min-h-10 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">Cancelar</button>
            <SubmitButton pending={action.pending}>{abertura ? "Salvar alterações" : "Criar abertura"}</SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
