import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { carregarContextoSecretaria, podeGerirEscalaSecretaria } from "@/lib/secretarias-rede/acesso";
import { zernioConfigurado } from "@/lib/zernio/client";

/**
 * Instagram da filial como pacote opcional (pedido do usuário 2026-10-26): R$ 49/mês, cobrado da filial pela
 * empresa do BPO (cobrança mensal com nota, fora das cobranças dos alunos). Conexão pela Zernio (lib/zernio).
 * Quem contrata e conecta: direção da filial ou responsável pela Difusão e Comunicação nela.
 */
export const PRECO_INSTAGRAM_CENTAVOS = 4900;
export const SECRETARIA_DIFUSAO = "Difusão e Comunicação";

export async function exigirGestaoDifusao(schoolId: string) {
  const member = await getAuthenticatedMember();
  if (!member?.mercurioAtivo) throw new Error("Entre com uma conta ativa para continuar.");
  const ctx = await carregarContextoSecretaria(member);
  if (!podeGerirEscalaSecretaria(ctx, SECRETARIA_DIFUSAO, schoolId)) throw new Error("Só a direção ou a Difusão da filial podem contratar o Instagram.");
  return member;
}

/** Filiais em que a pessoa pode contratar (a dela primeiro) e a situação do Instagram de cada uma. */
export async function instagramDasFiliais(member: Awaited<ReturnType<typeof getAuthenticatedMember>>) {
  // Sem a Zernio configurada, a oferta não aparece (não há como conectar).
  if (!member?.mercurioAtivo || !zernioConfigurado()) return [];
  const ctx = await carregarContextoSecretaria(member);
  const ids = ctx.administradorNacional ? [member.schoolId] : ctx.escolas.map((e) => e.id).filter((id) => podeGerirEscalaSecretaria(ctx, SECRETARIA_DIFUSAO, id));
  if (!ids.length) return [];
  const [escolas, contas] = await Promise.all([
    db.school.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    db.redeSocialFilial.findMany({ where: { schoolId: { in: ids }, rede: "instagram" } }),
  ]);
  return escolas
    .sort((a, b) => (a.id === member.schoolId ? -1 : b.id === member.schoolId ? 1 : a.name.localeCompare(b.name, "pt-BR")))
    .map((e) => {
      const c = contas.find((x) => x.schoolId === e.id);
      return {
        schoolId: e.id,
        filial: e.name,
        status: (c?.status ?? "nao_contratada") as "nao_contratada" | "contratada" | "conectada" | "desconectada" | "cancelada",
        usuario: c?.usuario ?? null,
        desde: (c?.conectadaEm ?? c?.contratadaEm)?.toISOString() ?? null,
      };
    });
}
