import { getAuthenticatedMember } from "@/lib/auth";
import { EconomiaPanel } from "@/components/economia/economia-panel";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <Link href="/voluntario" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Portal do Voluntário
        </Link>
        <ThemeToggle />
      </div>
      <h1 className="text-xl font-black text-na-green-dark">Economia</h1>
      <EconomiaPanel schoolId={member.schoolId} />
    </main>
  );
}
