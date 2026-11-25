import { CabecalhoAluno } from "@/components/member/cabecalho-aluno";
import { MarcarAtendimento } from "@/components/atendimentos/marcar-atendimento";
import { fusoDaEscola, horariosDoInstrutor, instrutoresParaAtendimento } from "@/lib/atendimentos";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { CalendarClock } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Conversa individual com o instrutor: o aluno escolhe um horário livre de um instrutor das suas turmas (pedido do usuário 2026-10-25). */
export default async function AtendimentosAlunoPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/atendimentos");
  if (!member.mercurioAtivo) redirect("/portal");

  const [instrutores, minhas] = await Promise.all([
    instrutoresParaAtendimento(member.id),
    db.atendimentoReserva.findMany({
      where: { alunoId: member.id, status: "marcada", fim: { gte: new Date() } },
      include: { instrutor: { select: { name: true } } },
      orderBy: { inicio: "asc" },
    }),
  ]);
  const horarios = await Promise.all(instrutores.map(async (i) => [i.id, (await horariosDoInstrutor(i.id)).horarios] as const));
  const porInstrutor = new Map(horarios);
  const fuso = fusoDaEscola(member.school.uf);

  return (
    <main className="mx-auto flex min-h-screen w-full min-w-0 max-w-xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      <CabecalhoAluno icone={<CalendarClock />} titulo="Conversar com meu instrutor" descricao="Escolha um horário livre, com pelo menos 24 horas de antecedência. A conversa entra na sua Agenda e na do instrutor, e você recebe um aviso 2 horas antes." />
      <MarcarAtendimento
        fuso={fuso}
        minhas={minhas.map((r) => ({ id: r.id, inicio: r.inicio.toISOString(), instrutor: r.instrutor.name, modalidade: r.modalidade, local: r.local, linkOnline: r.linkOnline, assunto: r.assunto }))}
        instrutores={instrutores.map((i) => ({
          ...i,
          jaMarcado: minhas.some((r) => r.instrutorId === i.id),
          horarios: (porInstrutor.get(i.id) ?? []).map((h) => ({ inicio: h.inicio.toISOString(), modalidade: h.modalidade, local: h.local })),
        }))}
      />
    </main>
  );
}
