"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GAF e oferta de apoio voluntário — antes só mudavam um estado local de
 * React (misc-panels.tsx), sem salvar nada de verdade (bug real encontrado
 * 2026-09-22: ninguém na escola via o pedido). Agora persiste, e aparece no
 * detalhe do membro no Painel do Diretor (ver director-actions.ts).
 */
export async function solicitarAdesaoGaf(memberId: string) {
  await requireAuthenticatedMember(memberId);
  await db.gafRequest.create({ data: { memberId } });
}

export async function oferecerApoioVoluntario(memberId: string, secretarias: string[]) {
  await requireAuthenticatedMember(memberId);
  if (secretarias.length === 0) throw new Error("Selecione pelo menos uma secretaria.");
  await db.volunteerOffer.create({ data: { memberId, secretarias } });
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
