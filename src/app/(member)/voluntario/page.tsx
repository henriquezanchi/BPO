import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { VOLUNTEER_TERM_VERSION } from "@/lib/volunteer-term";
import { ArrowLeft, CalendarClock, Crown, FileSignature, GraduationCap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Hub pros diferentes tipos de voluntário (instrutor, direção, secretário,
 * etc — ver conversa). Instrutor (isPedagogo, "Integração > Pedagogos"),
 * Direção (isDiretor/isSubChefe, "Diretor > Dados da Unidade") e Secretário
 * de Escolástica (isSecretarioEscolastica, "Diretor > Colaboradores") têm
 * sinal real do Mercúrio — ver scripts/sync-diretoria.ts.
 */
export default async function VoluntarioPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario");
  if (!member.isPedagogo && !member.isDiretor && !member.isSubChefe && !member.isSecretarioEscolastica) redirect("/portal");

  const termoAssinado = await db.volunteerTermSignature.findUnique({
    where: { memberId_termVersion: { memberId: member.id, termVersion: VOLUNTEER_TERM_VERSION } },
  });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Voltar ao Portal
      </Link>
      <h1 className="text-xl font-black text-na-green-dark">Portal do Voluntário</h1>

      <div className="flex flex-col gap-3">
        {member.isPedagogo && (
          <Link
            href="/professor"
            className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-na-gold"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-na-gold/15 text-na-gold-dark">
              <GraduationCap size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Instrutor</h2>
              <p className="text-xs text-gray-500">Turmas, atividades e enquetes</p>
            </div>
          </Link>
        )}

        {(member.isDiretor || member.isSubChefe) && (
          <Link
            href="/diretor"
            className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-na-gold"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-na-gold/15 text-na-gold-dark">
              <Crown size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Direção</h2>
              <p className="text-xs text-gray-500">{member.isDiretor ? "Diretor(a)" : "Sub-Chefe"} da unidade</p>
            </div>
          </Link>
        )}

        <Link
          href="/voluntario/termo"
          className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-na-gold"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-na-gold/15 text-na-gold-dark">
            <FileSignature size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Termo de Voluntariado</h2>
            <p className="text-xs text-gray-500">{termoAssinado ? "Assinado" : "Pendente de assinatura"}</p>
          </div>
        </Link>

        {member.isSecretarioEscolastica && (
          <Link
            href="/escolastica"
            className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-na-gold"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-na-gold/15 text-na-gold-dark">
              <CalendarClock size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Escolástica</h2>
              <p className="text-xs text-gray-500">Agenda de pendências (ex: transições pro Círculo de Amigos)</p>
            </div>
          </Link>
        )}
      </div>
    </main>
  );
}
