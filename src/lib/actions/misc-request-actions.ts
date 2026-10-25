"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { candidatoElegivel } from "@/lib/grupos-portal";
import { SECRETARIAS_OFERTA } from "@/lib/secretarias";

/**
 * GAF e oferta de apoio voluntário — antes só mudavam um estado local de
 * React (misc-panels.tsx), sem salvar nada de verdade (bug real encontrado
 * 2026-09-22: ninguém na escola via o pedido). Agora persiste, e aparece no
 * detalhe do membro no Painel do Diretor (ver director-actions.ts).
 */
/**
 * Pedido de participação no GAF. Com `classGroupId` (2026-10-25), vai para o GAF escolhido pelo aluno —
 * conferido aqui: GAF ativo da filial dele, que o aceita, sem vínculo nem pedido pendente.
 */
export async function solicitarAdesaoGaf(memberId: string, classGroupId?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await requireAuthenticatedMember(memberId);
  if (classGroupId) {
    const g = await db.classGroup.findUnique({ where: { id: classGroupId }, select: { tipo: true, schoolId: true, permiteAlunos: true, arquivadoEm: true } });
    if (!g || g.tipo !== "GAF" || g.arquivadoEm || g.schoolId !== m.schoolId) return { ok: false, error: "Este GAF não está disponível." };
    const motivo = await candidatoElegivel("GAF", g.schoolId, g.permiteAlunos, memberId);
    if (motivo) return { ok: false, error: motivo };
    if (await db.classMembership.findFirst({ where: { classGroupId, memberId } })) return { ok: false, error: "Você já participa deste GAF." };
    if (await db.gafRequest.findFirst({ where: { classGroupId, memberId } })) return { ok: false, error: "Seu pedido para este GAF já foi enviado." };
  }
  await db.gafRequest.create({ data: { memberId, classGroupId: classGroupId ?? null } });
  return { ok: true };
}

export async function oferecerApoioVoluntario(memberId: string, secretarias: string[]) {
  await requireAuthenticatedMember(memberId);
  // Só nomes do catálogo (lib/secretarias.ts), para a oferta casar com as secretarias da filial.
  const validas = [...new Set(secretarias)].filter((s) => (SECRETARIAS_OFERTA as readonly string[]).includes(s));
  if (validas.length === 0) throw new Error("Selecione pelo menos uma secretaria.");
  await db.volunteerOffer.create({ data: { memberId, secretarias: validas } });
}

/** Marca o tour guiado do 1º login como visto — ver onboarding-tour.tsx. Chamado ao terminar ou pular. */
export async function marcarTourConcluido(memberId: string) {
  await requireAuthenticatedMember(memberId);
  await db.member.update({ where: { id: memberId }, data: { tourCompletedAt: new Date() } });
}

/** Chamado ao abrir os painéis do GAF/voluntariado — evita reoferecer um pedido já feito recentemente sem dar essa informação ao membro. */
export async function getMinhasSolicitacoes(memberId: string) {
  await requireAuthenticatedMember(memberId);
  const [gaf, voluntariado] = await Promise.all([
    db.gafRequest.findFirst({ where: { memberId }, orderBy: { createdAt: "desc" } }),
    db.volunteerOffer.findFirst({ where: { memberId }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    gafSolicitadoEm: gaf?.createdAt ?? null,
    voluntariadoOferecidoEm: voluntariado?.createdAt ?? null,
  };
}
