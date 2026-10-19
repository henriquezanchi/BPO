import { AdminFilialPanel } from "@/components/admin/admin-filial-panel";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { ehDirecaoDaFilial, filiaisAdministradas, recursosDaFilial, RECURSOS } from "@/lib/recursos-filial";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Administração da filial no Portal (pedido do usuário 2026-10-19): liga e
 * desliga recursos do Portal do Aluno e — só Chefe/Sub-Chefe — escolhe quem
 * mais administra. Toda ação é reconferida no servidor.
 */
export default async function AdminFilialPage(props: { searchParams: Promise<{ filial?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/admin");
  const ids = await filiaisAdministradas(member);
  if (!ids.length) redirect("/portal");

  const escolas = await db.school.findMany({ where: { id: { in: ids } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const { filial } = await props.searchParams;
  const escola = escolas.find((e) => e.id === filial) ?? escolas.find((e) => e.id === member.schoolId) ?? escolas[0];

  const [recursos, admins, direcao, pessoas] = await Promise.all([
    recursosDaFilial(escola.id),
    db.administradorFilial.findMany({ where: { schoolId: escola.id }, orderBy: { criadoEm: "asc" } }),
    ehDirecaoDaFilial(member, escola.id),
    db.member.findMany({ where: { schoolId: escola.id, mercurioAtivo: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const nomes = new Map(pessoas.map((p) => [p.id, p.name]));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Portal do Aluno
        </Link>
        <ThemeToggle />
      </div>
      <div>
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Administração da filial</h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          O que aparece para os alunos no Portal. Tudo começa desligado; ligue quando o recurso estiver pronto para uso na filial.
        </p>
      </div>
      {escolas.length > 1 && (
        <nav className="flex flex-wrap gap-1.5">
          {escolas.map((e) => (
            <Link
              key={e.id}
              href={`/admin?filial=${e.id}`}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                e.id === escola.id ? "border-na-green bg-na-green/10 text-na-green-dark dark:text-emerald-400" : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400"
              }`}
            >
              {e.name.replace(/^Nova Acrópole\s*-\s*/i, "")}
            </Link>
          ))}
        </nav>
      )}
      <AdminFilialPanel
        key={escola.id}
        schoolId={escola.id}
        recursos={Object.entries(RECURSOS).map(([chave, r]) => ({ chave, nome: r.nome, descricao: r.descricao, ativo: recursos[chave as keyof typeof RECURSOS] }))}
        admins={admins.map((a) => ({ memberId: a.memberId, nome: nomes.get(a.memberId) ?? "(fora da filial)" }))}
        podeEscolherAdmins={direcao}
        pessoas={pessoas.filter((p) => p.id !== member.id)}
      />
    </main>
  );
}
