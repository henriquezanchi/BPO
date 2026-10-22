import { MemberPortalClient } from "@/components/member/member-portal-client";
import { InactiveMemberNotice } from "@/components/inactive-member-notice";
import { getAuthenticatedMember } from "@/lib/auth";
import { getMemberDashboard } from "@/lib/member-data";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MemberPortalPage({ searchParams }: { searchParams: Promise<{ evento?: string | string[] }> }) {
  const params = await searchParams;
  const eventoId = typeof params.evento === "string" ? params.evento : undefined;
  const member = await getAuthenticatedMember();
  if (!member) {
    const destino = eventoId ? `/portal?${new URLSearchParams({ evento: eventoId })}` : "/portal";
    redirect(`/login?${new URLSearchParams({ next: destino })}`);
  }
  if (!member.mercurioAtivo) return <InactiveMemberNotice schoolWhatsapp={member.school.whatsapp} />;

  const dashboard = await getMemberDashboard(member.id);

  return <MemberPortalClient key={eventoId} dashboard={dashboard} eventoId={eventoId} />;
}
