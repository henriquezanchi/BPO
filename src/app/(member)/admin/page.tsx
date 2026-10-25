import { AdminFilialPanel } from "@/components/admin/admin-filial-panel";
import { AcessosSubchefe } from "@/components/admin/acessos-subchefe";
import { SenhasAdmin } from "@/components/admin/senhas-admin";
import { ehAdministradorNacional, escolasChefiadas } from "@/lib/acesso-voluntario";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { ehDirecaoDaFilial, filiaisAdministradas, recursosDaFilial, RECURSOS } from "@/lib/recursos-filial";
import { AbasAdmin } from "@/components/admin/abas-admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Secretarias e GAF têm páginas próprias (/secretarias, /grupos); Liberar acessos é a outra aba (AbasAdmin).
const ABAS = [
  { id: "recursos", rotulo: "Recursos e administradores", descricao: "O que aparece para os alunos no Portal, quem mais administra a filial e senhas esquecidas." },
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
  // Secretarias e GAF passaram para Grupos (pedido do usuário 2026-10-25: criação de grupos num lugar só).
  if (abaPedida === "secretarias") redirect(`/secretarias${filial ? `?filial=${filial}` : ""}`);
  if (abaPedida === "gaf") redirect(`/grupos?aba=gaf${filial ? `&filial=${filial}` : ""}`);
  const aba: Aba = ABAS.some((a) => a.id === abaPedida) ? (abaPedida as Aba) : "recursos";
  const abaInfo = ABAS.find((a) => a.id === aba)!;
  // Secretarias e GAF abrem em Grupos, na mesma filial.
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
    // Só o chefe (ou quem chefia a filial) retira acessos do sub-chefe.
    const chefe = (member.schoolId === escola.id && member.isDiretor) || (await escolasChefiadas(member)).includes(escola.id);
    const subchefes = chefe
      ? await Promise.all(
          (await db.member.findMany({ where: { schoolId: escola.id, isSubChefe: true, mercurioAtivo: true }, select: { id: true, name: true } })).map(async (s) => ({
            id: s.id,
            nome: s.name,
            retiradas: (await db.acessoRetiradoSubchefe.findMany({ where: { schoolId: escola.id, memberId: s.id }, select: { area: true } })).map((r) => r.area),
          })),
        )
      : [];
    conteudo = (
      <div className="flex max-w-2xl flex-col gap-3">
        <AdminFilialPanel
          key={escola.id}
          schoolId={escola.id}
          recursos={Object.entries(RECURSOS).map(([chave, r]) => ({ chave, nome: r.nome, descricao: r.descricao, ativo: recursos[chave as keyof typeof RECURSOS] }))}
          admins={admins.map((a) => ({ memberId: a.memberId, nome: nomes.get(a.memberId) ?? "(fora da filial)" }))}
          podeEscolherAdmins={direcao}
          pessoas={pessoas.filter((p) => p.id !== member.id)}
        />
        {chefe && <AcessosSubchefe schoolId={escola.id} subchefes={subchefes} />}
        <SenhasAdmin pessoas={pessoas} />
      </div>
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
        <AbasAdmin atual="recursos" filial={escolas.length > 1 ? escola.id : undefined} acessos={member.isDiretor || member.isSubChefe || member.filiaisChefiadas.length > 0 || (await ehAdministradorNacional(member))} />
        <p className="text-[13px] text-gray-500 dark:text-gray-400">{abaInfo.descricao}</p>
      </header>
      {conteudo}
    </ShellTrabalho>
  );
}
