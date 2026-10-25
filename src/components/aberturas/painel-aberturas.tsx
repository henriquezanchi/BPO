"use client";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, BookOpenCheck, CalendarDays, CalendarPlus, CheckCircle2, ClipboardCheck, Clock3, GraduationCap, Link2, UsersRound } from "lucide-react";
import { vincularTurmaAbertura } from "@/lib/actions/aberturas-actions";
import { FormAbertura } from "./form-abertura";
import { FormRegistro } from "./form-registro";
import { InteressadosTab, InvestimentosTab } from "./crm-investimentos";
import { EquipeHorarios } from "./equipe-horarios";
import { AprendizadosTab } from "./aprendizados-tab";
import type { Abertura, PainelAberturas, RegistroAbertura } from "./types";
import { DIAS, dataCalendario, despesasDaAbertura, formatarCentavos, formatarData, formatarReais, hora, numero, objeto, primeiraChave, texto, tituloCalendario } from "./utils";
import { GraficoCustoConversao } from "./graficos";
import { CAMPO_CLASS, Campo, Feedback, SubmitButton, hiddenAberturaFields, useFormAction } from "./form-action";

type Aba = "resumo" | "planejamento" | "cultura" | "interessados" | "investimentos" | "equipe" | "aprendizados";
const ABAS: { id: Aba; titulo: string }[] = [
  { id: "resumo", titulo: "Resumo" },
  { id: "planejamento", titulo: "Planejamento" },
  { id: "cultura", titulo: "Ciclo cultural" },
  { id: "interessados", titulo: "Interessados" },
  { id: "investimentos", titulo: "Investimentos" },
  { id: "equipe", titulo: "Equipe e horários" },
  { id: "aprendizados", titulo: "Aprendizados" },
];
const CARD = "rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900";

export function PainelAberturas({ data }: { data: PainelAberturas }) {
  const router = useRouter();
  const inicial = data.aberturas.find((item) => item.status !== "cancelada") ?? data.aberturas[0];
  const [aba, setAba] = useState<Aba>("resumo");
  const [aberturaId, setAberturaId] = useState(inicial?.id ?? "");
  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Abertura | null>(null);
  const abertura = data.aberturas.find((item) => item.id === aberturaId) ?? data.aberturas.find((item) => item.status !== "cancelada") ?? data.aberturas[0] ?? null;

  function abrirNova() {
    setEmEdicao(null);
    setFormAberto(true);
  }

  function abrirEdicao(item: Abertura) {
    setEmEdicao(item);
    setFormAberto(true);
  }

  function fecharFormulario(id?: string) {
    if (id) {
      setAberturaId(id);
      setAba("planejamento");
      router.refresh();
    }
    setFormAberto(false);
    setEmEdicao(null);
  }

  const mostrarAba = () => {
    if (aba === "resumo") return <ResumoTab data={data} nova={abrirNova} onIr={(id, destino = "planejamento") => { if (id) setAberturaId(id); setAba(destino); }} />;
    if (aba === "planejamento") return <PlanejamentoTab data={data} abertura={abertura} selecionar={setAberturaId} nova={abrirNova} editar={abrirEdicao} />;
    if (aba === "cultura") return <CicloCultural data={data} abertura={abertura} />;
    if (aba === "interessados") return <InteressadosTab data={data} abertura={abertura} />;
    if (aba === "investimentos") return <InvestimentosTab data={data} abertura={abertura} />;
    if (aba === "equipe") return <EquipeHorarios data={data} abertura={abertura} />;
    return <AprendizadosTab data={data} abertura={abertura} />;
  };

  return <div className="space-y-5">
    <header className="flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-na-green-dark to-na-green px-5 py-6 text-white shadow-sm sm:flex-row sm:items-end sm:justify-between sm:px-7">
      <div className="max-w-2xl"><h1 className="text-2xl font-black sm:text-3xl">Aberturas de Turmas</h1><p className="mt-2 text-sm leading-6 text-white/85">Organize a equipe, a agenda cultural, o acompanhamento dos interessados e os resultados confirmados para cada nova turma.</p></div>
      <div className="flex flex-col gap-2 sm:min-w-56 sm:items-end">{data.escolas.length > 1 && <label className="flex flex-col gap-1 text-xs font-semibold text-white/90">Filial<select value={data.schoolId} onChange={(event) => router.push(`/voluntario/aberturas?schoolId=${encodeURIComponent(event.target.value)}`)} className="min-h-10 rounded-xl border border-white/30 bg-white/10 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/40"><option className="text-gray-900" value="">Selecione a filial</option>{data.escolas.map((escola) => <option className="text-gray-900" key={escola.id} value={escola.id}>{escola.name}</option>)}</select></label>}
        <button type="button" onClick={abrirNova} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-na-green-dark transition hover:bg-emerald-50"><CalendarPlus size={16} />Planejar abertura</button>
      </div>
    </header>

    <nav aria-label="Seções de aberturas" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist">{ABAS.map(({ id, titulo }) => <button key={id} type="button" role="tab" id={`aba-aberturas-${id}`} aria-selected={aba === id} aria-controls="painel-aberturas-conteudo" onClick={() => setAba(id)} className={`min-h-10 shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${aba === id ? "bg-na-green-dark text-white shadow-sm dark:bg-emerald-800" : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"}`}>{titulo}</button>)}</nav>

    <div role="tabpanel" id="painel-aberturas-conteudo" aria-labelledby={`aba-aberturas-${aba}`} className="min-w-0">{mostrarAba()}</div>
    {formAberto && <FormAbertura key={emEdicao?.id ?? "nova-abertura"} schoolId={data.schoolId} professores={data.professores} abertura={emEdicao} onFechar={fecharFormulario} />}
  </div>;
}

function ResumoTab({ data, onIr, nova }: { data: PainelAberturas; onIr: (id?: string, destino?: Aba) => void; nova: () => void }) {
  const capacidade = data.aberturas.filter((item) => item.status !== "cancelada").reduce((total, item) => total + item.capacidade, 0);
  const meta = data.aberturas.filter((item) => item.status !== "cancelada").reduce((total, item) => total + item.metaMatriculas, 0);
  const orcamento = data.aberturas.filter((item) => item.status !== "cancelada").reduce((total, item) => total + item.orcamentoCentavos, 0);
  const tarefas = data.aberturas.flatMap((item) => item.registros.filter((registro) => registro.tipo === "tarefa" && objeto(registro.dados).status !== "concluida").map((registro) => ({ abertura: item, registro })));
  const agenda = agendaProxima(data);
  return <div className="space-y-5">
    <SuasAberturas data={data} onIr={onIr} nova={nova} />
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <IndicadorResumo icone={<CalendarDays size={17} onClick={() => onIr(undefined, "planejamento")} />} titulo="Aberturas" valor={String(data.aberturas.filter((item) => item.status !== "cancelada").length)} detalhe={`${data.aberturas.filter((item) => item.status === "planejada" || item.status === "rascunho").length} em planejamento`} />
      <IndicadorResumo icone={<UsersRound size={17} onClick={() => onIr(undefined, "planejamento")} />} titulo="Capacidade somada" valor={String(capacidade)} detalhe={`Meta de ${meta} matrículas`} />
      <IndicadorResumo icone={<GraduationCap size={17} />} titulo="Interessados" valor={String(data.crm.leads.length)} detalhe="Contatos importados da filial; não são matrículas previstas" onClick={() => onIr(undefined, "interessados")} />
      <IndicadorResumo icone={<ClipboardCheck size={17} onClick={() => onIr(undefined, "investimentos")} />} titulo="Orçamento planejado" valor={formatarCentavos(orcamento)} detalhe="Soma das aberturas não canceladas" />
    </section>

    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]"><GraficoCustoConversao data={data} />
      <section className={CARD}><CollapsibleSection title={<h2 className="font-black text-gray-950 dark:text-white">Agenda próxima</h2>}><div className="mb-4 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><CalendarDays size={18} /></span><div><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Datas de aberturas e eventos publicados disponíveis para a filial.</p></div></div>
        {agenda.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Ainda não há datas futuras na agenda carregada.</p> : <div className="space-y-2">{agenda.map((item) => <button key={`${item.kind}-${item.id}`} type="button" onClick={() => onIr(item.aberturaId)} className="flex w-full items-center gap-3 rounded-xl border border-gray-100 p-3 text-left transition hover:border-na-green/40 hover:bg-na-green-light/20 dark:border-gray-800 dark:hover:bg-emerald-950/20"><span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-gray-50 text-[9px] font-bold uppercase text-gray-500 dark:bg-gray-950 dark:text-gray-400"><span>{formatarData(item.date, { month: "short" }).replace(".", "")}</span><span className="text-base text-gray-900 dark:text-gray-100">{new Date(`${item.date}T12:00:00Z`).getUTCDate()}</span></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</span><span className="mt-0.5 block truncate text-[11px] text-gray-500 dark:text-gray-400">{item.label}</span></span><ArrowRight size={14} className="shrink-0 text-gray-400" /></button>)}</div>}
      </CollapsibleSection></section>
    </div>

    <div className="grid gap-5 xl:grid-cols-2"><section className={CARD}><CollapsibleSection title={<h2 className="font-black text-gray-950 dark:text-white">Próximas tarefas</h2>}><div className="mb-3 flex items-center justify-between gap-3"><div><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Tarefas abertas registradas nos ciclos.</p></div><button type="button" onClick={() => onIr()} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-na-green-dark dark:text-emerald-400">Ver planejamento <ArrowRight size={13} /></button></div>{tarefas.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Não há tarefas pendentes registradas.</p> : <div className="divide-y divide-gray-100 dark:divide-gray-800">{tarefas.slice(0, 6).map(({ abertura: item, registro }) => { const dados = objeto(registro.dados); return <button key={registro.id} type="button" onClick={() => onIr(item.id)} className="flex w-full items-start gap-2 py-3 text-left"><Clock3 size={14} className="mt-0.5 shrink-0 text-amber-600" /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{texto(dados.titulo, "Tarefa sem título")}</span><span className="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">{item.titulo} · Prazo {dados.prazo ? formatarData(dados.prazo) : "não informado"}</span></span></button>; })}</div>}</CollapsibleSection></section>
      <section className={CARD}><CollapsibleSection title={<h2 className="font-black text-gray-950 dark:text-white">Leitura dos dados</h2>}><div className="mb-3 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><CheckCircle2 size={18} /></span><div><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Conversão usa interessados vinculados à abertura e matrículas confirmadas no Mercúrio. Adequação e próxima ação vêm da integração.</p></div></div><p className="rounded-xl bg-gray-50 px-3 py-3 text-sm leading-6 text-gray-700 dark:bg-gray-950 dark:text-gray-300">Custos estimados ou realizados aparecem separados. Uma abertura sem denominador de interessados ou sem vínculo acadêmico confirmado fica sem taxa de conversão; não há probabilidade estimada.</p><button type="button" onClick={() => onIr(aberturaMaisRecente(data)?.id, "interessados")} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:border-na-green dark:border-gray-700 dark:text-gray-200">Abrir interessados <ArrowRight size={13} /></button></CollapsibleSection></section>
    </div>
  </div>;
}

function IndicadorResumo({ icone, titulo, valor, detalhe, onClick }: { icone: React.ReactNode; titulo: string; valor: string; detalhe: string; onClick?: () => void }) {
  const conteudo = <><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{titulo}</span><span className="text-na-green-dark dark:text-emerald-400">{icone}</span></div><p className="mt-2 text-2xl font-black text-gray-950 dark:text-white">{valor}</p><p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{detalhe}</p></>;
  return onClick
    ? <button type="button" onClick={onClick} className={`${CARD} w-full text-left transition hover:border-na-green/50 hover:bg-na-green-light/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-na-green dark:hover:bg-emerald-950/20`}>{conteudo}</button>
    : <article className={CARD}>{conteudo}</article>;
}

function agendaProxima(data: PainelAberturas) {
  const agenda: { id: string; title: string; date: string; label: string; kind: string; aberturaId?: string }[] = [];
  for (const abertura of data.aberturas) {
    if (abertura.status === "cancelada") continue;
    const date = dataCalendario({ primeiraAula: abertura.primeiraAula });
    if (date) agenda.push({ id: abertura.id, title: abertura.titulo, date, label: `${abertura.status.replaceAll("_", " ")} · ${DIAS[abertura.diaSemana] ?? "Dia a confirmar"} às ${hora(abertura.inicioMinuto)}`, kind: "abertura", aberturaId: abertura.id });
  }
  for (const evento of data.eventos) {
    const date = dataCalendario(evento);
    if (date) agenda.push({ id: evento.id, title: tituloCalendario(evento), date, label: "Evento publicado", kind: "evento" });
  }
  return agenda.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
}

function aberturaMaisRecente(data: PainelAberturas) {
  return data.aberturas.find((item) => item.status !== "cancelada") ?? data.aberturas[0];
}

function PlanejamentoTab({ data, abertura, selecionar, nova, editar }: { data: PainelAberturas; abertura: Abertura | null; selecionar: (id: string) => void; nova: () => void; editar: (abertura: Abertura) => void }) {
  return <div className="space-y-5">
    <section className={CARD}><CollapsibleSection title={<h2 className="font-black text-gray-950 dark:text-white">Planejamento das turmas</h2>}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">Defina primeira aula, horário semanal, equipe docente, capacidade e orçamento. O vínculo com o Mercúrio deve ser exato.</p></div><button type="button" onClick={nova} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-2 text-sm font-bold text-white hover:bg-na-green-dark"><CalendarPlus size={15} />Nova abertura</button></div>
      {data.aberturas.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Nenhuma abertura cadastrada. Crie a primeira para iniciar o ciclo de planejamento.</p> : <div className="mt-4 grid gap-3 lg:grid-cols-2">{data.aberturas.map((item) => <article key={item.id} className={`rounded-xl border p-4 ${item.id === abertura?.id ? "border-na-green/50 bg-na-green-light/25 dark:border-emerald-800 dark:bg-emerald-950/20" : "border-gray-200 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-950/30"}`}><div className="flex items-start justify-between gap-3"><button type="button" onClick={() => selecionar(item.id)} className="min-w-0 text-left"><span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-black text-gray-950 dark:text-white">{item.titulo}</span><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-900 dark:text-gray-300">{rotuloStatus(item.status)}</span></span><span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{formatarData(item.primeiraAula)} · {DIAS[item.diaSemana] ?? "Dia a confirmar"} · {hora(item.inicioMinuto)} · {item.sala || "Sala não informada"}</span></button><button type="button" onClick={() => editar(item)} className="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:border-na-green dark:border-gray-700 dark:text-gray-200">Editar</button></div><div className="mt-3 grid grid-cols-3 gap-2 text-[11px]"><MiniResumo label="Capacidade" value={String(item.capacidade)} /><MiniResumo label="Meta" value={String(item.metaMatriculas)} /><MiniResumo label="Registros" value={String(item.registros.length)} /></div></article>)}</div>}
    </CollapsibleSection></section>
    {abertura && <DetalheAbertura abertura={abertura} data={data} editar={() => editar(abertura)} />}
  </div>;
}

function DetalheAbertura({ abertura, data, editar }: { abertura: Abertura; data: PainelAberturas; editar: () => void }) {
  const despesas = despesasDaAbertura(abertura);
  const gastos = despesas.filter((item) => !item.previsto).reduce((total, item) => total + item.valor, 0);
  return <section className={CARD}><CollapsibleSection title={<h2 className="mt-1 text-xl font-black text-gray-950 dark:text-white">{abertura.titulo}</h2>}><div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between dark:border-gray-800"><div><p className="text-xs font-bold tracking-wide text-na-green-dark uppercase dark:text-emerald-400">Abertura selecionada</p><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{formatarData(abertura.primeiraAula)} · {hora(abertura.inicioMinuto)} · {abertura.sala || "Sala não informada"} · {rotuloStatus(abertura.status)}</p></div><button type="button" onClick={editar} className="min-h-9 rounded-lg border border-gray-300 px-3 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">Editar parâmetros</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MiniResumo label="Professores envolvidos" value={abertura.professorIds.map((id) => data.professores.find((item) => item.id === id)?.name ?? "Pessoa da equipe").join(", ") || "Sem equipe definida"} /><MiniResumo label="Mercúrio · código da turma" value={abertura.mercurioTurmaId || "Sem vínculo confirmado"} /><MiniResumo label="Orçamento" value={formatarCentavos(abertura.orcamentoCentavos)} /><MiniResumo label="Despesas lançadas" value={`${formatarReais(gastos)} · ${despesas.length} registro(s)`} /></div><div className="mt-3"><LinkMatricula abertura={abertura} /></div><div className="mt-3"><FormVinculoTurma data={data} abertura={abertura} /></div><div className="mt-5"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-bold text-gray-900 dark:text-gray-100">Linha do ciclo</h3><span className="text-xs text-gray-500 dark:text-gray-400">{abertura.registros.length} registros</span></div>{abertura.registros.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Ainda não há registros neste ciclo.</p> : <div className="space-y-2">{[...abertura.registros].reverse().map((registro) => <RegistroLinha key={registro.id} registro={registro} />)}</div>}</div></CollapsibleSection></section>;
}

function FormVinculoTurma({ data, abertura }: { data: PainelAberturas; abertura: Abertura }) {
  const action = useFormAction(vincularTurmaAbertura);
  const codigosTurma = [...new Set(data.crm.matriculas.map((matricula) => texto(primeiraChave(matricula, ["turmaId", "mercurioTurmaId"]), "")).filter(Boolean))];
  const listaId = `codigos-turma-${abertura.id}`;

  return <details className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-950/30">
    <summary className="cursor-pointer text-xs font-bold text-na-green-dark dark:text-emerald-400">{abertura.mercurioTurmaId ? "Alterar associação da turma do Mercúrio" : "Associar turma do Mercúrio"}</summary>
    <form onSubmit={action.submit} className="mt-3 space-y-3 border-t border-gray-200 pt-3 dark:border-gray-800">
      {hiddenAberturaFields(data.schoolId, abertura.id, abertura.revisao)}
      <Campo label="Código exato da turma" hint="A turma precisa estar cadastrada no Mercúrio antes desta associação. Este vínculo não cria turma nem matrícula.">
        <input required name="mercurioTurmaId" list={listaId} maxLength={100} defaultValue={abertura.mercurioTurmaId ?? ""} placeholder="Informe o código exato" className={CAMPO_CLASS} />
        <datalist id={listaId}>{codigosTurma.map((codigo) => <option key={codigo} value={codigo} />)}</datalist>
      </Campo>
      <Feedback error={action.error} success={action.success} aviso={action.aviso} />
      <div className="flex justify-end"><SubmitButton pending={action.pending}>Salvar associação</SubmitButton></div>
    </form>
  </details>;
}

function CicloCultural({ data, abertura }: { data: PainelAberturas; abertura: Abertura | null }) {
  return <div className="space-y-5">
    <section className={CARD}><CollapsibleSection title={<h2 className="font-black text-gray-950 dark:text-white">Ciclo cultural e acompanhamento</h2>}><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><BookOpenCheck size={18} /></span><div><p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">Organize tarefas, palestras e contatos como fatos datados do percurso de abertura.</p></div></div>{!abertura && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Selecione ou crie uma abertura em Planejamento para registrar atividades.</p>}</CollapsibleSection></section>
    {abertura && <><section className={CARD}><CollapsibleSection title={<h3 className="font-black text-gray-950 dark:text-white">Registrar atividade</h3>}><div className="mb-3 flex items-center justify-between gap-2"><div><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Modelos de tarefa sugerem prazos relativos à primeira aula; ajuste-os ao contexto local.</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{abertura.titulo}</span></div><FormRegistro schoolId={data.schoolId} abertura={abertura} leads={data.crm.leads} matriculas={data.crm.matriculas} eventos={data.eventos} pessoas={data.pessoas} tiposPermitidos={["tarefa", "palestra", "sinal", "avaliacao"]} /></CollapsibleSection></section><section className={CARD}><CollapsibleSection title={<h3 className="font-black text-gray-950 dark:text-white">Atividades registradas</h3>}><div className="mb-3 flex items-center gap-2"><CalendarDays size={17} className="text-gray-500" /></div>{abertura.registros.filter((item) => ["tarefa", "palestra", "sinal", "avaliacao"].includes(item.tipo)).length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Nenhuma tarefa, palestra ou sinal registrado ainda.</p> : <div className="space-y-2">{[...abertura.registros].filter((item) => ["tarefa", "palestra", "sinal", "avaliacao"].includes(item.tipo)).reverse().map((registro) => <RegistroLinha key={registro.id} registro={registro} />)}</div>}</CollapsibleSection></section></>}
  </div>;
}

function RegistroLinha({ registro }: { registro: RegistroAbertura }) {
  const dados = objeto(registro.dados);
  const tipo: Record<string, string> = { tarefa: "Tarefa", palestra: "Palestra", sinal: "Sinal registrado", avaliacao: "Avaliação atual", despesa: "Investimento", resultado: "Resultado acadêmico", aprendizado: "Aprendizado", alteracao: "Parâmetros atualizados" };
  const titulo = texto(primeiraChave(dados, ["titulo", "descricao"]), tipo[registro.tipo] ?? "Registro");
  const detalhes: string[] = [];
  if (registro.tipo === "tarefa") detalhes.push(texto(dados.status, "Pendente"), dados.prazo ? `Prazo ${formatarData(dados.prazo)}` : "Prazo não informado");
  if (registro.tipo === "palestra") detalhes.push(texto(dados.tema, "Tema não informado"), dados.inicio ? formatarData(dados.inicio, { dateStyle: "medium", timeStyle: "short" }) : "Data não informada");
  if (registro.tipo === "despesa") detalhes.push(formatarReais(numero(dados.valor)), dados.previsto === true ? "Prevista" : "Realizada");
  if (registro.tipo === "sinal") detalhes.push(rotuloSinal(texto(dados.tipo, "")), valorFactual(dados.valor), texto(dados.natureza, ""));
  if (registro.tipo === "resultado") detalhes.push(texto(dados.status, "Resultado"), texto(dados.fonte, "Fonte confirmada"));
  if (registro.tipo === "aprendizado") detalhes.push(dados.compartilhar === true ? "Compartilhado por opt-in" : "Local");
  if (registro.tipo === "avaliacao") detalhes.push(texto(objeto(dados.interesse).estado, "Interesse sem registro"), texto(objeto(dados.adequacaoTurma).estado, "Adequação sem registro"), texto(objeto(dados.proximaAcao).motivo, "Próxima ação não informada"));
  const createdAt = registro.createdAt;
  return <article className="flex flex-col gap-1.5 rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between dark:border-gray-800 dark:bg-gray-950/30"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-900 dark:text-gray-300">{tipo[registro.tipo] ?? registro.tipo}</span><p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{titulo}</p></div>{detalhes.length > 0 && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{detalhes.filter(Boolean).join(" · ")}</p>}</div><span className="shrink-0 text-[10px] text-gray-500 dark:text-gray-500">{formatarData(createdAt, { dateStyle: "medium", timeStyle: "short" })}</span></article>;
}

function rotuloSinal(value: string) {
  const labels: Record<string, string> = { interesse_declarado: "Interesse declarado", disponibilidade_confirmada: "Disponibilidade", presenca_palestra: "Presença em palestra", outra_atividade: "Outra atividade", resposta_atendimento: "Resposta ao atendimento", pedido_matricula: "Pedido de matrícula", nao_contatar: "Pedido de não contato", acao_realizada: "Ação realizada", resultado_atendimento: "Resultado de atendimento" };
  return labels[value] ?? value;
}

function valorFactual(value: unknown) {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return texto(value, "Sem valor informado").replaceAll("_", " ");
}

function MiniResumo({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-950/60"><p className="text-[10px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">{label}</p><p className="mt-1 break-words text-sm font-bold text-gray-900 dark:text-gray-100">{value}</p></div>;
}

function rotuloStatus(status: string) {
  return ({ rascunho: "Rascunho", planejada: "Planejada", em_curso: "Em curso", concluida: "Concluída", cancelada: "Cancelada" } as Record<string, string>)[status] ?? status.replaceAll("_", " ");
}

const SITUACAO: Record<string, [string, string]> = {
  rascunho: ["Rascunho", "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"],
  planejada: ["Planejada", "bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300"],
  em_curso: ["Em curso", "bg-na-success-light text-na-success-dark dark:bg-emerald-950/50 dark:text-emerald-300"],
  concluida: ["Concluída", "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"],
  cancelada: ["Cancelada", "bg-na-danger-light text-na-danger-dark dark:bg-red-950/50 dark:text-red-300"],
};
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Aberturas sempre à vista no topo do Resumo (pedido do usuário 2026-10-25: "criei um rascunho; para onde foi?").
 * Cada cartão mostra inscritos/vagas (interessados vinculados à abertura ÷ capacidade) e leva ao planejamento.
 */
function SuasAberturas({ data, onIr, nova }: { data: PainelAberturas; onIr: (id?: string, destino?: Aba) => void; nova: () => void }) {
  const relatorio = new Map((data.relatorios?.aberturas ?? []).map((r) => [r.aberturaId, r]));
  const ordem = (a: Abertura) => (a.status === "cancelada" || a.status === "concluida" ? 1 : 0);
  const lista = [...data.aberturas].sort((a, b) => ordem(a) - ordem(b) || String(a.primeiraAula).localeCompare(String(b.primeiraAula)));
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-bold tracking-wide text-gray-600 uppercase dark:text-gray-300">Suas aberturas</h2>
        <button type="button" onClick={nova} className="text-[12px] font-semibold text-na-green-dark hover:underline dark:text-emerald-400">+ Planejar abertura</button>
      </div>
      {lista.length === 0 ? (
        <button type="button" onClick={nova} className="w-full rounded-2xl border border-dashed border-na-green/50 p-5 text-left text-sm text-gray-600 hover:bg-na-green-light/30 dark:text-gray-300 dark:hover:bg-emerald-950/20">
          Nenhuma abertura ainda. <span className="font-semibold text-na-green-dark dark:text-emerald-400">Planejar a primeira</span>
        </button>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((a) => {
            const r = relatorio.get(a.id);
            const inscritos = r?.leads.denominadorObservado ?? 0;
            const matriculas = r?.matriculas.confirmadasUnicasMercurio ?? 0;
            const d = new Date(String(a.primeiraAula));
            const dia = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit" });
            const mes = MESES_CURTOS[Number(d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(5, 7)) - 1] ?? "";
            const [rotulo, cor] = SITUACAO[a.status] ?? [a.status, SITUACAO.rascunho[1]];
            const apagada = a.status === "cancelada" || a.status === "concluida";
            return (
              <article key={a.id} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
                <button type="button" onClick={() => onIr(a.id, "planejamento")} className="flex gap-3 text-left">
                  <span className={`flex w-14 shrink-0 flex-col items-center justify-center self-start rounded-xl py-2 leading-tight ${apagada ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" : "bg-na-green text-white"}`}>
                    <span className="text-[10px] font-semibold uppercase opacity-90">{DIAS[a.diaSemana]?.slice(0, 3) ?? ""}</span>
                    <span className="text-xl font-black">{dia}</span>
                    <span className="text-[10px] font-semibold uppercase opacity-90">{mes}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${cor}`}>{rotulo}</span>
                    <span className="text-[14px] leading-snug font-bold text-gray-900 dark:text-gray-100">{a.titulo}</span>
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">
                      {hora(a.inicioMinuto)} · {a.sala || "sala a definir"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-2xl font-black text-gray-900 tabular-nums dark:text-gray-100">
                      {inscritos}/{a.capacidade}
                    </span>
                    <span className="block text-[10px] text-gray-500 dark:text-gray-400">inscritos/vagas</span>
                    {matriculas > 0 && <span className="block text-[10px] font-semibold text-na-success-dark dark:text-emerald-300">{matriculas} matrícula{matriculas === 1 ? "" : "s"}</span>}
                  </span>
                </button>
                <div className="flex flex-wrap gap-1.5 border-t border-gray-100 pt-2.5 text-[12px] font-semibold dark:border-gray-800">
                  <button type="button" onClick={() => onIr(a.id, "planejamento")} className="rounded-lg bg-na-green px-2.5 py-1 text-white hover:bg-na-green-dark">Planejamento</button>
                  <button type="button" onClick={() => onIr(a.id, "investimentos")} className="rounded-lg border border-gray-300 px-2.5 py-1 text-gray-700 dark:border-gray-700 dark:text-gray-200">Lançar despesa</button>
                  <button type="button" onClick={() => onIr(a.id, "interessados")} className="rounded-lg px-2.5 py-1 text-na-green-dark dark:text-emerald-400">Interessados</button>
                </div>
                <LinkMatricula abertura={a} />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Link público de matrícula da abertura e as matrículas feitas por ele (pedido do usuário 2026-10-25). */
function LinkMatricula({ abertura }: { abertura: Abertura }) {
  const [copiado, setCopiado] = useState(false);
  const site = abertura.matriculasSite ?? [];
  const pagas = site.filter((m) => m.status === "paga" || m.status === "lancada").length;
  if (!abertura.matriculaToken) return null;
  const url = typeof window === "undefined" ? `/matricula/${abertura.matriculaToken}` : `${window.location.origin}/matricula/${abertura.matriculaToken}`;
  const aberto = abertura.matriculaAberta !== false;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[12px] ${aberto ? "border-na-green/40 bg-na-green-light/40 dark:border-emerald-800 dark:bg-emerald-950/20" : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/40"}`}>
      <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
        <Link2 size={14} className={aberto ? "text-na-green-dark dark:text-emerald-400" : "text-gray-400"} />
        <span>
          <b>Link de matrícula</b> {aberto ? "aberto" : "fechado (ligue em Editar parâmetros)"}
          {site.length > 0 && ` · ${site.length} pelo site, ${pagas} paga${pagas === 1 ? "" : "s"}`}
        </span>
      </span>
      {aberto && (
        <span className="flex items-center gap-1.5 font-semibold">
          <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg px-2 py-1 text-na-green-dark hover:underline dark:text-emerald-400">
            Abrir
          </a>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopiado(true);
              } catch {
                /* sem área de transferência */
              }
            }}
            className="rounded-lg bg-na-green px-2.5 py-1 text-white hover:bg-na-green-dark"
          >
            {copiado ? "Link copiado" : "Copiar link"}
          </button>
        </span>
      )}
    </div>
  );
}

