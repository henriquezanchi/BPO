import { MemberPortalClient } from "@/components/member/member-portal-client";
import { InactiveMemberNotice } from "@/components/inactive-member-notice";
import { getAuthenticatedMember } from "@/lib/auth";
import { getMemberDashboard } from "@/lib/member-data";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MemberPortalPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/portal");
  if (!member.mercurioAtivo) return <InactiveMemberNotice schoolWhatsapp={member.school.whatsapp} />;

  const dashboard = await getMemberDashboard(member.id);

  return <MemberPortalClient dashboard={dashboard} />;
}
