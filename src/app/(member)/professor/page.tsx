import { CreateActivityForm } from "@/components/member/professor/create-activity-form";
import { formatDateBR } from "@/lib/format";
import { getTeacherClasses } from "@/lib/teacher-data";

export const dynamic = "force-dynamic";

// TODO: mesma ressalva do Portal do Membro — trocar `?memberId=` por sessão
// real (Supabase Auth) assim que o papel de professor puder ser resolvido
// via Mercúrio.
export default async function ProfessorPage(props: PageProps<"/professor">) {
  const searchParams = await props.searchParams;
  const memberId = typeof searchParams.memberId === "string" ? searchParams.memberId : undefined;

  if (!memberId) {
    return (
      <main className="p-6 text-center text-sm text-gray-500">
        Acesse com <code className="rounded bg-gray-100 px-1.5 py-0.5">?memberId=ID_DO_PROFESSOR</code>.
      </main>
    );
  }

  const classes = await getTeacherClasses(memberId);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
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

          <CreateActivityForm classGroupId={c.id} createdById={memberId} />

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
