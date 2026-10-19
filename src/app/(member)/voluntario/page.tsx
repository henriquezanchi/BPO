import { CartaoGrupo } from "@/components/admin/grupos-admin";
import { CriarGdve } from "@/components/member/volunteer/criar-gdve";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ehAdministradorNacional, temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { getAuthenticatedMember } from "@/lib/auth";
import { escolasQueGereAvaliacao } from "@/lib/avaliacao";
import { portalLabel } from "@/lib/display-labels";
import { meusGrupos, type ResumoGrupo } from "@/lib/grupos-dados";
import { ehFV } from "@/lib/grupos-portal";
import { filiaisAdministradas } from "@/lib/recursos-filial";
import { termoVigente } from "@/lib/volunteer-term";
import { ArrowLeft, Banknote, CalendarClock, ChevronRight, ClipboardCheck, Crown, FileSignature, GraduationCap, KeyRound, Settings, Shield } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const SECOES: { titulo: string; tipos: ResumoGrupo["tipo"][]; vazio?: string }[] = [
  { titulo: "Secretarias", tipos: ["SEC"] },
  { titulo: "Grupos de FV", tipos: ["BF", "BM", "CS"] },
  { titulo: "GDVE", tipos: ["GDVE"] },
  { titulo: "GAF", tipos: ["GAF"] },
];

function Ferramenta({ href, icone: Icone, titulo, texto }: { href: string; icone: typeof Shield; titulo: string; texto: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white dark:hover:bg-gray-900">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-na-gold/15 text-na-gold-dark">
        <Icone size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-gray-900 dark:text-gray-100">{titulo}</span>
        <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">{texto}</span>
      </span>
      <ChevronRight size={15} className="shrink-0 text-gray-300 group-hover:text-na-green" />
    </Link>
  );
}

/**
 * Portal do Voluntário (redesenho 2026-10-19): grupos da pessoa em destaque
 * (secretarias, grupos de FV, GDVE, GAF) e as ferramentas de cada função. No
 * computador, duas colunas; no celular, grupos primeiro e ferramentas depois.
 * A área de voluntários é sensível: grupos só aparecem com acesso liberado
 * (camadas — acesso-voluntario.ts); o GDVE só para FV.
 */
export default async function VoluntarioPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario");
  const [acesso, fv, grupos, nacional, administra, geraAvaliacao, termoAssinado] = await Promise.all([
    temAcessoVoluntario(member),
    ehFV(member.id),
    meusGrupos(member),
    ehAdministradorNacional(member),
    filiaisAdministradas(member),
    escolasQueGereAvaliacao(member),
    termoVigente(member.id, member.schoolId),
  ]);
  const lideraGrupo = grupos.some((g) => g.papel === "responsavel" && ["BF", "BM", "CS"].includes(g.tipo));
  const chefeDeFilial = member.isDiretor || member.filiaisChefiadas.length > 0 || nacional;
  const podeCriarGdve = fv && acesso;
  if (
    grupos.length === 0 &&
    !podeCriarGdve &&
    !chefeDeFilial &&
    !member.isPedagogo &&
    !member.isSubChefe &&
    !member.isSecretarioEscolastica &&
    !member.isSecretarioEconomia &&
    member.cargos.length === 0
  )
    redirect("/portal");

  const ferramentas = [
    administra.length > 0 && { href: "/admin", icone: Settings, titulo: "Administração da filial", texto: "Secretarias, GAF, recursos e administradores" },
    geraAvaliacao.length > 0 && { href: "/escolastica/avaliacao", icone: ClipboardCheck, titulo: "Avaliação dos instrutores", texto: "Questionário, rodadas e relatórios anônimos" },
    (chefeDeFilial || lideraGrupo) && {
      href: "/voluntario/acessos",
      icone: KeyRound,
      titulo: "Liberar acessos",
      texto: chefeDeFilial ? "Quem da filial vê a área de voluntários" : "Quem do seu grupo vê a área de voluntários",
    },
    (member.isPedagogo || lideraGrupo) && {
      href: "/professor",
      icone: member.isPedagogo ? GraduationCap : Shield,
      titulo: member.isPedagogo ? "Instrutor" : "Avisos dos grupos",
      texto: member.isPedagogo ? "Turmas, atividades e enquetes" : "Avisos e atividades para os integrantes",
    },
    (member.isDiretor || member.isSubChefe) && { href: "/diretor", icone: Crown, titulo: "Direção", texto: `${member.isDiretor ? "Diretor(a)" : "Sub-Chefe"} da unidade` },
    member.isSecretarioEscolastica && { href: "/escolastica", icone: CalendarClock, titulo: "Escolástica", texto: "Agenda de pendências" },
    member.isSecretarioEconomia && { href: "/economia", icone: Banknote, titulo: "Economia", texto: "Composição da contribuição e tesouraria" },
    { href: "/voluntario/termo", icone: FileSignature, titulo: "Termo de Voluntariado", texto: termoAssinado ? "Assinado" : "Pendente de assinatura" },
  ].filter(Boolean) as Parameters<typeof Ferramenta>[0][];

  const secoes = SECOES.map((s) => ({ ...s, grupos: grupos.filter((g) => s.tipos.includes(g.tipo)) })).filter((s) => s.grupos.length > 0 || (s.titulo === "GDVE" && podeCriarGdve));

  return (
    <div className="min-h-screen bg-na-bg dark:bg-gray-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 lg:p-8">
        <div className="flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <ArrowLeft size={14} /> Portal do Aluno
          </Link>
          <ThemeToggle />
        </div>
        <header>
          <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Portal do Voluntário</h1>
          {member.cargos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {member.cargos.map((cargo) => (
                <span key={cargo} className="rounded-full bg-na-green-light px-2.5 py-1 text-[11px] font-semibold text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-400">
                  {portalLabel(cargo.charAt(0) + cargo.slice(1).toLowerCase())}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="flex flex-col gap-6">
            {secoes.length === 0 && (
              <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-[13px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
                {acesso ? "Você ainda não faz parte de nenhum grupo ou secretaria." : "Seus grupos aparecem aqui depois que o responsável liberar seu acesso à área de voluntários."}
              </p>
            )}
            {secoes.map((s) => (
              <section key={s.titulo} className="flex flex-col gap-3">
                <h2 className="text-[12px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">{s.titulo}</h2>
                {s.titulo === "GDVE" && podeCriarGdve && <CriarGdve schoolId={member.schoolId} />}
                {s.grupos.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {s.grupos.map((g) => (
                      <CartaoGrupo key={g.id} g={g} de="voluntario" etiqueta={g.papel === "responsavel" ? "Responsável" : "Integrante"} />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>

          <aside className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-gray-50/60 p-2 lg:sticky lg:top-6 dark:border-gray-800 dark:bg-gray-900/40">
            <h2 className="px-3 pt-2 text-[12px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">Ferramentas</h2>
            {ferramentas.map((f) => (
              <Ferramenta key={f.href} {...f} />
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}
