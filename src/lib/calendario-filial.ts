import { eventScopeWhere } from "@/lib/event-policy";
import { db } from "@/lib/db";
import { ensureGroupMeetingWindow } from "@/lib/meeting-series";
import type { ResumoFilialDados } from "@/lib/mercurio-db/resumo-filial";
import type { Publico } from "@/lib/calendario-comum";

/**
 * Calendário inteligente do chefe (pedido do usuário 2026-10-19): junta
 * numa visão só as aulas fixas das turmas (Mercúrio), as reuniões dos
 * grupos de voluntários, os eventos da filial, os eventos nacionais e
 * regionais e os feriados — e, a partir disso, aponta conflitos de um
 * horário e sugere datas livres para o público escolhido.
 */

export type Camada = "aula" | "reuniao_grupo" | "evento_filial" | "evento_externo" | "feriado";

export interface ItemCalendario {
  id: string;
  camada: Camada;
  titulo: string;
  inicio: string; // ISO
  fim: string | null;
  diaInteiro: boolean;
  detalhe: string | null;
  publicos: Publico[];
  pessoas: number | null;
  adminHref?: string;
}

const TZ = "-03:00";
const DURACAO_AULA_MIN = 120; // o Mercúrio só tem o horário de início das turmas
const DIAS: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Público atingido por uma turma, pelo nível: turmas do 2º nível em diante são de membros (o que inclui FV, HD, dirigentes e provacionistas). */
function publicosDaTurma(nivel: string): Publico[] {
  return /^N[2-9]$/.test(nivel) ? ["todos", "membros", "fv", "provacionistas", "hd", "dirigentes"] : ["todos"];
}

/** Quem um evento interno do Portal alcança (publicos, vários — ver EVENT_AUDIENCES): "Todos" inclui todos; "Membros" inclui FV, HD, dirigentes e provacionistas. */
function publicosDoEvento(publicos: string[], audience: string): Publico[] {
  const mapa: Record<string, Publico[]> = {
    todos_ativos: ["todos", "membros", "fv", "provacionistas", "hd", "dirigentes"],
    membros: ["membros", "fv", "provacionistas", "hd", "dirigentes"],
    // FV alcança HD e dirigentes (públicos agregadores, 2026-10-25).
    fv: ["fv", "hd", "dirigentes"],
    provacionistas: ["provacionistas"],
    hd: ["hd"],
    dirigentes: ["dirigentes"],
    voluntarios: ["fv", "hd", "dirigentes"],
    direcao: ["dirigentes"],
  };
  const lista = [...new Set((publicos.length ? publicos : [audience]).flatMap((p) => mapa[p] ?? []))];
  return lista.length ? lista : ["todos"];
}

async function feriados(ano: number): Promise<{ data: string; nome: string }[]> {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`, { next: { revalidate: 60 * 60 * 24 } });
    if (!r.ok) return [];
    const lista = (await r.json()) as { date: string; name: string }[];
    return lista.map((f) => ({ data: f.date, nome: f.name }));
  } catch {
    return [];
  }
}

/** Todos os itens do calendário da filial entre `de` e `ate`. */
export async function itensDoCalendario(schoolId: string, de: Date, ate: Date): Promise<ItemCalendario[]> {
  // Sem grupos encerrados nem GDVE (o GDVE é visto só por FV).
  const grupos = await db.classGroup.findMany({ where: { schoolId, tipo: { notIn: ["turma", "GDVE"] }, arquivadoEm: null }, select: { id: true, name: true, _count: { select: { memberships: true } } } });
  // Mesma geração preguiçosa das rotinas semanais usada no resto do Portal.
  await ensureGroupMeetingWindow(grupos.map((g) => g.id)).catch(() => null);

  const escola = await db.school.findUniqueOrThrow({where:{id:schoolId},select:{id:true,uf:true}});
  const [resumo, reunioes, eventosFilial, eventosExternos, aberturas] = await Promise.all([
    db.resumoFilial.findUnique({ where: { schoolId } }),
    db.groupMeeting.findMany({ where: { classGroupId: { in: grupos.map((g) => g.id) }, startsAt: { gte: de, lte: ate }, status: { not: "cancelada" } } }),
    db.event.findMany({ where: { schoolId, startsAt: { gte: de, lte: ate }, status: { not: "cancelado" } } }),
    db.event.findMany({ where: { AND: [eventScopeWhere(escola), {schoolId:{not:schoolId}, startsAt: { gte: de, lte: ate }, status: "publicado"}] } }),
    db.aberturaTurma.findMany({where:{schoolId,status:{in:["planejada","em_curso"]}},include:{registros:{where:{tipo:"palestra"}}}}),
  ]);

  const itens: ItemCalendario[] = [];
  for(const abertura of aberturas){
    for(let dia=new Date(de);dia<=ate;dia=new Date(dia.getTime()+86400000)){
      const dataBR=dia.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
      if(new Date(dataBR+"T12:00:00Z").getUTCDay()!==abertura.diaSemana)continue;
      const inicio=new Date(dataBR+"T00:00:00-03:00");inicio.setTime(inicio.getTime()+abertura.inicioMinuto*60000);
      if(inicio<abertura.primeiraAula)continue;
      itens.push({id:`abertura-${abertura.id}-${dataBR}`,camada:"aula",titulo:`Turma planejada · ${abertura.titulo}`,inicio:inicio.toISOString(),fim:new Date(inicio.getTime()+7200000).toISOString(),diaInteiro:false,detalhe:`Planejamento · ${abertura.sala}`,publicos:["todos"],pessoas:null});
    }
    for(const registro of abertura.registros){const p=registro.dados as {inicio?:string;fim?:string;titulo?:string;eventoId?:string};if(p.eventoId||!p.inicio||new Date(p.inicio)<de||new Date(p.inicio)>ate)continue;itens.push({id:`ciclo-${registro.id}`,camada:"evento_filial",titulo:`Ciclo cultural · ${p.titulo||abertura.titulo}`,inicio:p.inicio,fim:p.fim||null,diaInteiro:false,detalhe:abertura.titulo,publicos:["todos"],pessoas:null});}
  }

  // Aulas fixas: cada turma, toda semana, no dia e horário do Mercúrio.
  const turmas = ((resumo?.dados as unknown as ResumoFilialDados | undefined)?.turmas.lista ?? []).filter((t) => semAcento(t.dia) in DIAS && /^\d{2}:\d{2}$/.test(t.horario));
  for (let dia = new Date(de); dia <= ate; dia = new Date(dia.getTime() + 86400000)) {
    const dataBR = dia.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const semana = new Date(`${dataBR}T12:00:00${TZ}`).getUTCDay();
    for (const t of turmas.filter((x) => DIAS[semAcento(x.dia)] === semana)) {
      const inicio = new Date(`${dataBR}T${t.horario}:00${TZ}`);
      itens.push({
        id: `aula-${t.turma}-${dataBR}`,
        camada: "aula",
        titulo: `Aula ${t.turma}`,
        inicio: inicio.toISOString(),
        fim: new Date(inicio.getTime() + DURACAO_AULA_MIN * 60000).toISOString(),
        diaInteiro: false,
        detalhe: `${t.nivel} · ${t.alunos} alunos`,
        publicos: publicosDaTurma(t.nivel),
        pessoas: t.alunos,
      });
    }
  }

  const nomeGrupo = new Map(grupos.map((g) => [g.id, g]));
  for (const r of reunioes) {
    const g = nomeGrupo.get(r.classGroupId);
    // Nome do grupo no título (pedido do usuário 2026-10-25: "GAF Online", não "Reunião semanal"); o nome da reunião vai no detalhe.
    itens.push({ id: `reuniao-${r.id}`, camada: "reuniao_grupo", titulo: g?.name ?? r.title, inicio: r.startsAt.toISOString(), fim: r.endsAt.toISOString(), diaInteiro: false, detalhe: g?.name ? r.title : null, publicos: ["fv"], pessoas: g?._count.memberships ?? null });
  }
  for (const e of eventosFilial) {
    itens.push({ id: `evento-${e.id}`, adminHref: `/voluntario/eventos?aba=eventos#evento-${e.id}`, camada: "evento_filial", titulo: e.title, inicio: e.startsAt.toISOString(), fim: e.endsAt?.toISOString() ?? null, diaInteiro: e.allDay, detalhe: e.location, publicos: publicosDoEvento(e.publicos, e.audience), pessoas: null });
  }
  for (const e of eventosExternos) {
    // O calendário nacional ainda não diz a quem o evento se destina nem se o chefe deve estar (virá do Ágora): tratado como "todos".
    itens.push({ id: `externo-${e.id}`, camada: "evento_externo", titulo: e.title, inicio: e.startsAt.toISOString(), fim: e.endsAt?.toISOString() ?? null, diaInteiro: e.allDay, detalhe: e.scope === "nacional" ? "Nacional" : "Regional", publicos: ["todos", "membros", "fv", "provacionistas", "hd", "dirigentes"], pessoas: null });
  }
  const anos = [...new Set([de.getUTCFullYear(), ate.getUTCFullYear()])];
  for (const ano of anos) {
    for (const f of await feriados(ano)) {
      const d = new Date(`${f.data}T00:00:00${TZ}`);
      if (d >= new Date(de.getTime() - 86400000) && d <= ate) itens.push({ id: `feriado-${f.data}`, camada: "feriado", titulo: f.nome, inicio: d.toISOString(), fim: null, diaInteiro: true, detalhe: "Feriado nacional", publicos: [], pessoas: null });
    }
  }
  return itens.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export interface Conflito {
  item: ItemCalendario;
  gravidade: "alta" | "media" | "info";
  motivo: string;
}

const dataBRDe = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Conflitos de um horário para o público escolhido. Eventos nacionais/regionais no mesmo dia sempre contam (o chefe pode precisar estar). */
export function conflitosDoHorario(itens: ItemCalendario[], inicio: Date, fim: Date, publicos: Publico[]): Conflito[] {
  const dia = dataBRDe(inicio.toISOString());
  const alvo = new Set(publicos.length ? publicos : ["todos"]);
  const conflitos: Conflito[] = [];
  for (const item of itens) {
    const ini = new Date(item.inicio).getTime();
    const fimItem = item.fim ? new Date(item.fim).getTime() : ini + 3 * 3600000;
    const mesmoDia = dataBRDe(item.inicio) === dia;
    const sobrepoe = item.diaInteiro ? mesmoDia : ini < fim.getTime() && fimItem > inicio.getTime();
    const atingePublico = item.publicos.some((p) => alvo.has(p));
    if (item.camada === "feriado" && mesmoDia) conflitos.push({ item, gravidade: "info", motivo: `Feriado: ${item.titulo}` });
    else if (item.camada === "evento_externo" && mesmoDia) conflitos.push({ item, gravidade: "alta", motivo: `${item.detalhe} no mesmo dia — o público e você podem estar nele` });
    else if (item.camada === "evento_filial" && (sobrepoe || (mesmoDia && atingePublico))) conflitos.push({ item, gravidade: sobrepoe ? "alta" : "media", motivo: sobrepoe ? "Outro evento da filial no mesmo horário" : "Outro evento da filial no mesmo dia, para o mesmo público" });
    else if (item.camada === "aula" && sobrepoe && atingePublico) conflitos.push({ item, gravidade: "alta", motivo: `${item.detalhe} em aula neste horário` });
    else if (item.camada === "reuniao_grupo" && sobrepoe && atingePublico) conflitos.push({ item, gravidade: "media", motivo: `Reunião de ${item.titulo} neste horário` });
  }
  return conflitos;
}

export interface Sugestao {
  inicio: string;
  fim: string;
  pontos: number;
  conflitos: Conflito[];
  motivo: string;
}

/** Procura as melhores janelas nas próximas semanas, nos dias e horários escolhidos. */
export function sugerirJanelas(
  itens: ItemCalendario[],
  opcoes: { publicos: Publico[]; duracaoMin: number; de: Date; semanas: number; dias: number[]; horarios: string[] },
): Sugestao[] {
  const candidatas: Sugestao[] = [];
  const inicioBusca = opcoes.de.getTime();
  for (let d = 0; d < opcoes.semanas * 7; d++) {
    const dataBR = new Date(inicioBusca + d * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const semana = new Date(`${dataBR}T12:00:00${TZ}`).getUTCDay();
    if (!opcoes.dias.includes(semana)) continue;
    for (const h of opcoes.horarios) {
      const inicio = new Date(`${dataBR}T${h}:00${TZ}`);
      if (inicio.getTime() < inicioBusca) continue;
      const fim = new Date(inicio.getTime() + opcoes.duracaoMin * 60000);
      const conflitos = conflitosDoHorario(itens, inicio, fim, opcoes.publicos);
      const pontos = conflitos.reduce((s, c) => s + (c.gravidade === "alta" ? 10 + Math.min(10, (c.item.pessoas ?? 0) / 5) : c.gravidade === "media" ? 3 : 0.5), 0);
      const motivo = conflitos.length
        ? conflitos.map((c) => c.motivo).join("; ")
        : "Nenhuma aula do público neste horário, nenhum outro evento da filial e nada nacional ou regional no dia.";
      candidatas.push({ inicio: inicio.toISOString(), fim: fim.toISOString(), pontos, conflitos, motivo });
    }
  }
  // Melhor horário de cada dia primeiro, pra espalhar as opções pelas semanas.
  const ordenadas = candidatas.sort((a, b) => a.pontos - b.pontos || a.inicio.localeCompare(b.inicio));
  const vistos = new Set<string>();
  const umaPorDia = ordenadas.filter((c) => {
    const dia = dataBRDe(c.inicio);
    if (vistos.has(dia)) return false;
    vistos.add(dia);
    return true;
  });
  return umaPorDia.slice(0, 6);
}
