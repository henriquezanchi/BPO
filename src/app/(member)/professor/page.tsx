import { CreateActivityForm } from "@/components/member/professor/create-activity-form";
import { formatDateBR } from "@/lib/format";
import { getAuthenticatedMember } from "@/lib/auth";
import { getTeacherClasses } from "@/lib/teacher-data";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfessorPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/professor");
  // isPedagogo vem da sincronização real de "Integração > Pedagogos" do
  // Mercúrio (scripts/sync-pedagogos.ts) — quem não está lá não deveria
  // nem ver o botão "Área do Professor" no Portal, e não deveria conseguir
  // entrar direto pela URL também (defesa em profundidade).
  if (!member.isPedagogo) redirect("/portal");

  const classes = await getTeacherClasses(member.id);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Voltar ao Portal
      </Link>
      <h1 className="text-xl font-bold text-na-green-dark">Minhas Turmas</h1>

      {classes.length === 0 && (
        <p className="text-sm text-gray-500">Nenhuma turma vinculada a este professor ainda.</p>
      )}

      {classes.map((c) => (
        <section key={c.id} className="flex flex-col gap-4 rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">{c.name}</h2>
            <span className="text-xs text-gray-500">{c._count.memberships} alunos</span>
          </div>

          <CreateActivityForm classGroupId={c.id} />

          {c.activities.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-gray-700">Atividades recentes</h3>
              <ul className="flex flex-col gap-1.5">
                {c.activities.map((a) => (
                  <li key={a.id} className="flex justify-between rounded-lg bg-gray-50 p-2 text-xs">
                    <span>{a.title}</span>
                    <span className="text-gray-500">{formatDateBR(a.dueDate)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
