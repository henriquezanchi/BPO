import {portalLabel} from "@/lib/display-labels";
import { ehAdministradorNacional, temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { linkDoCanal } from "@/lib/slack";
import { termoVigente } from "@/lib/volunteer-term";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ArrowLeft, Banknote, CalendarClock, Crown, ExternalLink, FileSignature, GraduationCap, KeyRound, Shield } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Hub pros diferentes tipos de voluntário (instrutor, direção, secretário,
 * etc — ver conversa). Instrutor (isPedagogo, "Integração > Pedagogos"),
 * Direção (isDiretor/isSubChefe, "Diretor > Dados da Unidade") e Secretário
 * de Escolástica (isSecretarioEscolastica) e de Economia
 * (isSecretarioEconomia), ambos de "Diretor > Colaboradores", têm sinal real
 * do Mercúrio — ver scripts/sync-diretoria.ts.
 */
export default async function VoluntarioPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario");
  // Grupos de voluntários (Grupo Feminino/Masculino/de Segurança) vêm do Mercúrio — ver mercurio-db/importar.ts.
  // Informação sensível: só aparece com acesso liberado em camadas.
  const acesso = await temAcessoVoluntario(member);
  const grupos = !acesso ? [] : await db.classMembership.findMany({
    where: { memberId: member.id, classGroup: { tipo: { not: "turma" } } },
    include: { classGroup: { select: { id: true, name: true, slackChannelId: true, slackTeamId: true } } },
    orderBy: { classGroup: { name: "asc" } },
  });
  const lideraGrupo = grupos.some((g) => g.role === "professor");
  // Responsável que também é integrante aparece uma vez só, como responsável.
  const gruposUnicos = [...new Map([...grupos].sort((a, b) => Number(a.role === "professor") - Number(b.role === "professor")).map((g) => [g.classGroupId, g])).values()].sort((a, b) =>
    a.classGroup.name.localeCompare(b.classGroup.name),
  );
  const chefeDeFilial = member.isDiretor || member.filiaisChefiadas.length > 0 || (await ehAdministradorNacional(member));
  const podeLiberarAcessos = chefeDeFilial || lideraGrupo;
  if (
    grupos.length === 0 &&
    !chefeDeFilial &&
    !member.isPedagogo &&
    !member.isDiretor &&
    !member.isSubChefe &&
    !member.isSecretarioEscolastica &&
    !member.isSecretarioEconomia &&
    member.cargos.length === 0
  )
    redirect("/portal");

  const termoAssinado = await termoVigente(member.id, member.schoolId);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Voltar ao Portal
        </Link>
        <ThemeToggle />
      </div>
      <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Portal do Voluntário</h1>
      {member.cargos.length > 0 && (
        <div className="-mt-3 flex flex-wrap gap-1.5">
          {member.cargos.map((cargo) => (
            <span key={cargo} className="rounded-full bg-na-green-light px-2.5 py-1 text-[11px] font-semibold text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-400">
              {portalLabel(cargo.charAt(0) + cargo.slice(1).toLowerCase())}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {podeLiberarAcessos && (
          <Link
            href="/voluntario/acessos"
            className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-na-gold dark:border-gray-700"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-na-gold/15 text-na-gold-dark">
              <KeyRound size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Liberar acessos</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {chefeDeFilial ? "Quem da filial vê a área de voluntários" : "Quem do seu grupo vê a área de voluntários"}
              </p>
            </div>
          </Link>
        )}

        {lideraGrupo && !member.isPedagogo && (
          <Link
            href="/professor"
            className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-na-gold dark:border-gray-700"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-na-gold/15 text-na-gold-dark">
              <Shield size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Meus grupos</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Avisos e atividades pros integrantes</p>
            </div>
          </Link>
        )}

        {member.isPedagogo && (
          <Link
            href="/professor"
            className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-na-gold dark:border-gray-700"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-na-gold/15 text-na-gold-dark">
              <GraduationCap size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{lideraGrupo ? "Instrutor e grupos" : "Instrutor"}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{lideraGrupo ? "Turmas, grupos, avisos e enquetes" : "Turmas, atividades e enquetes"}</p>
            </div>
          </Link>
        )}

        {(member.isDiretor || member.isSubChefe) && (
          <Link
            href="/diretor"
            className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-na-gold dark:border-gray-700"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-na-gold/15 text-na-gold-dark">
              <Crown size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Direção</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{member.isDiretor ? "Diretor(a)" : "Sub-Chefe"} da unidade</p>
            </div>
          </Link>
        )}

        <Link
          href="/voluntario/termo"
          className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-na-gold dark:border-gray-700"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-na-gold/15 text-na-gold-dark">
            <FileSignature size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Termo de Voluntariado</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{termoAssinado ? "Assinado" : "Pendente de assinatura"}</p>
          </div>
        </Link>

        {member.isSecretarioEscolastica && (
          <Link
            href="/escolastica"
            className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-na-gold dark:border-gray-700"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-na-gold/15 text-na-gold-dark">
              <CalendarClock size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Escolástica</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Agenda de pendências (ex: transições pro Círculo de Amigos)</p>
            </div>
          </Link>
        )}

        {member.isSecretarioEconomia && (
          <Link
            href="/economia"
            className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-na-gold dark:border-gray-700"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-na-gold/15 text-na-gold-dark">
              <Banknote size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Economia</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Aprovar novos itens de composição da contribuição</p>
            </div>
          </Link>
        )}
      </div>

      {grupos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Seus grupos</h2>
          <p className="-mt-1 text-[11px] text-gray-500 dark:text-gray-400">Os avisos de cada grupo aparecem na sua Agenda no Portal.</p>
          {gruposUnicos.map((g) => {
            const slack = linkDoCanal(g.classGroup.slackTeamId, g.classGroup.slackChannelId);
            return (
              <div key={g.id} className="flex items-center justify-between rounded-2xl border border-gray-200 p-3 dark:border-gray-700">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{portalLabel(g.classGroup.name)}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{g.role === "professor" ? "Responsável" : "Integrante"}</p>
                </div>
                {slack && (
                  <a href={slack} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] font-semibold text-na-green dark:text-emerald-400">
                    Canal no Slack <ExternalLink size={11} />
                  </a>
                )}
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
