"use client";

import { sincronizarCrmAberturas } from "@/lib/actions/aberturas-actions";
import { ArrowUpRight, CircleDollarSign, RefreshCw, UserRound, UsersRound } from "lucide-react";
import { Feedback, useFormAction } from "./form-action";
import { FormRegistro } from "./form-registro";
import { GraficoCustoConversao, LinhasOrcamento } from "./graficos";
import type { Abertura, JsonRecord, PainelAberturas } from "./types";
import { formatarData, primeiraChave, texto } from "./utils";

const CARD = "rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900";

export function InteressadosTab({ data, abertura }: { data: PainelAberturas; abertura: Abertura | null }) {
  const action = useFormAction(sincronizarCrmAberturas);
  return (
    <div className="space-y-5">
      <section className={CARD}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><UsersRound size={18} /></span><div><h2 className="font-black text-gray-950 dark:text-white">Interessados e matrículas</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Dados recebidos pela integração do CRM da filial. Interesse, adequação e próxima ação são fatos descritos pela integração, sem estimativa de probabilidade.</p></div></div>
          <form onSubmit={action.submit} className="flex flex-col items-stretch gap-2 sm:min-w-64 sm:items-end">
            <input type="hidden" name="schoolId" value={data.schoolId} />
            <button type="submit" disabled={action.pending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-na-green hover:text-na-green-dark disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:text-emerald-400"><RefreshCw size={14} className={action.pending ? "animate-spin" : ""} />{action.pending ? "Atualizando CRM…" : "Atualizar dados do CRM"}</button>
          </form>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><StatusCard label="Status da integração" value={data.crm.status || "Sem status"} /><StatusCard label="Interessados importados" value={String(data.crm.leads.length)} icon="interesse" /><StatusCard label="Registros de matrícula" value={String(data.crm.matriculas.length)} icon="matricula" /></div>
        <div className="mt-3 flex flex-col gap-1 text-xs text-gray-500 sm:flex-row sm:justify-between dark:text-gray-400"><Feedback error={action.error} success={action.success} aviso={action.aviso} /><span>Base atualizada: {data.crm.baseAtualizadaEm ? formatarData(data.crm.baseAtualizadaEm, { dateStyle: "medium", timeStyle: "short" }) : "ainda não sincronizada"}</span></div>
      </section>

      <GraficoCustoConversao data={data} />

      <section className={CARD}>
        <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-black text-gray-950 dark:text-white">Fila de interessados</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">A avaliação considera somente sinais e registros desta abertura selecionada.</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{data.crm.leads.length}</span></div>
        {!abertura && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Selecione uma abertura em Planejamento para consultar adequação e próxima ação específicas do ciclo e registrar uma avaliação.</p>}
        {data.crm.leads.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Não há interessados na base sincronizada da filial.</p> : <div className="space-y-2">{data.crm.leads.map((lead, index) => <LeadCard key={String(lead.id ?? index)} lead={lead} data={data} abertura={abertura} />)}</div>}
      </section>

      <section className={CARD}>
        <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-black text-gray-950 dark:text-white">Matrículas informadas pelo Mercúrio</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Vínculos acadêmicos devolvidos pela integração CRM.</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{data.crm.matriculas.length}</span></div>
        {data.crm.matriculas.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Não há matrículas na base sincronizada.</p> : <div className="divide-y divide-gray-100 dark:divide-gray-800">{data.crm.matriculas.map((matricula, index) => <MatriculaLinha key={`${String(matricula.mercurioId ?? index)}-${index}`} matricula={matricula} />)}</div>}
      </section>

      {abertura && <section className={CARD}><div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="font-black text-gray-950 dark:text-white">Registrar resultado acadêmico</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">A lista considera somente matrículas confirmadas no código de turma vinculado a esta abertura.</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{abertura.titulo}</span></div><FormRegistro schoolId={data.schoolId} abertura={abertura} leads={data.crm.leads} matriculas={data.crm.matriculas} eventos={data.eventos} professores={data.professores} tipoInicial="resultado" tiposPermitidos={["resultado"]} /></section>}
    </div>
  );
}

export function InvestimentosTab({ data, abertura }: { data: PainelAberturas; abertura: Abertura | null }) {
  return (
    <div className="space-y-5">
      <GraficoCustoConversao data={data} />
      <section className={CARD}>
        <div className="mb-4 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><CircleDollarSign size={18} /></span><div><h2 className="font-black text-gray-950 dark:text-white">Orçamento por abertura</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Compare o valor planejado com despesas lançadas e valores previstos.</p></div></div>
        <LinhasOrcamento aberturas={data.aberturas} aberturaSelecionadaId={abertura?.id} />
      </section>
      {abertura && <section className={CARD}><div className="mb-3"><h2 className="font-black text-gray-950 dark:text-white">Registrar investimento</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Lance uma despesa ou previsão em {abertura.titulo}.</p></div><FormRegistro schoolId={data.schoolId} abertura={abertura} leads={data.crm.leads} matriculas={data.crm.matriculas} eventos={data.eventos} professores={data.professores} tipoInicial="despesa" tiposPermitidos={["despesa"]} /></section>}
    </div>
  );
}

function StatusCard({ label, value, icon }: { label: string; value: string; icon?: "interesse" | "matricula" }) {
  return <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-950/60"><p className="text-[10px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">{label}</p><p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-gray-100">{icon === "interesse" ? <UserRound size={13} className="text-gray-500" /> : icon === "matricula" ? <ArrowUpRight size={13} className="text-emerald-600" /> : null}{value}</p></div>;
}

function LeadCard({ lead, data, abertura }: { lead: PainelAberturas["crm"]["leads"][number]; data: PainelAberturas; abertura: Abertura | null }) {
  const nome = texto(primeiraChave(lead, ["name", "nome", "nomeCompleto"]), "Interessado sem nome informado");
  const status = primeiraChave(lead, ["status", "situacao", "etapa"]);
  const avaliacoes = asRecord(lead.avaliacoesPorAbertura);
  const avaliacaoDireta = abertura ? asRecord(avaliacoes[abertura.id] ?? asRecord(lead.avaliacoes)[abertura.id]) : {};
  const interesse = avaliacaoDireta.interesse;
  const adequacao = avaliacaoDireta.adequacaoTurma;
  const proximaAcao = avaliacaoDireta.proximaAcao;
  return <article className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-950/30">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h3 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{nome}</h3>{status !== undefined && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">CRM · {texto(status)}</p>}</div></div>
    {abertura ? <div className="mt-3 grid gap-2 sm:grid-cols-3"><CampoCRM rotulo="Interesse" valor={interesse} /><CampoCRM rotulo="Adequação desta abertura" valor={adequacao} /><CampoCRM rotulo="Próxima ação" valor={proximaAcao} /></div> : <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Selecione uma abertura para consultar a avaliação específica.</p>}
    {abertura && <details className="mt-3 rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"><summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-na-green-dark dark:text-emerald-400">Guardar avaliação no histórico</summary><div className="border-t border-gray-100 p-3 dark:border-gray-800"><p className="mb-3 text-xs text-gray-500 dark:text-gray-400">A avaliação atualiza com os sinais automaticamente. Use este registro opcional para guardar um recorte datado dos fatos e da próxima ação.</p><FormRegistro schoolId={data.schoolId} abertura={abertura} leads={[lead]} matriculas={data.crm.matriculas} eventos={data.eventos} professores={data.professores} tipoInicial="avaliacao" tiposPermitidos={["avaliacao"]} leadInicialId={String(lead.id ?? "")} leadFixo /></div></details>}
  </article>;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function CampoCRM({ rotulo, valor }: { rotulo: string; valor: unknown }) {
  const registro = asRecord(valor);
  const estado = primeiraChave(registro, ["estado", "codigo"]);
  const motivo = primeiraChave(registro, ["motivo"]);
  const fonte = primeiraChave(registro, ["fonte"]);
  const simples = typeof valor === "string" || typeof valor === "number" ? valor : undefined;
  return <div className="rounded-lg bg-white px-2.5 py-2 dark:bg-gray-900"><p className="text-[10px] text-gray-500 dark:text-gray-400">{rotulo}</p><p className="mt-0.5 text-xs font-semibold text-gray-800 dark:text-gray-200">{rotuloEstado(simples ?? estado)}</p>{motivo !== undefined && motivo !== null && motivo !== "" && <p className="mt-1 text-[11px] leading-4 text-gray-600 dark:text-gray-400">{texto(motivo)}</p>}{fonte !== undefined && fonte !== null && fonte !== "" && <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-500">Fonte: {texto(fonte)}</p>}</div>;
}

function rotuloEstado(value: unknown): string {
  const estados: Record<string, string> = {
    a_confirmar: "A confirmar", conhecer: "Conhecer", participar: "Participar", inscrever: "Inscrever-se", depois: "Prefere depois", nao: "Não tem interesse",
    adequada: "Adequada", inadequada: "Inadequada", confirmar_interesse: "Confirmar interesse", confirmar_horario: "Confirmar horário",
    apoiar_inscricao: "Apoiar inscrição", respeitar_momento: "Respeitar o momento", respeitar_nao_contatar: "Respeitar pedido de não contato",
    respeitar_sem_interesse: "Respeitar decisão", retomar_conforme_combinado: "Retomar conforme combinado", conferir_contato: "Conferir contato",
    rever_combinado: "Rever combinado", acompanhar_como_matriculado: "Acompanhar matrícula", verificar_outra_turma: "Verificar outra turma", orientar_proximo_passo: "Orientar próximo passo",
  };
  const raw = texto(value, "Ainda sem avaliação registrada");
  return estados[raw] ?? raw.replaceAll("_", " ");
}

function MatriculaLinha({ matricula }: { matricula: JsonRecord }) {
  const nome = texto(primeiraChave(matricula, ["name", "nome", "nomeCompleto"]), "Matrícula sem nome no retorno");
  const id = texto(primeiraChave(matricula, ["mercurioId", "merId"]), "Identificador não informado");
  const turma = texto(primeiraChave(matricula, ["turmaId", "mercurioTurmaId"]), "Turma não informada");
  const data = primeiraChave(matricula, ["data", "dataMatricula"]);
  return <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{nome}</p><p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">Mercúrio · {id} · Turma {turma}</p></div><span className="text-xs text-gray-600 dark:text-gray-400">{data ? formatarData(data) : "Data não informada"}</span></div>;
}
