"use client";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { logout } from "@/lib/actions/auth-actions";
import { getFortunaBalancesForMember } from "@/lib/actions/fortuna-member-actions";
import { whatsappHref } from "@/lib/format";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { MemberDashboard } from "@/lib/member-data";
import { PAGINA_BOLETIM_AURORA, type EdicaoAurora } from "@/lib/boletim-aurora";
import {
  BookOpen,
  BookOpenText,
  CalendarCheck,
  CheckCircle2,
  Coffee,
  ClipboardCheck,
  Compass,
  HandHeart,
  Heart,
  Presentation,
  Leaf,
  LifeBuoy,
  LogOut,
  MessageCircle,
  Newspaper,
  Pencil,
  PiggyBank,
  TriangleAlert,
  UsersRound,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import { situacaoGeral } from "@/lib/situacao-contribuicao";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FortunaWalletCard } from "./fortuna-wallet-card";
import { InstallPrompt } from "./install-prompt";
import { NudgeCard } from "./nudge-card";
import { OnboardingTour } from "./onboarding-tour";
import { AtivarNotificacoes } from "@/components/pwa/ativar-notificacoes";
import { AgendaPanel } from "./panels/agenda-panel";
import { ContributionStatusPanel } from "./panels/contribution-status-panel";
import { FortunaTopUpPanel } from "./panels/fortuna-topup-panel";
import { JornadaPanel } from "./panels/jornada-panel";
import { MyContributionPanel } from "./panels/my-contribution-panel";
import { ProfileEditPanel } from "./panels/profile-edit-panel";
import { StudyAreaPanel } from "./panels/study-area-panel";
import { TransparenciaPanel } from "./panels/transparencia-panel";
import { GafPanel, HelpPanel, VolunteerPanel } from "./misc-panels";
import { GruposEstudoPanel } from "./grupos-estudo-panel";
import { useAgendaComUlisses } from "@/lib/ulisses/navegador";
import { AvisosGrupos } from "./avisos-grupos";
import { AtalhoFavorito, DestaqueDoDia, registrarUso, useFavorita } from "./acesso-rapido";
import { BoasVindasVoluntario } from "./boas-vindas-voluntario";
import { BuscaPortal, type DestinoBusca } from "./busca-portal";
import { quandoDaOportunidade } from "@/lib/oportunidades-comum";
import { Anuncio, DestaqueDiario, DestaquePlay, Vitrine, type Destaque } from "./vitrine";

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
  | "grupos_estudo"
  | "jornada"
  | "transparencia"
  | "economia";

const DIA_VENCIMENTO = 10;
/** "04/11" a partir de "2026-11-04". */
const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

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

export function MemberPortalClient({ dashboard, eventoId, abrir, boletim }: { dashboard: MemberDashboard; eventoId?: string; abrir?: "voluntariado"; boletim?: EdicaoAurora | null }) {
  const { member, availableToAdd } = dashboard;
  // Eventos públicos do Ulisses lidos pelo navegador (ver lib/ulisses/navegador.ts).
  const agendaItems = useAgendaComUlisses(dashboard.agendaItems, member.school.ulissesFilialId, member.schoolId);
  const [modal, setModal] = useState<ModalKey | null>(eventoId ? "agenda" : abrir && dashboard.voluntariadoVisivel ? abrir : null);
  const [fortunaBalances, setFortunaBalances] = useState(dashboard.fortunaBalances);
  const [fortunaCarregando, setFortunaCarregando] = useState(true);
  const [tourVisivel, setTourVisivel] = useState(!eventoId && !abrir && !member.tourCompletedAt);

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

  // Verde (pago/até dia 10), amarelo (perdeu o desconto, ainda no mês) ou vermelho (mês encerrado sem pagamento) — ver situacao-contribuicao.ts.
  const situacao = situacaoGeral(member.monthlyStatus, member.status);
  const isDelayed = situacao === "em_atraso";
  const semDesconto = situacao === "sem_desconto";
  const schoolWhatsapp = member.school.whatsapp ?? member.whatsapp;
  const compositionTotal = member.compositionItems.reduce((soma, i) => soma + i.amount, 0);
  const proximoVencimento = calcularProximoVencimento(member.monthlyStatus);
  const t = getDictionary(member.school.language);
  // Asaas/PIX é só Brasil — decisão do usuário 2026-10-15: 1ª versão do
  // Portal em inglês não processa pagamento, só consulta (ver
  // ContributionStatusPanel/FortunaWalletCard/AgendaPanel, que recebem
  // `somenteConsulta` e escondem qualquer ação de cobrança).
  // Filiais em inglês (Mercury) e filiais ainda sem escrita no Mercúrio liberada (School.mercurioEscrita —
  // pedido do usuário 2026-10-19) só consultam; nas brasileiras aparece "em breve".
  const somenteConsulta = member.school.language === "en" || !member.school.mercurioEscrita;
  // Pagamento pelo Portal: escrita no Mercúrio liberada E conta Asaas da filial ligada (cobrança sempre pela subconta).
  const emBreve = member.school.language !== "en" && (!member.school.mercurioEscrita || !dashboard.cobraOnline);

  // Cartões da contribuição e do Fortuna: no quadro "Economia" e, quando for o caso, no acesso rápido (2026-10-29).
  const cartaoContribuicao = (
    <div
      data-tour-id="contribuicao-status"
      className={`flex flex-col gap-3 rounded-2xl border p-4 ${
        isDelayed
          ? "border-na-danger/40 bg-na-danger-light dark:border-red-900 dark:bg-red-950/30"
          : semDesconto
            ? "border-na-warning/40 bg-na-warning-light dark:border-amber-900 dark:bg-amber-950/30"
            : "border-na-success/40 bg-na-success-light dark:border-emerald-900 dark:bg-emerald-950/30"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            isDelayed
              ? "bg-na-danger-light text-na-danger-dark dark:bg-red-900/50 dark:text-red-300"
              : semDesconto
                ? "bg-na-warning-light text-na-warning-dark dark:bg-amber-900/50 dark:text-amber-300"
                : "bg-na-success-light text-na-success-dark dark:bg-emerald-900/50 dark:text-emerald-300"
          }`}
        >
          {isDelayed || semDesconto ? <TriangleAlert size={16} /> : <CheckCircle2 size={16} />}
        </div>
        <div>
          <h4
            className={`text-[13px] font-bold ${
              isDelayed ? "text-na-danger-dark dark:text-red-300" : semDesconto ? "text-na-warning-dark dark:text-amber-300" : "text-na-success-dark dark:text-emerald-300"
            }`}
          >
            {isDelayed ? t.home.contribuicaoPendente : semDesconto ? t.home.contribuicaoSemDesconto : t.home.contribuicaoEmDia}
          </h4>
          <p className="mt-0.5 text-xs text-gray-700 dark:text-gray-400">
            {semDesconto
              ? t.home.mensagemSemDesconto(member.name.split(" ")[0])
              : situacao === "a_vencer"
                ? t.home.mensagemAVencer(member.name.split(" ")[0])
                : `${t.home.ola(member.name.split(" ")[0])} ${isDelayed ? t.home.statusAtrasada : t.home.statusEmDia}.`}
          </p>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-500">
            {proximoVencimento.diasRestantes < 0
              ? t.home.venceuHa(Math.abs(proximoVencimento.diasRestantes), proximoVencimento.vencimento.getDate(), proximoVencimento.vencimento.getMonth() + 1)
              : proximoVencimento.diasRestantes === 0
                ? t.home.venceHoje
                : t.home.proximoVencimento(proximoVencimento.vencimento.getDate(), proximoVencimento.vencimento.getMonth() + 1, proximoVencimento.diasRestantes)}
          </p>
        </div>
      </div>

      <button
        onClick={() => setModal("situacao")}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-semibold transition ${
          isDelayed
            ? "bg-na-danger text-white hover:bg-red-700"
            : semDesconto
              ? "bg-na-warning-dark text-white hover:opacity-90 dark:bg-amber-600"
              : "bg-white/70 text-na-success-dark hover:bg-white dark:bg-black/20 dark:text-emerald-300"
        }`}
      >
        {t.home.verSituacao}
      </button>
      {!somenteConsulta && (
        <p className="text-center text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
          Pelo Portal, sua contribuição é atualizada assim que o pagamento é confirmado.
        </p>
      )}
      {emBreve && <p className="text-center text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">Pagamento pelo Portal: em breve na sua filial.</p>}
    </div>
  );
  const cartaoFortuna = (
    <div data-tour-id="fortuna">
      <FortunaWalletCard
        balances={fortunaBalances}
        loading={fortunaCarregando}
        onAdicionarCreditos={somenteConsulta ? undefined : () => setModal("fortuna_recarga")}
        onAtualizar={buscarSaldoFortuna}
      />
    </div>
  );
  // Contribuição no acesso rápido: atrasada, sem desconto ou a 5 dias (ou menos) do vencimento sem pagamento.
  const contribuicaoUrgente = isDelayed || semDesconto || (situacao === "a_vencer" && proximoVencimento.diasRestantes <= 5);
  const QUADROS: Record<string, { icone: React.ReactNode; titulo: string; subtitulo: string }> = {
    agenda: { icone: <CalendarCheck size={18} />, titulo: t.tiles.agenda.title, subtitulo: agendaItems.length > 0 ? t.tiles.agenda.subtitleComItens(agendaItems.length) : t.tiles.agenda.subtitleSemItens },
    estudos: { icone: <BookOpen size={18} />, titulo: t.tiles.estudos.title, subtitulo: t.tiles.estudos.subtitle },
    ...(dashboard.voluntariadoVisivel && { voluntariado: { icone: <HandHeart size={18} />, titulo: t.tiles.voluntariado.title, subtitulo: t.tiles.voluntariado.subtitle } }),
    gaf: { icone: <UsersRound size={18} />, titulo: dashboard.meusGafs.length ? dashboard.meusGafs.map((g) => g.nome).join(", ") : t.tiles.gaf.title, subtitulo: t.tiles.gaf.subtitle },
    grupos_estudo: { icone: <BookOpenText size={18} />, titulo: "Grupos de estudo", subtitulo: "Estudos e leituras comentadas" },
    jornada: { icone: <Compass size={18} />, titulo: t.tiles.jornada.title, subtitulo: t.tiles.jornada.subtitleSemStreak },
    transparencia: { icone: <PiggyBank size={18} />, titulo: t.tiles.transparencia.title, subtitulo: t.tiles.transparencia.subtitle },
    ajuda: { icone: <LifeBuoy size={18} />, titulo: t.tiles.ajuda.title, subtitulo: t.tiles.ajuda.subtitle },
  };
  const favorita = useFavorita(member.id, ["economia", ...Object.keys(QUADROS)]);
  useEffect(() => {
    if (modal) registrarUso(member.id, modal);
  }, [modal, member.id]);
  const agoraMs = new Date().setHours(0, 0, 0, 0);
  const proximosEventos = agendaItems
    .flatMap((i) => (i.kind === "evento" && i.date.getTime() >= agoraMs && i.status !== "cancelado" ? [{ id: i.id, titulo: i.title, data: i.date }] : []))
    .sort((a, b) => a.data.getTime() - b.data.getTime())
    .slice(0, 3);

  // Vitrine do centro (pedido do usuário 2026-10-29): um destaque por vez, trocando a cada 5 segundos.
  const saldoFortuna = fortunaBalances.find((b) => b.isHome) ?? fortunaBalances[0];
  const podeIncluirCrianca = !somenteConsulta && availableToAdd.some((i) => /crian[cç]a.*bem/i.test(i.label));
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  // Busca de funções (pedido do usuário 2026-10-29): só o que a pessoa tem no Portal, com o mesmo destino dos quadros.
  const abrirModal = (m: ModalKey) => ({ abrir: () => setModal(m) });
  const destinosBusca: Record<string, DestinoBusca | false> = {
    economia: abrirModal("economia"),
    situacao: abrirModal("situacao"),
    contribuicao: abrirModal("contribuicao"),
    fortuna: fortunaBalances.length > 0 && abrirModal(somenteConsulta ? "economia" : "fortuna_recarga"),
    agenda: abrirModal("agenda"),
    meus_eventos: { href: "/eventos" },
    atendimentos: dashboard.podeMarcarAtendimento && { href: "/atendimentos" },
    estudos: abrirModal("estudos"),
    anotacoes: { href: "/estudos/anotacoes" },
    livros: { href: "/estudos/livros" },
    play: dashboard.recursos.acropole_play && { href: "/api/portal/acropole-play/entrar", externo: true },
    biblioteca: { href: "https://biblioteca.acropolebrasil.com.br/", externo: true },
    bastioes: dashboard.bibliotecaLiberada && { href: "https://bastiao.oinabn.com.br/", externo: true },
    gaf: (dashboard.recursos.gaf || dashboard.meusGafs.length > 0 || dashboard.gafsDisponiveis.length > 0) && abrirModal("gaf"),
    diario: dashboard.meusGafs.length > 0 && { href: "/diario" },
    diario_historico: dashboard.meusGafs.length > 0 && { href: "/diario/historico" },
    grupos_estudo: dashboard.gruposDeEstudo.length > 0 && abrirModal("grupos_estudo"),
    voluntariado: dashboard.voluntariadoVisivel && abrirModal("voluntariado"),
    area_voluntario: dashboard.areaVoluntario && { href: "/voluntario" },
    pedagogos: !!dashboard.pedagogos && { href: `/grupos/${dashboard.pedagogos.grupoId}?aba=escala` },
    avaliacao: !!dashboard.avaliacao && { href: "/avaliacao" },
    ajuda: abrirModal("ajuda"),
    jornada: abrirModal("jornada"),
    transparencia: dashboard.recursos.transparencia && abrirModal("transparencia"),
    cadastro: abrirModal("cadastro"),
    whatsapp: !!schoolWhatsapp && { href: whatsappHref(schoolWhatsapp), externo: true },
    boletim: { href: boletim?.link ?? PAGINA_BOLETIM_AURORA, externo: true },
  };

  const destaques = ([
    contribuicaoUrgente && { id: "contribuicao", conteudo: cartaoContribuicao },
    // Pedagogo com apresentação marcada e plano ainda por entregar (2026-10-29).
    dashboard.pedagogos?.proxima &&
      ["no_prazo", "atrasado", "devolvido"].includes(dashboard.pedagogos.proxima.situacao) && {
        id: "pedagogos",
        conteudo: (
          <Anuncio
            tom={dashboard.pedagogos.proxima.situacao === "no_prazo" ? "ouro" : "claro"}
            icone={<Presentation size={20} />}
            rotulo={`Sua apresentação · ${dataCurta(dashboard.pedagogos.proxima.data)}`}
            titulo={dashboard.pedagogos.proxima.tema}
            texto={
              dashboard.pedagogos.proxima.situacao === "devolvido"
                ? "O instrutor pediu ajustes no plano de aula."
                : dashboard.pedagogos.proxima.situacao === "atrasado"
                  ? `O plano de aula era até ${dataCurta(dashboard.pedagogos.proxima.prazo)}. Entregue assim que puder.`
                  : `Entregue o plano de aula até ${dataCurta(dashboard.pedagogos.proxima.prazo)}.`
            }
            acao="Abrir o plano de aula"
            href={`/grupos/${dashboard.pedagogos.proxima.grupoId}?aba=escala`}
          />
        ),
      },
    favorita && favorita !== "economia" && QUADROS[favorita] && {
      id: "favorita",
      conteudo: <Anuncio icone={QUADROS[favorita].icone} rotulo="Acesso rápido · o que você mais usa" titulo={QUADROS[favorita].titulo} texto={QUADROS[favorita].subtitulo} acao="Abrir" onClick={() => setModal(favorita as ModalKey)} />,
    },
    proximosEventos.length > 0 && {
      id: "eventos",
      conteudo: (
        <Anuncio
          icone={<CalendarCheck size={20} />}
          rotulo="Próximos eventos"
          titulo={proximosEventos[0].titulo}
          extra={
            <span className="mt-1 flex flex-col gap-0.5">
              {proximosEventos.map((e) => (
                <span key={e.id} className="flex items-baseline gap-2 text-[12px]">
                  <span className="w-10 shrink-0 font-bold text-gray-500 tabular-nums">{e.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                  <span className="truncate text-gray-700 dark:text-gray-300">{e.titulo}</span>
                </span>
              ))}
            </span>
          }
          acao="Ver a agenda"
          onClick={() => setModal("agenda")}
        />
      ),
    },
    dashboard.recursos.acropole_play && { id: "play", conteudo: <DestaquePlay /> },
    dashboard.meusGafs.length > 0 && { id: "diario", conteudo: <DestaqueDiario /> },
    saldoFortuna && {
      id: "fortuna",
      conteudo: (
        <Anuncio
          tom={favorita === "economia" ? "ouro" : "claro"}
          icone={<Coffee size={20} />}
          rotulo={`Fortuna · ${saldoFortuna.branchTitle}`}
          titulo="Coloque mais crédito e evite filas!"
          texto={
            <>
              Seu saldo: <strong>{brl(saldoFortuna.amount)}</strong>
            </>
          }
          acao={somenteConsulta ? "Ver a carteira" : "Adicionar créditos"}
          onClick={() => setModal(somenteConsulta ? "economia" : "fortuna_recarga")}
        />
      ),
    },
    {
      id: "crianca",
      conteudo: (
        <Anuncio
          tom="ouro"
          icone={<Heart size={20} />}
          rotulo="Criança para o Bem"
          titulo="Uma doação que muda o dia de uma criança"
          texto="Você pode ajudar com o transporte, com as oficinas e o lanche, ou apadrinhar uma criança."
          acao={podeIncluirCrianca ? "Incluir na minha contribuição" : "Conhecer o projeto"}
          {...(podeIncluirCrianca ? { onClick: () => setModal("contribuicao") } : { href: "https://criancaparaobem.org.br/", externo: true })}
        />
      ),
    },
    dashboard.meusGafs.length === 0 && (dashboard.recursos.gaf || dashboard.gafsDisponiveis.length > 0) && {
      id: "gaf",
      conteudo: (
        <Anuncio
          icone={<UsersRound size={20} />}
          rotulo="Grupo de Acompanhamento Filosófico"
          titulo="Você ainda não participa do GAF?"
          texto="Encontros em grupo para ler e conversar sobre os textos de trabalho, levando a filosofia para a vida."
          acao="Conhecer os grupos"
          onClick={() => setModal("gaf")}
        />
      ),
    },
    // Com oportunidade aberta, o destaque mostra a mais próxima (também para quem já é voluntário).
    dashboard.voluntariadoVisivel && dashboard.oportunidades && {
      id: "voluntariado",
      conteudo: (
        <Anuncio
          tom="verde"
          icone={<HandHeart size={20} />}
          rotulo={dashboard.oportunidades.total === 1 ? "Voluntariado · 1 oportunidade aberta" : `Voluntariado · ${dashboard.oportunidades.total} oportunidades abertas`}
          titulo={dashboard.oportunidades.proxima?.titulo ?? "Sua escola precisa de você"}
          texto={
            dashboard.oportunidades.proxima
              ? `${dashboard.oportunidades.proxima.area} · ${quandoDaOportunidade(dashboard.oportunidades.proxima)}`
              : "Você já se ofereceu para as oportunidades abertas. Obrigado!"
          }
          acao={dashboard.oportunidades.proxima ? "Quero ajudar" : "Ver oportunidades"}
          onClick={() => setModal("voluntariado")}
        />
      ),
    },
    dashboard.voluntariadoVisivel && !dashboard.oportunidades && !dashboard.areaVoluntario && {
      id: "voluntariado",
      conteudo: (
        <Anuncio
          tom="verde"
          icone={<HandHeart size={20} />}
          rotulo="Voluntariado"
          titulo="Você sabia que “Voluntário” significa “aquele que faz por força da Vontade”?"
          texto="Conheça as oportunidades de Voluntariado da sua escola, e ajude ainda mais pessoas através desse ideal!"
          acao="Quero ajudar"
          onClick={() => setModal("voluntariado")}
        />
      ),
    },
    !contribuicaoUrgente && {
      id: "contribuicao",
      conteudo: (
        <Anuncio
          icone={<Wallet size={20} />}
          rotulo="Minha contribuição"
          titulo={t.home.contribuicaoEmDia}
          texto={proximoVencimento.diasRestantes > 0 ? t.home.proximoVencimento(proximoVencimento.vencimento.getDate(), proximoVencimento.vencimento.getMonth() + 1, proximoVencimento.diasRestantes) : undefined}
          acao={t.home.verSituacao}
          onClick={() => setModal("economia")}
        />
      ),
    },
  ] as (Destaque | false | null | undefined | "")[]).filter((d): d is Destaque => !!d);
  const emPortugues = member.school.language !== "en";


  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col border border-gray-200 bg-white shadow-xl sm:my-5 sm:rounded-[28px] dark:border-gray-800 dark:bg-gray-900">
      {tourVisivel && <OnboardingTour memberId={member.id} onFechar={() => setTourVisivel(false)} />}
      {!tourVisivel && dashboard.boasVindasVoluntario && <BoasVindasVoluntario memberId={member.id} nome={member.name.split(" ")[0]} dados={dashboard.boasVindasVoluntario} />}
      <header className="relative border-b border-gray-100 bg-white px-5 pt-6 pb-4 text-center dark:border-gray-800 dark:bg-gray-900">
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <ThemeToggle className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800" />
          <button
            onClick={() => logout()}
            title={t.home.sair}
            aria-label={t.home.sair}
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800"
          >
            <LogOut size={16} />
          </button>
        </div>
        <div className="mb-5 flex justify-center">
          <Image src="/na-logo.png" alt={member.school.name} width={160} height={104} className="h-auto w-40 dark:brightness-0 dark:invert" />
        </div>

        <div data-tour-id="welcome" className="rounded-2xl bg-gradient-to-br from-na-green-dark to-na-green p-4 text-left text-white">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold tracking-wide text-na-gold uppercase">{/* "Membro" só para membros (2º nível em diante); N1 e programa complementar veem "Aluno" — pedido do usuário 2026-10-22. */}{dashboard.bibliotecaLiberada ? t.home.portalDoMembro : t.home.portalDoAluno}</span>
            <button
              onClick={() => setModal("cadastro")}
              className="flex shrink-0 items-center gap-1 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-[10px] font-semibold whitespace-nowrap transition hover:bg-white/25"
            >
              <Pencil size={11} /> {t.home.editarDados}
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
              {t.home.matricula}: <strong>#{member.registrationNo ?? "—"}</strong>
            </span>
          </div>
          {dashboard.areaVoluntario && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Link href="/voluntario" className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white/90 transition hover:bg-white/25">
                <HandHeart size={11} /> {t.home.portalDoVoluntario}
                {dashboard.pendenciasVoluntario > 0 && (
                  <span className="ml-0.5 rounded-full bg-na-danger px-1.5 text-[9px] font-bold text-white" aria-label={`${dashboard.pendenciasVoluntario} pedidos aguardando`}>
                    {dashboard.pendenciasVoluntario}
                  </span>
                )}
              </Link>
            </div>
          )}
        </div>
      </header>

      <InstallPrompt />

      <main className="flex flex-1 flex-col gap-4 bg-na-bg p-5 pb-24 dark:bg-gray-950">
        {member.school.language !== "en" && <BuscaPortal destinos={Object.fromEntries(Object.entries(destinosBusca).filter(([, d]) => d)) as Record<string, DestinoBusca>} />}
        <NudgeCard memberId={member.id} />
        <AvisosGrupos avisos={dashboard.avisosGrupos} />
        <AtivarNotificacoes aguardar={tourVisivel} />

        {/* Acesso rápido (pedido do usuário 2026-10-29): contribuição perto do vencimento, o quadro mais usado ou,
            sem nada a destacar, a frase do dia (alternando com o Acrópole Play) e os próximos eventos. */}
        {emPortugues ? (
          <Vitrine destaques={destaques} />
        ) : (
          <section aria-label="Acesso rápido" className="flex flex-col gap-3">
            {contribuicaoUrgente && cartaoContribuicao}
            {favorita === "economia" && !contribuicaoUrgente && cartaoFortuna}
            {favorita && favorita !== "economia" && QUADROS[favorita] && <AtalhoFavorito {...QUADROS[favorita]} onClick={() => setModal(favorita as ModalKey)} />}
            {!contribuicaoUrgente && !favorita && (
              <DestaqueDoDia frase={dashboard.fraseDoDia} acropolePlay={dashboard.recursos.acropole_play} eventos={proximosEventos} abrirAgenda={() => setModal("agenda")} />
            )}
          </section>
        )}

        {/* Grid de funcionalidades */}
        <section className="grid grid-cols-2 gap-2.5">
          <FeatureTile
            tourId="economia"
            icon={<Wallet size={16} />}
            title={t.tiles.economia.title}
            subtitle={isDelayed ? t.home.contribuicaoPendente : semDesconto ? t.home.contribuicaoSemDesconto : t.tiles.economia.subtitle}
            onClick={() => setModal("economia")}
          />
          <FeatureTile
            tourId="agenda"
            icon={<CalendarCheck size={16} />}
            title={t.tiles.agenda.title}
            subtitle={agendaItems.length > 0 ? t.tiles.agenda.subtitleComItens(agendaItems.length) : t.tiles.agenda.subtitleSemItens}
            onClick={() => setModal("agenda")}
          />
          <FeatureTile icon={<BookOpen size={16} />} title={t.tiles.estudos.title} subtitle={t.tiles.estudos.subtitle} onClick={() => setModal("estudos")} />
          {/* Voluntariado, GAF e Transparência só aparecem se a filial liberou (Administração da filial). */}
          {dashboard.voluntariadoVisivel && (
            <FeatureTile icon={<HandHeart size={16} />} title={t.tiles.voluntariado.title} subtitle={t.tiles.voluntariado.subtitle} onClick={() => setModal("voluntariado")} />
          )}
          {(dashboard.recursos.gaf || dashboard.meusGafs.length > 0) && (
            <FeatureTile icon={<UsersRound size={16} />} title={t.tiles.gaf.title} subtitle={dashboard.meusGafs.length ? dashboard.meusGafs.map((g) => g.nome).join(", ") : t.tiles.gaf.subtitle} onClick={() => setModal("gaf")} />
          )}
          {dashboard.gruposDeEstudo.length > 0 && (
            <FeatureTile
              icon={<BookOpenText size={16} />}
              title="Grupos de estudo"
              subtitle={dashboard.gruposDeEstudo.some((g) => g.participo) ? dashboard.gruposDeEstudo.filter((g) => g.participo).map((g) => g.nome).join(", ") : "Estudos e leituras comentadas abertos"}
              onClick={() => setModal("grupos_estudo")}
            />
          )}
          {dashboard.pedagogos && (
            <Link
              href={`/grupos/${dashboard.pedagogos.grupoId}?aba=escala`}
              className="flex flex-col items-start gap-2 rounded-2xl border border-gray-200 bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:border-na-gold dark:border-gray-800 dark:bg-gray-900"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-na-green-light text-na-green dark:bg-emerald-900/40 dark:text-emerald-400">
                <Presentation size={16} />
              </span>
              <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">Turma de pedagogos</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {dashboard.pedagogos.proxima ? `Apresenta em ${dataCurta(dashboard.pedagogos.proxima.data)}` : "Escala e planos de aula"}
              </span>
            </Link>
          )}
          <FeatureTile icon={<LifeBuoy size={16} />} title={t.tiles.ajuda.title} subtitle={t.tiles.ajuda.subtitle} onClick={() => setModal("ajuda")} />
          <FeatureTile
            icon={<Compass size={16} />}
            title={t.tiles.jornada.title}
            subtitle={dashboard.streakMeses > 0 ? t.tiles.jornada.subtitleComStreak(dashboard.streakMeses) : t.tiles.jornada.subtitleSemStreak}
            onClick={() => setModal("jornada")}
          />
          {dashboard.avaliacao && (
            <Link
              href="/avaliacao"
              className="flex flex-col items-start gap-2 rounded-2xl border border-na-gold/50 bg-na-gold/10 p-3.5 text-left transition hover:-translate-y-0.5 hover:border-na-gold dark:border-amber-900 dark:bg-amber-950/20"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-na-gold/20 text-na-gold-dark dark:text-amber-300">
                <ClipboardCheck size={16} />
              </span>
              <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">Avaliação dos instrutores</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">Anônima · poucos minutos</span>
            </Link>
          )}
          {dashboard.recursos.transparencia && (
            <FeatureTile
              icon={<PiggyBank size={16} />}
              title={t.tiles.transparencia.title}
              subtitle={t.tiles.transparencia.subtitle}
              onClick={() => setModal("transparencia")}
            />
          )}
        </section>

        {/* Boletim Aurora (pedido do usuário 2026-10-26): novidades mensais da Nova Acrópole, edição mais recente. */}
        {member.school.language !== "en" && (
          <a
            href={boletim?.link ?? PAGINA_BOLETIM_AURORA}
            target="_blank"
            rel="noreferrer"
            className="mt-2.5 flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-na-gold dark:border-gray-800 dark:bg-gray-900"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-na-green-light text-na-green dark:bg-emerald-900/40 dark:text-emerald-400">
              <Newspaper size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold tracking-wide text-na-green-dark uppercase dark:text-emerald-400">Boletim Aurora{boletim ? ` · ${boletim.titulo}` : ""}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs text-gray-700 dark:text-gray-300">{boletim?.resumo || "Novidades e ações da Nova Acrópole no Brasil, todo mês."}</span>
              <span className="mt-1 block text-[11px] font-semibold text-na-green-dark dark:text-emerald-400">Ler a edição →</span>
            </span>
          </a>
        )}
        {/* Frase do dia (pedido do usuário 2026-10-29), embaixo de tudo, quando não está no acesso rápido. */}
        {/* A frase do dia fica sempre no fim: a vitrine do centro não a mostra mais. */}
        {emPortugues && (
          <figure className="mt-6 mb-16 px-2 text-center">
            <blockquote className="text-[13px] leading-relaxed text-gray-600 italic dark:text-gray-400">“{dashboard.fraseDoDia.texto}”</blockquote>
            <figcaption className="mt-1 text-[11px] font-semibold text-gray-500 dark:text-gray-500">
              — {dashboard.fraseDoDia.autor}
              {dashboard.fraseDoDia.obra ? `, ${dashboard.fraseDoDia.obra}` : ""}
            </figcaption>
          </figure>
        )}
      </main>

      <a
        href={whatsappHref(schoolWhatsapp)}
        target="_blank"
        rel="noreferrer"
        aria-label={t.home.falarNoWhatsapp}
        className="fixed bottom-6 right-6 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg transition hover:scale-105 sm:absolute"
      >
        <MessageCircle size={26} />
      </a>

      {modal && (
        <BottomSheet open onOpenChange={(open) => !open && setModal(null)} title={modal === "gaf" && dashboard.meusGafs.length ? (dashboard.meusGafs.length === 1 ? dashboard.meusGafs[0].nome : "Meus GAFs") : t.modalTitles[modal]}>
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
          {modal === "economia" && (
            <div className="flex flex-col gap-4">
              {cartaoContribuicao}
              <button onClick={() => setModal("contribuicao")} className="flex items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white p-3.5 text-left transition hover:border-na-gold dark:border-gray-800 dark:bg-gray-900">
                <span className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-na-green-light text-na-green dark:bg-emerald-900/40 dark:text-emerald-400">
                    <Leaf size={16} />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-gray-900 dark:text-gray-100">{t.tiles.contribuicao.title}</span>
                    <span className="block text-[10px] text-gray-500 dark:text-gray-400">{t.tiles.contribuicao.subtitle}</span>
                  </span>
                </span>
              </button>
              {cartaoFortuna}
            </div>
          )}
          {modal === "contribuicao" && (
            <MyContributionPanel
              memberId={member.id}
              compositionItems={member.compositionItems}
              initialAvailableToAdd={availableToAdd}
              somenteConsulta={somenteConsulta}
            />
          )}
          {modal === "situacao" && (
            <ContributionStatusPanel
              memberId={member.id}
              monthlyStatus={member.monthlyStatus}
              confirmedCharges={member.paymentCharges}
              compositionTotal={compositionTotal}
              fortunaBalances={fortunaBalances}
              pixAutomaticStatus={member.pixAutomaticStatus}
              pixAutomaticoDisponivel={dashboard.pixAutomaticoDisponivel}
              somenteConsulta={somenteConsulta}
              emBreve={emBreve}
            />
          )}
          {modal === "fortuna_recarga" && <FortunaTopUpPanel balances={fortunaBalances} memberId={member.id} />}
          {modal === "agenda" && <AgendaPanel memberId={member.id} items={agendaItems} somenteConsulta={somenteConsulta} emBreve={emBreve} eventoId={eventoId} podeMarcarAtendimento={dashboard.podeMarcarAtendimento} agoraReconectar={dashboard.agoraReconectar} />}
          {modal === "estudos" && <StudyAreaPanel mostrarAcropolePlay={dashboard.recursos.acropole_play} mostrarApostilas={dashboard.recursos.apostilas} mostrarBastioes={dashboard.bibliotecaLiberada} />}
          {modal === "voluntariado" && <VolunteerPanel memberId={member.id} />}
          {modal === "ajuda" && <HelpPanel whatsapp={schoolWhatsapp} />}
          {modal === "gaf" && <GafPanel memberId={member.id} gafs={dashboard.meusGafs} disponiveis={dashboard.gafsDisponiveis} />}
          {modal === "grupos_estudo" && <GruposEstudoPanel grupos={dashboard.gruposDeEstudo} />}
          {modal === "jornada" && (
            <JornadaPanel
              dataEntrada={member.dataEntradaEscola}
              dataSegundoNivel={member.dataSegundoNivel}
              streakMeses={dashboard.streakMeses}
              levelHistory={dashboard.levelHistory}
              badges={dashboard.badges}
              integrationCourses={dashboard.integrationCourses}
              eventHistory={dashboard.eventHistory}
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
