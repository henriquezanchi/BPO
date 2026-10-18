import { SignTermForm } from "@/components/member/volunteer/sign-term-form";
import { formatDateBR, formatDateTimeBR } from "@/lib/format";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { montarTermo, termoVigente } from "@/lib/volunteer-term";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function VolunteerTermPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario/termo");

  const signature = await termoVigente(member.id, member.schoolId);
  const school = await db.school.findUniqueOrThrow({ where: { id: member.schoolId }, select: { name: true, cnpj: true } });
  // Assinado: mostra exatamente o texto que foi assinado; senão, o termo preenchido com o cadastro.
  const texto = signature?.signedText ?? montarTermo(member, school, null);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Link href="/voluntario" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        <ArrowLeft size={14} /> Portal do Voluntário
      </Link>
      <div>
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Termo de Adesão ao Serviço Voluntário</h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Dados vindos do seu cadastro na escola. Se algo estiver errado, peça à secretaria pra corrigir antes de assinar. O termo vale por 5 anos e precisa ser assinado de novo se você mudar de filial.
        </p>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs whitespace-pre-wrap text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        {texto}
      </div>

      {signature ? (
        <div className="flex items-center gap-2 rounded-xl border border-na-success/40 bg-na-success-light p-4 text-sm text-na-success-dark dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>
            Assinado por <strong>{signature.signedName}</strong> em {formatDateTimeBR(signature.signedAt)}. Válido até {formatDateBR(new Date(new Date(signature.signedAt).setFullYear(signature.signedAt.getFullYear() + 5)))}.
          </span>
        </div>
      ) : (
        <SignTermForm memberId={member.id} />
      )}
    </main>
  );
}
