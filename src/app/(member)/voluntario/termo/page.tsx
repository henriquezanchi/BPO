import { SignTermForm } from "@/components/member/volunteer/sign-term-form";
import { formatDateTimeBR } from "@/lib/format";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { VOLUNTEER_TERM_TEXT, VOLUNTEER_TERM_VERSION } from "@/lib/volunteer-term";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function VolunteerTermPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario/termo");
  if (!member.isPedagogo) redirect("/portal");

  const signature = await db.volunteerTermSignature.findUnique({
    where: { memberId_termVersion: { memberId: member.id, termVersion: VOLUNTEER_TERM_VERSION } },
  });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Link href="/voluntario" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Portal do Voluntário
      </Link>
      <h1 className="text-xl font-bold text-na-green-dark">Termo de Voluntariado</h1>

      <div className="max-h-96 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs whitespace-pre-wrap text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        {VOLUNTEER_TERM_TEXT}
      </div>

      {signature ? (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>
            Assinado por <strong>{signature.signedName}</strong> em {formatDateTimeBR(signature.signedAt)}.
          </span>
        </div>
      ) : (
        <SignTermForm memberId={member.id} />
      )}
    </main>
  );
}
