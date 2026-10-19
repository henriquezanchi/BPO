import { AdminFilialPanel } from "@/components/admin/admin-filial-panel";
import { GafAdmin, SecretariasAdmin } from "@/components/admin/grupos-admin";
import { SenhasAdmin } from "@/components/admin/senhas-admin";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { gruposDaFilial } from "@/lib/grupos-dados";
import { ehDirecaoDaFilial, filiaisAdministradas, recursosDaFilial, RECURSOS } from "@/lib/recursos-filial";
import { ArrowLeft, Building2, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ABAS = [
  { id: "secretarias", rotulo: "Secretarias", icone: Building2, descricao: "Secretarias da filial, equipes de voluntários, atividades e reuniões." },
  { id: "gaf", rotulo: "GAF", icone: Sparkles, descricao: "Grupos de Acompanhamento Filosófico: coordenação, participantes, encontros e programa." },
  { id: "recursos", rotulo: "Recursos e administradores", icone: Settings, descricao: "O que aparece para os alunos no Portal, quem mais administra a filial e senhas esquecidas." },
] as const;
type Aba = (typeof ABAS)[number]["id"];

/**
 * Administração da filial no Portal. Pedidos do usuário: recursos e
 * administradores (2026-10-19), secretarias e GAF (2026-10-19, mesma data).
 * No computador: menu lateral; no celular: abas no topo. Toda ação é
 * reconferida no servidor.
 */
export default async function AdminFilialPage(props: { searchParams: Promise<{ filial?: string; aba?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/admin");
  const ids = await filiaisAdministradas(member);
  if (!ids.length) redirect("/portal");

  const escolas = await db.school.findMany({ where: { id: { in: ids } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const { filial, aba: abaPedida } = await props.searchParams;
  const escola = escolas.find((e) => e.id === filial) ?? escolas.find((e) => e.id === member.schoolId) ?? escolas[0];
  const aba: Aba = ABAS.some((a) => a.id === abaPedida) ? (abaPedida as Aba) : "secretarias";
  const abaInfo = ABAS.find((a) => a.id === aba)!;
  const link = (a: Aba, f = escola.id) => `/admin?filial=${f}&aba=${a}`;
  const nomeEscola = (n: string) => n.replace(/^Nova Acrópole\s*-\s*/i, "");

  let conteudo: React.ReactNode;
  if (aba === "recursos") {
    const [recursos, admins, direcao, pessoas] = await Promise.all([
      recursosDaFilial(escola.id),
      db.administradorFilial.findMany({ where: { schoolId: escola.id }, orderBy: { criadoEm: "asc" } }),
      ehDirecaoDaFilial(member, escola.id),
      db.member.findMany({ where: { schoolId: escola.id, mercurioAtivo: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    const nomes = new Map(pessoas.map((p) => [p.id, p.name]));
    conteudo = (
      <div className="flex max-w-2xl flex-col gap-8">
        <AdminFilialPanel
          key={escola.id}
          schoolId={escola.id}
          recursos={Object.entries(RECURSOS).map(([chave, r]) => ({ chave, nome: r.nome, descricao: r.descricao, ativo: recursos[chave as keyof typeof RECURSOS] }))}
          admins={admins.map((a) => ({ memberId: a.memberId, nome: nomes.get(a.memberId) ?? "(fora da filial)" }))}
          podeEscolherAdmins={direcao}
          pessoas={pessoas.filter((p) => p.id !== member.id)}
        />
        <SenhasAdmin pessoas={pessoas} />
      </div>
    );
  } else if (aba === "secretarias") {
    conteudo = <SecretariasAdmin key={escola.id} schoolId={escola.id} grupos={await gruposDaFilial(escola.id, "SEC")} />;
  } else {
    const [grupos, pedidos] = await Promise.all([
      gruposDaFilial(escola.id, "GAF"),
      db.gafRequest.findMany({
        where: { member: { schoolId: escola.id, mercurioAtivo: true } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { createdAt: true, member: { select: { name: true, isMembroPrograma: true } } },
      }),
    ]);
    conteudo = (
      <GafAdmin key={escola.id} schoolId={escola.id} grupos={grupos} pedidos={pedidos.map((p) => ({ nome: p.member.name, em: p.createdAt.toISOString(), nivelMembro: p.member.isMembroPrograma }))} />
    );
  }

  return (
    <div className="min-h-screen bg-na-bg dark:bg-gray-950">
      <div className="mx-auto grid max-w-7xl lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Computador: menu lateral fixo */}
        <aside className="hidden border-r border-gray-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:p-6 dark:border-gray-800">
          <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <ArrowLeft size={14} /> Portal do Aluno
          </Link>
          <div>
            <p className="text-[11px] font-bold tracking-wide text-gray-400 uppercase">Administração</p>
            <p className="mt-0.5 text-sm font-bold text-na-green-dark dark:text-emerald-400">{nomeEscola(escola.name)}</p>
          </div>
          <nav className="flex flex-col gap-0.5">
            {ABAS.map((a) => (
              <Link
                key={a.id}
                href={link(a.id)}
                aria-current={aba === a.id ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold ${aba === a.id ? "bg-na-green text-white" : "text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-900"}`}
              >
                <a.icone size={15} /> {a.rotulo}
              </Link>
            ))}
          </nav>
          {escolas.length > 1 && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold tracking-wide text-gray-400 uppercase">Filiais</p>
              <div className="flex flex-col gap-0.5">
                {escolas.map((e) => (
                  <Link
                    key={e.id}
                    href={link(aba, e.id)}
                    className={`rounded-lg px-3 py-1.5 text-[12px] ${e.id === escola.id ? "font-bold text-na-green-dark dark:text-emerald-400" : "text-gray-600 hover:bg-white dark:text-gray-400 dark:hover:bg-gray-900"}`}
                  >
                    {nomeEscola(e.name)}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="mt-auto">
            <ThemeToggle />
          </div>
        </aside>

        <main className="flex min-w-0 flex-col gap-5 p-4 lg:p-8">
          {/* Celular: cabeçalho e abas no topo */}
          <div className="flex flex-col gap-3 lg:hidden">
            <div className="flex items-center justify-between">
              <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                <ArrowLeft size={14} /> Portal
              </Link>
              <ThemeToggle />
            </div>
            <div>
              <h1 className="text-lg font-black text-na-green-dark dark:text-emerald-400">Administração</h1>
              {escolas.length > 1 ? (
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                  {escolas.map((e) => (
                    <Link
                      key={e.id}
                      href={link(aba, e.id)}
                      className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold ${e.id === escola.id ? "border-na-green bg-na-green/10 text-na-green-dark dark:text-emerald-400" : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400"}`}
                    >
                      {nomeEscola(e.name)}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">{nomeEscola(escola.name)}</p>
              )}
            </div>
            <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 dark:border-gray-800" aria-label="Seções">
              {ABAS.map((a) => (
                <Link
                  key={a.id}
                  href={link(a.id)}
                  aria-current={aba === a.id ? "page" : undefined}
                  className={`shrink-0 border-b-2 px-3 py-2 text-[13px] font-semibold ${aba === a.id ? "border-na-green text-na-green-dark dark:text-emerald-400" : "border-transparent text-gray-500 dark:text-gray-400"}`}
                >
                  {a.id === "recursos" ? "Recursos" : a.rotulo}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden lg:block">
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">{abaInfo.rotulo}</h1>
          </div>
          <p className="-mt-2 text-[13px] text-gray-500 dark:text-gray-400">{abaInfo.descricao}</p>
          {conteudo}
        </main>
      </div>
    </div>
  );
}
