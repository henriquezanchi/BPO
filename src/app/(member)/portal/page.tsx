import { MemberPortalClient } from "@/components/member/member-portal-client";
import { InactiveMemberNotice } from "@/components/inactive-member-notice";
import { getAuthenticatedMember } from "@/lib/auth";
import { getMemberDashboard } from "@/lib/member-data";
import { ultimaEdicaoAurora } from "@/lib/boletim-aurora";
import { EntrarComoResponsavel } from "@/components/member/entrar-como-responsavel";
import { adultoDoMesmoEmail } from "@/lib/actions/login-responsavel-actions";
import { ehCrianca } from "@/lib/criancas-comum";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MemberPortalPage({ searchParams }: { searchParams: Promise<{ evento?: string | string[]; abrir?: string | string[] }> }) {
  const params = await searchParams;
  const eventoId = typeof params.evento === "string" ? params.evento : undefined;
  // Avisos de voluntariado abrem o quadro direto (oportunidades-actions.ts).
  // "pagar" (10/11/2026): o lembrete de vencimento abre direto o pagamento do mês em aberto.
  const abrir = params.abrir === "voluntariado" ? "voluntariado" : params.abrir === "pagar" ? "pagar" : undefined;
  const member = await getAuthenticatedMember();
  if (!member) {
    const destino = eventoId ? `/portal?${new URLSearchParams({ evento: eventoId })}` : abrir ? `/portal?${new URLSearchParams({ abrir })}` : "/portal";
    redirect(`/login?${new URLSearchParams({ next: destino })}`);
  }
  if (!member.mercurioAtivo) return <InactiveMemberNotice schoolWhatsapp={member.school.whatsapp} />;
  // Criança ou adolescente dos programas (Correntinha, Távolas, Janos): o acesso é do responsável (18/11/2026).
  if (ehCrianca(member)) {
    const adulto = await adultoDoMesmoEmail();
    return (
      <main className="mx-auto grid min-h-dvh max-w-md content-center gap-3 p-6 text-center">
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">O acesso é pelo seu responsável</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Agenda, contribuição e eventos do {member.nivel === "JN" ? "Janos" : "Merlin"} ficam no Portal do seu pai, mãe ou responsável. Se precisar de
          ajuda, fale com a secretaria da escola.
        </p>
        {adulto && <EntrarComoResponsavel nome={adulto.name} />}
      </main>
    );
  }

  const [dashboard, boletim] = await Promise.all([getMemberDashboard(member.id, { eventoDoLink: eventoId }), ultimaEdicaoAurora()]);

  return <MemberPortalClient key={eventoId} dashboard={dashboard} eventoId={eventoId} abrir={abrir} boletim={boletim} />;
}
