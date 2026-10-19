import { AdminFilialPanel } from "@/components/admin/admin-filial-panel";
import { GafAdmin, SecretariasAdmin } from "@/components/admin/grupos-admin";
import { SenhasAdmin } from "@/components/admin/senhas-admin";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { gruposDaFilial } from "@/lib/grupos-dados";
import { ehDirecaoDaFilial, filiaisAdministradas, recursosDaFilial, RECURSOS } from "@/lib/recursos-filial";
import { Building2, Settings, Sparkles } from "lucide-react";
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
    <ShellTrabalho>
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Administração</h1>
          {escolas.length === 1 && <p className="text-xs text-gray-500 dark:text-gray-400">{nomeEscola(escola.name)}</p>}
        </div>
        {escolas.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {escolas.map((e) => (
              <Link
                key={e.id}
                href={link(aba, e.id)}
                className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold ${
                  e.id === escola.id ? "border-na-green bg-na-green/10 text-na-green-dark dark:text-emerald-400" : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400"
                }`}
              >
                {nomeEscola(e.name)}
              </Link>
            ))}
          </div>
        )}
        <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 lg:mx-0 lg:px-0 dark:border-gray-800" aria-label="Seções da Administração">
          {ABAS.map((a) => (
            <Link
              key={a.id}
              href={link(a.id)}
              aria-current={aba === a.id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-semibold ${
                aba === a.id ? "border-na-green text-na-green-dark dark:text-emerald-400" : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
              }`}
            >
              <a.icone size={15} /> {a.rotulo}
            </Link>
          ))}
        </nav>
        <p className="text-[13px] text-gray-500 dark:text-gray-400">{abaInfo.descricao}</p>
      </header>
      {conteudo}
    </ShellTrabalho>
  );
}
