"use client";

import { registrarAbertura } from "@/lib/actions/aberturas-actions";
import { ClipboardList, GraduationCap, Megaphone, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { CAMPO_CLASS, Campo, Feedback, SubmitButton, hiddenAberturaFields, useFormAction } from "./form-action";
import type { Abertura, CalendarioItem, JsonRecord, LeadCRM, Pessoa } from "./types";
import { formatarData, idLead, isoDate, nomeLead, primeiraChave, texto } from "./utils";

export type TipoRegistro = "palestra" | "tarefa" | "despesa" | "sinal" | "avaliacao" | "resultado" | "aprendizado";
type Draft = Record<string, string>;

const INTERESSES = [
  ["a_confirmar", "Ainda a confirmar"],
  ["conhecer", "Conhecer"],
  ["participar", "Participar"],
  ["inscrever", "Inscrever-se"],
  ["depois", "Prefere depois"],
  ["nao", "Não tem interesse"],
] as const;

const SINAIS_BOOLEANOS: Record<string, string> = {
  disponibilidade_confirmada: "Disponibilidade confirmada",
  presenca_palestra: "Presença em palestra",
  outra_atividade: "Participou de outra atividade",
  pedido_matricula: "Pedido de matrícula",
  nao_contatar: "Pedido de não contato",
};

const TIPOS: { id: TipoRegistro; nome: string; icone: typeof ClipboardList }[] = [
  { id: "tarefa", nome: "Tarefa", icone: ClipboardList },
  { id: "palestra", nome: "Palestra", icone: Megaphone },
  { id: "sinal", nome: "Sinal de interesse", icone: Sparkles },
  { id: "avaliacao", nome: "Avaliação", icone: GraduationCap },
  { id: "despesa", nome: "Despesa", icone: Plus },
  { id: "resultado", nome: "Resultado no Mercúrio", icone: GraduationCap },
  { id: "aprendizado", nome: "Aprendizado", icone: Sparkles },
];

const TAREFAS_MODELO = [
  { titulo: "Confirmar sala e recursos necessários", diasAntes: 7 },
  { titulo: "Convidar palestrante e alinhar o tema", diasAntes: 21 },
  { titulo: "Preparar divulgação e fluxo de inscrição", diasAntes: 14 },
  { titulo: "Confirmar presença dos interessados", diasAntes: 2 },
];

function dataSugestao(primeiraAula: string, diasAntes: number) {
  const date = new Date(`${isoDate(primeiraAula)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() - diasAntes);
  return date.toISOString().slice(0, 10);
}

export function FormRegistro({ schoolId, abertura, leads, matriculas, eventos, pessoas, tipoInicial = "tarefa", tiposPermitidos, compartilhamentoPermitido = false, leadInicialId, leadFixo = false }: { schoolId: string; abertura: Abertura; leads: LeadCRM[]; matriculas: JsonRecord[]; eventos: CalendarioItem[]; pessoas: Pessoa[]; tipoInicial?: TipoRegistro; tiposPermitidos?: TipoRegistro[]; compartilhamentoPermitido?: boolean; leadInicialId?: string; leadFixo?: boolean }) {
  const action = useFormAction(registrarAbertura);
  const [tipo, setTipo] = useState<TipoRegistro>(tipoInicial);
  const matriculasDaTurma = matriculas.filter((matricula) => abertura.mercurioTurmaId && String(matricula.turmaId ?? "") === abertura.mercurioTurmaId);
  const primeiraMatricula = matriculasDaTurma[0] ?? {};
  const [draft, setDraft] = useState<Draft>({ status: "pendente", previsto: "false", natureza: "declarado", tipoSinal: "interesse_declarado", valorAtendimento: "adiou", statusResultado: "matriculado", presente: "desconhecido", mercurioId: texto(primeiraChave(primeiraMatricula, ["mercurioId", "merId"]), ""), dataResultado: isoDate(primeiraChave(primeiraMatricula, ["data", "dataMatricula"])), leadId: leadInicialId ?? texto(primeiraMatricula.leadId, "") });
  const [templateAberto, setTemplateAberto] = useState(false);

  const leadsComId = useMemo(() => leads.filter((lead) => idLead(lead)), [leads]);

  function atualizar(campo: string, valor: string) {
    setDraft((current) => ({ ...current, [campo]: valor }));
  }

  function escolherModelo(titulo: string, diasAntes: number) {
    setTipo("tarefa");
    setDraft((current) => ({ ...current, titulo, prazo: dataSugestao(abertura.primeiraAula, diasAntes), status: "pendente" }));
    setTemplateAberto(false);
  }

  function valorSinal(): unknown {
    if (draft.tipoSinal === "resultado_atendimento") return draft.valorAtendimento ?? "adiou";
    if (draft.tipoSinal === "interesse_declarado") return draft.valorInteresse ?? "a_confirmar";
    if (draft.tipoSinal in SINAIS_BOOLEANOS) return (draft.valorBooleano ?? "true") === "true";
    return draft.valorTexto ?? "";
  }

  function dadosAtuais(): Record<string, unknown> {
    if (tipo === "sinal") {
      return {
        leadId: draft.leadId ?? "",
        tipo: draft.tipoSinal ?? "interesse_declarado",
        valor: valorSinal(),
        occurredAt: draft.occurredAt ?? "",
        origem: draft.origem ?? "",
        natureza: draft.tipoSinal === "nao_contatar" ? "declarado" : draft.natureza ?? "declarado",
      };
    }
    if (tipo === "avaliacao") return { leadId: draft.leadId ?? "" };
    if (tipo === "resultado") return { mercurioId: draft.mercurioId ?? "", data: draft.dataResultado ?? "", status: draft.statusResultado ?? "matriculado", leadId: draft.leadId ?? "", ...(draft.statusResultado !== "matriculado" && draft.presente !== "desconhecido" ? { presente: draft.presente === "true" } : {}) };
    if (tipo === "despesa") return { categoria: draft.categoria ?? "", valor: draft.valorDespesa ?? "", data: draft.dataDespesa ?? "", descricao: draft.descricao ?? "", previsto: draft.previsto === "true" };
    if (tipo === "tarefa") return { titulo: draft.titulo ?? "", responsavelId: draft.responsavelId ?? "", prazo: draft.prazo ?? "", status: draft.status ?? "pendente" };
    if (tipo === "aprendizado") return { titulo: draft.titulo ?? "", descricao: draft.descricao ?? "", compartilhar: draft.compartilhar === "true" };
    return { titulo: draft.titulo ?? "", inicio: draft.inicio ?? "", fim: draft.fim ?? "", tema: draft.tema ?? "", palestrante: draft.palestrante ?? "", eventoId: draft.eventoId ?? "" };
  }

  const dados = dadosAtuais();
  const dataDefault = isoDate(abertura.primeiraAula);
  const dataPalestra = dataSugestao(abertura.primeiraAula, 7) || dataDefault;
  const eventosValidos = eventos.filter((evento) => evento.id && (evento.title || evento.titulo));
  return (
    <form onSubmit={action.submit} className="space-y-4">
      {hiddenAberturaFields(schoolId, abertura.id, abertura.revisao)}
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="dados" value={JSON.stringify(dados)} />
      {tipo === "avaliacao" && <input type="hidden" name="leadId" value={draft.leadId ?? ""} />}
      {(!tiposPermitidos || tiposPermitidos.length > 1) && <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de registro">
        {TIPOS.filter(({ id }) => !tiposPermitidos || tiposPermitidos.includes(id)).map(({ id, nome, icone: Icon }) => (
          <button key={id} type="button" onClick={() => { setTipo(id); action.setError(""); }} aria-pressed={tipo === id} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${tipo === id ? "border-na-green bg-na-green-light text-na-green-dark dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "border-gray-200 text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-300"}`}>
            <Icon size={13} />{nome}
          </button>
        ))}
      </div>}

      {tipo === "tarefa" && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="O que precisa ser feito" className="sm:col-span-2"><input required name="titulo" value={draft.titulo ?? ""} onChange={(e) => atualizar("titulo", e.target.value)} maxLength={160} placeholder="Ex.: Confirmar sala e recursos" className={CAMPO_CLASS} /></Campo>
            <Campo label="Responsável"><select name="responsavelId" value={draft.responsavelId ?? ""} onChange={(e) => atualizar("responsavelId", e.target.value)} className={CAMPO_CLASS}><option value="">A definir</option>{pessoas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Campo>
            <Campo label="Prazo"><input required type="date" name="prazo" value={draft.prazo ?? ""} onChange={(e) => atualizar("prazo", e.target.value)} className={CAMPO_CLASS} /></Campo>
            <Campo label="Situação"><select name="status" value={draft.status ?? "pendente"} onChange={(e) => atualizar("status", e.target.value)} className={CAMPO_CLASS}><option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option></select></Campo>
          </div>
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950/50">
            <button type="button" onClick={() => setTemplateAberto((open) => !open)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-na-green-dark dark:text-emerald-400"><Sparkles size={15} /> {templateAberto ? "Fechar modelos" : "Usar modelo de tarefa"}</button>
            {templateAberto && <div className="mt-3 grid gap-2 sm:grid-cols-2">{TAREFAS_MODELO.map((modelo) => <button key={modelo.titulo} type="button" onClick={() => escolherModelo(modelo.titulo, modelo.diasAntes)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs font-medium text-gray-700 hover:border-na-green/50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">{modelo.titulo}<span className="mt-1 block text-[10px] font-normal text-gray-500">Sugestão: {formatarData(dataSugestao(abertura.primeiraAula, modelo.diasAntes))}</span></button>)}</div>}
          </div>
        </div>
      )}

      {tipo === "palestra" && <div className="grid gap-3 sm:grid-cols-2"><Campo label="Título"><input required name="titulo" value={draft.titulo ?? ""} onChange={(e) => atualizar("titulo", e.target.value)} className={CAMPO_CLASS} /></Campo><Campo label="Tema"><input required name="tema" value={draft.tema ?? ""} onChange={(e) => atualizar("tema", e.target.value)} className={CAMPO_CLASS} /></Campo><Campo label="Palestrante"><input name="palestrante" value={draft.palestrante ?? ""} onChange={(e) => atualizar("palestrante", e.target.value)} className={CAMPO_CLASS} /></Campo><Campo label="Evento relacionado"><select name="eventoId" value={draft.eventoId ?? ""} onChange={(e) => atualizar("eventoId", e.target.value)} className={CAMPO_CLASS}><option value="">Nenhum</option>{eventosValidos.map((evento) => <option key={evento.id} value={evento.id}>{texto(evento.title ?? evento.titulo)}</option>)}</select></Campo><Campo label="Início"><input required type="datetime-local" name="inicio" value={draft.inicio ?? `${dataPalestra}T19:00`} onChange={(e) => atualizar("inicio", e.target.value)} className={CAMPO_CLASS} /></Campo><Campo label="Fim"><input required type="datetime-local" name="fim" value={draft.fim ?? `${dataPalestra}T21:00`} onChange={(e) => atualizar("fim", e.target.value)} className={CAMPO_CLASS} /></Campo></div>}

      {tipo === "despesa" && <div className="grid gap-3 sm:grid-cols-2"><Campo label="Categoria"><select required name="categoria" value={draft.categoria ?? ""} onChange={(e) => atualizar("categoria", e.target.value)} className={CAMPO_CLASS}><option value="">Selecione</option><option value="trafego">Tráfego e divulgação</option><option value="impressao">Impressão</option><option value="coffee_break">Coffee break</option><option value="estrutura">Estrutura</option><option value="outros">Outros</option></select></Campo><Campo label="Valor (R$)"><input required name="valorDespesa" type="number" min="0" step="0.01" inputMode="decimal" value={draft.valorDespesa ?? ""} onChange={(e) => atualizar("valorDespesa", e.target.value)} className={CAMPO_CLASS} /></Campo><Campo label="Data"><input required type="date" name="dataDespesa" value={draft.dataDespesa ?? dataDefault} onChange={(e) => atualizar("dataDespesa", e.target.value)} className={CAMPO_CLASS} /></Campo><Campo label="Descrição"><input required name="descricao" value={draft.descricao ?? ""} onChange={(e) => atualizar("descricao", e.target.value)} className={CAMPO_CLASS} /></Campo><label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2 dark:text-gray-300"><input type="checkbox" checked={draft.previsto === "true"} onChange={(e) => atualizar("previsto", e.target.checked ? "true" : "false")} className="accent-na-green" />Marcar como valor previsto, ainda não realizado</label></div>}

      {tipo === "sinal" && <div className="grid gap-3 sm:grid-cols-2"><Campo label="Interessado"><select required name="leadId" value={draft.leadId ?? ""} onChange={(e) => atualizar("leadId", e.target.value)} className={CAMPO_CLASS}><option value="">Selecione na base de interessados</option>{leadsComId.map((lead) => <option key={idLead(lead)} value={idLead(lead)}>{nomeLead(lead)}</option>)}</select></Campo><Campo label="Tipo de sinal"><select name="tipoSinal" value={draft.tipoSinal ?? "interesse_declarado"} onChange={(e) => { atualizar("tipoSinal", e.target.value); if (e.target.value === "resultado_atendimento") atualizar("valorAtendimento", "adiou"); if (e.target.value === "interesse_declarado") atualizar("valorInteresse", "a_confirmar"); if (e.target.value in SINAIS_BOOLEANOS) atualizar("valorBooleano", "true"); }} className={CAMPO_CLASS}>{[["interesse_declarado","Interesse declarado"],["disponibilidade_confirmada","Disponibilidade confirmada"],["presenca_palestra","Presença em palestra"],["outra_atividade","Outra atividade"],["resposta_atendimento","Resposta ao atendimento"],["pedido_matricula","Pedido de matrícula"],["nao_contatar","Não contatar"],["acao_realizada","Ação realizada"],["resultado_atendimento","Resultado do atendimento"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Campo><Campo label="Quando ocorreu"><input required type="datetime-local" name="occurredAt" value={draft.occurredAt ?? ""} onChange={(e) => atualizar("occurredAt", e.target.value)} className={CAMPO_CLASS} /></Campo><Campo label="Origem"><input required name="origem" value={draft.origem ?? ""} onChange={(e) => atualizar("origem", e.target.value)} placeholder="Ex.: telefone, recepção, palestra" className={CAMPO_CLASS} /></Campo><Campo label="Natureza"><select name="natureza" value={draft.tipoSinal === "nao_contatar" ? "declarado" : draft.natureza ?? "declarado"} onChange={(e) => atualizar("natureza", e.target.value)} disabled={draft.tipoSinal === "nao_contatar"} className={CAMPO_CLASS}><option value="declarado">Declarado</option><option value="observado">Observado</option><option value="interpretado">Interpretado</option></select></Campo>{draft.tipoSinal === "resultado_atendimento" ? <Campo label="Resultado do contato"><select value={draft.valorAtendimento ?? "adiou"} onChange={(e) => atualizar("valorAtendimento", e.target.value)} className={CAMPO_CLASS}><option value="adiou">A pessoa adiou</option><option value="sem_interesse">Sem interesse</option><option value="horario_incompativel">Horário incompatível</option><option value="contato_invalido">Contato inválido</option></select></Campo> : draft.tipoSinal === "interesse_declarado" ? <Campo label="Interesse declarado"><select value={draft.valorInteresse ?? "a_confirmar"} onChange={(e) => atualizar("valorInteresse", e.target.value)} className={CAMPO_CLASS}>{INTERESSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Campo> : draft.tipoSinal in SINAIS_BOOLEANOS ? <Campo label={SINAIS_BOOLEANOS[draft.tipoSinal]}><select value={draft.valorBooleano ?? "true"} onChange={(e) => atualizar("valorBooleano", e.target.value)} className={CAMPO_CLASS}><option value="true">Sim</option><option value="false">Não</option></select></Campo> : <Campo label="Resposta registrada"><input required maxLength={120} value={draft.valorTexto ?? ""} onChange={(e) => atualizar("valorTexto", e.target.value)} placeholder="Código curto da ação ou resposta, sem copiar a conversa" className={CAMPO_CLASS} /></Campo>}</div>}

      {tipo === "avaliacao" && <div className="space-y-3">{leadFixo ? <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 dark:bg-gray-950 dark:text-gray-300">Avaliação para {nomeLead(leadsComId.find((lead) => idLead(lead) === draft.leadId) ?? {})}</p> : <Campo label="Interessado avaliado"><select required name="leadId" value={draft.leadId ?? ""} onChange={(e) => atualizar("leadId", e.target.value)} className={CAMPO_CLASS}><option value="">Selecione na base de interessados</option>{leadsComId.map((lead) => <option key={idLead(lead)} value={idLead(lead)}>{nomeLead(lead)}</option>)}</select></Campo>}<p className="rounded-xl bg-gray-50 px-3 py-2.5 text-xs leading-5 text-gray-600 dark:bg-gray-950 dark:text-gray-400">O registro usa um recorte protegido da avaliação disponível para este interessado. Dados pessoais completos não são copiados para o histórico da abertura.</p></div>}

      {tipo === "resultado" && <div className="grid gap-3 sm:grid-cols-2"><Campo label="Matrícula confirmada no Mercúrio" hint={abertura.mercurioTurmaId ? `Somente registros da turma ${abertura.mercurioTurmaId} são aceitos.` : "Vincule primeiro o código exato da turma à abertura."}><select required name="mercurioId" value={draft.mercurioId ?? ""} onChange={(e) => { const selected = matriculasDaTurma.find((matricula) => texto(primeiraChave(matricula, ["mercurioId", "merId"]), "") === e.target.value); atualizar("mercurioId", e.target.value); if (draft.statusResultado === "matriculado") atualizar("dataResultado", isoDate(primeiraChave(selected ?? {}, ["data", "dataMatricula"]))); atualizar("leadId", texto(selected?.leadId, "")); }} className={CAMPO_CLASS}><option value="">Selecione na base acadêmica</option>{matriculasDaTurma.map((matricula, index) => { const id = texto(primeiraChave(matricula, ["mercurioId", "merId"]), ""); return id ? <option key={`${id}-${index}`} value={id}>{id}{primeiraChave(matricula, ["data", "dataMatricula"]) ? ` · ${formatarData(primeiraChave(matricula, ["data", "dataMatricula"]))}` : ""}</option> : null; })}</select></Campo><Campo label={draft.statusResultado === "matriculado" ? "Data acadêmica confirmada" : "Data da observação"}><input required type="date" name="dataResultado" value={draft.dataResultado ?? ""} readOnly={draft.statusResultado === "matriculado"} onChange={(e) => atualizar("dataResultado", e.target.value)} className={`${CAMPO_CLASS} ${draft.statusResultado === "matriculado" ? "bg-gray-50 dark:bg-gray-900" : ""}`} /></Campo><div className="flex items-center rounded-xl border border-gray-200 px-3 py-2.5 text-xs text-gray-600 sm:col-span-2 dark:border-gray-700 dark:text-gray-400">Interessado vinculado: {draft.leadId ? nomeLead(leadsComId.find((lead) => idLead(lead) === draft.leadId) ?? {}) : "sem vínculo confirmado"}</div><Campo label="Marco"><select name="statusResultado" value={draft.statusResultado ?? "matriculado"} onChange={(e) => { const status = e.target.value; atualizar("statusResultado", status); if (status === "matriculado") { const selected = matriculasDaTurma.find((matricula) => texto(primeiraChave(matricula, ["mercurioId", "merId"]), "") === draft.mercurioId); atualizar("dataResultado", isoDate(primeiraChave(selected ?? {}, ["data", "dataMatricula"]))); } else if (draft.statusResultado === "matriculado") atualizar("dataResultado", ""); }} className={CAMPO_CLASS}><option value="matriculado">Matrícula</option><option value="presenca30">Presença em 30 dias</option><option value="presenca60">Presença em 60 dias</option><option value="presenca90">Presença em 90 dias</option></select></Campo>{draft.statusResultado !== "matriculado" && <Campo label="Observação de presença"><select value={draft.presente ?? "desconhecido"} onChange={(e) => atualizar("presente", e.target.value)} className={CAMPO_CLASS}><option value="desconhecido">Ainda sem confirmação</option><option value="true">Presença observada</option><option value="false">Ausência observada</option></select></Campo>}{matriculasDaTurma.length === 0 && <p className="text-xs text-amber-700 sm:col-span-2 dark:text-amber-300">{abertura.mercurioTurmaId ? "Não há matrícula confirmada nesta turma no último retorno da integração." : "A abertura ainda não está vinculada a um código exato de turma do Mercúrio."} Atualize os interessados ou confirme o vínculo da turma antes de registrar um resultado.</p>}</div>}

      {tipo === "aprendizado" && <div className="grid gap-3 sm:grid-cols-2"><Campo label="Título do aprendizado"><input required name="titulo" value={draft.titulo ?? ""} onChange={(e) => atualizar("titulo", e.target.value)} maxLength={500} placeholder="Ex.: O melhor horário para esta escola" className={CAMPO_CLASS} /></Campo><Campo label="Descrição"><textarea required name="descricao" value={draft.descricao ?? ""} onChange={(e) => atualizar("descricao", e.target.value)} rows={4} maxLength={10000} placeholder="Registre o que aconteceu e o que vale ajustar na próxima abertura." className={CAMPO_CLASS} /></Campo><label className="flex items-start gap-2 rounded-xl border border-gray-200 p-3 text-sm text-gray-700 sm:col-span-2 dark:border-gray-700 dark:text-gray-300"><input type="checkbox" disabled={!compartilhamentoPermitido} checked={compartilhamentoPermitido && draft.compartilhar === "true"} onChange={(e) => atualizar("compartilhar", e.target.checked ? "true" : "false")} className="mt-0.5 accent-na-green disabled:opacity-50" /><span><span className="block font-semibold">Compartilhar com outras escolas</span><span className="block text-xs text-gray-500 dark:text-gray-400">{compartilhamentoPermitido ? "Envie apenas o aprendizado registrado, sem informações de interessados." : "O compartilhamento ainda não está habilitado para esta escola."}</span></span></label></div>}

      {tipo === "avaliacao" && leadsComId.length === 0 && <p className="text-xs text-amber-700 dark:text-amber-300">A base sincronizada não trouxe identificadores de interessados para avaliação.</p>}
      {tipo === "sinal" && leadsComId.length === 0 && <p className="text-xs text-amber-700 dark:text-amber-300">A base sincronizada não trouxe identificadores de interessados para registro de sinais.</p>}
      {tipo === "resultado" && matriculasDaTurma.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400">O registro fica disponível quando a integração confirmar uma matrícula vinculada à turma exata.</p>}
      <Feedback error={action.error} success={action.success} aviso={action.aviso} />
      <div className="flex justify-end"><SubmitButton pending={action.pending} disabled={tipo === "resultado" && matriculasDaTurma.length === 0}>Registrar</SubmitButton></div>
    </form>
  );
}
