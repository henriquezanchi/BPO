"use client";

import { gerarAutoLoginAcropolePlay, getAcropolePlayStatus, salvarCredencialAcropolePlay } from "@/lib/actions/acropoleplay-actions";
import { abrirJanelaAcropolePlay, autoLoginAcropolePlay } from "@/lib/acropoleplay-auto-login";
import { Clapperboard, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

/**
 * Botão de acesso à Acrópole Play — solução PROVISÓRIA (pedido do usuário
 * 2026-10-08) enquanto não confirmamos API/SSO oficial deles: guarda
 * e-mail+senha cifrados (ver crypto-secrets.ts) e, no clique, auto-submete
 * um form escondido com essas credenciais, abrindo a Acrópole Play já
 * logada numa aba nova.
 */
export function AcropolePlayButton({ memberId }: { memberId: string }) {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getAcropolePlayStatus>> | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getAcropolePlayStatus(memberId).then(setStatus);
  }, [memberId]);

  function handleAcessar() {
    setErro(null);
    // Precisa abrir a janela JÁ, de forma síncrona, dentro do clique —
    // esperar a Server Action antes faz o navegador tratar como pop-up não
    // confiável (ver acropoleplay-auto-login.ts).
    const janela = abrirJanelaAcropolePlay();
    startTransition(async () => {
      const res = await gerarAutoLoginAcropolePlay(memberId);
      if (!res.ok) {
        janela?.close();
        setMostrarForm(true);
        return;
      }
      autoLoginAcropolePlay(res.email, res.senha, janela);
    });
  }

  function handleSalvar() {
    if (!email.trim() || !senha) {
      setErro("Preencha e-mail e senha da Acrópole Play.");
      return;
    }
    setErro(null);
    const janela = abrirJanelaAcropolePlay();
    startTransition(async () => {
      const res = await salvarCredencialAcropolePlay(memberId, email, senha);
      if (!res.ok) {
        janela?.close();
        setErro(res.error ?? "Falha ao salvar.");
        return;
      }
      autoLoginAcropolePlay(email, senha, janela);
      setStatus({ configurado: true, email });
      setMostrarForm(false);
      setSenha("");
    });
  }

  if (!status) {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green-dark px-4 py-3 text-sm font-semibold text-white opacity-60">
        <Loader2 size={16} className="animate-spin" />
      </div>
    );
  }

  if (status.configurado && !mostrarForm) {
    return (
      <div className="flex w-full flex-col gap-1">
        <button
          onClick={handleAcessar}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green-dark px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Clapperboard size={16} />} Acrópole Play — vídeos e séries
        </button>
        <button onClick={() => setMostrarForm(true)} className="self-center text-[11px] text-gray-400 underline">
          Trocar e-mail/senha salvos
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
      <p className="text-[12px] font-semibold text-gray-900 dark:text-gray-100">Conectar com a Acrópole Play</p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">Salve seu e-mail e senha de lá 1 vez — o Portal abre já logado nas próximas.</p>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-mail da Acrópole Play"
        type="email"
        className="rounded-lg border border-gray-200 p-2 text-[13px] text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />
      <input
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Senha da Acrópole Play"
        type="password"
        className="rounded-lg border border-gray-200 p-2 text-[13px] text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />
      <button
        onClick={handleSalvar}
        disabled={isPending}
        className="flex items-center justify-center gap-2 rounded-xl bg-na-green-dark px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : "Salvar e acessar"}
      </button>
      {status.configurado && (
        <button onClick={() => setMostrarForm(false)} className="text-[11px] text-gray-400 underline">
          Cancelar
        </button>
      )}
      {erro && <p className="text-[11px] text-red-600 dark:text-red-400">{erro}</p>}
    </div>
  );
}
