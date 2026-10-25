import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { MeetingManager } from "@/components/member/groups/meeting-manager";
import { CreateActivityForm } from "@/components/member/professor/create-activity-form";
import { CreatePollForm } from "@/components/member/professor/create-poll-form";
import { SlackChannelPanel } from "@/components/member/professor/slack-channel-panel";
import { linkDoCanal, tokenSlackDaFilial } from "@/lib/slack";
import { PublishedActivities } from "@/components/member/professor/published-activities";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { catalogoDaMateria } from "@/lib/temas-curriculo";
import { getTeacherClassDetail } from "@/lib/teacher-data";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TeacherClassPage(props: PageProps<"/professor/turma/[id]">) {
  const { id } = await props.params;

  const member = await getAuthenticatedMember();
  if (!member) redirect(`/login?next=/professor/turma/${id}`);
  // Permissão real é conferida em getTeacherClassDetail (responsável por
  // ESTA turma/grupo) — vale pra instrutor e pra chefe de brigada.
  const turma = await getTeacherClassDetail(id).catch(() => null);
  if (!turma) redirect("/portal");
  // Grupos (FV, GAF, secretarias, GDVE): uma tela só, na aba de avisos (pedido do usuário 2026-10-25).
  if (turma.tipo !== "turma") redirect(`/grupos/${turma.id}?aba=avisos`);
  const ehGrupo = false;
  const pessoas = ehGrupo ? "integrantes" : "alunos";
  const slackDisponivel = !!tokenSlackDaFilial(turma.mercurioUnidade);
  // Matérias em curso na turma (vêm do Mercúrio) com os temas do catálogo, para a prova/trabalho/leitura.
  const materias = ehGrupo
    ? []
    : (await db.turmaMateria.findMany({ where: { classGroupId: turma.id }, orderBy: { materiaNome: "asc" }, select: { materiaSigla: true, materiaNome: true } })).map((m) => ({
        sigla: m.materiaSigla,
        nome: m.materiaNome,
        catalogo: catalogoDaMateria(m.materiaSigla),
      }));

  return (
    <ShellTrabalho largura="estreita">
      <Link href="/professor" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        <ArrowLeft size={14} /> {ehGrupo ? "Meus grupos" : "Minhas Turmas"}
      </Link>

      <div>
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">{turma.name}</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">{turma.students.length} {pessoas}</p>
      </div>

      <section>
        <CollapsibleSection title={<h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">{ehGrupo ? "Integrantes" : "Alunos"}</h2>}>
        {turma.students.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">{ehGrupo ? "Nenhum integrante com acesso ao Portal ainda." : "Nenhum aluno matriculado ainda."}</p>
        ) : (
          <ul className="flex flex-col gap-1 rounded-2xl border border-gray-200 p-2 dark:border-gray-700">
            {turma.students.map((s) => (
              <li key={s.id} className="flex justify-between rounded-lg p-2 text-xs">
                <span>{s.name}</span>
                <span className="text-gray-500 dark:text-gray-400">#{s.registrationNo ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection></section>

      {slackDisponivel && (
        <section className="flex flex-col gap-3">
          <CollapsibleSection title={<h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Canal no Slack</h2>}>
          <SlackChannelPanel classGroupId={turma.id} linkCanal={linkDoCanal(turma.slackTeamId, turma.slackChannelId)} />
        </CollapsibleSection></section>
      )}

      {ehGrupo && ["BF","BM","CS"].includes(turma.tipo) && (
        // Reuniões recolhidas por padrão (pedido do usuário 2026-10-19).
        <details className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
          <summary className="cursor-pointer text-sm font-bold text-na-green-dark dark:text-na-green-light">Reuniões do grupo</summary>
          <div className="mt-3">
            <MeetingManager groupId={turma.id} />
          </div>
        </details>
      )}

      <section className="flex flex-col gap-3">
        <CollapsibleSection title={<h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{ehGrupo ? "Novo aviso" : "Nova atividade"}</h2>}>
        <CreateActivityForm classGroupId={turma.id} ehGrupo={ehGrupo} temSlack={slackDisponivel && !!turma.slackChannelId} materias={materias} />

        {turma.activities.length > 0 && (
          <div>
            <CollapsibleSection title={<h3 className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">{ehGrupo ? "Publicados" : "Atividades cadastradas"}</h3>}>
            <PublishedActivities activities={turma.activities} ehGrupo={ehGrupo} />
          </CollapsibleSection></div>
        )}
      </CollapsibleSection></section>

      <section className="flex flex-col gap-3">
        <CollapsibleSection title={<h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Nova enquete</h2>}>
        <CreatePollForm classGroupId={turma.id} />

        {turma.polls.length > 0 && (
          <div>
            <CollapsibleSection title={<h3 className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">Enquetes publicadas</h3>}>
            <ul className="flex flex-col gap-2">
              {turma.polls.map((p) => {
                const total = p.options.reduce((soma, o) => soma + o.votes, 0);
                return (
                  <li key={p.id} className="rounded-lg bg-gray-50 p-2.5 text-xs dark:bg-gray-800">
                    <div className="mb-1.5 font-semibold text-gray-800 dark:text-gray-200">{p.question}</div>
                    {p.options.map((o) => (
                      <div key={o.id} className="mb-1 flex items-center justify-between text-gray-600 dark:text-gray-400">
                        <span>{o.label}</span>
                        <span>{o.votes} voto{o.votes === 1 ? "" : "s"}</span>
                      </div>
                    ))}
                    <div className="mt-1 text-[10px] text-gray-400">{total} resposta{total === 1 ? "" : "s"} no total</div>
                  </li>
                );
              })}
            </ul>
          </CollapsibleSection></div>
        )}
      </CollapsibleSection></section>
    </ShellTrabalho>
  );
}
