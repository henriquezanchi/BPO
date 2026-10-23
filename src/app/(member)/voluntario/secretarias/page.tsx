import { SecretariasRede } from "@/components/secretarias-rede/secretarias-rede";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { carregarBibliotecaSecretarias } from "@/lib/secretarias-rede/dados";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SecretariasRedePage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario/secretarias");
  if (!member.mercurioAtivo) redirect("/portal");
  const data = await carregarBibliotecaSecretarias(member);
  const podeAcessarEscalas = data.escalas.length > 0 || (data.escolasEscala.length > 0 && (data.podeGerirEscalaLivre || data.secretariasEscala.length > 0));
  if (!data.publicacoes.length && !data.secretariasPublicaveis.length && !data.podeGerirMandatos && !podeAcessarEscalas) redirect("/voluntario");

  return (
    <ShellTrabalho>
      <SecretariasRede data={data} />
    </ShellTrabalho>
  );
}

