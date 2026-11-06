"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { consultarMercurio, sqlNumero, sqlTexto } from "@/lib/mercurio-db/client";
import { ehDirecaoDaFilial } from "@/lib/recursos-filial";

/**
 * Liberação individual do Portal em filial fechada (07/11/2026, pedido do usuário): a direção escolhe quem pode fazer o
 * primeiro acesso (TestadorLiberado). Na filial aberta qualquer ativo entra e esta lista não é usada.
 */
async function exigirDirecao(schoolId: string) {
  const eu = await getAuthenticatedMember();
  if (!eu || !(await ehDirecaoDaFilial(eu, schoolId))) throw new Error("Só a direção da filial libera o Portal.");
  const escola = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { mercurioUnidade: true } });
  if (!escola.mercurioUnidade) throw new Error("Filial sem unidade do Mercúrio.");
  return { eu, unidade: escola.mercurioUnidade };
}

export type PessoaParaLiberar = { matricula: string; nome: string; nivel: string; liberado: boolean; noPortal: boolean };

export async function buscarParaLiberar(schoolId: string, termo: string): Promise<PessoaParaLiberar[]> {
  const { unidade } = await exigirDirecao(schoolId);
  const t = termo.trim();
  if (t.length < 3) return [];
  const filtro = /^\d+$/.test(t) ? `cad_matr=${sqlNumero(t)}` : `cad_nome LIKE ${sqlTexto(`%${t.toUpperCase().replace(/[%_]/g, "")}%`)}`;
  const achados = await consultarMercurio(
    `SELECT cad_matr, cad_nome, cad_nivel FROM cadastro WHERE cad_situacao='ATI' AND cad_unidade=${sqlTexto(unidade)} AND ${filtro} ORDER BY cad_nome LIMIT 15`,
  );
  const matrs = achados.map((a) => a.cad_matr!).filter(Boolean);
  const [liberados, noPortal] = await Promise.all([
    db.testadorLiberado.findMany({ where: { mercurioId: { in: matrs } }, select: { mercurioId: true } }),
    db.member.findMany({ where: { mercurioId: { in: matrs } }, select: { mercurioId: true } }),
  ]);
  const lib = new Set(liberados.map((l) => l.mercurioId));
  const port = new Set(noPortal.map((m) => m.mercurioId));
  return achados.map((a) => ({ matricula: a.cad_matr!, nome: (a.cad_nome ?? "").trim(), nivel: a.cad_nivel ?? "", liberado: lib.has(a.cad_matr!), noPortal: port.has(a.cad_matr!) }));
}

export async function liberarNoPortal(schoolId: string, matricula: string) {
  const { eu, unidade } = await exigirDirecao(schoolId);
  if (!/^\d+$/.test(matricula)) throw new Error("Matrícula inválida.");
  const [c] = await consultarMercurio(`SELECT cad_matr FROM cadastro WHERE cad_situacao='ATI' AND cad_unidade=${sqlTexto(unidade)} AND cad_matr=${sqlNumero(matricula)}`);
  if (!c) throw new Error("Essa matrícula não é de um ativo desta filial.");
  await db.testadorLiberado.upsert({
    where: { mercurioId: matricula },
    update: { unidade, liberadoPor: eu.mercurioId ?? eu.id },
    create: { mercurioId: matricula, unidade, liberadoPor: eu.mercurioId ?? eu.id },
  });
  revalidatePath("/admin");
}

export async function retirarLiberacao(schoolId: string, matricula: string) {
  const { unidade } = await exigirDirecao(schoolId);
  await db.testadorLiberado.deleteMany({ where: { mercurioId: matricula, unidade } });
  revalidatePath("/admin");
}
