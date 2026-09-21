import { DiretorDashboard } from "@/components/director/diretor-dashboard";
import { getAuthenticatedMember } from "@/lib/auth";
import { getDirectorDashboard } from "@/lib/director-data";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel do Diretor - Nova Acrópole" };

/**
 * Acesso: link direto (esta URL, /diretor) OU pelo Portal do Membro >
 * Portal do Voluntário > card "Direção" — os dois levam pro mesmo lugar,
 * a mesma sessão/gate decide (member-portal-client.tsx e
 * voluntario/page.tsx só mostram o link/card quando isDiretor/isSubChefe).
 */
export default async function DiretorPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/diretor");
  if (!member.isDiretor && !member.isSubChefe) redirect("/portal");

  const data = await getDirectorDashboard(member.schoolId);

  return <DiretorDashboard schoolId={member.schoolId} schoolName={member.school.name} data={data} />;
}
