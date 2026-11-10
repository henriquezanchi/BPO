import { getAuthenticatedMember } from "@/lib/auth";
import { podeGerirAvaliacao } from "@/lib/avaliacao";
import { lerPerguntas } from "@/lib/avaliacao-comum";
import { nomeDoArquivo, planilhaDaRodada } from "@/lib/avaliacao-planilha";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Planilha de uma rodada (lib/avaliacao-planilha.ts): só para quem gere a avaliação da filial. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const member = await getAuthenticatedMember();
  if (!member) return new Response("Entre no Portal.", { status: 401 });
  const campanha = await db.avaliacaoCampanha.findUnique({ where: { id }, select: { schoolId: true, titulo: true, perguntas: true } });
  if (!campanha || !(await podeGerirAvaliacao(member, campanha.schoolId))) return new Response("Não encontrada.", { status: 404 });
  const respostas = await db.avaliacaoResposta.findMany({
    where: { campanhaId: id },
    // Ordem que não revela quando cada um respondeu: por parte, turma e instrutor.
    orderBy: [{ parte: "desc" }, { turmaNome: "asc" }, { instrutorNome: "asc" }, { id: "asc" }],
    select: { parte: true, turmaNome: true, instrutorNome: true, materias: true, respostas: true },
  });
  const csv = planilhaDaRodada(campanha.titulo, lerPerguntas(campanha.perguntas), respostas);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeDoArquivo(campanha.titulo)}"`,
      "Cache-Control": "no-store",
    },
  });
}
