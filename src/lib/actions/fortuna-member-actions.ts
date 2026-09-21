"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { fortunaGetBranches, fortunaGetClient } from "@/lib/fortuna/client";
import type { FortunaBalanceView } from "@/lib/member-data";

/**
 * Saldo real do Fortuna, buscado à parte do resto do Portal — extraído de
 * getMemberDashboard porque essa chamada (API externa, login+2 requests)
 * segurava o carregamento inicial da tela inteira mesmo pra quem só queria
 * ver o resto do Portal (bug real relatado pelo usuário: "demorando a
 * carregar o início"). Agora o Portal renderiza na hora e este card busca
 * o saldo sozinho, client-side, depois.
 */
export async function getFortunaBalancesForMember(memberId: string): Promise<FortunaBalanceView[]> {
  const member = await requireAuthenticatedMember(memberId);
  if (!member.fortunaClientId) return [];

  try {
    const [client, branches] = await Promise.all([fortunaGetClient(member.fortunaClientId), fortunaGetBranches()]);
    const tituloPorFilial = new Map(branches.map((b) => [b.id, b.title]));
    return client.balance.map((b) => ({
      branchId: b.branchId,
      branchTitle: tituloPorFilial.get(b.branchId) ?? `Filial ${b.branchId}`,
      amount: Number(b.amount),
      isHome: b.branchId === client.branch.id,
    }));
  } catch (e) {
    console.error("Falha ao buscar saldo Fortuna:", (e as Error).message);
    return [];
  }
}
