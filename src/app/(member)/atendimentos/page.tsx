import { MarcarAtendimento } from "@/components/atendimentos/marcar-atendimento";
import { fusoDaEscola, horariosDoInstrutor, instrutoresParaAtendimento } from "@/lib/atendimentos";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
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
    <main className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col gap-5 bg-na-bg p-5 pb-16 dark:bg-gray-950">
      <Link href="/portal" className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-na-green dark:text-emerald-400">
        <ArrowLeft size={15} /> Portal do Aluno
      </Link>
      <header className="rounded-2xl bg-gradient-to-br from-na-green-dark to-na-green p-4 text-white">
        <p className="text-[10px] font-semibold tracking-wide text-na-gold uppercase">Agenda</p>
        <h1 className="mt-1 text-xl font-black">Conversar com meu instrutor</h1>
        <p className="mt-1 text-[12px] text-green-100">Escolha um horário livre. A conversa entra na sua Agenda e na do instrutor, e você recebe um aviso 2 horas antes.</p>
      </header>
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
