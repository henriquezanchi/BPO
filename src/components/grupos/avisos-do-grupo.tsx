import { CreateActivityForm } from "@/components/member/professor/create-activity-form";
import { CreatePollForm } from "@/components/member/professor/create-poll-form";
import { PublishedActivities } from "@/components/member/professor/published-activities";
import { SlackChannelPanel } from "@/components/member/professor/slack-channel-panel";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { linkDoCanal, tokenSlackDaFilial } from "@/lib/slack";
import { getTeacherClassDetail } from "@/lib/teacher-data";

const CARTAO = "rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 lg:p-5";
const TITULO = "text-sm font-bold text-gray-900 dark:text-gray-100";

/**
 * Aba "Avisos e enquetes" da página do grupo (pedido do usuário 2026-10-25: uma tela só por grupo).
 * Antes ficava em /professor/turma/[id]. Só para quem coordena o grupo — getTeacherClassDetail
 * reconfere no servidor (requireTeacherOfClass → papelNoGrupo().podeGerir).
 */
export async function AvisosDoGrupo({ grupoId }: { grupoId: string }) {
  const turma = await getTeacherClassDetail(grupoId).catch(() => null);
  if (!turma) return null;
  const slackDisponivel = !!tokenSlackDaFilial(turma.mercurioUnidade);
  return (
    <div className="flex flex-col gap-4">
      <section className={CARTAO}>
        <CollapsibleSection defaultOpen title={<h2 className={TITULO}>Novo aviso</h2>}>
          <CreateActivityForm classGroupId={turma.id} ehGrupo temSlack={slackDisponivel && !!turma.slackChannelId} materias={[]} />
          {turma.activities.length > 0 && (
            <CollapsibleSection title={<h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Publicados ({turma.activities.length})</h3>}>
              <PublishedActivities activities={turma.activities} ehGrupo />
            </CollapsibleSection>
          )}
        </CollapsibleSection>
      </section>

      <section className={CARTAO}>
        <CollapsibleSection title={<h2 className={TITULO}>Nova enquete</h2>}>
          <CreatePollForm classGroupId={turma.id} />
          {turma.polls.length > 0 && (
            <CollapsibleSection title={<h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Enquetes publicadas ({turma.polls.length})</h3>}>
              <ul className="flex flex-col gap-2">
                {turma.polls.map((p) => {
                  const total = p.options.reduce((soma, o) => soma + o.votes, 0);
                  return (
                    <li key={p.id} className="rounded-lg bg-gray-50 p-2.5 text-xs dark:bg-gray-800">
                      <div className="mb-1.5 font-semibold text-gray-800 dark:text-gray-200">{p.question}</div>
                      {p.options.map((o) => (
                        <div key={o.id} className="mb-1 flex items-center justify-between text-gray-600 dark:text-gray-400">
                          <span>{o.label}</span>
                          <span>
                            {o.votes} voto{o.votes === 1 ? "" : "s"}
                          </span>
                        </div>
                      ))}
                      <div className="mt-1 text-[10px] text-gray-400">
                        {total} resposta{total === 1 ? "" : "s"} no total
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CollapsibleSection>
          )}
        </CollapsibleSection>
      </section>

      {slackDisponivel && (
        <section className={CARTAO}>
          <CollapsibleSection title={<h2 className={TITULO}>Canal no Slack</h2>}>
            <SlackChannelPanel classGroupId={turma.id} linkCanal={linkDoCanal(turma.slackTeamId, turma.slackChannelId)} />
          </CollapsibleSection>
        </section>
      )}
    </div>
  );
}
