import { DiarioFv } from "@/components/fv/diario-fv";
import type { getAuthenticatedMember } from "@/lib/auth";
import { carregarDiarioFv } from "@/lib/fv/dados";

/** Aba "Meu diário de FV" do GDVE: carrega só o diário de quem está logado (2026-10-31). */
export async function DiarioFvDoGrupo({ member, dia }: { member: NonNullable<Awaited<ReturnType<typeof getAuthenticatedMember>>>; dia?: string }) {
  const d = await carregarDiarioFv(member, dia);
  return <DiarioFv key={d.data} d={d} />;
}
