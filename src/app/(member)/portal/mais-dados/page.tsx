import { MaisDadosClient } from "@/components/member/mais-dados-client";
import { getAuthenticatedMember } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MaisDadosPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/portal/mais-dados");

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
