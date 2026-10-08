"use client";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { logout } from "@/lib/actions/auth-actions";
import { getFortunaBalancesForMember } from "@/lib/actions/fortuna-member-actions";
import { whatsappHref } from "@/lib/format";
import type { MemberDashboard } from "@/lib/member-data";
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Compass,
  HandHeart,
  Leaf,
  LifeBuoy,
  LogOut,
  MessageCircle,
  Pencil,
  PiggyBank,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FortunaWalletCard } from "./fortuna-wallet-card";
import { InstallPrompt } from "./install-prompt";
import { NudgeCard } from "./nudge-card";
import { OnboardingTour } from "./onboarding-tour";
import { AgendaPanel } from "./panels/agenda-panel";
import { ContributionStatusPanel } from "./panels/contribution-status-panel";
import { FortunaTopUpPanel } from "./panels/fortuna-topup-panel";
import { JornadaPanel } from "./panels/jornada-panel";
import { MyContributionPanel } from "./panels/my-contribution-panel";
import { ProfileEditPanel } from "./panels/profile-edit-panel";
import { StudyAreaPanel } from "./panels/study-area-panel";
import { TransparenciaPanel } from "./panels/transparencia-panel";
import { GafPanel, HelpPanel, VolunteerPanel } from "./misc-panels";

type ModalKey =
  | "cadastro"
  | "contribuicao"
  | "situacao"
  | "fortuna_recarga"
  | "agenda"
  | "estudos"
  | "voluntariado"
  | "ajuda"
  | "gaf"
  | "jornada"
  | "transparencia";

const MODAL_TITLES: Record<ModalKey, string> = {
  cadastro: "Atualizar Cadastro",
  contribuicao: "Minha Contribuição",
  situacao: "Situação da Contribuição",
  fortuna_recarga: "Adicionar Créditos",
  agenda: "Agenda & Eventos",
  estudos: "Área de Estudos",
  voluntariado: "Voluntariado",
  ajuda: "Central de Ajuda",
  gaf: "Conhecer o GAF",
  transparencia: "Transparência Financeira",
  jornada: "Minha Jornada",
};

const DIA_VENCIMENTO = 10;

/**
 * Resumo do próximo vencimento (dia 10, mesma convenção já usada pelo
 * worker do Pix Automático — ver process-pix-automatico.ts) pro topo do
 * Portal — pedido do usuário 2026-09-30: saber "quantos dias faltam" sem
 * precisar entrar em "Situação da Contribuição".
 */
function calcularProximoVencimento(monthlyStatus: { year: number; month: number; status: string }[]) {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;

  const statusMesAtual = monthlyStatus.find((m) => m.year === anoAtual && m.month === mesAtual)?.status ?? "em_branco";
  const jaResolvidoEsseMes = statusMesAtual === "paga" || statusMesAtual === "isento";

  const [ano, mes] = jaResolvidoEsseMes
    ? mesAtual === 12
      ? [anoAtual + 1, 1]
      : [anoAtual, mesAtual + 1]
    : [anoAtual, mesAtual];

  const vencimento = new Date(ano, mes - 1, DIA_VENCIMENTO);
  const diasRestantes = Math.round((vencimento.getTime() - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()) / 86400000);
  return { vencimento, diasRestantes, jaResolvidoEsseMes };
}

export function MemberPortalClient({ dashboard }: { dashboard: MemberDashboard }) {
  const { member, agendaItems, availableToAdd } = dashboard;
  const [modal, setModal] = useState<ModalKey | null>(null);
  const [fortunaBalances, setFortunaBalances] = useState(dashboard.fortunaBalances);
  const [fortunaCarregando, setFortunaCarregando] = useState(true);
  const [tourVisivel, setTourVisivel] = useState(!member.tourCompletedAt);

  function carregarSaldoFortuna() {
    getFortunaBalancesForMember(member.id)
      .then(setFortunaBalances)
      .finally(() => setFortunaCarregando(false));
  }

  function buscarSaldoFortuna() {
    setFortunaCarregando(true);
    carregarSaldoFortuna();
  }

  useEffect(() => {
    carregarSaldoFortuna();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDelayed = member.status === "atrasado" || member.status === "negociando";
  const schoolWhatsapp = member.school.whatsapp ?? member.whatsapp;
  const compositionTotal = member.compositionItems.reduce((soma, i) => soma + i.amount, 0);
  const proximoVencimento = calcularProximoVencimento(member.monthlyStatus);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col border border-gray-200 bg-white shadow-xl sm:my-5 sm:rounded-[28px] dark:border-gray-800 dark:bg-gray-900">
      {tourVisivel && <OnboardingTour memberId={member.id} onFechar={() => setTourVisivel(false)} />}
      <header className="relative border-b border-gray-100 bg-white px-5 pt-6 pb-4 text-center dark:border-gray-800 dark:bg-gray-900">
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <ThemeToggle className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800" />
          <button
            onClick={() => logout()}
            title="Sair"
            aria-label="Sair"
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800"
          >
            <LogOut size={16} />
          </button>
        </div>
        <div className="mb-5 flex justify-center">
          <Image src="/na-logo.png" alt={member.school.name} width={160} height={48} className="h-auto w-40 dark:brightness-0 dark:invert" />
        </div>

        <div data-tour-id="welcome" className="rounded-2xl bg-gradient-to-br from-na-green-dark to-na-green p-4 text-left text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-na-gold">PORTAL DO MEMBRO</span>
              {(member.isPedagogo || member.isDiretor || member.isSubChefe) && (
                <>
                  <span className="text-[10px] text-white/30">·</span>
                  <Link
                    href="/voluntario"
                    className="text-[10px] font-semibold text-white/80 underline decoration-dotted underline-offset-2 transition hover:text-white"
                  >
                    Portal do Voluntário
                  </Link>
                </>
              )}
            </div>
            <button
              onClick={() => setModal("cadastro")}
              className="flex items-center gap-1 rounded-full border border-white/30 bg-white/15 px-3 py-2 text-[10px] font-semibold transition hover:bg-white/25"
            >
              <Pencil size={11} /> Editar Dados
            </button>
          </div>
          <div className="mt-3 mb-1 flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/30 bg-white/15">
              {member.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- vem do Supabase Storage, não é um asset local
                <img src={member.avatarUrl} alt={member.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-bold">{member.name.charAt(0)}</span>
              )}
            </div>
            <span className="text-base font-bold">{member.name}</span>
          </div>
          <div className="flex justify-between border-t border-white/15 pt-2.5 text-[11px] text-green-100">
            <span>{member.school.city ?? member.school.name}</span>
            <span>
              Matrícula: <strong>#{member.registrationNo ?? "—"}</strong>
            </span>
          </div>
        </div>
      </header>

      <InstallPrompt />

      <main className="flex flex-1 flex-col gap-4 bg-na-bg p-5 pb-24 dark:bg-gray-950">
        <NudgeCard memberId={member.id} />

        {/* Status financeiro */}
        <div
          data-tour-id="contribuicao-status"
          className={`flex flex-col gap-3 rounded-2xl border p-4 ${
            isDelayed
              ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
              : "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                isDelayed
                  ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
              }`}
            >
              {isDelayed ? <TriangleAlert size={16} /> : <CheckCircle2 size={16} />}
            </div>
            <div>
              <h4
                className={`text-[13px] font-bold ${
                  isDelayed ? "text-red-800 dark:text-red-300" : "text-emerald-800 dark:text-emerald-300"
                }`}
              >
                {isDelayed ? "Contribuição Pendente" : "Contribuição em Dia"}
              </h4>
              <p className="mt-0.5 text-xs text-gray-700 dark:text-gray-400">
                Olá, {member.name.split(" ")[0]}. Sua contribuição deste mês está{" "}
                {isDelayed ? "atrasada" : "em dia"}.
              </p>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-500">
                {proximoVencimento.diasRestantes < 0
                  ? `Venceu há ${Math.abs(proximoVencimento.diasRestantes)} dia(s) — vencimento dia ${proximoVencimento.vencimento.getDate()}/${proximoVencimento.vencimento.getMonth() + 1}`
                  : proximoVencimento.diasRestantes === 0
                    ? "Vence hoje"
                    : `Próximo vencimento: dia ${proximoVencimento.vencimento.getDate()}/${proximoVencimento.vencimento.getMonth() + 1} (em ${proximoVencimento.diasRestantes} dia${proximoVencimento.diasRestantes === 1 ? "" : "s"})`}
              </p>
            </div>
          </div>

          <button
            onClick={() => setModal("situacao")}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-semibold transition ${
              isDelayed
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-white/70 text-emerald-800 hover:bg-white dark:bg-black/20 dark:text-emerald-300"
            }`}
          >
            Ver Situação
          </button>
        </div>

        {/* Carteira Fortuna */}
        <div data-tour-id="fortuna">
          <FortunaWalletCard
            balances={fortunaBalances}
            loading={fortunaCarregando}
            onAdicionarCreditos={() => setModal("fortuna_recarga")}
            onAtualizar={buscarSaldoFortuna}
          />
        </div>

        {/* Grid de funcionalidades */}
        <section className="grid grid-cols-2 gap-2.5">
          <FeatureTile icon={<Leaf size={16} />} title="Minha Contribuição" subtitle="Composição e apoios" onClick={() => setModal("contribuicao")} />
          <FeatureTile
            tourId="agenda"
            icon={<CalendarCheck size={16} />}
            title="Agenda & Eventos"
            subtitle={agendaItems.length > 0 ? `${agendaItems.length} próximos` : "Palestras e Turmas"}
            onClick={() => setModal("agenda")}
          />
          <FeatureTile icon={<BookOpen size={16} />} title="Área de Estudos" subtitle="Biblioteca, apostilas e Acrópole Play" onClick={() => setModal("estudos")} />
          <FeatureTile icon={<HandHeart size={16} />} title="Voluntariado" subtitle="Secretarias e mutirões" onClick={() => setModal("voluntariado")} />
          <FeatureTile icon={<UsersRound size={16} />} title="Grupo de Acompanhamento" subtitle="Conheça e faça sua adesão ao GAF" onClick={() => setModal("gaf")} />
          <FeatureTile icon={<LifeBuoy size={16} />} title="Central de Ajuda" subtitle="Fale com a Economia" onClick={() => setModal("ajuda")} />
          <FeatureTile
            icon={<Compass size={16} />}
            title="Minha Jornada"
            subtitle={dashboard.streakMeses > 0 ? `${dashboard.streakMeses} meses em dia` : "Sua caminhada na escola"}
            onClick={() => setModal("jornada")}
          />
          <FeatureTile
            icon={<PiggyBank size={16} />}
            title="Transparência Financeira"
            subtitle="Veja como o dinheiro da escola é usado"
            onClick={() => setModal("transparencia")}
          />
        </section>
      </main>

      <a
        href={whatsappHref(schoolWhatsapp)}
        target="_blank"
        rel="noreferrer"
        aria-label="Falar com a escola no WhatsApp"
        className="fixed bottom-6 right-6 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg transition hover:scale-105 sm:absolute"
      >
        <MessageCircle size={26} />
      </a>

      {modal && (
        <BottomSheet open onOpenChange={(open) => !open && setModal(null)} title={MODAL_TITLES[modal]}>
          {modal === "cadastro" && (
            <ProfileEditPanel
              memberId={member.id}
              name={member.name}
              whatsapp={member.whatsapp}
              email={member.email}
              addressStreet={member.addressStreet}
              addressNumber={member.addressNumber}
              addressComplement={member.addressComplement}
              addressNeighborhood={member.addressNeighborhood}
              addressCity={member.addressCity}
              addressState={member.addressState}
              addressZip={member.addressZip}
              avatarUrl={member.avatarUrl}
            />
          )}
          {modal === "contribuicao" && (
            <MyContributionPanel
              memberId={member.id}
              compositionItems={member.compositionItems}
              initialAvailableToAdd={availableToAdd}
            />
          )}
          {modal === "situacao" && (
            <ContributionStatusPanel
              memberId={member.id}
              monthlyStatus={member.monthlyStatus}
              compositionTotal={compositionTotal}
              fortunaBalances={fortunaBalances}
              pixAutomaticStatus={member.pixAutomaticStatus}
            />
          )}
          {modal === "fortuna_recarga" && <FortunaTopUpPanel balances={fortunaBalances} memberId={member.id} />}
          {modal === "agenda" && <AgendaPanel memberId={member.id} items={agendaItems} />}
          {modal === "estudos" && <StudyAreaPanel />}
          {modal === "voluntariado" && <VolunteerPanel memberId={member.id} />}
          {modal === "ajuda" && <HelpPanel whatsapp={schoolWhatsapp} />}
          {modal === "gaf" && <GafPanel memberId={member.id} />}
          {modal === "jornada" && (
            <JornadaPanel
              dataEntrada={member.dataEntradaEscola ?? member.createdAt}
              streakMeses={dashboard.streakMeses}
              levelHistory={dashboard.levelHistory}
              badges={dashboard.badges}
              integrationCourses={dashboard.integrationCourses}
            />
          )}
          {modal === "transparencia" && <TransparenciaPanel memberId={member.id} />}
        </BottomSheet>
      )}
    </div>
  );
}

function FeatureTile({
  icon,
  title,
  subtitle,
  onClick,
  tourId,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  tourId?: string;
}) {
  return (
    <button
      data-tour-id={tourId}
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-2xl border border-gray-200 bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:border-na-gold dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-na-green-light text-na-green dark:bg-emerald-900/40 dark:text-emerald-400">
        {icon}
      </div>
      <h5 className="text-xs font-semibold text-gray-900 dark:text-gray-100">{title}</h5>
      <p className="text-[10px] text-gray-500 dark:text-gray-400">{subtitle}</p>
    </button>
  );
}
