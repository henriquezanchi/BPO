import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { SignTermForm } from "@/components/member/volunteer/sign-term-form";
import { formatDateBR, formatDateTimeBR } from "@/lib/format";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { montarTermo, termoVigente } from "@/lib/volunteer-term";
import { CheckCircle2 } from "lucide-react";
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
    <ShellTrabalho largura="estreita">
      <div>
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Termo de Adesão ao Serviço Voluntário</h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Dados vindos do seu cadastro na escola. Se algo estiver errado, peça à secretaria pra corrigir antes de assinar. O termo vale por 5 anos e precisa ser assinado de novo se você mudar de filial.
        </p>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs whitespace-pre-wrap text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        {texto}
      </div>

      <section className="space-y-2 rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-700">
        <CollapsibleSection title={<h2 className="font-bold text-na-green-dark dark:text-na-green-light">Assinatura pelo gov.br</h2>}>
        <p>Para o fluxo orientado pela escola, o mesmo PDF deve receber as assinaturas do voluntário, do representante legal e das duas testemunhas, uma pessoa por vez. Após cada assinatura, confira o arquivo no validador do ITI e preserve a versão assinada.</p>
        <p>Não imprima e gere outro PDF entre as assinaturas. O aceite abaixo não conclui esse processo e o Portal ainda não recebe o arquivo assinado nem valida assinaturas gov.br.</p>
        <a href="https://validar.iti.gov.br/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-na-green-dark dark:text-na-green-light">Abrir validador do ITI</a>
      </CollapsibleSection></section>
      {signature ? (
        <div className="flex items-center gap-2 rounded-xl border border-na-success/40 bg-na-success-light p-4 text-sm text-na-success-dark dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>
            Concordância registrada por <strong>{signature.signedName}</strong> em {formatDateTimeBR(signature.signedAt)}. Renovação prevista para {formatDateBR(new Date(new Date(signature.signedAt).setFullYear(signature.signedAt.getFullYear() + 5)))}.
          </span>
        </div>
      ) : (
        <SignTermForm memberId={member.id} />
      )}
    </ShellTrabalho>
  );
}
