"use client";

import { salvarAbertura } from "@/lib/actions/aberturas-actions";
import { CalendarPlus, X } from "lucide-react";
import { useState } from "react";
import { CAMPO_CLASS, Campo, Feedback, SubmitButton, hiddenAberturaFields, useFormAction } from "./form-action";
import type { Abertura, Pessoa } from "./types";
import { hora, isoDate } from "./utils";

const STATUS = [
  ["rascunho", "Rascunho"],
  ["planejada", "Planejada"],
  ["em_curso", "Em curso"],
  ["concluida", "Concluída"],
  ["cancelada", "Cancelada"],
];

export function FormAbertura({ schoolId, professores, codigosTurma, abertura, onFechar }: { schoolId: string; professores: Pessoa[]; codigosTurma: string[]; abertura?: Abertura | null; onFechar: (id?: string) => void }) {
  const [professorIds, setProfessorIds] = useState<string[]>(abertura?.professorIds ?? []);
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
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Registre a turma e os parâmetros que orientam o planejamento.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={() => onFechar()} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </header>
        <form onSubmit={submit} className="space-y-5">
          {hiddenAberturaFields(schoolId, abertura?.id, abertura?.revisao)}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Nome do curso" className="sm:col-span-2">
              <input required name="titulo" maxLength={120} defaultValue={abertura?.titulo ?? ""} placeholder="Ex.: Introdução à filosofia" className={CAMPO_CLASS} />
            </Campo>
            <Campo label="Código da turma no Mercúrio" className="sm:col-span-2" hint="Vincule somente o código exato da turma. Matrículas entram nos relatórios apenas quando o Mercúrio confirma esse vínculo.">
              <input name="mercurioTurmaId" list="codigos-turma-mercurio" maxLength={100} defaultValue={abertura?.mercurioTurmaId ?? ""} placeholder="Código exato da turma" className={CAMPO_CLASS} />
              <datalist id="codigos-turma-mercurio">{codigosTurma.map((codigo) => <option key={codigo} value={codigo} />)}</datalist>
            </Campo>
            <Campo label="Primeira aula">
              <input required type="date" name="primeiraAula" defaultValue={isoDate(abertura?.primeiraAula)} className={CAMPO_CLASS} />
            </Campo>
            <Campo label="Dia da semana" hint="Precisa coincidir com a data da primeira aula.">
              <select required name="diaSemana" defaultValue={String(abertura?.diaSemana ?? 1)} className={CAMPO_CLASS}>
                {[[0,"Domingo"],[1,"Segunda-feira"],[2,"Terça-feira"],[3,"Quarta-feira"],[4,"Quinta-feira"],[5,"Sexta-feira"],[6,"Sábado"]].map(([id, label]) => <option key={String(id)} value={String(id)}>{label}</option>)}
              </select>
            </Campo>
            <Campo label="Horário de início">
              <input required type="time" name="inicio" defaultValue={hora(abertura?.inicioMinuto ?? 19 * 60)} className={CAMPO_CLASS} />
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
            <Campo label="Orçamento (R$)" hint="Valor planejado para esta abertura.">
              <input required type="number" name="orcamento" min="0" step="0.01" inputMode="decimal" defaultValue={abertura ? (abertura.orcamentoCentavos / 100).toFixed(2) : "0.00"} className={CAMPO_CLASS} />
            </Campo>
            <Campo label="Situação">
              <select name="status" defaultValue={abertura?.status ?? "rascunho"} className={CAMPO_CLASS}>
                {STATUS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Campo>
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
