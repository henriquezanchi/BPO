import { MaisDadosClient } from "@/components/member/mais-dados-client";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MaisDadosPage(props: PageProps<"/portal/mais-dados">) {
  const searchParams = await props.searchParams;
  const memberId = typeof searchParams.memberId === "string" ? searchParams.memberId : undefined;

  if (!memberId) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-gray-500">
        Acesse com <code className="rounded bg-gray-100 px-1.5 py-0.5">?memberId=SEU_ID</code>.
      </main>
    );
  }

  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });

  return (
    <MaisDadosClient
      memberId={member.id}
      birthDate={member.birthDate ? member.birthDate.toISOString().slice(0, 10) : ""}
      naturalidade={member.naturalidade}
      profession={member.profession}
      estadoCivil={member.estadoCivil}
      escolaridade={member.escolaridade}
      rgNumero={member.rgNumero}
      rgOrgaoEmissor={member.rgOrgaoEmissor}
      rgDataEmissao={member.rgDataEmissao ? member.rgDataEmissao.toISOString().slice(0, 10) : ""}
    />
  );
}
