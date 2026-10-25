import { PainelInstrutor } from "@/components/atendimentos/painel-instrutor";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { ehInstrutor, horariosDoInstrutor } from "@/lib/atendimentos";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Atendimentos individuais: o instrutor abre e fecha horários e acompanha as conversas marcadas (pedido do usuário 2026-10-25). */
export default async function AtendimentosInstrutorPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/professor/atendimentos");
  if (!(await ehInstrutor(member))) redirect("/professor");

  const agora = new Date();
  const [{ fuso, janelas, horarios }, conversas] = await Promise.all([
    horariosDoInstrutor(member.id, { incluirFechados: true }),
    db.atendimentoReserva.findMany({
      where: { instrutorId: member.id, alunoId: { not: null }, OR: [{ status: "marcada" }, { inicio: { gte: new Date(agora.getTime() - 30 * 864e5) } }] },
      include: { aluno: { select: { name: true, classMemberships: { where: { role: "aluno", classGroup: { tipo: "turma", arquivadoEm: null } }, select: { classGroup: { select: { name: true } } } } } } },
      orderBy: { inicio: "asc" },
    }),
  ]);
  const nomes = new Map(conversas.map((c) => [c.id, c.aluno?.name ?? ""]));

  return (
    <ShellTrabalho largura="estreita" ativo="/professor">
      <Link href="/professor" className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-na-green dark:text-emerald-400">
        <ArrowLeft size={15} /> Minhas Turmas
      </Link>
      <div>
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Atendimentos individuais</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Abra faixas de horário e os alunos das suas turmas marcam uma conversa. Cada conversa entra na sua Agenda e na do aluno, e vocês recebem um aviso 2 horas antes.
        </p>
      </div>
      <PainelInstrutor
        fuso={fuso}
        janelas={janelas.map((j) => ({ id: j.id, diaSemana: j.diaSemana, data: j.data, inicioMinuto: j.inicioMinuto, fimMinuto: j.fimMinuto, duracaoMinutos: j.duracaoMinutos, modalidade: j.modalidade, local: j.local, linkOnline: j.linkOnline }))}
        horarios={horarios.map((h) => ({ inicio: h.inicio.toISOString(), fim: h.fim.toISOString(), janelaId: h.janelaId, situacao: h.situacao, reservaId: h.reservaId ?? null, aluno: h.reservaId ? (nomes.get(h.reservaId) ?? null) : null }))}
        conversas={conversas.map((c) => ({
          id: c.id,
          inicio: c.inicio.toISOString(),
          fim: c.fim.toISOString(),
          aluno: c.aluno?.name ?? "",
          turma: c.aluno?.classMemberships.map((t) => t.classGroup.name).join(", ") ?? "",
          assunto: c.assunto,
          modalidade: c.modalidade,
          status: c.status,
          canceladoPor: c.canceladoPor,
        }))}
      />
    </ShellTrabalho>
  );
}
