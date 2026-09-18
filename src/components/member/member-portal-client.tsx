"use client";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { logout } from "@/lib/actions/auth-actions";
import type { MemberDashboard } from "@/lib/member-data";
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  HandHeart,
  Leaf,
  LifeBuoy,
  LogOut,
  MessageCircle,
  Pencil,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { FortunaWalletCard } from "./fortuna-wallet-card";
import { AgendaPanel } from "./panels/agenda-panel";
import { ContributionStatusPanel } from "./panels/contribution-status-panel";
import { FortunaTopUpPanel } from "./panels/fortuna-topup-panel";
import { MyContributionPanel } from "./panels/my-contribution-panel";
import { ProfileEditPanel } from "./panels/profile-edit-panel";
import { StudyAreaPanel } from "./panels/study-area-panel";
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
  | "gaf";

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
};

export function MemberPortalClient({ dashboard }: { dashboard: MemberDashboard }) {
  const { member, fortunaBalances, agendaItems, availableToAdd } = dashboard;
  const [modal, setModal] = useState<ModalKey | null>(null);

  const isDelayed = member.status === "atrasado" || member.status === "negociando";
  const schoolWhatsapp = member.school.whatsapp ?? member.whatsapp;
  const compositionTotal = member.compositionItems.reduce((soma, i) => soma + i.amount, 0);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col border border-gray-200 bg-white shadow-xl sm:my-5 sm:rounded-[28px] dark:border-gray-800 dark:bg-gray-900">
      <header className="relative border-b border-gray-100 bg-white px-5 pt-6 pb-4 text-center dark:border-gray-800 dark:bg-gray-900">
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <ThemeToggle className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800" />
          <button
            onClick={() => logout()}
            title="Sair"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800"
          >
            <LogOut size={16} />
          </button>
        </div>
        <div className="mb-5 flex justify-center">
          <Image src="/na-logo.png" alt={member.school.name} width={160} height={48} className="h-auto w-40 dark:brightness-0 dark:invert" />
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-na-green-dark to-na-green p-4 text-left text-white">
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
              className="flex items-center gap-1 rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-[10px] font-semibold transition hover:bg-white/25"
            >
              <Pencil size={11} /> Editar Dados
            </button>
          </div>
          <div className="mt-3 mb-1 text-base font-bold">{member.name}</div>
          <div className="flex justify-between border-t border-white/15 pt-2.5 text-[11px] text-green-100">
            <span>{member.school.city ?? member.school.name}</span>
            <span>
              Matrícula: <strong>#{member.registrationNo ?? "—"}</strong>
            </span>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 bg-na-bg p-5 pb-24 dark:bg-gray-950">
        {/* Status financeiro */}
        <div
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
        <FortunaWalletCard balances={fortunaBalances} onAdicionarCreditos={() => setModal("fortuna_recarga")} />

        {/* Grid de funcionalidades */}
        <section className="grid grid-cols-2 gap-2.5">
          <FeatureTile icon={<Leaf size={16} />} title="Minha Contribuição" subtitle="Composição e apoios" onClick={() => setModal("contribuicao")} />
          <FeatureTile
            icon={<CalendarCheck size={16} />}
            title="Agenda & Eventos"
            subtitle={agendaItems.length > 0 ? `${agendaItems.length} próximos` : "Palestras e Turmas"}
            onClick={() => setModal("agenda")}
          />
          <FeatureTile icon={<BookOpen size={16} />} title="Área de Estudos" subtitle="Biblioteca, apostilas e Acrópole Play" onClick={() => setModal("estudos")} />
          <FeatureTile icon={<HandHeart size={16} />} title="Voluntariado" subtitle="Secretarias e mutirões" onClick={() => setModal("voluntariado")} />
          <FeatureTile icon={<UsersRound size={16} />} title="Grupo de Acompanhamento" subtitle="Conheça e faça sua adesão ao GAF" onClick={() => setModal("gaf")} />
          <FeatureTile icon={<LifeBuoy size={16} />} title="Central de Ajuda" subtitle="Fale com a Economia" onClick={() => setModal("ajuda")} />
        </section>
      </main>

      <a
        href={`https://wa.me/${schoolWhatsapp.replace(/\D/g, "")}`}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 flex h-13 w-13 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg transition hover:scale-105 sm:absolute"
        style={{ width: 52, height: 52 }}
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
            <ContributionStatusPanel memberId={member.id} monthlyStatus={member.monthlyStatus} compositionTotal={compositionTotal} />
          )}
          {modal === "fortuna_recarga" && <FortunaTopUpPanel balances={fortunaBalances} />}
          {modal === "agenda" && <AgendaPanel memberId={member.id} items={agendaItems} />}
          {modal === "estudos" && <StudyAreaPanel />}
          {modal === "voluntariado" && <VolunteerPanel />}
          {modal === "ajuda" && <HelpPanel whatsapp={schoolWhatsapp} />}
          {modal === "gaf" && <GafPanel />}
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
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
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
