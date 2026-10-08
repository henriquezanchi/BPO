"use client";

import { gerarAutoLoginAcropolePlay, getAcropolePlayStatus, salvarCredencialAcropolePlay } from "@/lib/actions/acropoleplay-actions";
import { Clapperboard, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

// URL e nomes de campo confirmados ao vivo em 2026-10-08 (inspecionado
// direto no HTML de https://membros.acropoleplay.com/auth/login) — é um
// form Laravel-like, mas a rota NÃO valida de verdade o token CSRF (testado
// ao vivo: POST com _token proposital errado, numa janela anônima sem
// nenhuma sessão prévia, ainda assim loga e redireciona pra /area/vitrine/
// home) — por isso um valor fixo/qualquer no campo _token é suficiente.
const LOGIN_URL = "https://membros.acropoleplay.com/auth/login";
const CAMPO_EMAIL = "Acesso[email]";
const CAMPO_SENHA = "Acesso[senha]";
const CAMPO_TOKEN = "_token";

/** Monta e submete um form escondido no PRÓPRIO navegador do membro — é o navegador dele que precisa logar de verdade, não o nosso servidor (cookie de sessão é por domínio, não dá pra "transferir" de outro jeito). */
function autoSubmeterLogin(email: string, senha: string) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = LOGIN_URL;
  form.target = "_blank";

  const campos: [string, string][] = [
    [CAMPO_TOKEN, "portal-na"],
    [CAMPO_EMAIL, email],
    [CAMPO_SENHA, senha],
  ];
  for (const [nome, valor] of campos) {
    const campo = document.createElement("input");
    campo.type = "hidden";
    campo.name = nome;
    campo.value = valor;
    form.appendChild(campo);
  }

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

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
    startTransition(async () => {
      const res = await gerarAutoLoginAcropolePlay(memberId);
      if (!res.ok) {
        setMostrarForm(true);
        return;
      }
      autoSubmeterLogin(res.email, res.senha);
    });
  }

  function handleSalvar() {
    if (!email.trim() || !senha) {
      setErro("Preencha e-mail e senha da Acrópole Play.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const res = await salvarCredencialAcropolePlay(memberId, email, senha);
      if (!res.ok) {
        setErro(res.error ?? "Falha ao salvar.");
        return;
      }
      autoSubmeterLogin(email, senha);
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
