import { CabecalhoAluno } from "@/components/member/cabecalho-aluno";
import { AnotacoesCliente } from "@/components/estudos/anotacoes-cliente";
import { carregarAnotacoes } from "@/lib/anotacoes";
import { fusoDaEscola } from "@/lib/atendimentos";
import { getAuthenticatedMember } from "@/lib/auth";
import { NotebookPen } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Anotações das aulas (2026-10-29), aberto pela Área de Estudos. */
export default async function AnotacoesPage(props: { searchParams: Promise<{ materia?: string; tema?: string; tipo?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/estudos/anotacoes");
  const { materia, tema, tipo } = await props.searchParams;
  const dados = await carregarAnotacoes(member, { sigla: materia, tema, tipo });
  return (
    <main className="mx-auto flex min-h-screen w-full min-w-0 max-w-xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      <CabecalhoAluno icone={<NotebookPen />} titulo="Anotações das aulas" descricao="Anote cada tema, resuma para a prova e compartilhe se quiser." />
      <AnotacoesCliente key={`${dados.escolha?.sigla}|${dados.escolha?.tema}`} d={dados} fuso={fusoDaEscola(member.school.uf)} />
    </main>
  );
}
