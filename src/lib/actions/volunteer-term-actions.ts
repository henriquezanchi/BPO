"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { mascararCpf, montarTermo, termoVigente, VOLUNTEER_TERM_VERSION } from "@/lib/volunteer-term";
import { revalidatePath } from "next/cache";

function cpfValido(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    const soma = [...d.slice(0, n)].reduce((s, c, i) => s + Number(c) * (n + 1 - i), 0);
    return ((soma * 10) % 11) % 10;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/**
 * "Assinatura" = o membro digita o próprio nome completo (conferido contra
 * o cadastro, sem exigir acento/caixa idênticos) e o CPF (conferido pelos
 * dígitos verificadores). O CPF não fica no cadastro — o texto assinado
 * guarda só a parte central (ver mascararCpf).
 */
export async function signVolunteerTerm(memberId: string, signedName: string, cpf: string) {
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
  if (!cpfValido(cpf)) throw new Error("CPF inválido — confira os números.");

  if (await termoVigente(memberId, member.schoolId)) return { ok: true as const };

  const school = await db.school.findUniqueOrThrow({ where: { id: member.schoolId }, select: { name: true, cnpj: true } });
  await db.volunteerTermSignature.create({
    data: {
      memberId,
      termVersion: VOLUNTEER_TERM_VERSION,
      signedName: signedName.trim(),
      schoolId: member.schoolId,
      signedText: montarTermo(member, school, mascararCpf(cpf)),
    },
  });

  revalidatePath("/voluntario");
  revalidatePath("/voluntario/termo");
  return { ok: true as const };
}
