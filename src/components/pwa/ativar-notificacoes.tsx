"use client";

import { chavePublicaPush, enviarNotificacaoTeste, removerInscricaoPush, salvarInscricaoPush } from "@/lib/actions/push-actions";
import { Bell, BellOff } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

/**
 * Notificações push do PWA (2026-10-21). Duas formas:
 *  - "cartao": convite em janela (pedido do usuário 2026-10-25) — "Sim", "Não" (só "Não" encerra o
 *    convite neste aparelho) e "Pergunte-me depois" (volta em 7 dias). Também abre no momento certo,
 *    por pedirNotificacoes(), depois de inscrição em evento, pedido de GAF ou resposta a encontro;
 *  - "ajustes": controle permanente (painel de Ajuda), para ativar, testar ou desligar.
 * No iPhone o Safari só permite notificação com o Portal instalado na tela de
 * início (iOS 16.4+); antes disso o banner de instalação já orienta.
 */
type Estado = "carregando" | "indisponivel" | "sem_suporte" | "instalar_iphone" | "bloqueado" | "desativado" | "ativo";

// Resposta ao convite neste aparelho: "nao" (não perguntar mais) ou "depois:<ms>" (perguntar de novo a partir de <ms>).
const CHAVE_RESPOSTA = "na-notificacoes-resposta";
const ADIAR_MS = 7 * 24 * 60 * 60 * 1000;
const EVENTO_PEDIR = "na:pedir-notificacoes";

function lerResposta(): { nao: boolean; adiadoAte: number } {
  try {
    const v = localStorage.getItem(CHAVE_RESPOSTA) ?? "";
    return { nao: v === "nao", adiadoAte: v.startsWith("depois:") ? Number(v.slice(7)) || 0 : 0 };
  } catch {
    return { nao: false, adiadoAte: 0 };
  }
}
function gravarResposta(v: string) {
  try {
    localStorage.setItem(CHAVE_RESPOSTA, v);
  } catch {
    /* sem localStorage: só não lembra */
  }
}

/** Abre o convite no momento certo (ex.: depois de se inscrever num evento). Não abre se a pessoa disse "Não". */
export function pedirNotificacoes(motivo?: string) {
  window.dispatchEvent(new CustomEvent(EVENTO_PEDIR, { detail: motivo ?? null }));
}

function base64ParaBytes(base64: string) {
  const preenchimento = "=".repeat((4 - (base64.length % 4)) % 4);
  const bruto = atob((base64 + preenchimento).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

async function estadoAtual(): Promise<Estado> {
  const iphone = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const instalado = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return iphone && !instalado ? "instalar_iphone" : "sem_suporte";
  if (!(await chavePublicaPush())) return "indisponivel"; // chaves VAPID ainda não configuradas no servidor
  if (Notification.permission === "denied") return "bloqueado";
  const registro = await navigator.serviceWorker.getRegistration("/");
  const inscricao = await registro?.pushManager.getSubscription();
  if (inscricao && Notification.permission === "granted") {
    // Garante que o servidor conhece este aparelho para a pessoa logada agora.
    salvarInscricaoPush(inscricao.toJSON() as Parameters<typeof salvarInscricaoPush>[0], navigator.userAgent).catch(() => {});
    return "ativo";
  }
  return "desativado";
}

/** `aguardar`: não abre sozinho nesta visita (ex.: durante o tour do 1º acesso); pedidos por ação continuam valendo. */
export function AtivarNotificacoes({ variante = "cartao", aguardar = false }: { variante?: "cartao" | "ajustes"; aguardar?: boolean }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  // Convite em janela: aberto (com o motivo, quando veio de uma ação) ou fechado.
  const [convite, setConvite] = useState<{ motivo: string | null } | null>(null);

  useEffect(() => {
    estadoAtual()
      .then(setEstado)
      .catch(() => setEstado("sem_suporte"));
  }, []);

  // Convite: sozinho, alguns segundos depois de abrir o Portal (fora do tour e do adiamento); ou quando uma ação pede.
  const podeConvidar = variante === "cartao" && (estado === "desativado" || estado === "instalar_iphone");
  useEffect(() => {
    if (!podeConvidar) return;
    const aoPedir = (e: Event) => {
      if (!lerResposta().nao) setConvite({ motivo: (e as CustomEvent<string | null>).detail });
    };
    window.addEventListener(EVENTO_PEDIR, aoPedir);
    const r = lerResposta();
    const t = !aguardar && !r.nao && r.adiadoAte <= Date.now() ? setTimeout(() => setConvite({ motivo: null }), 3000) : undefined;
    return () => {
      window.removeEventListener(EVENTO_PEDIR, aoPedir);
      if (t) clearTimeout(t);
    };
  }, [podeConvidar, aguardar]);

  function ativar() {
    setMensagem(null);
    iniciar(async () => {
      try {
        const chave = await chavePublicaPush();
        if (!chave) {
          setMensagem("As notificações ainda não foram liberadas no Portal. Tente de novo mais tarde.");
          return;
        }
        const permissao = await Notification.requestPermission();
        if (permissao !== "granted") {
          setEstado(permissao === "denied" ? "bloqueado" : "desativado");
          return;
        }
        const registro = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
        await navigator.serviceWorker.ready;
        const inscricao = (await registro.pushManager.getSubscription()) ?? (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaBytes(chave) }));
        await salvarInscricaoPush(inscricao.toJSON() as Parameters<typeof salvarInscricaoPush>[0], navigator.userAgent);
        setEstado("ativo");
        gravarResposta("sim");
        setConvite(null);
        const teste = await enviarNotificacaoTeste();
        setMensagem(teste.ok ? "Pronto. Enviamos uma notificação de teste para este aparelho." : "Ativado, mas o teste não chegou. Tente de novo em instantes.");
      } catch (e) {
        console.error(e);
        setMensagem("Não foi possível ativar agora. Tente de novo.");
      }
    });
  }

  function desativar() {
    iniciar(async () => {
      const registro = await navigator.serviceWorker.getRegistration("/");
      const inscricao = await registro?.pushManager.getSubscription();
      if (inscricao) {
        await removerInscricaoPush(inscricao.endpoint);
        await inscricao.unsubscribe();
      }
      setEstado("desativado");
      setMensagem("Notificações desligadas neste aparelho.");
    });
  }

  function testar() {
    iniciar(async () => {
      const r = await enviarNotificacaoTeste();
      setMensagem(r.ok ? "Notificação de teste enviada." : "O teste não chegou. Desligue e ative de novo.");
    });
  }

  function responder(resposta: "nao" | "depois") {
    gravarResposta(resposta === "nao" ? "nao" : `depois:${Date.now() + ADIAR_MS}`);
    setConvite(null);
  }

  if (variante === "cartao") {
    if (!convite || !podeConvidar)
      return mensagem ? <p className="rounded-xl bg-na-success-light p-3 text-[12px] text-na-success-dark dark:bg-emerald-950/30 dark:text-emerald-300">{mensagem}</p> : null;
    const iphone = estado === "instalar_iphone";
    return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="convite-notificacoes">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-na-green text-white">
            <Bell size={18} />
          </span>
          {convite.motivo && <p className="mt-3 text-[12px] font-semibold text-na-green-dark dark:text-emerald-400">{convite.motivo}</p>}
          <h2 id="convite-notificacoes" className="mt-2 text-[15px] font-bold text-gray-900 dark:text-gray-100">
            Aceita receber notificações sobre eventos, contribuições e muito mais?
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
            {iphone
              ? "No iPhone, primeiro instale o Portal: toque em compartilhar e depois em \u201cAdicionar à Tela de Início\u201d. Abra pelo ícone e responda \u201cSim\u201d aqui."
              : "Eventos da sua escola, lembretes dos encontros e da contribuição, mesmo com o Portal fechado. Dá para desligar quando quiser em Ajuda."}
          </p>
          {mensagem && <p className="mt-2 text-[11px] text-na-danger-dark dark:text-red-300">{mensagem}</p>}
          <div className="mt-4 flex flex-col gap-2">
            {!iphone && (
              <button onClick={ativar} disabled={pendente} className="rounded-xl bg-na-green px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60">
                {pendente ? "Ativando..." : "Sim"}
              </button>
            )}
            <button onClick={() => responder("depois")} className="rounded-xl border border-gray-300 px-4 py-2.5 text-[13px] font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
              Pergunte-me depois
            </button>
            <button onClick={() => responder("nao")} className="px-4 py-2 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
              Não
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 p-3 text-left dark:border-gray-700">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-800 dark:text-gray-200">
        {estado === "ativo" ? <Bell size={13} /> : <BellOff size={13} />} Notificações neste aparelho
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
        {estado === "carregando" && "Verificando..."}
        {estado === "indisponivel" && "Em breve: as notificações no celular estão sendo liberadas no Portal."}
        {estado === "ativo" && "Ativas. Você recebe lembretes dos encontros, atividades novas e respostas da secretaria."}
        {estado === "desativado" && "Desligadas. Ative para receber lembretes dos encontros e avisos, mesmo com o Portal fechado."}
        {estado === "bloqueado" && "Bloqueadas nas configurações do navegador. Libere as notificações para este site nas configurações do celular e volte aqui."}
        {estado === "instalar_iphone" && "No iPhone, primeiro instale o Portal: toque em compartilhar e depois em \"Adicionar à Tela de Início\". Abra pelo ícone e ative aqui."}
        {estado === "sem_suporte" && "Este navegador não recebe notificações. No Android, use o Chrome; no iPhone, instale o Portal na tela de início."}
      </p>
      {(estado === "ativo" || estado === "desativado") && (
        <div className="mt-2 flex flex-wrap gap-2">
          {estado === "desativado" ? (
            <button onClick={ativar} disabled={pendente} className="rounded-lg bg-na-green px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">
              {pendente ? "Ativando..." : "Ativar"}
            </button>
          ) : (
            <>
              <button onClick={testar} disabled={pendente} className="rounded-lg border border-gray-300 px-3 py-1.5 text-[11px] font-semibold text-gray-700 disabled:opacity-60 dark:border-gray-600 dark:text-gray-300">
                Enviar teste
              </button>
              <button onClick={desativar} disabled={pendente} className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-gray-500 disabled:opacity-60 dark:text-gray-400">
                Desligar
              </button>
            </>
          )}
        </div>
      )}
      {mensagem && <p className="mt-2 text-[11px] text-gray-600 dark:text-gray-400">{mensagem}</p>}
    </div>
  );
}
