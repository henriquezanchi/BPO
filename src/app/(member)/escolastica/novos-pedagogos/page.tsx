import { AbasEscolastica } from "@/components/escolastica/abas-escolastica";
import { NovosPedagogos } from "@/components/escolastica/novos-pedagogos";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { acessoNovosPedagogos, candidatosAPedagogo, equipeQueAtende, listarPedidosPedagogo, temAcessoNovosPedagogos } from "@/lib/solicitacoes-pedagogo";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Novos pedagogos (pedido do usuário 11/11/2026): o Chefe e o Sub-Chefe pedem a inclusão de uma ou mais pessoas da filial
 * como pedagogos no Mercúrio; o responsável nacional (Giordano Bruno) autoriza, ou quem ele delegar. Regras em
 * lib/solicitacoes-pedagogo.ts.
 */
export default async function NovosPedagogosPage(props: { searchParams: Promise<{ filial?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/escolastica/novos-pedagogos");
  const acesso = await acessoNovosPedagogos(member);
  if (!temAcessoNovosPedagogos(acesso)) redirect("/escolastica");

  // Filiais em que a pessoa pede (o formulário vale para a escolhida); quem decide vê os pedidos de todas.
  const escolas = await db.school.findMany({ where: { id: { in: acesso.escolas } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const { filial } = await props.searchParams;
  const escola = escolas.find((e) => e.id === filial) ?? escolas.find((e) => e.id === member.schoolId) ?? escolas[0];
  const todas = acesso.veTodas ? (await db.school.findMany({ select: { id: true } })).map((s) => s.id) : acesso.escolas;

  const [pedidos, candidatos, equipe] = await Promise.all([
    listarPedidosPedagogo(todas),
    escola ? candidatosAPedagogo(escola.id) : Promise.resolve([]),
    acesso.gereIndicados ? equipeQueAtende() : Promise.resolve(null),
  ]);

  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Escolástica</h1>
      <AbasEscolastica atual="novos-pedagogos" />
      <p className="max-w-3xl text-sm text-gray-500 dark:text-gray-400">
        O Chefe e o Sub-Chefe da filial pedem aqui a inclusão de novos pedagogos no Mercúrio, uma ou várias pessoas por pedido. O responsável nacional pelos
        pedagogos autoriza; quando a pessoa passa a aparecer como pedagogo na importação do Mercúrio, o pedido se fecha sozinho.
      </p>
      {escolas.length > 1 && (
        <nav className="-mt-2 flex flex-wrap gap-1.5" aria-label="Filial do pedido">
          {escolas.map((e) => (
            <Link
              key={e.id}
              href={`/escolastica/novos-pedagogos?filial=${e.id}`}
              aria-current={e.id === escola?.id ? "page" : undefined}
              className={`flex min-h-9 items-center rounded-full border px-3 text-[12px] font-semibold ${
                e.id === escola?.id ? "border-na-green bg-na-green text-white" : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {e.name.replace(/^Nova Acrópole\s*-\s*/i, "")}
            </Link>
          ))}
        </nav>
      )}
      <NovosPedagogos
        schoolId={escola?.id ?? member.schoolId}
        podePedir={!!escola}
        decide={acesso.nacional}
        candidatos={candidatos}
        pedidos={pedidos}
        escolasQuePede={acesso.escolas}
        variasFiliais={todas.length > 1}
        indicados={equipe?.indicados ?? []}
        gereIndicados={acesso.gereIndicados}
      />
    </ShellTrabalho>
  );
}
