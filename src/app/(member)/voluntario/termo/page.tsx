import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { montarTermo } from "@/lib/volunteer-term";
import { FileSignature } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Termo de Adesão ao Serviço Voluntário (decisão de 30/10/2026, com a direção nacional do Instituto Maat): o termo só
 * vale juridicamente assinado no gov.br ou em papel com 2 testemunhas, e validadores externos custam caro. O Portal
 * não colhe assinatura: orienta a procurar a secretaria ou a Direção da filial e mostra o texto para conhecer.
 */
export default async function VolunteerTermPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario/termo");

  const school = await db.school.findUniqueOrThrow({ where: { id: member.schoolId }, select: { name: true, cnpj: true } });
  const texto = montarTermo(member, school, null);

  return (
    <ShellTrabalho largura="estreita">
      <div>
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Termo de Adesão ao Serviço Voluntário</h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Todo voluntário assina o termo com a escola. Ele vale por 5 anos e precisa ser assinado de novo se você mudar de filial.</p>
      </div>

      <section className="flex items-start gap-3 rounded-2xl border border-na-green/30 bg-na-green-light/40 p-4 text-sm text-gray-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-gray-200">
        <FileSignature size={20} className="mt-0.5 shrink-0 text-na-green-dark dark:text-emerald-400" />
        <div className="space-y-1.5">
          <p className="font-bold text-na-green-dark dark:text-emerald-300">Como assinar</p>
          <p>
            Procure a <strong>secretaria</strong> ou a <strong>Direção da sua filial</strong>. O termo é assinado em papel, com duas testemunhas, ou pelo gov.br, conforme a filial orientar.
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">O Portal não colhe essa assinatura. Se já assinou na filial, não precisa fazer mais nada.</p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-700">
        <CollapsibleSection title={<h2 className="font-bold text-na-green-dark dark:text-na-green-light">Ler o texto do termo</h2>}>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Preenchido com os dados do seu cadastro. Se algo estiver errado, peça à secretaria para corrigir antes de assinar.</p>
          <div className="max-h-96 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs whitespace-pre-wrap text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">{texto}</div>
        </CollapsibleSection>
      </section>
    </ShellTrabalho>
  );
}
