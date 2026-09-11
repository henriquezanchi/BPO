import { MemberPortalClient } from "@/components/member/member-portal-client";
import { getMemberDashboard } from "@/lib/member-data";

export const dynamic = "force-dynamic";

// TODO: substituir `?memberId=` por sessão real assim que Supabase Auth +
// resolução de papel via Mercúrio estiverem prontos (ver conversa sobre
// autenticação). Por ora, aceitar o id explícito viabiliza testar o portal
// com dados reais sem bloquear no login.
export default async function MemberPortalPage(props: PageProps<"/portal">) {
  const searchParams = await props.searchParams;
  const memberId = typeof searchParams.memberId === "string" ? searchParams.memberId : undefined;

  if (!memberId) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-gray-500">
        Acesse com <code className="rounded bg-gray-100 px-1.5 py-0.5">?memberId=SEU_ID</code> enquanto o login
        real não está pronto. Rode <code className="rounded bg-gray-100 px-1.5 py-0.5">npm run db:seed</code> para
        gerar dados de exemplo.
      </main>
    );
  }

  const dashboard = await getMemberDashboard(memberId);

  return <MemberPortalClient dashboard={dashboard} />;
}
