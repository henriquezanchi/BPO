"use client";

import { pedirLinkDeSenha } from "@/lib/actions/senha-actions";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

const CAMPO =
  "w-full rounded-lg border border-gray-200 p-2.5 text-[13px] text-gray-900 outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";

/** Pedido do link para criar uma senha nova. A resposta é a mesma exista ou não o e-mail. */
export function EsqueciSenha() {
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="flex min-h-screen items-center justify-center bg-na-bg p-5 dark:bg-gray-950">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <Link href="/login" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
          <ArrowLeft size={14} /> Voltar para o login
        </Link>
        <h1 className="text-lg font-black text-na-green-dark dark:text-emerald-400">Esqueci minha senha</h1>
        {enviado ? (
          <div className="flex flex-col gap-3 text-[13px] text-gray-700 dark:text-gray-300">
            <p>Se esse e-mail estiver cadastrado no Portal, enviamos um link para você criar uma senha nova. Confira a caixa de entrada e o spam.</p>
            <p className="rounded-lg bg-gray-50 p-3 text-[12px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              Não chegou em alguns minutos? Peça à secretaria da sua filial para voltar sua senha para a inicial: os 6 primeiros números do seu CPF.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const email = String(new FormData(e.currentTarget).get("email") ?? "");
              setErro(null);
              iniciar(async () => {
                const r = await pedirLinkDeSenha(email);
                if (!r.ok) return setErro("Digite um e-mail válido.");
                setEnviado(true);
              });
            }}
            className="flex flex-col gap-3"
          >
            <p className="text-[13px] text-gray-600 dark:text-gray-400">Digite o e-mail que você usa para entrar no Portal.</p>
            <input name="email" type="email" required autoComplete="email" placeholder="seu@email.com" className={CAMPO} aria-label="E-mail" />
            {erro && <p className="text-[12px] text-na-danger-dark dark:text-red-400">{erro}</p>}
            <button
              disabled={pendente}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
            >
              {pendente ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Enviar link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
