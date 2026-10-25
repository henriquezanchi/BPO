import { CartaoGrupo, SecretariasAdmin } from "@/components/admin/grupos-admin";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { destinosDaPessoa } from "@/lib/area-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { gruposDaFilial, meusGrupos } from "@/lib/grupos-dados";
import { filiaisAdministradas } from "@/lib/recursos-filial";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Secretarias da filial, separadas de Grupos (pedido do usuário 2026-10-25). A administração da filial
 * cria e acompanha todas (com as sugestões do Mercúrio); as demais pessoas veem as secretarias de que
 * participam. Cada secretaria abre em /grupos/[id] (equipe, atividades, encontros, orientações).
 */
export default async function SecretariasPage(props: { searchParams: Promise<{ filial?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/secretarias");
  const [administradas, minhas, destinos] = await Promise.all([filiaisAdministradas(member), meusGrupos(member, ["SEC"]), destinosDaPessoa(member)]);
  if (!destinos.length) redirect("/portal");

  const { filial } = await props.searchParams;
  const escolas = administradas.length
    ? await db.school.findMany({ where: { id: { in: administradas } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  const escola = escolas.find((e) => e.id === filial) ?? escolas.find((e) => e.id === member.schoolId) ?? escolas[0];
  const nomeEscola = (n: string) => n.replace(/^Nova Acrópole\s*-\s*/i, "");

  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Secretarias</h1>
      {escola ? (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">Secretarias da filial, com responsáveis, equipe de voluntários, atividades e encontros.</p>
          {escolas.length > 1 && (
            <nav className="flex flex-wrap gap-1.5" aria-label="Filial">
              {escolas.map((e) => (
                <Link
                  key={e.id}
                  href={`/secretarias?filial=${e.id}`}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                    e.id === escola.id ? "border-na-green bg-na-green/10 text-na-green-dark dark:text-emerald-400" : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400"
                  }`}
                >
                  {nomeEscola(e.name)}
                </Link>
              ))}
            </nav>
          )}
          <SecretariasAdmin key={escola.id} schoolId={escola.id} grupos={await gruposDaFilial(escola.id, "SEC")} />
        </>
      ) : minhas.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {minhas.map((g) => (
            <CartaoGrupo key={g.id} g={g} de="voluntario" etiqueta={g.papel === "responsavel" ? "Responsável" : "Equipe"} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-[13px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Você ainda não faz parte de nenhuma secretaria da filial.
        </p>
      )}
    </ShellTrabalho>
  );
}
