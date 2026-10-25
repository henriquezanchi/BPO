"use client";

import { AtivarNotificacoes, pedirNotificacoes } from "@/components/pwa/ativar-notificacoes";
import { getMinhasSolicitacoes, oferecerApoioVoluntario, solicitarAdesaoGaf } from "@/lib/actions/misc-request-actions";
import { formatDateBR, whatsappHref } from "@/lib/format";
import type { ResumoGrupo } from "@/lib/grupos-dados";
import { CalendarClock, ChevronRight, HandHeart, Loader2 } from "lucide-react";
import { MODALIDADES } from "@/lib/grupos-comum";
import { SECRETARIAS_OFERTA } from "@/lib/secretarias";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

const SECRETARIAS = SECRETARIAS_OFERTA;

/**
 * Antes só mudava um estado local do React — nada era salvo, ninguém na
 * escola via o pedido (bug real encontrado 2026-09-22). Agora persiste de
 * verdade (ver misc-request-actions.ts) e aparece no detalhe do membro no
 * Painel do Diretor.
 */
export type GafDisponivel = { id: string; nome: string; descricao: string | null; modalidade: string | null; local: string | null; pedidoEm: string | null };

/**
 * GAF no Portal do Aluno. Desde 2026-10-25 (pedido do usuário) o aluno vê os GAFs da filial que o aceitam,
 * escolhe um e envia o pedido, que cai na página daquele GAF para a coordenação aceitar. Sem GAF disponível,
 * continua o pedido geral (a administração encaminha).
 */
export function GafPanel({ memberId, gafs = [], disponiveis = [] }: { memberId: string; gafs?: ResumoGrupo[]; disponiveis?: GafDisponivel[] }) {
  const [solicitadoEm, setSolicitadoEm] = useState<Date | null | undefined>(undefined);
  const [pedidos, setPedidos] = useState<Record<string, string>>(() => Object.fromEntries(disponiveis.filter((g) => g.pedidoEm).map((g) => [g.id, g.pedidoEm!])));
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getMinhasSolicitacoes(memberId).then((r) => setSolicitadoEm(r.gafSolicitadoEm));
  }, [memberId]);

  function handleSolicitar(classGroupId?: string) {
    setErro(null);
    startTransition(async () => {
      const r = await solicitarAdesaoGaf(memberId, classGroupId);
      if (!r.ok) return setErro(r.error);
      setSolicitadoEm(new Date());
      if (classGroupId) setPedidos((atual) => ({ ...atual, [classGroupId]: new Date().toISOString() }));
      setEscolhido(null);
      pedirNotificacoes("Pedido enviado. Quer ser avisado dos encontros do GAF?");
    });
  }

  return (
    <div className="text-left">
      {gafs.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-[11px] font-bold text-gray-500 uppercase dark:text-gray-400">Seus GAFs</p>
          {gafs.map((g) => (
            <Link key={g.id} href={`/grupos/${g.id}?de=portal`} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{g.nome}</span>
                <span className="flex items-center gap-1 text-[11px] text-gray-500 capitalize dark:text-gray-400">
                  <CalendarClock size={11} />
                  {g.proximoEncontro
                    ? new Date(g.proximoEncontro).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                    : "sem encontro marcado"}
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-gray-300" />
            </Link>
          ))}
        </div>
      )}
      <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
        O <strong>Grupo de Acompanhamento Filosófico (GAF)</strong> é um espaço criado para apoiar o aluno em sua
        jornada de vivência prática da filosofia, com encontros periódicos e acompanhamento próximo por instrutores.
      </p>

      {disponiveis.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold text-gray-500 uppercase dark:text-gray-400">Escolha o GAF</p>
          {disponiveis.map((g) => {
            const pedido = pedidos[g.id];
            const marcado = escolhido === g.id;
            return (
              <label
                key={g.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                  pedido ? "cursor-default border-gray-200 opacity-70 dark:border-gray-700" : marcado ? "border-na-green bg-na-green-light dark:bg-emerald-950/30" : "border-gray-200 hover:border-na-green/50 dark:border-gray-700"
                }`}
              >
                <input type="radio" name="gaf" disabled={!!pedido} checked={marcado} onChange={() => setEscolhido(g.id)} className="mt-1 h-4 w-4 accent-na-green" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{g.nome}</span>
                  {(g.modalidade || g.local) && (
                    <span className="block text-[11px] text-gray-500 dark:text-gray-400">{[g.modalidade && MODALIDADES[g.modalidade], g.local].filter(Boolean).join(" · ")}</span>
                  )}
                  {g.descricao && <span className="mt-0.5 line-clamp-2 block text-[12px] text-gray-600 dark:text-gray-400">{g.descricao}</span>}
                  {pedido && <span className="mt-1 block text-[11px] font-semibold text-na-green-dark dark:text-emerald-400">Pedido enviado em {formatDateBR(new Date(pedido))}</span>}
                </span>
              </label>
            );
          })}
          <button
            disabled={isPending || !escolhido}
            onClick={() => escolhido && handleSolicitar(escolhido)}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <HandHeart size={16} />}
            {escolhido ? "Enviar pedido para este GAF" : "Escolha um GAF acima"}
          </button>
        </div>
      ) : (
        <>
          {solicitadoEm && <p className="mb-2 text-[11px] text-gray-400 dark:text-gray-500">Última solicitação: {formatDateBR(solicitadoEm)}</p>}
          <p className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">Nenhum GAF com vagas abertas para você agora. Envie o pedido e a escola avisa quando houver.</p>
          <button
            disabled={isPending || solicitadoEm === undefined}
            onClick={() => handleSolicitar()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <HandHeart size={16} />}
            {solicitadoEm ? "Solicitar de novo" : "Quero participar de um GAF"}
          </button>
        </>
      )}
      {erro && <p className="mt-2 text-[12px] text-na-danger-dark dark:text-red-300">{erro}</p>}
    </div>
  );
}

export function VolunteerPanel({ memberId }: { memberId: string }) {
  const [active, setActive] = useState<string[]>([]);
  const [oferecidoEm, setOferecidoEm] = useState<Date | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getMinhasSolicitacoes(memberId).then((r) => setOferecidoEm(r.voluntariadoOferecidoEm));
  }, [memberId]);

  function toggle(tag: string) {
    setActive((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function handleOferecer() {
    if (active.length === 0) {
      setErro("Selecione pelo menos uma secretaria.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      await oferecerApoioVoluntario(memberId, active);
      setOferecidoEm(new Date());
      setActive([]);
    });
  }

  return (
    <div className="text-left">
      <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">Ofereça-se para ajudar no funcionamento da escola:</p>
      {oferecidoEm && (
        <p className="mb-2 text-[11px] text-gray-400 dark:text-gray-500">Última oferta: {formatDateBR(oferecidoEm)}</p>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        {SECRETARIAS.map((s) => (
          <button
            key={s}
            onClick={() => toggle(s)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
              active.includes(s)
                ? "border-na-green bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-400"
                : "border-gray-200 bg-gray-50 text-gray-700 hover:border-na-green dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {erro && <p className="mb-2 text-[11px] text-na-danger-dark dark:text-red-400">{erro}</p>}
      <button
        disabled={isPending || oferecidoEm === undefined}
        onClick={handleOferecer}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <HandHeart size={16} />} Me oferecer para apoiar
      </button>
    </div>
  );
}

const FAQ: { pergunta: string; resposta: string }[] = [
  {
    pergunta: "Como funciona o débito automático (Pix Automático)?",
    resposta:
      'Na tela "Situação da Contribuição", ative o débito automático e autorize uma vez (pagando o primeiro QR code). A partir daí, sua contribuição é cobrada sozinha todo mês, sem precisar abrir o Portal de novo.',
  },
  {
    pergunta: "Como recarrego minha carteira Fortuna?",
    resposta: 'Pelo menu "Adicionar Créditos" no Portal, ou aproveitando o pagamento da contribuição (o Portal sugere recarregar junto).',
  },
  {
    pergunta: "Esqueci minha senha, e agora?",
    resposta:
      "A senha inicial são os 6 primeiros números do seu CPF. Se você já trocou e não lembra mais, fale com a secretaria da escola pra redefinir.",
  },
  {
    pergunta: "Como baixo o comprovante de uma contribuição paga?",
    resposta: 'Em "Situação da Contribuição", clique no mês já pago (verde) e depois em "Baixar PDF".',
  },
  {
    pergunta: "Posso pagar com cartão de crédito?",
    resposta: "Sim — ao gerar a cobrança, escolha Cartão de Crédito em vez de PIX. O valor fica um pouco maior, cobrindo a taxa do cartão.",
  },
  {
    pergunta: "Como me inscrevo em um evento da escola?",
    resposta: 'Na Agenda, encontre o evento e toque em "Inscreva-se". Eventos pagos geram um PIX na hora; gratuitos confirmam na hora.',
  },
  {
    pergunta: "O que é o GAF?",
    resposta: "O Grupo de Acompanhamento Filosófico é um espaço de apoio na jornada filosófica, com encontros e acompanhamento por instrutores.",
  },
  {
    pergunta: "O que é a Transparência Financeira?",
    resposta: "Mostra, mês a mês, de onde vem e pra onde vai o dinheiro da escola — contribuições, eventos, despesas por categoria e mais.",
  },
];

/**
 * Central de Ajuda com FAQ — decisão do usuário 2026-09-30: perguntas
 * repetitivas respondidas ali mesmo, sem precisar de contato humano;
 * WhatsApp continua disponível pro que não estiver coberto.
 */
export function HelpPanel({ whatsapp }: { whatsapp: string }) {
  return (
    <div className="text-left">
      <ul className="mb-4 flex flex-col gap-2">
        {FAQ.map((item, i) => (
          <li key={i}>
            <details className="group rounded-lg border border-gray-100 dark:border-gray-800">
              <summary className="cursor-pointer list-none p-2.5 text-[12px] font-semibold text-gray-800 marker:content-none dark:text-gray-200">
                {item.pergunta}
              </summary>
              <p className="border-t border-gray-100 p-2.5 text-[11px] text-gray-600 dark:border-gray-800 dark:text-gray-400">{item.resposta}</p>
            </details>
          </li>
        ))}
      </ul>

      <div className="mb-4">
        <AtivarNotificacoes variante="ajustes" />
      </div>

      <div className="rounded-xl border border-gray-200 p-3 text-center dark:border-gray-700">
        <p className="mb-3 text-[11px] text-gray-500 dark:text-gray-400">Não achou o que precisava? Fale com a Economia:</p>
        <a
          href={whatsappHref(whatsapp, "Olá, preciso de ajuda com o Portal do Aluno")}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-na-green px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-na-green-dark"
        >
          Chamar no WhatsApp
        </a>
      </div>
    </div>
  );
}
