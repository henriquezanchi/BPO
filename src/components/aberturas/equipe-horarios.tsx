"use client";

import { salvarDisponibilidade, salvarEscalaSecretaria, salvarConfigAberturas, compararHorariosAbertura, removerDisponibilidade, removerEscalaSecretaria } from "@/lib/actions/aberturas-actions";
import type { HorarioAvaliado, ResultadoComparacao } from "@/lib/aberturas/planejador";
import { ArrowUpRight, CalendarClock, CheckCircle2, Clock3, Edit3, Trash2, Users, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CAMPO_CLASS, Campo, Feedback, SubmitButton, hiddenAberturaFields, useFormAction } from "./form-action";
import type { Abertura, Disponibilidade, EscalaSecretaria, PainelAberturas } from "./types";
import { DIAS, formatarData, hora, isoDate } from "./utils";

const CARD = "rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900";

function tituloDia(dia: number) {
  return DIAS[dia] ? DIAS[dia][0].toUpperCase() + DIAS[dia].slice(1) : "Dia não informado";
}

function intervalo(dia: number, inicio: number, fim: number) {
  return `${tituloDia(dia)} · ${hora(inicio)}–${hora(fim)}`;
}

function DataRange({ inicio, fim }: { inicio: string; fim: string }) {
  return <span className="text-xs text-gray-500 dark:text-gray-400">Válido de {formatarData(inicio)} a {formatarData(fim)}</span>;
}

export function EquipeHorarios({ data, abertura }: { data: PainelAberturas; abertura: Abertura | null }) {
  const [disponibilidadeEmEdicao, setDisponibilidadeEmEdicao] = useState<Disponibilidade | null>(null);
  const [escalaEmEdicao, setEscalaEmEdicao] = useState<EscalaSecretaria | null>(null);
  const disponibilidade = data.disponibilidades;
  const inicioPadrao = abertura?.primeiraAula ?? new Date().toISOString().slice(0, 10);
  const fimPadrao = (() => {
    const date = new Date(`${inicioPadrao}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) date.setUTCDate(date.getUTCDate() + 35);
    return Number.isNaN(date.getTime()) ? inicioPadrao : date.toISOString().slice(0, 10);
  })();
  const fimPadraoEscala = (() => {
    const date = new Date(`${inicioPadrao}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) date.setUTCDate(date.getUTCDate() + 60);
    return Number.isNaN(date.getTime()) ? fimPadrao : date.toISOString().slice(0, 10);
  })();

  return (
    <div className="space-y-5">
      <section className={CARD}>
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><CalendarClock size={18} /></span>
          <div><h2 className="font-black text-gray-950 dark:text-white">Disponibilidade dos professores</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Registre dias e horários recorrentes, com o período em que a disponibilidade vale.</p></div>
        </div>
        <FormularioDisponibilidade key={disponibilidadeEmEdicao?.id ?? "nova-disponibilidade"} data={data} abertura={abertura} item={disponibilidadeEmEdicao} aoCancelar={() => setDisponibilidadeEmEdicao(null)} inicioPadrao={inicioPadrao} fimPadrao={fimPadrao} />
      </section>

      <section className={CARD}>
        <div className="mb-3 flex items-center gap-2"><Clock3 size={17} className="text-gray-500" /><h3 className="font-bold text-gray-900 dark:text-gray-100">Horários informados</h3><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">{disponibilidade.length}</span></div>
        {disponibilidade.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Nenhuma disponibilidade foi registrada ainda.</p> : <div className="divide-y divide-gray-100 dark:divide-gray-800">{disponibilidade.map((item) => <DisponibilidadeLinha key={item.id} item={item} nome={data.professores.find((p) => p.id === item.professorId)?.name} aoEditar={() => setDisponibilidadeEmEdicao(item)} schoolId={data.schoolId} />)}</div>}
      </section>

      <section className={CARD}>
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><Users size={18} /></span>
          <div><h2 className="font-black text-gray-950 dark:text-white">Escala da secretaria</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Assuma um horário de apoio à abertura na secretaria responsável.</p></div>
        </div>
        <FormularioEscala key={escalaEmEdicao?.id ?? "nova-escala"} data={data} escala={escalaEmEdicao} aoCancelar={() => setEscalaEmEdicao(null)} inicioPadrao={inicioPadrao} fimPadrao={fimPadraoEscala} />
        <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
          <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">Turnos registrados</h3>
          {data.escalas.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Ainda não há turnos de secretaria registrados.</p> : <div className="grid gap-2 sm:grid-cols-2">{data.escalas.map((escala) => <EscalaCard key={escala.id} escala={escala} schoolId={data.schoolId} aoEditar={() => setEscalaEmEdicao(escala)} />)}</div>}
        </div>
        <Link href="/voluntario/aberturas?aba=orientacoes" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-na-green-dark hover:underline dark:text-emerald-400">Orientações da Secretaria de Abertura de Turma <ArrowUpRight size={14} /></Link>
      </section>

      <section className={CARD}>
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><WandSparkles size={18} /></span>
          <div><h2 className="font-black text-gray-950 dark:text-white">Parâmetros da escola</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Defina a capacidade e as funções que precisam estar cobertas nas aberturas.</p></div>
        </div>
        <FormularioConfiguracao key={JSON.stringify(data.configs ?? {})} data={data} />
      </section>

      <CompararHorarios key={abertura?.id ?? "sem-abertura"} data={data} abertura={abertura} inicioPadrao={inicioPadrao} fimPadrao={fimPadrao} />
    </div>
  );
}

function FormularioDisponibilidade({ data, abertura, item, aoCancelar, inicioPadrao, fimPadrao }: { data: PainelAberturas; abertura: Abertura | null; item: Disponibilidade | null; aoCancelar: () => void; inicioPadrao: string; fimPadrao: string }) {
  const action = useFormAction(salvarDisponibilidade);
  const impedimentos = Array.isArray(item?.impedimentos) ? JSON.stringify(item.impedimentos) : "[]";
  const submit = (event: React.FormEvent<HTMLFormElement>) => action.submit(event, () => { if (item) aoCancelar(); });
  return <form onSubmit={submit} className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${item ? "rounded-xl border border-na-green/30 bg-na-green-light/20 p-3 dark:border-emerald-900 dark:bg-emerald-950/20" : ""}`}>
    <input type="hidden" name="schoolId" value={data.schoolId} />
    {item && <input type="hidden" name="id" value={item.id} />}
    <Campo label="Professor"><select required name="professorId" defaultValue={item?.professorId ?? ""} className={CAMPO_CLASS}><option value="" disabled>Selecione</option>{data.professores.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Campo>
    <Campo label="Dia"><select name="diaSemana" defaultValue={String(item?.diaSemana ?? abertura?.diaSemana ?? 1)} className={CAMPO_CLASS}>{DIAS.map((dia, i) => <option key={dia} value={i}>{dia[0].toUpperCase() + dia.slice(1)}</option>)}</select></Campo>
    <Campo label="A partir de"><input required type="time" name="inicio" defaultValue={hora(item?.inicioMinuto ?? abertura?.inicioMinuto ?? 19 * 60)} className={CAMPO_CLASS} /></Campo>
    <Campo label="Até"><input required type="time" name="fim" defaultValue={hora(item?.fimMinuto ?? (abertura ? abertura.inicioMinuto + abertura.duracaoMinutos : 21 * 60))} className={CAMPO_CLASS} /></Campo>
    <Campo label="Válida desde"><input required type="date" name="validaDe" defaultValue={isoDate(item?.validaDe) || inicioPadrao} className={CAMPO_CLASS} /></Campo>
    <Campo label="Válida até"><input required type="date" name="validaAte" defaultValue={isoDate(item?.validaAte) || fimPadrao} className={CAMPO_CLASS} /></Campo>
    <Campo label="Impedimentos (JSON)" hint="Use [] se não houver. Cada item contém data, inicioMinuto e fimMinuto."><input name="impedimentos" defaultValue={impedimentos} className={CAMPO_CLASS} /></Campo>
    <label className="flex min-h-11 items-center gap-2 text-sm text-gray-700 sm:col-span-2 lg:col-span-4 dark:text-gray-300"><input type="checkbox" name="habilitado" value="true" defaultChecked={item?.habilitado ?? false} className="accent-na-green" />A escola confirma a habilitação e disponibilidade deste professor</label>
    <div className="sm:col-span-2 lg:col-span-4"><Feedback error={action.error} success={action.success} aviso={action.aviso} /><div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{item && <button type="button" onClick={aoCancelar} className="min-h-10 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300">Cancelar edição</button>}<SubmitButton pending={action.pending}>{item ? "Salvar alterações" : "Salvar disponibilidade"}</SubmitButton></div></div>
  </form>;
}

function DisponibilidadeLinha({ item, nome, aoEditar, schoolId }: { item: Disponibilidade; nome?: string; aoEditar: () => void; schoolId: string }) {
  const impedimentos = Array.isArray(item.impedimentos) ? item.impedimentos.length : 0;
  return <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{nome || "Professor da escola"}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.habilitado ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>{item.habilitado ? "Validada pela escola" : "Sem validação da escola"}</span></div><p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{intervalo(item.diaSemana, item.inicioMinuto, item.fimMinuto)}{impedimentos ? ` · ${impedimentos} impedimento(s)` : ""}</p><DataRange inicio={item.validaDe} fim={item.validaAte} /></div><div className="flex gap-2 self-start sm:self-auto"><button type="button" onClick={aoEditar} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"><Edit3 size={13} />Editar</button><RemoverRegistro action={removerDisponibilidade} schoolId={schoolId} id={item.id} label="disponibilidade" /></div></div>;
}

function FormularioEscala({ data, escala, aoCancelar, inicioPadrao, fimPadrao }: { data: PainelAberturas; escala: EscalaSecretaria | null; aoCancelar: () => void; inicioPadrao: string; fimPadrao: string }) {
  const action = useFormAction(salvarEscalaSecretaria);
  const nomesSecretarias = [...new Set(data.escalas.map((e) => e.secretaria).filter(Boolean))];
  const funcoes = data.configs?.funcoesNecessarias ?? [];
  const submit = (event: React.FormEvent<HTMLFormElement>) => action.submit(event, () => { if (escala) aoCancelar(); });
  return (
    <form onSubmit={submit} className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${escala ? "rounded-xl border border-na-green/30 bg-na-green-light/20 p-3 dark:border-emerald-900 dark:bg-emerald-950/20" : ""}`}>
      <input type="hidden" name="schoolId" value={data.schoolId} />
      {escala && <input type="hidden" name="id" value={escala.id} />}
      <Campo label="Pessoa da equipe"><select required name="memberId" defaultValue={escala?.memberId ?? data.professores.find((p) => p.id === data.member.id)?.id ?? ""} className={CAMPO_CLASS}><option value="">Selecione</option>{data.professores.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Campo>
      <Campo label="Secretaria"><input required name="secretaria" list="aberturas-secretarias" maxLength={100} defaultValue={escala?.secretaria ?? ""} placeholder="Ex.: Comunicação" className={CAMPO_CLASS} /><datalist id="aberturas-secretarias">{nomesSecretarias.map((nome) => <option key={nome} value={nome} />)}</datalist></Campo>
      <Campo label="Função"><input required name="funcao" list="aberturas-funcoes" maxLength={100} defaultValue={escala?.funcao ?? ""} placeholder="Ex.: recepção" className={CAMPO_CLASS} /><datalist id="aberturas-funcoes">{funcoes.map((funcao) => <option key={funcao} value={funcao} />)}</datalist></Campo>
      <Campo label="Dia"><select name="diaSemana" defaultValue={String(escala?.diaSemana ?? 1)} className={CAMPO_CLASS}>{DIAS.map((dia, i) => <option key={dia} value={i}>{dia[0].toUpperCase() + dia.slice(1)}</option>)}</select></Campo>
      <div className="grid grid-cols-2 gap-2"><Campo label="Início"><input required type="time" name="inicio" defaultValue={hora(escala?.inicioMinuto ?? 18 * 60 + 30)} className={CAMPO_CLASS} /></Campo><Campo label="Fim"><input required type="time" name="fim" defaultValue={hora(escala?.fimMinuto ?? 21 * 60 + 30)} className={CAMPO_CLASS} /></Campo></div>
      <Campo label="Válida desde"><input required type="date" name="validaDe" defaultValue={isoDate(escala?.validaDe) || inicioPadrao} className={CAMPO_CLASS} /></Campo>
      <Campo label="Válida até"><input required type="date" name="validaAte" defaultValue={isoDate(escala?.validaAte) || fimPadrao} className={CAMPO_CLASS} /></Campo>
      <label className="flex min-h-11 items-center gap-2 text-sm text-gray-700 sm:col-span-2 lg:col-span-4 dark:text-gray-300"><input type="checkbox" name="confirmado" value="true" defaultChecked={escala?.confirmado ?? false} className="accent-na-green" />Confirmo que posso cumprir este turno.</label>
      <div className="sm:col-span-2 lg:col-span-4"><Feedback error={action.error} success={action.success} aviso={action.aviso} /><div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{escala && <button type="button" onClick={aoCancelar} className="min-h-10 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300">Cancelar edição</button>}<SubmitButton pending={action.pending}>{escala ? "Salvar alterações" : "Registrar turno"}</SubmitButton></div></div>
    </form>
  );
}

function EscalaCard({ escala, schoolId, aoEditar }: { escala: EscalaSecretaria; schoolId: string; aoEditar: () => void }) {
  return <article className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-950/50"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{escala.secretaria}</p><p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{escala.funcao} · {intervalo(escala.diaSemana, escala.inicioMinuto, escala.fimMinuto)}</p><p className="mt-1 text-[11px] text-gray-500 dark:text-gray-500"><DataRange inicio={escala.validaDe} fim={escala.validaAte} /></p></div><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${escala.confirmado ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>{escala.confirmado && <CheckCircle2 size={11} />}{escala.confirmado ? "Confirmado" : "Aguardando"}</span><button type="button" onClick={aoEditar} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-gray-300 px-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"><Edit3 size={12} />Editar</button><RemoverRegistro action={removerEscalaSecretaria} schoolId={schoolId} id={escala.id} label="turno" /></div></div></article>;
}

function RemoverRegistro({ action, schoolId, id, label }: { action: (data: FormData) => Promise<{ ok: boolean; error?: string }>; schoolId: string; id: string; label: string }) {
  const feedback = useFormAction(action);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm(`Remover este ${label}? Esta alteração libera o horário associado.`)) { event.preventDefault(); return; }
    feedback.submit(event);
  };
  return <form onSubmit={submit} className="flex items-center gap-2"><input type="hidden" name="schoolId" value={schoolId} /><input type="hidden" name="id" value={id} /><Feedback error={feedback.error} success={feedback.success} /><button type="submit" disabled={feedback.pending} aria-label={`Remover ${label}`} title={`Remover ${label}`} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-200 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"><Trash2 size={13} />{feedback.pending ? "Removendo…" : "Remover"}</button></form>;
}

function FormularioConfiguracao({ data }: { data: PainelAberturas }) {
  const action = useFormAction(salvarConfigAberturas);
  const [funcoesText, setFuncoesText] = useState((data.configs?.funcoesNecessarias ?? []).join("\n"));
  const funcoes = [...new Set(funcoesText.split(/[\n,;]/).map((value) => value.trim()).filter(Boolean))];
  return (
    <form onSubmit={action.submit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="schoolId" value={data.schoolId} />
      <input type="hidden" name="revisao" value={String(data.configs?.revisao ?? 0)} />
      <input type="hidden" name="funcoesNecessarias" value={funcoes.join(", ")} />
      <Campo label="Capacidade geral da escola" hint="Opcional. Limite de pessoas para atividades simultâneas."><input type="number" min="1" max="10000" name="capacidadeEscola" defaultValue={data.configs?.capacidadeEscola ?? ""} className={CAMPO_CLASS} /></Campo>
      <Campo label="Funções necessárias" hint="Uma por linha. Essas funções aparecem como sugestões na escala."><textarea rows={3} value={funcoesText} onChange={(e) => setFuncoesText(e.target.value)} className={CAMPO_CLASS} placeholder="Recepção\nApoio de sala\nDivulgação" /></Campo>
      <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2 dark:text-gray-300"><input type="checkbox" name="compartilharAprendizados" value="true" defaultChecked={data.configs?.compartilharAprendizados ?? false} className="accent-na-green" />Permitir compartilhamento de aprendizados com outras escolas</label>
      <div className="sm:col-span-2"><Feedback error={action.error} success={action.success} aviso={action.aviso} /><div className="mt-3 flex justify-end"><SubmitButton pending={action.pending}>Salvar parâmetros</SubmitButton></div></div>
    </form>
  );
}

function CompararHorarios({ data, abertura, inicioPadrao, fimPadrao }: { data: PainelAberturas; abertura: Abertura | null; inicioPadrao: string; fimPadrao: string }) {
  const action = useFormAction(compararHorariosAbertura, { refresh: false });
  const [resultado, setResultado] = useState<ResultadoComparacao | null>(null);
  const compara = (event: React.FormEvent<HTMLFormElement>) => {
    action.submit(event, (result) => { if ("comparacao" in result) setResultado(result.comparacao); });
  };
  const opcoes = resultado?.opcoes ?? [];
  const viaveis = resultado?.viaveis ?? [];
  const diasSelecionados = abertura ? [abertura.diaSemana] : [1, 2, 3, 4, 5];
  return (
    <section className={CARD}>
      <div className="mb-4 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"><CalendarClock size={18} /></span><div><h2 className="font-black text-gray-950 dark:text-white">Comparar horários possíveis</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Consulte conflitos de calendário e a disponibilidade de professores para um período.</p></div></div>
      {!abertura && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">Selecione ou crie uma abertura na aba Planejamento para comparar horários com seus professores.</p>}
      <form onSubmit={compara} className="space-y-3">
        {hiddenAberturaFields(data.schoolId, abertura?.id, abertura?.revisao)}
        <div className="grid gap-3 sm:grid-cols-3"><Campo label="Janela de início"><input required type="date" name="janelaInicio" defaultValue={inicioPadrao} className={CAMPO_CLASS} /></Campo><Campo label="Janela de fim"><input required type="date" name="janelaFim" defaultValue={fimPadrao} className={CAMPO_CLASS} /></Campo><Campo label="Horário de início"><input required type="time" name="inicio" defaultValue={abertura ? hora(abertura.inicioMinuto) : "19:00"} className={CAMPO_CLASS} /></Campo></div>
        <fieldset><legend className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">Dias da semana</legend><div className="flex flex-wrap gap-2">{DIAS.map((dia, i) => <label key={dia} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-300"><input type="checkbox" name="dias" value={String(i)} defaultChecked={diasSelecionados.includes(i)} className="accent-na-green" />{dia.slice(0, 3)}</label>)}</div></fieldset>
        <Feedback error={action.error} success={action.success} aviso={action.aviso} />
        <div className="flex justify-end">{abertura ? <SubmitButton pending={action.pending}>Comparar agenda</SubmitButton> : <button type="button" disabled className="min-h-10 cursor-not-allowed rounded-xl bg-gray-300 px-4 py-2 text-sm font-bold text-gray-500 dark:bg-gray-800">Comparar agenda</button>}</div>
      </form>
      {resultado && <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-gray-900 dark:text-gray-100">Opções avaliadas</h3><p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Janela: {formatarData(resultado.janela.inicio)} a {formatarData(resultado.janela.fim)} · fuso {resultado.fusoHorario}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">{viaveis.length} viável(is) de {opcoes.length}</span></div>{opcoes.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">A comparação não retornou opções para estes critérios.</p> : <div className="grid gap-3 xl:grid-cols-2">{opcoes.map((opcao, index) => <OpcaoHorario key={`${opcao.diaSemana}-${opcao.inicioMinuto}-${index}`} opcao={opcao} pessoas={data.professores} />)}</div>}<details className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-950/60 dark:text-gray-400"><summary className="cursor-pointer font-semibold">Como as opções são ordenadas</summary><ul className="mt-2 list-disc space-y-1 pl-4">{resultado.criteriosOrdenacao.map((criterio) => <li key={criterio}>{criterio}</li>)}</ul></details></div>}
    </section>
  );
}

function OpcaoHorario({ opcao, pessoas }: { opcao: HorarioAvaliado; pessoas: PainelAberturas["professores"] }) {
  const estado = opcao.situacao;
  const label = estado === "viavel" ? "Viável" : estado === "impedido" ? "Impedido" : "Pendente";
  const nomeIds = (ids: string[]) => ids.map((id) => pessoas.find((p) => p.id === id)?.name ?? "Pessoa da equipe").join(", ") || "Nenhum informado";
  const motivos = [...opcao.motivos.impedimentos, ...opcao.motivos.pendencias];
  const historic = opcao.indicadores.historico.diaSemana;
  return <article className={`rounded-xl border p-3.5 ${estado === "viavel" ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20" : estado === "impedido" ? "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20" : "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"}`}>
    <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-gray-900 dark:text-gray-100">{tituloDia(opcao.diaSemana)} · {hora(opcao.inicioMinuto)}–{hora(opcao.fimMinuto)}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${estado === "viavel" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200" : estado === "impedido" ? "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"}`}>{label}</span></div>
    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{opcao.ocorrencias.length} encontro(s) na janela · duração de 2 horas</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2"><IndicadorLinha nome="Disponibilidade docente" valor={opcao.indicadores.docentes.disponibilidade} /><IndicadorLinha nome="Titulares disponíveis" valor={nomeIds(opcao.indicadores.docentes.titularesDisponiveis)} /><IndicadorLinha nome="Suplentes disponíveis" valor={nomeIds(opcao.indicadores.docentes.suplentesDisponiveis)} /><IndicadorLinha nome="Capacidade" valor={opcao.indicadores.ocupacao.situacao === "conhecida" ? `${opcao.indicadores.ocupacao.ocupados} ocupados${opcao.indicadores.ocupacao.capacidade !== null ? ` de ${opcao.indicadores.ocupacao.capacidade}` : ""}` : "Sem dado histórico"} /><IndicadorLinha nome="Interesse por horário" valor={opcao.indicadores.leads.situacao === "conhecida" ? `${opcao.indicadores.leads.confirmados} confirmados · ${opcao.indicadores.leads.previstos} previstos` : "Sem amostra para este horário"} /></div>
    {motivos.length > 0 && <div className="mt-3 border-t border-current/10 pt-2"><p className="text-[10px] font-bold tracking-wide text-gray-600 uppercase dark:text-gray-300">Agenda e pendências</p><ul className="mt-1 space-y-1">{motivos.map((motivo, index) => <li key={`${motivo.codigo}-${motivo.data ?? ""}-${index}`} className="text-xs leading-5 text-gray-700 dark:text-gray-300">{motivo.data ? `${formatarData(motivo.data)} · ` : ""}{motivo.descricao}</li>)}</ul></div>}
    {historic && <p className="mt-3 rounded-lg bg-white/70 px-2.5 py-2 text-[11px] text-gray-600 dark:bg-gray-900/60 dark:text-gray-400">Histórico do dia: {historic.amostra} caso(s), {historic.matriculas} matrícula(s) e {historic.leads} interessado(s). Mostrado como amostra observada.</p>}
  </article>;
}

function IndicadorLinha({ nome, valor }: { nome: string; valor: string }) {
  return <div className="rounded-lg bg-white/70 px-2.5 py-2 dark:bg-gray-900/60"><p className="text-[10px] text-gray-500 dark:text-gray-400">{nome}</p><p className="mt-0.5 text-xs font-semibold text-gray-800 dark:text-gray-200">{valor}</p></div>;
}
