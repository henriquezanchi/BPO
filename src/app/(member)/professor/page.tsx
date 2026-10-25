import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { formatDateBR } from "@/lib/format";
import { getAuthenticatedMember } from "@/lib/auth";
import { getTeacherClasses, lideraAlgumGrupo } from "@/lib/teacher-data";
import { ExternalLink } from "lucide-react";
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
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  return (
    <ShellTrabalho largura="estreita">
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">
          {!member.isPedagogo ? "Meus Grupos" : classes.some((c) => c.tipo !== "turma") ? "Turmas e Grupos" : "Minhas Turmas"}
        </h1>
        {member.isPedagogo && (
          <div className="flex flex-wrap gap-2"><a
            href="https://pedagogia.acropolebrasil.com.br/#/home"
            target="_blank"
            rel="noreferrer"
            className="flex w-fit items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Diário de Classe <ExternalLink size={12} />
          </a>
          <a href="https://www.oinabn.com.br/orpheu" target="_blank" rel="noopener noreferrer" className="flex w-fit items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Orpheu <ExternalLink size={12} /></a></div>
        )}
      </div>

      {classes.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma turma ou grupo vinculado a você ainda.</p>
      )}

      {[
        { titulo: "Turmas", lista: classes.filter((c) => c.tipo === "turma"), pessoa: ["aluno", "alunos"] },
        { titulo: "Grupos de voluntários", lista: classes.filter((c) => c.tipo !== "turma"), pessoa: ["integrante", "integrantes"] },
      ]
        .filter((secao) => secao.lista.length > 0)
        .map((secao) => (
          <section key={secao.titulo} className="flex flex-col gap-3">
            <CollapsibleSection title={<h2 className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">{secao.titulo}</h2>}>
            {secao.lista.map((c) => (
              <Link
                key={c.id}
                href={c.tipo === "turma" ? `/professor/turma/${c.id}` : `/grupos/${c.id}?aba=avisos`}
                className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-5 transition hover:border-na-gold dark:border-gray-700"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{c.name}</span>
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {c._count.memberships} {c._count.memberships === 1 ? secao.pessoa[0] : secao.pessoa[1]}
                  </span>
                </div>

                {c.activities.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {[...c.activities].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 3).map((a) => (
                      <li key={a.id} className="flex justify-between gap-3 rounded-lg bg-gray-50 p-2 text-xs dark:bg-gray-800">
                        <span>{a.title}{new Date(a.dueDate).toISOString().slice(0, 10) < today && <span className="ml-2 text-[10px] text-gray-500 dark:text-gray-400">· Já aconteceu</span>}</span>
                        <span className="shrink-0 text-gray-500 dark:text-gray-400">{formatDateBR(a.dueDate)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Link>
            ))}
          </CollapsibleSection></section>
        ))}
    </ShellTrabalho>
  );
}
