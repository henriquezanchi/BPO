import { formatDateBR } from "@/lib/format";
import { getAuthenticatedMember } from "@/lib/auth";
import { getTeacherClasses, lideraAlgumGrupo } from "@/lib/teacher-data";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfessorPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/professor");
  // Instrutor (isPedagogo, do Mercúrio) ou responsável por algum grupo
  // (chefe de Brigada/Corpo de Segurança) — quem não é nenhum dos dois não
  // entra nem pela URL direta (defesa em profundidade).
  if (!member.isPedagogo && !(await lideraAlgumGrupo(member.id))) redirect("/portal");

  const classes = await getTeacherClasses(member.id);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <Link href="/voluntario" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Portal do Voluntário
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">{!member.isPedagogo ? "Meus Grupos" : classes.some((c) => c.tipo !== "turma") ? "Turmas e Grupos" : "Minhas Turmas"}</h1>
        {member.isPedagogo && (
        <a
          href="https://pedagogia.acropolebrasil.com.br/#/home"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Diário de Classe <ExternalLink size={12} />
        </a>
        )}
      </div>

      {classes.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma turma ou grupo vinculado a você ainda.</p>
      )}

      {classes.map((c) => (
        <Link
          key={c.id}
          href={`/professor/turma/${c.id}`}
          className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-5 transition hover:border-na-gold dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
              {c.name}
              {c.tipo !== "turma" && (
                <span className="rounded-full bg-na-gold/15 px-2 py-0.5 text-[10px] font-semibold text-na-gold-dark dark:text-amber-300">Grupo</span>
              )}
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {c._count.memberships} {c.tipo === "turma" ? "alunos" : "integrantes"}
            </span>
          </div>

          {c.activities.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {c.activities.slice(0, 3).map((a) => (
                <li key={a.id} className="flex justify-between rounded-lg bg-gray-50 p-2 text-xs dark:bg-gray-800">
                  <span>{a.title}</span>
                  <span className="text-gray-500 dark:text-gray-400">{formatDateBR(a.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Link>
      ))}
    </main>
  );
}
