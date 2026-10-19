import { NavTrabalho } from "@/components/trabalho/nav-trabalho";
import { destinosDaPessoa } from "@/lib/area-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Moldura da Área do Voluntário: menu com só o que a pessoa pode ver e o
 * conteúdo da página ao lado (computador) ou abaixo da barra (celular).
 * `largura`: "estreita" para formulários, "larga" para painéis.
 */
export async function ShellTrabalho({ children, largura = "larga", ativo }: { children: React.ReactNode; largura?: "estreita" | "larga"; ativo?: string }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario");
  const destinos = await destinosDaPessoa(member);
  if (!destinos.length) redirect("/portal");
  return (
    <div className="min-h-screen bg-na-bg dark:bg-gray-950">
      <div className="mx-auto lg:grid lg:max-w-[1440px] lg:grid-cols-[256px_minmax(0,1fr)]">
        <NavTrabalho destinos={destinos} nome={member.name} filial={member.school.name.replace(/^Nova Acrópole\s*-\s*/i, "")} forcado={ativo} />
        <main className={`mx-auto flex w-full flex-col gap-6 p-4 lg:p-8 ${largura === "estreita" ? "max-w-2xl" : "max-w-6xl"}`}>{children}</main>
      </div>
    </div>
  );
}
