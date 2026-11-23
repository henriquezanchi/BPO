"use server";

import { camposDoPedido, situacaoDoPedido } from "@/lib/pedidos-correcao";
import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { OVERDUE_STATUSES } from "@/lib/member-data";
import { aplicarAlteracaoCadastro } from "@/lib/cadastro-aplicar";
import { conferirAlteracao, mensagemDoFiltro } from "@/lib/filtro-cadastro";
import { revalidatePath } from "next/cache";

export interface AddressChangeInput {
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
}

export interface SensitiveContactInput {
  whatsapp?: string;
  email?: string;
}

const CAMPOS_ENDERECO = [
  "addressStreet",
  "addressNumber",
  "addressComplement",
  "addressNeighborhood",
  "addressCity",
  "addressState",
  "addressZip",
] as const;

const CAMPOS_SENSIVEIS = ["whatsapp", "email"] as const;

/**
 * Desde 23/11/2026 (pedido do usuário) o próprio membro altera o cadastro sem a Escolástica: o filtro barra o que não é
 * dado de cadastro (recusa na hora, com o motivo) e o resto é aplicado já (Portal + Mercúrio). Fica registrado em
 * ContactChangeLog, como antes.
 */
async function registrarEAplicar(memberId: string, oldValues: Record<string, string | null>, newValues: Record<string, string | null>, extra: { memberWasOverdue: boolean; alertedEconomia?: boolean }) {
  const filtro = conferirAlteracao(newValues);
  if (!filtro.ok) return { erro: mensagemDoFiltro(filtro.erros) };
  const log = await db.contactChangeLog.create({ data: { memberId, oldValues, newValues, status: "pendente", ...extra } });
  try {
    await aplicarAlteracaoCadastro(log.id);
  } catch (e) {
    await db.contactChangeLog.update({ where: { id: log.id }, data: { status: "rejeitado", reviewedAt: new Date() } });
    return { erro: (e as Error).message };
  }
  return { erro: null };
}

/**
 * Pedido do usuário 2026-10-19: NENHUM dado de cadastro muda sozinho — nem
 * no Portal, nem no Mercúrio. O endereço vira uma SOLICITAÇÃO pendente,
 * igual a WhatsApp/e-mail, e só é aplicado (e enfileirado pro Mercúrio)
 * quando a Secretaria de Escolástica ou a Direção aprova (ver
 * aprovarSolicitacaoCadastro em escolastica-actions.ts).
 *
 * requireAuthenticatedMember confere que quem está logado É o memberId
 * recebido — Server Actions não passam pelo matcher do proxy.ts.
 */
export async function updateMemberAddress(memberId: string, changes: AddressChangeInput) {
  await requireAuthenticatedMember(memberId);
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });

  const oldValues: Record<string, string | null> = {};
  const newValues: Record<string, string | null> = {};

  for (const field of CAMPOS_ENDERECO) {
    const incoming = changes[field];
    const current = member[field] ?? null;
    if (incoming !== undefined && (incoming || null) !== current) {
      oldValues[field] = current;
      newValues[field] = incoming;
    }
  }

  if (Object.keys(newValues).length === 0) {
    return { changed: false, alerted: false, pendente: false, erro: null };
  }

  const wasOverdue = OVERDUE_STATUSES.has(member.status);
  const r = await registrarEAplicar(memberId, oldValues, newValues, { memberWasOverdue: wasOverdue, alertedEconomia: wasOverdue });
  if (r.erro) return { changed: false, alerted: false, pendente: false, erro: r.erro };

  revalidatePath("/portal");
  return { changed: true, alerted: wasOverdue, pendente: false, erro: null };
}

/**
 * Registra uma SOLICITAÇÃO de correção de WhatsApp/e-mail — não aplica nada
 * em Member ainda. Fica pendente até o Secretário de Escolástica aprovar
 * (ver aprovarSolicitacaoCadastro em escolastica-actions.ts), que só então
 * grava de verdade e enfileira a propagação pro Mercúrio.
 */
export async function solicitarAlteracaoContato(memberId: string, changes: SensitiveContactInput) {
  const member = await requireAuthenticatedMember(memberId);

  const oldValues: Record<string, string | null> = {};
  const newValues: Record<string, string | null> = {};

  for (const field of CAMPOS_SENSIVEIS) {
    const incoming = changes[field];
    const current = member[field] ?? null;
    if (incoming !== undefined && incoming.trim() !== "" && incoming !== current) {
      oldValues[field] = current;
      newValues[field] = incoming;
    }
  }

  if (Object.keys(newValues).length === 0) {
    return { solicitado: false, erro: null };
  }

  const r = await registrarEAplicar(memberId, oldValues, newValues, { memberWasOverdue: OVERDUE_STATUSES.has(member.status) });
  if (r.erro) return { solicitado: false, erro: r.erro };

  revalidatePath("/portal");

  return { solicitado: true, aplicado: true, erro: null };
}

/** Pra UI mostrar "você já tem uma solicitação em aberto" e não deixar mandar duplicada. */
/** Pedidos de correção do cadastro dos últimos 120 dias, com a situação (10/11/2026), para "Meus dados". */
export async function meusPedidosDeCorrecao(memberId: string) {
  await requireAuthenticatedMember(memberId);
  const desde = new Date(Date.now() - 120 * 864e5);
  const logs = await db.contactChangeLog.findMany({
    where: { memberId, createdAt: { gte: desde }, status: { in: ["pendente", "aprovado", "rejeitado"] } },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id: true, newValues: true, status: true, createdAt: true, reviewedAt: true },
  });
  return logs.flatMap((l) => {
    const situacao = situacaoDoPedido(l.status);
    const campos = camposDoPedido(l.newValues);
    return situacao && campos.length ? [{ id: l.id, campos, situacao, criadoEm: l.createdAt.toISOString(), revisadoEm: l.reviewedAt?.toISOString() ?? null }] : [];
  });
}

export async function getSolicitacaoContatoPendente(memberId: string) {
  await requireAuthenticatedMember(memberId);
  const pendente = await db.contactChangeLog.findFirst({
    where: { memberId, status: "pendente" },
    orderBy: { createdAt: "desc" },
  });
  return pendente ? { oldValues: pendente.oldValues, newValues: pendente.newValues, createdAt: pendente.createdAt } : null;
}
