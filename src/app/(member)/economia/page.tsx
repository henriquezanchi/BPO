import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { PaymentReviewPanel } from "@/components/economia/payment-review-panel";
import { EconomiaPanel } from "@/components/economia/economia-panel";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Área do Secretário de Economia — isSecretarioEconomia vem da sincronização
 * real de "Diretor > Colaboradores" do Mercúrio (ver scripts/sync-diretoria.ts).
 * Direção também entra (requireEconomiaOuDirecao cobre os dois) porque nem
 * toda filial já tem esse cargo preenchido lá.
 */
export default async function EconomiaPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/economia");
  if (!member.isSecretarioEconomia && !member.isDiretor && !member.isSubChefe) redirect("/portal");

  return (
    <ShellTrabalho largura="estreita">
      <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Economia</h1>
      <PaymentReviewPanel schoolId={member.schoolId} />
      <EconomiaPanel schoolId={member.schoolId} />
    </ShellTrabalho>
  );
}
