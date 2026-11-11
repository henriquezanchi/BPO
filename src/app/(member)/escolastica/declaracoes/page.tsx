import { GeradorDeclaracoes } from "@/components/escolastica/declaracoes";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { AbasEscolastica } from "@/components/escolastica/abas-escolastica";
import { exigirArea } from "@/lib/area-trabalho";
import { db } from "@/lib/db";
import { finalidadeDoPedido, TIPO_PEDIDO_DECLARACAO } from "@/lib/declaracoes/pedidos";


export const dynamic = "force-dynamic";

/** Declarações de matrícula, instrução, voluntariado e cursos, com os dados do Mercúrio (pedido do usuário 02/11/2026). */
export default async function DeclaracoesPage(props: { searchParams: Promise<{ pedido?: string }> }) {
  const member = await exigirArea("escolastica", "/escolastica/declaracoes");
  // Pedido feito pelo próprio aluno (06/11/2026): o gerador abre com a pessoa e a finalidade; ao entregar, conclui.
  const { pedido: pedidoId } = await props.searchParams;
  const pedido = pedidoId
    ? await db.scholasticPendency.findFirst({ where: { id: pedidoId, schoolId: member.schoolId, tipo: TIPO_PEDIDO_DECLARACAO, completedAt: null }, select: { id: true, memberId: true, notes: true } })
    : null;
  const pessoas = await db.member.findMany({
    where: { schoolId: member.schoolId, mercurioAtivo: true, mercurioId: { not: null } },
    select: { id: true, name: true, mercurioId: true },
    orderBy: { name: "asc" },
  });
  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400 print:hidden">Escolástica</h1>
      <div className="print:hidden">
        <AbasEscolastica atual="declaracoes" />
      </div>
      <GeradorDeclaracoes
        schoolId={member.schoolId}
        pessoas={pessoas.map((p) => ({ id: p.id, nome: p.name, matricula: p.mercurioId! }))}
        pedido={pedido?.memberId ? { id: pedido.id, pessoaId: pedido.memberId, finalidade: finalidadeDoPedido(pedido.notes) } : null}
      />
    </ShellTrabalho>
  );
}
