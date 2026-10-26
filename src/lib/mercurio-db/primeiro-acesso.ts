import { db } from "@/lib/db";
import { consultarMercurio, sqlTexto } from "@/lib/mercurio-db/client";
import { importarMembro } from "@/lib/mercurio-db/importar";

/**
 * Primeiro acesso pelo login unificado (26/10/2026): a pessoa existe no Mercúrio, mas ainda não foi importada para o
 * Portal. Procura o cadastro ativo pelo e-mail e importa — só se a unidade dela já tem escola no Portal (as filiais em
 * uso); as demais unidades da OINAB-N não são abertas por este caminho.
 */
export async function importarPorEmail(email: string): Promise<{ situacao: "importado" | "nao_encontrado" | "ambiguo" | "fora_do_portal" }> {
  const achados = await consultarMercurio(
    `SELECT cad_matr, cad_unidade FROM cadastro WHERE cad_situacao='ATI' AND LOWER(TRIM(cad_email))=${sqlTexto(email.trim().toLowerCase())}`,
  );
  if (!achados.length) return { situacao: "nao_encontrado" };
  if (achados.length > 1) return { situacao: "ambiguo" };
  const [c] = achados;
  const escola = await db.school.findFirst({ where: { mercurioUnidade: c.cad_unidade }, select: { id: true } });
  if (!escola) return { situacao: "fora_do_portal" };
  await importarMembro(c.cad_matr!);
  return { situacao: "importado" };
}
