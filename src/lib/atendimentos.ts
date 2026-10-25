import "server-only";
import { db } from "@/lib/db";
import { localInZone, parseLocal } from "@/lib/group-meetings";
import type { AtendimentoJanela, AtendimentoReserva } from "@prisma/client";

/**
 * Atendimentos individuais com o instrutor (pedido do usuário 2026-10-25): o instrutor abre faixas de horário
 * (semanais ou numa data), fatiadas em conversas; os alunos das turmas dele marcam; a conversa vai para a Agenda
 * dos dois; a Direção e a Escolástica veem os números por instrutor.
 */

export const DURACOES = [20, 30, 45, 60] as const;
export const SEMANAS_A_FRENTE = 4;
/** Antecedência mínima para marcar (o instrutor precisa saber antes). */
export const ANTECEDENCIA_MIN = 3 * 60;
export const MODALIDADES = { presencial: "Presencial", online: "Online", ambos: "Presencial ou online" } as const;

const FUSO_POR_UF: Record<string, string> = {
  MT: "America/Cuiaba",
  MS: "America/Campo_Grande",
  AM: "America/Manaus",
  RR: "America/Boa_Vista",
  RO: "America/Porto_Velho",
  AC: "America/Rio_Branco",
};
/** Fuso da filial pela UF (Barra do Garças-MT é uma hora antes de Brasília). */
export const fusoDaEscola = (uf: string | null | undefined) => FUSO_POR_UF[(uf ?? "").toUpperCase()] ?? "America/Sao_Paulo";

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const rotuloHora = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;

function diasEntre(deISO: string, dias: number) {
  const base = new Date(`${deISO}T12:00:00Z`);
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date(base.getTime() + i * 864e5);
    return { data: d.toISOString().slice(0, 10), diaSemana: d.getUTCDay() };
  });
}

export type Horario = {
  inicio: Date;
  fim: Date;
  janelaId: string;
  modalidade: string;
  local: string | null;
  linkOnline: string | null;
  situacao: "livre" | "marcado" | "fechado" | "dia_fechado";
  reservaId?: string;
  alunoId?: string | null;
};

/**
 * Fatia as faixas do instrutor em horários de hoje até SEMANAS_A_FRENTE, cruzando com reservas e bloqueios.
 * `incluirFechados` (visão do instrutor) devolve também os dias e horários fechados.
 */
export function gerarHorarios(
  janelas: AtendimentoJanela[],
  reservas: Pick<AtendimentoReserva, "id" | "inicio" | "status" | "alunoId">[],
  fuso: string,
  { agora = new Date(), incluirFechados = false, semanas = SEMANAS_A_FRENTE } = {},
): Horario[] {
  const hoje = localInZone(agora, fuso).slice(0, 10);
  const limite = agora.getTime() + ANTECEDENCIA_MIN * 60_000;
  const ocupado = new Map(reservas.filter((r) => r.status === "marcada" || r.status === "bloqueio").map((r) => [r.inicio.getTime(), r]));
  const saida: Horario[] = [];
  for (const { data, diaSemana } of diasEntre(hoje, semanas * 7)) {
    for (const j of janelas) {
      if (!j.ativa) continue;
      if (j.data ? j.data !== data : j.diaSemana !== diaSemana) continue;
      const diaFechado = j.datasFechadas.includes(data);
      if (diaFechado && !incluirFechados) continue;
      for (let m = j.inicioMinuto; m + j.duracaoMinutos <= j.fimMinuto; m += j.duracaoMinutos) {
        let inicio: Date;
        try {
          inicio = parseLocal(`${data}T${hhmm(m)}`, fuso);
        } catch {
          continue;
        }
        if (inicio.getTime() < (incluirFechados ? agora.getTime() : limite)) continue;
        const r = ocupado.get(inicio.getTime());
        const situacao = diaFechado ? "dia_fechado" : !r ? "livre" : r.status === "bloqueio" ? "fechado" : "marcado";
        if (!incluirFechados && situacao !== "livre") continue;
        saida.push({
          inicio,
          fim: new Date(inicio.getTime() + j.duracaoMinutos * 60_000),
          janelaId: j.id,
          modalidade: j.modalidade,
          local: j.local,
          linkOnline: j.linkOnline,
          situacao,
          reservaId: r?.id,
          alunoId: r?.alunoId,
        });
      }
    }
  }
  return saida.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

/** Horários do instrutor (com reservas e bloqueios) a partir de agora. */
export async function horariosDoInstrutor(instrutorId: string, opcoes: { incluirFechados?: boolean } = {}) {
  const instrutor = await db.member.findUniqueOrThrow({ where: { id: instrutorId }, select: { school: { select: { uf: true } } } });
  const fuso = fusoDaEscola(instrutor.school.uf);
  const [janelas, reservas] = await Promise.all([
    db.atendimentoJanela.findMany({ where: { instrutorId, ativa: true } }),
    db.atendimentoReserva.findMany({ where: { instrutorId, inicio: { gte: new Date() }, status: { in: ["marcada", "bloqueio"] } }, select: { id: true, inicio: true, status: true, alunoId: true } }),
  ]);
  return { fuso, janelas, horarios: gerarHorarios(janelas, reservas, fuso, opcoes) };
}

export type InstrutorDoAluno = { id: string; nome: string; turmas: string[] };

/**
 * Instrutores com quem o aluno pode marcar: professores das turmas em que ele é aluno (vínculo no Portal) e os
 * instrutores das matérias dessas turmas no Mercúrio (TurmaMateria), quando já ligados a uma pessoa do Portal.
 */
export async function instrutoresParaAtendimento(alunoId: string): Promise<InstrutorDoAluno[]> {
  const turmas = await db.classMembership.findMany({
    where: { memberId: alunoId, role: "aluno", classGroup: { tipo: "turma", arquivadoEm: null } },
    select: { classGroupId: true, classGroup: { select: { name: true } } },
  });
  if (!turmas.length) return [];
  const ids = turmas.map((t) => t.classGroupId);
  const nomeTurma = new Map(turmas.map((t) => [t.classGroupId, t.classGroup.name]));
  const [professores, materias] = await Promise.all([
    db.classMembership.findMany({ where: { classGroupId: { in: ids }, role: "professor" }, select: { classGroupId: true, member: { select: { id: true, name: true, mercurioAtivo: true } } } }),
    db.turmaMateria.findMany({ where: { classGroupId: { in: ids }, instrutorMemberId: { not: null } }, select: { classGroupId: true, instrutorMemberId: true, instrutorNome: true } }),
  ]);
  const porId = new Map<string, InstrutorDoAluno>();
  const somar = (id: string, nome: string, turma: string) => {
    if (id === alunoId) return;
    const atual = porId.get(id) ?? { id, nome, turmas: [] };
    if (!atual.turmas.includes(turma)) atual.turmas.push(turma);
    porId.set(id, atual);
  };
  for (const p of professores) if (p.member.mercurioAtivo) somar(p.member.id, p.member.name, nomeTurma.get(p.classGroupId) ?? "");
  for (const m of materias) somar(m.instrutorMemberId!, m.instrutorNome, nomeTurma.get(m.classGroupId) ?? "");
  return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** O aluno pode marcar com este instrutor? */
export async function podeMarcarCom(alunoId: string, instrutorId: string) {
  return (await instrutoresParaAtendimento(alunoId)).some((i) => i.id === instrutorId);
}

/** Pode abrir horários: instrutor (Mercúrio) ou professor de alguma turma no Portal. */
export async function ehInstrutor(m: { id: string; isPedagogo: boolean }) {
  if (m.isPedagogo) return true;
  return (await db.classMembership.count({ where: { memberId: m.id, role: "professor", classGroup: { tipo: "turma", arquivadoEm: null } } })) > 0;
}

// ───────────────────────── Números para a Direção e a Escolástica ─────────────────────────

export type NumerosInstrutor = {
  id: string;
  nome: string;
  schoolId: string;
  horariosAbertos: number; // próximas 4 semanas, livres + marcados
  livres: number;
  marcados: number;
  ocupacao: number | null; // marcados / abertos
  realizados30: number;
  faltas30: number;
  canceladosAluno30: number;
  canceladosInstrutor30: number;
  alunosAtendidos90: number;
  proximoLivre: Date | null;
};

/** Números por instrutor das filiais pedidas (instrutores = isPedagogo ativos, mais quem já abriu horários). */
export async function numerosDosInstrutores(schoolIds: string[]): Promise<NumerosInstrutor[]> {
  if (!schoolIds.length) return [];
  const agora = new Date();
  const d30 = new Date(agora.getTime() - 30 * 864e5);
  const d90 = new Date(agora.getTime() - 90 * 864e5);
  const [pedagogos, janelas, escolas] = await Promise.all([
    db.member.findMany({ where: { schoolId: { in: schoolIds }, isPedagogo: true, mercurioAtivo: true }, select: { id: true, name: true, schoolId: true } }),
    db.atendimentoJanela.findMany({ where: { schoolId: { in: schoolIds }, ativa: true }, include: { instrutor: { select: { id: true, name: true, schoolId: true } } } }),
    db.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true, uf: true } }),
  ]);
  const pessoas = new Map(pedagogos.map((p) => [p.id, p]));
  for (const j of janelas) if (!pessoas.has(j.instrutorId)) pessoas.set(j.instrutorId, j.instrutor);
  const ids = [...pessoas.keys()];
  if (!ids.length) return [];
  const [futuras, passadas] = await Promise.all([
    db.atendimentoReserva.findMany({ where: { instrutorId: { in: ids }, inicio: { gte: agora }, status: { in: ["marcada", "bloqueio"] } }, select: { id: true, instrutorId: true, inicio: true, status: true, alunoId: true } }),
    db.atendimentoReserva.findMany({ where: { instrutorId: { in: ids }, inicio: { gte: d90, lt: agora }, alunoId: { not: null } }, select: { instrutorId: true, inicio: true, status: true, canceladoPor: true, alunoId: true } }),
  ]);
  const fusoDe = new Map(escolas.map((e) => [e.id, fusoDaEscola(e.uf)]));
  return ids.map((id) => {
    const p = pessoas.get(id)!;
    const hs = gerarHorarios(
      janelas.filter((j) => j.instrutorId === id),
      futuras.filter((r) => r.instrutorId === id),
      fusoDe.get(p.schoolId) ?? "America/Sao_Paulo",
      { agora, incluirFechados: true },
    );
    const livres = hs.filter((h) => h.situacao === "livre");
    const marcados = hs.filter((h) => h.situacao === "marcado").length;
    const abertos = livres.length + marcados;
    const minhas = passadas.filter((r) => r.instrutorId === id);
    const ult30 = minhas.filter((r) => r.inicio >= d30);
    return {
      id,
      nome: p.name,
      schoolId: p.schoolId,
      horariosAbertos: abertos,
      livres: livres.length,
      marcados,
      ocupacao: abertos ? marcados / abertos : null,
      realizados30: ult30.filter((r) => r.status === "realizada").length,
      faltas30: ult30.filter((r) => r.status === "faltou").length,
      canceladosAluno30: ult30.filter((r) => r.status === "cancelada" && r.canceladoPor === "aluno").length,
      canceladosInstrutor30: ult30.filter((r) => r.status === "cancelada" && r.canceladoPor === "instrutor").length,
      alunosAtendidos90: new Set(minhas.filter((r) => r.status === "realizada" || r.status === "marcada").map((r) => r.alunoId)).size,
      proximoLivre: livres[0]?.inicio ?? null,
    };
  });
}
