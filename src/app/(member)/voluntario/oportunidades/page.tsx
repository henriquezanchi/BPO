import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { OportunidadesGestao } from "@/components/member/volunteer/oportunidades-gestao";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { estaAberta, gestaoDeOportunidades, gruposVinculaveis, hojeDaFilial, ofertasPorArea, responsaveisPossiveis } from "@/lib/oportunidades";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Oportunidades de voluntariado (pedido do usuário 2026-10-29): a Direção vê e gere todas as da filial; o
 * responsável de uma secretaria ou grupo, as que criou ou de que é responsável. Aqui chegam os interessados.
 */
export default async function OportunidadesPage(props: { searchParams: Promise<{ filial?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario/oportunidades");
  const g = await gestaoDeOportunidades(member);
  const souResponsavel = (await db.oportunidadeVoluntariado.count({ where: { responsavelId: member.id } })) > 0;
  if (!g.podeCadastrar && !souResponsavel) redirect("/voluntario");

  const { filial: pedida } = await props.searchParams;
  const filial =
    pedida && g.escolas.includes(pedida) ? pedida : g.escolas.includes(member.schoolId) || g.responsavel || souResponsavel ? member.schoolId : g.escolas[0];
  const direcao = g.escolas.includes(filial);
  const podeCadastrar = direcao || (g.responsavel && filial === member.schoolId);

  const [escola, escolas, lista, grupos, responsaveis, ofertas] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: filial }, select: { name: true, uf: true } }),
    g.escolas.length > 1 ? db.school.findMany({ where: { id: { in: g.escolas } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    db.oportunidadeVoluntariado.findMany({
      where: { schoolId: filial, ...(direcao ? {} : { OR: [{ responsavelId: member.id }, { criadoPorId: member.id }] }) },
      include: {
        responsavel: { select: { name: true } },
        interesses: { include: { member: { select: { name: true, whatsapp: true, nivel: true } } }, orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    }),
    podeCadastrar ? gruposVinculaveis(member, g, filial) : [],
    podeCadastrar ? responsaveisPossiveis(member, g, filial) : [],
    direcao ? ofertasPorArea(filial) : [],
  ]);
  const hoje = hojeDaFilial(escola.uf);
  const vistas = new Set<string>();
  const ofertasRecentes = ofertas.filter((o) => !vistas.has(o.memberId) && vistas.add(o.memberId));

  const oportunidades = lista
    .map((op) => ({
      id: op.id,
      titulo: op.titulo,
      area: op.area,
      descricao: op.descricao,
      tipo: op.tipo as "pontual" | "continua",
      data: op.data,
      horario: op.horario,
      vagas: op.vagas,
      abertaAte: op.abertaAte,
      grupoId: op.grupoId,
      responsavelId: op.responsavelId,
      responsavel: op.responsavel.name,
      aberta: estaAberta(op, hoje),
      encerrada: !!op.encerradaEm,
      interesses: op.interesses
        .filter((i) => i.status !== "desistiu" || i.respondidoEm)
        .map((i) => ({ id: i.id, nome: i.member.name, whatsapp: i.member.whatsapp, nivel: i.member.nivel, recado: i.recado, status: i.status, em: i.createdAt.toISOString() })),
    }))
    // Abertas primeiro (as com data mais próxima antes), depois as encerradas ou vencidas.
    .sort((a, b) => Number(b.aberta) - Number(a.aberta) || (a.data ?? "9999").localeCompare(b.data ?? "9999"));

  return (
    <ShellTrabalho>
      <div className="max-w-3xl">
        <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Oportunidades de voluntariado</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {direcao
            ? `Cadastre o que ${escola.name.replace(/^Nova Acrópole - /, "")} precisa. Os membros veem no quadro Voluntariado do Portal e se oferecem; o responsável de cada oportunidade recebe um aviso e responde aqui.`
            : "Cadastre o que a sua secretaria ou grupo precisa. Os membros veem no quadro Voluntariado do Portal e se oferecem; você recebe um aviso e responde aqui."}
        </p>
      </div>
      <OportunidadesGestao
        schoolId={filial}
        escolas={escolas}
        hoje={hoje}
        podeCadastrar={podeCadastrar}
        euId={member.id}
        oportunidades={oportunidades}
        grupos={grupos}
        responsaveis={responsaveis}
        ofertas={ofertasRecentes.map((o) => ({ id: o.id, nome: o.member.name, whatsapp: o.member.whatsapp, secretarias: o.secretarias, em: o.createdAt.toISOString() }))}
        mostrarOfertas={direcao}
      />
    </ShellTrabalho>
  );
}
