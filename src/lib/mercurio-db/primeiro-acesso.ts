import { db } from "@/lib/db";
import { ehDonoDoSistema, temDirecaoLiberada } from "@/lib/dono-do-sistema";
import { consultarMercurio, sqlTexto } from "@/lib/mercurio-db/client";
import { importarMembro } from "@/lib/mercurio-db/importar";

/**
 * Quem pode fazer o primeiro acesso numa filial (07/11/2026, pedido do usuário): filial aberta (`School.portalAberto`),
 * qualquer ativo; filial fechada, só dirigentes (cad_dirigente 'S'), direção liberada pelo dono e quem a direção liberou
 * um a um (TestadorLiberado). Pura, para teste.
 */
export function podeEntrarNaFilial(p: { portalAberto: boolean; matricula: string; dirigente: boolean; liberado: boolean }) {
  return p.portalAberto || p.dirigente || p.liberado || temDirecaoLiberada(p.matricula) || ehDonoDoSistema({ mercurioId: p.matricula });
}

/**
 * Primeiro acesso pelo login unificado (26/10/2026): a pessoa existe no Mercúrio, mas ainda não foi importada para o
 * Portal. Procura o cadastro ativo pelo e-mail e importa — só se a unidade dela já tem escola no Portal e a pessoa pode
 * entrar nela (podeEntrarNaFilial). Quem já está no Portal não passa por aqui.
 */
export async function importarPorEmail(email: string): Promise<{ situacao: "importado" | "nao_encontrado" | "ambiguo" | "fora_do_portal" }> {
  const achados = await consultarMercurio(
    `SELECT cad_matr, cad_unidade, cad_dirigente FROM cadastro WHERE cad_situacao='ATI' AND LOWER(TRIM(cad_email))=${sqlTexto(email.trim().toLowerCase())}`,
  );
  if (!achados.length) return { situacao: "nao_encontrado" };
  if (achados.length > 1) return { situacao: "ambiguo" };
  const [c] = achados;
  const escola = await db.school.findFirst({ where: { mercurioUnidade: c.cad_unidade }, select: { id: true, portalAberto: true } });
  if (!escola) return { situacao: "fora_do_portal" };
  const liberado = !escola.portalAberto && (await db.testadorLiberado.count({ where: { mercurioId: c.cad_matr! } })) > 0;
  if (!podeEntrarNaFilial({ portalAberto: escola.portalAberto, matricula: c.cad_matr!, dirigente: c.cad_dirigente === "S", liberado })) {
    return { situacao: "fora_do_portal" };
  }
  await importarMembro(c.cad_matr!);
  return { situacao: "importado" };
}
