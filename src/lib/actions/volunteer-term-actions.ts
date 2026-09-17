"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { VOLUNTEER_TERM_VERSION } from "@/lib/volunteer-term";
import { revalidatePath } from "next/cache";

/**
 * "Assinatura" aqui é o membro digitar o próprio nome completo de
 * confirmação — checado (sem exigir acento/caixa idênticos) contra o nome
 * já cadastrado, pra não aceitar qualquer texto como assinatura.
 */
export async function signVolunteerTerm(memberId: string, signedName: string) {
  const member = await requireAuthenticatedMember(memberId);

  const normalizar = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");

  if (normalizar(signedName) !== normalizar(member.name)) {
    throw new Error("Digite seu nome completo exatamente como no cadastro pra assinar.");
  }

  const signature = await db.volunteerTermSignature.upsert({
    where: { memberId_termVersion: { memberId, termVersion: VOLUNTEER_TERM_VERSION } },
    update: {},
    create: { memberId, termVersion: VOLUNTEER_TERM_VERSION, signedName: signedName.trim() },
  });

  revalidatePath("/voluntario");
  return signature;
}
