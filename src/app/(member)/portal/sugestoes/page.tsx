import { CabecalhoAluno } from "@/components/member/cabecalho-aluno";
import { MessageSquareText } from "lucide-react";
import { redirect } from "next/navigation";
import { CaixaSugestoes } from "@/components/member/caixa-sugestoes";
import { getAuthenticatedMember } from "@/lib/auth";
import { minhasSugestoes, opcoesDeContexto } from "@/lib/sugestoes";
import { ehCategoria } from "@/lib/sugestoes-comum";

export const dynamic = "force-dynamic";

/** Caixa de sugestões do aluno (pedido do usuário 10/11/2026): enviar, por categoria, e acompanhar as respostas. */
export default async function SugestoesPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/portal/sugestoes");
  const sp = await props.searchParams;
  const inicial = ehCategoria(sp.categoria) ? sp.categoria : null;
  const [minhas, opcoes] = await Promise.all([minhasSugestoes(member.id), opcoesDeContexto(member)]);

  return (
    <main className="mx-auto flex min-h-screen w-full min-w-0 max-w-xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      <CabecalhoAluno icone={<MessageSquareText />} titulo="Sugestões" descricao="Uma ideia, um elogio ou algo que não está funcionando. O que for sobre o Portal vai para a equipe que cuida do sistema; o que for sobre a escola, para a direção da sua filial." />
      <CaixaSugestoes inicial={inicial} minhas={minhas} opcoes={opcoes} />
    </main>
  );
}
