import { CartaoGrupo, EstudosAdmin, GafAdmin, PedagogosAdmin } from "@/components/admin/grupos-admin";
import { CriarGdve } from "@/components/member/volunteer/criar-gdve";
import { AbasArea } from "@/components/trabalho/areas";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { temAcessoVoluntario } from "@/lib/acesso-voluntario";
import type { AbaEscolastica } from "@/lib/abas-escolastica";
import { destinosDaPessoa } from "@/lib/area-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { gruposDaFilial, meusGrupos, type ResumoGrupo } from "@/lib/grupos-dados";
import { ehFV, podeCriarEstudo, podeCriarTurmaPedagogos } from "@/lib/grupos-portal";
import { filiaisAdministradas } from "@/lib/recursos-filial";
import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const SECOES: { titulo: string; tipos: ResumoGrupo["tipo"][] }[] = [
  { titulo: "GAF", tipos: ["GAF"] },
  { titulo: "Grupos de estudo e leituras", tipos: ["ESTUDO", "LEITURA"] },
  { titulo: "Turmas de pedagogos", tipos: ["PED"] },
  { titulo: "Grupos de FV", tipos: ["BF", "BM", "CS"] },
  { titulo: "GDVE", tipos: ["GDVE"] },
];

/**
 * Grupos num lugar só (pedido do usuário 2026-10-25: "a criação de grupos está em lugares diferentes").
 * "Meus grupos" para todos; a administração da filial cria e acompanha GAF aqui (antes em Administração),
 * instrutores criam estudos e leituras, FV cria GDVE (antes no Início). Grupos de FV e turmas vêm do
 * Mercúrio. Secretarias ficam à parte, em /secretarias (pedido do usuário 2026-10-25: "divida grupos e secretarias").
 */
export default async function GruposPage(props: { searchParams: Promise<{ aba?: string; filial?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/grupos");
  const [acesso, fv, meus, administradas, destinos] = await Promise.all([
    temAcessoVoluntario(member),
    ehFV(member.id),
    meusGrupos(member),
    filiaisAdministradas(member),
    destinosDaPessoa(member),
  ]);
  if (!destinos.length) redirect("/portal");

  const { aba: abaPedida, filial } = await props.searchParams;
  const escolas = administradas.length
    ? await db.school.findMany({ where: { id: { in: administradas } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  const escola = escolas.find((e) => e.id === filial) ?? escolas.find((e) => e.id === member.schoolId) ?? escolas[0];
  const podeGdve = fv && acesso;
  // Estudo e leitura: na filial escolhida (administração) ou na própria (instrutor, Escolástica).
  const escolaEstudo = escola?.id ?? member.schoolId;
  const podeEstudo = await podeCriarEstudo(member, escolaEstudo);
  const podePedagogos = await podeCriarTurmaPedagogos(member, escolaEstudo);
  const sufixo = escola && escolas.length > 1 ? `&filial=${escola.id}` : "";
  const abas: AbaEscolastica[] = [
    ["meus", "Meus grupos", `/grupos?aba=meus${sufixo}`],
    ...(escola
      ? ([
          ["gaf", "GAF da filial", `/grupos?aba=gaf${sufixo}`],
        ] as AbaEscolastica[])
      : []),
    ...(podeEstudo ? ([["estudos", "Estudo e leitura", `/grupos?aba=estudos${sufixo}`]] as AbaEscolastica[]) : []),
    ...(podePedagogos ? ([["pedagogos", "Turmas de pedagogos", `/grupos?aba=pedagogos${sufixo}`]] as AbaEscolastica[]) : []),
    ...(podeGdve ? ([["gdve", "GDVE", `/grupos?aba=gdve${sufixo}`]] as AbaEscolastica[]) : []),
  ];
  const aba = abas.some(([id]) => id === abaPedida) ? abaPedida! : "meus";
  const nomeEscola = (n: string) => n.replace(/^Nova Acrópole\s*-\s*/i, "");

  // O que a pessoa pode criar, com o caminho de cada um (um só "Criar grupo").
  const criar = [
    escola && { rotulo: "GAF", href: `/grupos?aba=gaf${sufixo}`, ajuda: "Grupo de Acompanhamento Filosófico" },
    podeEstudo && { rotulo: "Grupo de estudo", href: `/grupos?aba=estudos${sufixo}`, ajuda: "Estudo de uma obra ou tema, aberto a alunos" },
    podeEstudo && { rotulo: "Leitura comentada", href: `/grupos?aba=estudos${sufixo}`, ajuda: "Leitura conduzida de um texto" },
    podePedagogos && { rotulo: "Turma de pedagogos", href: `/grupos?aba=pedagogos${sufixo}`, ajuda: "Escala de apresentações e planos de aula" },
    podeGdve && { rotulo: "GDVE", href: `/grupos?aba=gdve${sufixo}`, ajuda: "Só para FV" },
  ].filter(Boolean) as { rotulo: string; href: string; ajuda: string }[];

  let conteudo: React.ReactNode;
  if (abaPedida === "secretarias") redirect(`/secretarias${escola && escolas.length > 1 ? `?filial=${escola.id}` : ""}`);
  if (aba === "gaf" && escola) {
    const [grupos, pedidos] = await Promise.all([
      gruposDaFilial(escola.id, "GAF"),
      db.gafRequest.findMany({
        where: { member: { schoolId: escola.id, mercurioAtivo: true } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { createdAt: true, classGroup: { select: { name: true } }, member: { select: { name: true, isMembroPrograma: true } } },
      }),
    ]);
    conteudo = <GafAdmin key={escola.id} schoolId={escola.id} grupos={grupos} pedidos={pedidos.map((p) => ({ nome: p.member.name, em: p.createdAt.toISOString(), nivelMembro: p.member.isMembroPrograma, gaf: p.classGroup?.name ?? null }))} />;
  } else if (aba === "estudos" && podeEstudo) {
    conteudo = <EstudosAdmin key={escolaEstudo} schoolId={escolaEstudo} grupos={await gruposDaFilial(escolaEstudo, ["ESTUDO", "LEITURA"])} />;
  } else if (aba === "pedagogos" && podePedagogos) {
    conteudo = <PedagogosAdmin key={escolaEstudo} schoolId={escolaEstudo} grupos={await gruposDaFilial(escolaEstudo, "PED")} />;
  } else if (aba === "gdve" && podeGdve) {
    const gdves = meus.filter((g) => g.tipo === "GDVE");
    conteudo = (
      <div className="flex flex-col gap-4">
        <CriarGdve schoolId={member.schoolId} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {gdves.map((g) => (
            <CartaoGrupo key={g.id} g={g} de="voluntario" etiqueta={g.papel === "responsavel" ? "Responsável" : "Integrante"} />
          ))}
        </div>
      </div>
    );
  } else {
    const secoes = SECOES.map((s) => ({ ...s, grupos: meus.filter((g) => s.tipos.includes(g.tipo)) })).filter((s) => s.grupos.length > 0);
    conteudo = (
      <div className="flex flex-col gap-6">
        {criar.length > 0 && (
          <section className="flex flex-col gap-2 rounded-2xl border border-dashed border-na-green/50 bg-white p-4 dark:bg-gray-900">
            <p className="flex items-center gap-2 text-[14px] font-bold text-gray-900 dark:text-gray-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-na-green text-white">
                <Plus size={16} />
              </span>
              Criar grupo
            </p>
            <div className="flex flex-wrap gap-2">
              {criar.map((c) => (
                <Link key={c.rotulo} href={c.href} className="rounded-xl border border-gray-200 px-3 py-2 text-left transition hover:border-na-green dark:border-gray-700">
                  <span className="block text-[13px] font-semibold text-na-green-dark dark:text-emerald-400">{c.rotulo}</span>
                  <span className="block text-[11px] text-gray-500 dark:text-gray-400">{c.ajuda}</span>
                </Link>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Turmas e grupos de FV vêm do Mercúrio.</p>
          </section>
        )}
        {secoes.length === 0 && (
          <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-[13px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
            {acesso ? "Você ainda não faz parte de nenhum grupo ou secretaria." : "Seus grupos aparecem aqui depois que o responsável liberar seu acesso à área de voluntários."}
          </p>
        )}
        {secoes.map((s) => (
          <section key={s.titulo} className="flex flex-col gap-3">
            <h2 className="text-[12px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">{s.titulo}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {s.grupos.map((g) => (
                <CartaoGrupo key={g.id} g={g} de="voluntario" etiqueta={g.papel === "responsavel" ? "Responsável" : "Integrante"} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Grupos</h1>
      <AbasArea base="/grupos" atual={aba} abas={abas} />
      {(aba === "gaf" || aba === "estudos" || aba === "pedagogos") && escolas.length > 1 && (
        <nav className="flex flex-wrap gap-1.5" aria-label="Filial">
          {escolas.map((e) => (
            <Link
              key={e.id}
              href={`/grupos?aba=${aba}&filial=${e.id}`}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                e.id === escola?.id ? "border-na-green bg-na-green/10 text-na-green-dark dark:text-emerald-400" : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400"
              }`}
            >
              {nomeEscola(e.name)}
            </Link>
          ))}
        </nav>
      )}
      {conteudo}
    </ShellTrabalho>
  );
}
