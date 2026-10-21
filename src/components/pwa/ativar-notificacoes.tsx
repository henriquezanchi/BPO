"use client";

import { chavePublicaPush, enviarNotificacaoTeste, removerInscricaoPush, salvarInscricaoPush } from "@/lib/actions/push-actions";
import { Bell, BellOff, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";

/**
 * Notificações push do PWA (2026-10-21). Duas formas:
 *  - "cartao": convite na tela inicial, some depois de ativado ou dispensado;
 *  - "ajustes": controle permanente (painel de Ajuda), para ativar, testar ou desligar.
 * No iPhone o Safari só permite notificação com o Portal instalado na tela de
 * início (iOS 16.4+); antes disso o banner de instalação já orienta.
 */
type Estado = "carregando" | "indisponivel" | "sem_suporte" | "instalar_iphone" | "bloqueado" | "desativado" | "ativo";

const CHAVE_DISPENSADO = "na-notificacoes-dispensado";
const ouvintes = new Set<() => void>();
const inscrever = (f: () => void) => (ouvintes.add(f), () => ouvintes.delete(f));
const lerDispensado = () => {
  try {
    return localStorage.getItem(CHAVE_DISPENSADO) === "1";
  } catch {
    return false;
  }
};

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

export function AtivarNotificacoes({ variante = "cartao" }: { variante?: "cartao" | "ajustes" }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const dispensado = useSyncExternalStore(inscrever, lerDispensado, () => true);

  useEffect(() => {
    estadoAtual()
      .then(setEstado)
      .catch(() => setEstado("sem_suporte"));
  }, []);

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

  function dispensar() {
    try {
      localStorage.setItem(CHAVE_DISPENSADO, "1");
    } catch {
      /* sem localStorage: só não lembra */
    }
    ouvintes.forEach((f) => f());
  }

  if (variante === "cartao") {
    if (dispensado || estado !== "desativado") return mensagem ? <p className="rounded-xl bg-na-success-light p-3 text-[12px] text-na-success-dark dark:bg-emerald-950/30 dark:text-emerald-300">{mensagem}</p> : null;
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-na-green/30 bg-na-green-light p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-na-green text-white">
          <Bell size={16} />
        </span>
        <div className="flex-1">
          <p className="text-[13px] font-bold text-na-green-dark dark:text-emerald-300">Receba os avisos no celular</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-gray-700 dark:text-gray-300">Lembrete dos encontros, atividades novas e respostas da secretaria, mesmo com o Portal fechado.</p>
          <button
            onClick={ativar}
            disabled={pendente}
            className="mt-2.5 rounded-xl bg-na-green px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
          >
            {pendente ? "Ativando..." : "Ativar notificações"}
          </button>
          {mensagem && <p className="mt-2 text-[11px] text-na-danger-dark dark:text-red-300">{mensagem}</p>}
        </div>
        <button onClick={dispensar} aria-label="Agora não" className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X size={14} />
        </button>
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
