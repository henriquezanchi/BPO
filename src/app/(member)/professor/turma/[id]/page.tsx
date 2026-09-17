import { CreateActivityForm } from "@/components/member/professor/create-activity-form";
import { CreatePollForm } from "@/components/member/professor/create-poll-form";
import { formatDateBR } from "@/lib/format";
import { getAuthenticatedMember } from "@/lib/auth";
import { getTeacherClassDetail } from "@/lib/teacher-data";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TeacherClassPage(props: PageProps<"/professor/turma/[id]">) {
  const { id } = await props.params;

  const member = await getAuthenticatedMember();
  if (!member) redirect(`/login?next=/professor/turma/${id}`);
  if (!member.isPedagogo) redirect("/portal");

  const turma = await getTeacherClassDetail(id);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Link href="/professor" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Minhas Turmas
      </Link>

      <div>
        <h1 className="text-xl font-bold text-na-green-dark">{turma.name}</h1>
        <p className="text-xs text-gray-500">{turma.students.length} alunos</p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-800">Alunos</h2>
        {turma.students.length === 0 ? (
          <p className="text-xs text-gray-500">Nenhum aluno matriculado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1 rounded-2xl border border-gray-200 p-2">
            {turma.students.map((s) => (
              <li key={s.id} className="flex justify-between rounded-lg p-2 text-xs">
                <span>{s.name}</span>
                <span className="text-gray-500">#{s.registrationNo ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-800">Nova atividade</h2>
        <CreateActivityForm classGroupId={turma.id} />

        {turma.activities.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold text-gray-700">Atividades cadastradas</h3>
            <ul className="flex flex-col gap-1.5">
              {turma.activities.map((a) => (
                <li key={a.id} className="flex justify-between rounded-lg bg-gray-50 p-2 text-xs">
                  <span>{a.title}</span>
                  <span className="text-gray-500">{formatDateBR(a.dueDate)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-800">Nova enquete</h2>
        <CreatePollForm classGroupId={turma.id} />

        {turma.polls.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold text-gray-700">Enquetes publicadas</h3>
            <ul className="flex flex-col gap-2">
              {turma.polls.map((p) => {
                const total = p.options.reduce((soma, o) => soma + o.votes, 0);
                return (
                  <li key={p.id} className="rounded-lg bg-gray-50 p-2.5 text-xs">
                    <div className="mb-1.5 font-semibold text-gray-800">{p.question}</div>
                    {p.options.map((o) => (
                      <div key={o.id} className="mb-1 flex items-center justify-between text-gray-600">
                        <span>{o.label}</span>
                        <span>{o.votes} voto{o.votes === 1 ? "" : "s"}</span>
                      </div>
                    ))}
                    <div className="mt-1 text-[10px] text-gray-400">{total} resposta{total === 1 ? "" : "s"} no total</div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
